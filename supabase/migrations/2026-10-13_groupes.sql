-- COP-PILOT · groupes de travail : membres, notes partagées, révisions en commun.
-- À exécuter une fois dans Supabase › SQL Editor (après les migrations précédentes :
-- la fonction public.mfa_ok() doit exister).
--
-- Principes :
-- - on ne voit un groupe, ses notes et ses révisions que si l'on en est membre ;
-- - l'appartenance est vérifiée par des fonctions security definer (pas de récursion RLS) ;
-- - entrer dans un groupe ne se fait QUE par son code d'invitation (fonction join_group) ;
-- - les autres membres ne voient que le prénom (profiles.name), jamais l'adresse e-mail ;
-- - la double authentification s'applique partout (règle restrictive + contrôle dans les fonctions).

-- ── Tables ─────────────────────────────────────────────────────────────────
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  color text check (color is null or color ~ '^#[0-9a-f]{6}$'),
  invite_code text not null unique check (invite_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  -- null le temps d'un transfert (compte supprimé) : le déclencheur plus bas désigne un nouveau propriétaire.
  owner_id uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user on public.group_members (user_id);

create table if not exists public.group_notes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  title text not null default 'Sans titre' check (char_length(title) <= 200),
  content text not null default '' check (char_length(content) <= 500000),
  created_by uuid default auth.uid() references auth.users on delete set null,
  updated_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists group_notes_group on public.group_notes (group_id, updated_at desc);

create table if not exists public.group_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  date date not null,
  start_time text check (start_time is null or start_time ~ '^\d{2}:\d{2}$'),
  end_time text check (end_time is null or end_time ~ '^\d{2}:\d{2}$'),
  place text check (place is null or char_length(place) <= 300),
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (id, group_id) -- cible de la clé étrangère composite des présences
);
create index if not exists group_events_group on public.group_events (group_id, date);

create table if not exists public.group_event_attendees (
  event_id uuid not null,
  group_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id),
  -- la présence appartient forcément au groupe de l'événement
  foreign key (event_id, group_id) references public.group_events (id, group_id) on delete cascade
);
create index if not exists group_event_attendees_group on public.group_event_attendees (group_id);

-- Essais de codes d'invitation (limite les essais au hasard). Illisible depuis l'API.
create table if not exists public.group_join_attempts (
  user_id uuid not null references auth.users on delete cascade,
  at timestamptz not null default now()
);
create index if not exists group_join_attempts_user on public.group_join_attempts (user_id, at);

