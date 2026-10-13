-- COP-PILOT · groupes : droits des membres (lecteur / éditeur, droit d'inviter) et fichiers partagés.
-- À exécuter une fois dans Supabase › SQL Editor, après 2026-10-13_groupes.sql.
--
-- Principes :
-- - le propriétaire a toujours tous les droits ; il choisit pour chaque membre :
--   « lecteur » (lit tout, dit s'il vient, peut partir) ou « éditeur » (ajoute, modifie, supprime
--   notes, fichiers et révisions), et s'il peut voir le code d'invitation ;
-- - tout est vérifié par la base (RLS + fonctions security definer), l'interface ne fait que suivre ;
-- - le code d'invitation n'est plus lisible dans la table groups (droits par colonne) : seule la
--   fonction group_invite_code le donne, au propriétaire et aux membres autorisés ;
-- - fichiers : table group_files + bucket privé « groups », objets rangés en <group_id>/<file_id>.

-- ── Droits des membres ─────────────────────────────────────────────────────
alter table public.group_members add column if not exists role text not null default 'editeur'
  check (role in ('lecteur', 'editeur'));
alter table public.group_members add column if not exists can_invite boolean not null default true;

-- Peut modifier le contenu du groupe : propriétaire, ou membre éditeur.
create or replace function public.can_edit_group(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.groups where id = gid and owner_id = auth.uid())
      or exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid() and role = 'editeur');
$$;
revoke all on function public.can_edit_group(uuid) from public, anon;
grant execute on function public.can_edit_group(uuid) to authenticated;

-- Notes partagées : tout membre lit ; seuls les éditeurs (et le propriétaire) créent, modifient, suppriment.
drop policy if exists "notes de groupe : membres" on public.group_notes;
drop policy if exists "notes de groupe : lecture" on public.group_notes;
create policy "notes de groupe : lecture" on public.group_notes for select to authenticated
  using ((select public.is_group_member(group_id)));
drop policy if exists "notes de groupe : ajout" on public.group_notes;
create policy "notes de groupe : ajout" on public.group_notes for insert to authenticated
  with check ((select public.can_edit_group(group_id)));
drop policy if exists "notes de groupe : modification" on public.group_notes;
create policy "notes de groupe : modification" on public.group_notes for update to authenticated
  using ((select public.can_edit_group(group_id))) with check ((select public.can_edit_group(group_id)));
drop policy if exists "notes de groupe : suppression" on public.group_notes;
create policy "notes de groupe : suppression" on public.group_notes for delete to authenticated
  using ((select public.can_edit_group(group_id)));

-- Révisions : les éditeurs proposent ; l'auteur (s'il est encore éditeur) ou le propriétaire modifie / annule.
drop policy if exists "révisions : ajout" on public.group_events;
create policy "révisions : ajout" on public.group_events for insert to authenticated
  with check ((select public.can_edit_group(group_id)));
drop policy if exists "révisions : modification" on public.group_events;
create policy "révisions : modification" on public.group_events for update to authenticated
  using ((select public.can_edit_group(group_id)) and (created_by = (select auth.uid()) or (select public.is_group_owner(group_id))))
  with check ((select public.can_edit_group(group_id)));
drop policy if exists "révisions : suppression" on public.group_events;
create policy "révisions : suppression" on public.group_events for delete to authenticated
  using ((select public.can_edit_group(group_id)) and (created_by = (select auth.uid()) or (select public.is_group_owner(group_id))));
-- (Présences « Je viens » : inchangées, tout membre gère la sienne.)

-- ── Code d'invitation : plus lisible directement ───────────────────────────
-- Lecture de groups colonne par colonne, sans invite_code.
revoke select on public.groups from anon, authenticated;
grant select (id, name, color, owner_id, created_at) on public.groups to authenticated;

-- Le code, pour le propriétaire et les membres autorisés à inviter ; null pour les autres.
create or replace function public.group_invite_code(p_group uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.mfa_ok() then raise exception 'mfa required'; end if;
  return (
    select g.invite_code from public.groups g
    where g.id = p_group
      and (g.owner_id = auth.uid()
           or exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = auth.uid() and m.can_invite))
  );
end;
$$;
revoke all on function public.group_invite_code(uuid) from public, anon;
grant execute on function public.group_invite_code(uuid) to authenticated;