-- ── Fonctions d'appartenance (security definer : lisent group_members sans repasser par la RLS) ─
create or replace function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid());
$$;
revoke all on function public.is_group_member(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;

create or replace function public.is_group_owner(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.groups where id = gid and owner_id = auth.uid());
$$;
revoke all on function public.is_group_owner(uuid) from public, anon;
grant execute on function public.is_group_owner(uuid) to authenticated;

-- Code de 6 caractères sans ambiguïté (pas de 0/O, 1/I/L), tiré au hasard cryptographique.
create or replace function public.new_group_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  b bytea;
begin
  loop
    b := pg_catalog.uuid_send(pg_catalog.gen_random_uuid());
    code := '';
    for i in 0..5 loop
      code := code || substr(alphabet, 1 + (get_byte(b, i) % length(alphabet)), 1);
    end loop;
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;
  return code;
end;
$$;
revoke all on function public.new_group_code() from public, anon, authenticated;

-- ── Déclencheurs ───────────────────────────────────────────────────────────
-- Notes : date et auteur de la dernière modification posés par la base, groupe et créateur figés.
create or replace function public.group_notes_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.group_id := old.group_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
drop trigger if exists group_notes_touch on public.group_notes;
create trigger group_notes_touch before insert or update on public.group_notes
  for each row execute procedure public.group_notes_touch();

create or replace function public.group_events_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.group_id := old.group_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
drop trigger if exists group_events_touch on public.group_events;
create trigger group_events_touch before insert or update on public.group_events
  for each row execute procedure public.group_events_touch();

-- Départ d'un membre (quitter, être retiré, compte supprimé) : un groupe vide disparaît,
-- un groupe sans propriétaire est confié au plus ancien membre restant.
create or replace function public.group_members_after_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  heir uuid;
begin
  if not exists (select 1 from public.groups where id = old.group_id) then
    return old; -- le groupe lui-même est en cours de suppression
  end if;
  delete from public.group_event_attendees where group_id = old.group_id and user_id = old.user_id;
  select user_id into heir from public.group_members
    where group_id = old.group_id order by joined_at, user_id limit 1;
  if heir is null then
    delete from public.groups where id = old.group_id;
  else
    update public.groups set owner_id = heir
      where id = old.group_id and (owner_id is null or owner_id = old.user_id);
  end if;
  return old;
end;
$$;
revoke all on function public.group_members_after_delete() from public, anon, authenticated;
drop trigger if exists group_members_after_delete on public.group_members;
create trigger group_members_after_delete after delete on public.group_members
  for each row execute procedure public.group_members_after_delete();

-- ── Sécurité (Row Level Security) ──────────────────────────────────────────
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_notes enable row level security;
alter table public.group_events enable row level security;
alter table public.group_event_attendees enable row level security;
alter table public.group_join_attempts enable row level security; -- aucune règle : illisible depuis l'API

-- Groupes : visibles par leurs membres ; seul le propriétaire renomme / change la couleur / supprime.
-- Création et code d'invitation : uniquement via les fonctions plus bas.
drop policy if exists "groupes : membres" on public.groups;
create policy "groupes : membres" on public.groups for select to authenticated
  using ((select public.is_group_member(id)));
drop policy if exists "groupes : propriétaire modifie" on public.groups;
create policy "groupes : propriétaire modifie" on public.groups for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "groupes : propriétaire supprime" on public.groups;
create policy "groupes : propriétaire supprime" on public.groups for delete to authenticated
  using (owner_id = (select auth.uid()));
revoke insert, update on public.groups from anon, authenticated;
grant update (name, color) on public.groups to authenticated;

-- Membres : visibles entre membres ; on peut se retirer soi-même, le propriétaire peut retirer
-- n'importe qui. Pas d'ajout direct : join_group / create_group.
drop policy if exists "membres : lecture" on public.group_members;
create policy "membres : lecture" on public.group_members for select to authenticated
  using ((select public.is_group_member(group_id)));
drop policy if exists "membres : départ" on public.group_members;
create policy "membres : départ" on public.group_members for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_group_owner(group_id)));
revoke insert, update on public.group_members from anon, authenticated;

-- Notes partagées : tout membre lit, crée, modifie et supprime.
drop policy if exists "notes de groupe : membres" on public.group_notes;
create policy "notes de groupe : membres" on public.group_notes for all to authenticated
  using ((select public.is_group_member(group_id))) with check ((select public.is_group_member(group_id)));

-- Révisions : tout membre lit et propose ; l'auteur ou le propriétaire modifie / supprime.
drop policy if exists "révisions : lecture" on public.group_events;
create policy "révisions : lecture" on public.group_events for select to authenticated
  using ((select public.is_group_member(group_id)));
drop policy if exists "révisions : ajout" on public.group_events;
create policy "révisions : ajout" on public.group_events for insert to authenticated
  with check ((select public.is_group_member(group_id)));
drop policy if exists "révisions : modification" on public.group_events;
create policy "révisions : modification" on public.group_events for update to authenticated
  using ((select public.is_group_member(group_id)) and (created_by = (select auth.uid()) or (select public.is_group_owner(group_id))))
  with check ((select public.is_group_member(group_id)));
drop policy if exists "révisions : suppression" on public.group_events;
create policy "révisions : suppression" on public.group_events for delete to authenticated
  using ((select public.is_group_member(group_id)) and (created_by = (select auth.uid()) or (select public.is_group_owner(group_id))));

-- Présences (« Je viens ») : visibles des membres, chacun ne gère que la sienne.
drop policy if exists "présences : lecture" on public.group_event_attendees;
create policy "présences : lecture" on public.group_event_attendees for select to authenticated
  using ((select public.is_group_member(group_id)));
drop policy if exists "présences : je viens" on public.group_event_attendees;
create policy "présences : je viens" on public.group_event_attendees for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_group_member(group_id)));
drop policy if exists "présences : je ne viens plus" on public.group_event_attendees;
create policy "présences : je ne viens plus" on public.group_event_attendees for delete to authenticated
  using (user_id = (select auth.uid()));
revoke update on public.group_event_attendees from anon, authenticated;

-- Double authentification obligatoire, comme partout ailleurs.
do $$
declare t text;
begin
  foreach t in array array['groups', 'group_members', 'group_notes', 'group_events', 'group_event_attendees', 'group_join_attempts'] loop
    execute format('drop policy if exists "2fa obligatoire" on public.%I', t);
    execute format('create policy "2fa obligatoire" on public.%I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
  end loop;
end $$;

-- ── Fonctions appelées par l'application ───────────────────────────────────
-- Les fonctions security definer contournent la RLS : elles vérifient elles-mêmes la session et la 2FA.

-- Crée un groupe et en fait de soi le propriétaire.
create or replace function public.create_group(p_name text, p_color text default null) returns public.groups
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  g public.groups;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not public.mfa_ok() then raise exception 'mfa required'; end if;
  if (select count(*) from public.group_members where user_id = me) >= 30 then
    raise exception 'too many groups';
  end if;
  insert into public.groups (name, color, invite_code, owner_id)
    values (btrim(p_name), nullif(lower(p_color), ''), public.new_group_code(), me)
    returning * into g;
  insert into public.group_members (group_id, user_id) values (g.id, me);
  return g;
end;
$$;
revoke all on function public.create_group(text, text) from public, anon;
grant execute on function public.create_group(text, text) to authenticated;

-- Rejoint un groupe avec son code. Renvoie l'identifiant du groupe, ou null si le code n'existe pas.
-- Au-delà de 15 codes faux en 15 minutes, les essais sont refusés.
create or replace function public.join_group(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  gid uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not public.mfa_ok() then raise exception 'mfa required'; end if;
  if (select count(*) from public.group_join_attempts where user_id = me and at > now() - interval '15 minutes') >= 15 then
    raise exception 'too many attempts';
  end if;
  select id into gid from public.groups where invite_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if gid is null then
    delete from public.group_join_attempts where user_id = me and at < now() - interval '1 day';
    insert into public.group_join_attempts (user_id) values (me);
    return null;
  end if;
  if exists (select 1 from public.group_members where group_id = gid and user_id = me) then
    return gid;
  end if;
  if (select count(*) from public.group_members where group_id = gid) >= 50 then
    raise exception 'group full';
  end if;
  if (select count(*) from public.group_members where user_id = me) >= 30 then
    raise exception 'too many groups';
  end if;
  insert into public.group_members (group_id, user_id) values (gid, me);
  return gid;
end;
$$;
revoke all on function public.join_group(text) from public, anon;
grant execute on function public.join_group(text) to authenticated;

-- Nouveau code d'invitation (l'ancien cesse de marcher). Propriétaire seulement.
create or replace function public.regenerate_group_code(p_group uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.mfa_ok() then raise exception 'mfa required'; end if;
  if not public.is_group_owner(p_group) then raise exception 'forbidden'; end if;
  code := public.new_group_code();
  update public.groups set invite_code = code where id = p_group;
  return code;
end;
$$;
revoke all on function public.regenerate_group_code(uuid) from public, anon;
grant execute on function public.regenerate_group_code(uuid) to authenticated;

-- Membres d'un groupe avec leur prénom (jamais l'e-mail). Réservé aux membres de ce groupe.
create or replace function public.group_member_list(p_group uuid)
returns table (user_id uuid, name text, joined_at timestamptz, is_owner boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.mfa_ok() then raise exception 'mfa required'; end if;
  if not public.is_group_member(p_group) then raise exception 'forbidden'; end if;
  return query
    select m.user_id, coalesce(nullif(btrim(p.name), ''), 'Membre'), m.joined_at, (g.owner_id = m.user_id)
    from public.group_members m
    join public.groups g on g.id = m.group_id
    left join public.profiles p on p.id = m.user_id
    where m.group_id = p_group
    order by m.joined_at;
end;
$$;
revoke all on function public.group_member_list(uuid) from public, anon;
grant execute on function public.group_member_list(uuid) to authenticated;

-- ── Temps réel : les membres voient les modifications des autres en direct ─
-- (Supabase Realtime applique la RLS ci-dessus à chaque abonné.)
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['groups', 'group_members', 'group_notes', 'group_events', 'group_event_attendees'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