-- Le propriétaire règle les droits d'un membre (pas les siens : il a toujours tout).
create or replace function public.set_member_rights(p_group uuid, p_member uuid, p_role text, p_can_invite boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.mfa_ok() then raise exception 'mfa required'; end if;
  if not public.is_group_owner(p_group) then raise exception 'forbidden'; end if;
  if p_role is null or p_role not in ('lecteur', 'editeur') or p_can_invite is null then raise exception 'invalid rights'; end if;
  if exists (select 1 from public.groups where id = p_group and owner_id = p_member) then raise exception 'forbidden'; end if;
  update public.group_members set role = p_role, can_invite = p_can_invite
    where group_id = p_group and user_id = p_member;
  if not found then raise exception 'not a member'; end if;
end;
$$;
revoke all on function public.set_member_rights(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.set_member_rights(uuid, uuid, text, boolean) to authenticated;

-- La liste des membres donne aussi leurs droits (le type de retour change : on recrée).
drop function if exists public.group_member_list(uuid);
create function public.group_member_list(p_group uuid)
returns table (user_id uuid, name text, joined_at timestamptz, is_owner boolean, role text, can_invite boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.mfa_ok() then raise exception 'mfa required'; end if;
  if not public.is_group_member(p_group) then raise exception 'forbidden'; end if;
  return query
    select m.user_id, coalesce(nullif(btrim(p.name), ''), 'Membre'), m.joined_at, (g.owner_id = m.user_id),
           case when g.owner_id = m.user_id then 'editeur' else m.role end,
           (g.owner_id = m.user_id or m.can_invite)
    from public.group_members m
    join public.groups g on g.id = m.group_id
    left join public.profiles p on p.id = m.user_id
    where m.group_id = p_group
    order by m.joined_at;
end;
$$;
revoke all on function public.group_member_list(uuid) from public, anon;
grant execute on function public.group_member_list(uuid) to authenticated;

-- ── Fichiers partagés ──────────────────────────────────────────────────────
create table if not exists public.group_files (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 255),
  mime text check (mime is null or char_length(mime) <= 200),
  size bigint not null default 0 check (size between 0 and 52428800), -- 50 Mo
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists group_files_group on public.group_files (group_id, created_at desc);

create or replace function public.group_files_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.id := old.id;
    new.group_id := old.group_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
drop trigger if exists group_files_touch on public.group_files;
create trigger group_files_touch before insert or update on public.group_files
  for each row execute procedure public.group_files_touch();

alter table public.group_files enable row level security;
drop policy if exists "fichiers de groupe : lecture" on public.group_files;
create policy "fichiers de groupe : lecture" on public.group_files for select to authenticated
  using ((select public.is_group_member(group_id)));
drop policy if exists "fichiers de groupe : ajout" on public.group_files;
create policy "fichiers de groupe : ajout" on public.group_files for insert to authenticated
  with check ((select public.can_edit_group(group_id)));
drop policy if exists "fichiers de groupe : suppression" on public.group_files;
create policy "fichiers de groupe : suppression" on public.group_files for delete to authenticated
  using ((select public.can_edit_group(group_id)));
revoke update on public.group_files from anon, authenticated; -- pas de renommage : on supprime et on repartage
drop policy if exists "2fa obligatoire" on public.group_files;
create policy "2fa obligatoire" on public.group_files as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

-- ── Stockage : bucket privé « groups », objets en <group_id>/<file_id> ─────
insert into storage.buckets (id, name, public, file_size_limit)
values ('groups', 'groups', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Accès à un chemin du bucket : membre du groupe nommé par le premier dossier (éditeur si p_edit).
-- Compare en texte : aucun cast qui pourrait échouer sur un objet d'un autre bucket.
create or replace function public.group_path_access(p_path text, p_edit boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    join public.groups g on g.id = m.group_id
    where m.group_id::text = (storage.foldername(p_path))[1]
      and m.user_id = auth.uid()
      and (not p_edit or m.role = 'editeur' or g.owner_id = auth.uid())
  );
$$;
revoke all on function public.group_path_access(text, boolean) from public, anon;
grant execute on function public.group_path_access(text, boolean) to authenticated;

drop policy if exists "groupes : lire les fichiers" on storage.objects;
create policy "groupes : lire les fichiers" on storage.objects for select to authenticated
  using (bucket_id = 'groups' and (select public.group_path_access(name, false)));
drop policy if exists "groupes : ajouter des fichiers" on storage.objects;
create policy "groupes : ajouter des fichiers" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'groups'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (select public.group_path_access(name, true))
  );
drop policy if exists "groupes : supprimer des fichiers" on storage.objects;
create policy "groupes : supprimer des fichiers" on storage.objects for delete to authenticated
  using (bucket_id = 'groups' and (select public.group_path_access(name, true)));
-- Pas de règle « update » : un fichier partagé ne se remplace pas.

drop policy if exists "groupes : 2fa obligatoire" on storage.objects;
create policy "groupes : 2fa obligatoire" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'groups' or (select public.mfa_ok()))
  with check (bucket_id <> 'groups' or (select public.mfa_ok()));

-- ── Temps réel ─────────────────────────────────────────────────────────────
-- groups sort de la publication : Realtime ne respecte pas de façon sûre les droits par colonne
-- et enverrait le code d'invitation. L'application relit la liste des groupes quand group_members
-- change (suppression du groupe en cascade, départs) et au retour sur l'onglet.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'groups') then
      alter publication supabase_realtime drop table public.groups;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_files') then
      alter publication supabase_realtime add table public.group_files;
    end if;
  end if;
end $$;
