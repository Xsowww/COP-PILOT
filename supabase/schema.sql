-- COP-PILOT · schéma Supabase
-- À coller une seule fois dans Supabase › SQL Editor › New query, puis « Run ».
-- Chaque étudiant ne peut lire et modifier QUE ses propres données (Row Level Security).

-- ── Profil et réglages ─────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  settings jsonb not null default '{}'::jsonb,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);
-- Bases créées avec une version précédente de ce script :
alter table public.profiles add column if not exists onboarded boolean not null default false;

-- ── Calendrier ─────────────────────────────────────────────────────────────
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  date date not null,
  start_time text,
  end_time text,
  category text not null check (category in ('cours', 'examen', 'devoir', 'perso', 'sport')),
  done boolean not null default false,
  details text,
  created_at timestamptz not null default now()
);
create index if not exists events_user_date on public.events (user_id, date);

-- ── Notes ──────────────────────────────────────────────────────────────────
create table if not exists public.note_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  parent_id uuid references public.note_folders on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null default 'Sans titre',
  content text not null default '',
  folder_id uuid references public.note_folders on delete cascade,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_user on public.notes (user_id);

-- ── Drive (le contenu des fichiers est dans Storage, bucket « drive ») ───────
create table if not exists public.drive_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  kind text not null check (kind in ('folder', 'file')),
  parent_id uuid references public.drive_items on delete cascade,
  mime text,
  size bigint,
  starred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists drive_user on public.drive_items (user_id);

-- ── Sécurité : chacun ne voit que ses lignes ───────────────────────────────
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.note_folders enable row level security;
alter table public.notes enable row level security;
alter table public.drive_items enable row level security;

drop policy if exists "mon profil" on public.profiles;
create policy "mon profil" on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "mes événements" on public.events;
create policy "mes événements" on public.events for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "mes dossiers de notes" on public.note_folders;
create policy "mes dossiers de notes" on public.note_folders for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "mes notes" on public.notes;
create policy "mes notes" on public.notes for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "mon drive" on public.drive_items;
create policy "mon drive" on public.drive_items for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ── Profil créé automatiquement à l'inscription ────────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Suppression de son propre compte (bouton « Supprimer mon compte ») ─────
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ── Fichiers du Drive : bucket privé, un dossier par utilisateur ───────────
insert into storage.buckets (id, name, public)
values ('drive', 'drive', false)
on conflict (id) do nothing;

drop policy if exists "drive : lire mes fichiers" on storage.objects;
create policy "drive : lire mes fichiers" on storage.objects for select to authenticated
  using (bucket_id = 'drive' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "drive : ajouter mes fichiers" on storage.objects;
create policy "drive : ajouter mes fichiers" on storage.objects for insert to authenticated
  with check (bucket_id = 'drive' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "drive : modifier mes fichiers" on storage.objects;
create policy "drive : modifier mes fichiers" on storage.objects for update to authenticated
  using (bucket_id = 'drive' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "drive : supprimer mes fichiers" on storage.objects;
create policy "drive : supprimer mes fichiers" on storage.objects for delete to authenticated
  using (bucket_id = 'drive' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ── 1. Double authentification : la base refuse l'accès sans le code du téléphone ─
-- Un compte qui a associé un téléphone doit être en niveau « aal2 » (mot de passe + code)
-- pour lire ou modifier ses données, même en interrogeant l'API directement.
create or replace function public.mfa_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      or not exists (select 1 from auth.mfa_factors where user_id = auth.uid() and status = 'verified');
$$;
revoke all on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'events', 'note_folders', 'notes', 'drive_items'] loop
    execute format('drop policy if exists "2fa obligatoire" on public.%I', t);
    execute format('create policy "2fa obligatoire" on public.%I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
  end loop;
end $$;

drop policy if exists "drive : 2fa obligatoire" on storage.objects;
create policy "drive : 2fa obligatoire" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'drive' or (select public.mfa_ok()))
  with check (bucket_id <> 'drive' or (select public.mfa_ok()));

-- ── 2. Administrateurs ─────────────────────────────────────────────────────
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security; -- aucune règle : illisible depuis l'API

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Statistiques globales : réservé aux administrateurs connectés AVEC leur code (aal2).
-- Seulement des chiffres et la liste des comptes, jamais le contenu des notes ou fichiers.
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'forbidden';
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'mfa required';
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'users', (
      select jsonb_build_object(
        'total', count(*),
        'confirmed', count(email_confirmed_at),
        'new_7d', count(*) filter (where created_at > now() - interval '7 days'),
        'active_24h', count(*) filter (where last_sign_in_at > now() - interval '24 hours'),
        'active_7d', count(*) filter (where last_sign_in_at > now() - interval '7 days'),
        'active_30d', count(*) filter (where last_sign_in_at > now() - interval '30 days')
      ) from auth.users
    ),
    'mfa_users', (select count(distinct user_id) from auth.mfa_factors where status = 'verified'),
    'content', jsonb_build_object(
      'notes', (select count(*) from public.notes),
      'note_folders', (select count(*) from public.note_folders),
      'events', (select count(*) from public.events),
      'events_done', (select count(*) from public.events where done),
      'files', (select count(*) from public.drive_items where kind = 'file'),
      'folders', (select count(*) from public.drive_items where kind = 'folder'),
      'storage_bytes', (select coalesce(sum(size), 0) from public.drive_items where kind = 'file')
    ),
    'events_by_category', (
      select coalesce(jsonb_object_agg(category, n), '{}'::jsonb)
      from (select category, count(*) as n from public.events group by category) c
    ),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'signups', (select count(*) from auth.users u where u.created_at::date = d.day),
        'created', (select count(*) from public.notes n where n.created_at::date = d.day)
                 + (select count(*) from public.events e where e.created_at::date = d.day)
                 + (select count(*) from public.drive_items i where i.created_at::date = d.day)
      ) order by d.day), '[]'::jsonb)
      from (select generate_series(current_date - 29, current_date, interval '1 day')::date as day) d
    ),
    'accounts', (
      select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb)
      from (
        select
          u.id, u.email, coalesce(p.name, '') as name, u.created_at, u.last_sign_in_at,
          u.email_confirmed_at is not null as confirmed,
          exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified') as mfa,
          exists (select 1 from public.admins ad where ad.user_id = u.id) as admin,
          (select count(*) from public.notes n where n.user_id = u.id) as notes,
          (select count(*) from public.events e where e.user_id = u.id) as events,
          (select count(*) from public.drive_items i where i.user_id = u.id and i.kind = 'file') as files,
          (select coalesce(sum(size), 0) from public.drive_items i where i.user_id = u.id) as storage
        from auth.users u
        left join public.profiles p on p.id = u.id
        order by u.created_at desc
        limit 1000
      ) a
    )
  );
end;
$$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- ── 3. Te déclarer administrateur ───────────────────────────────────────────
-- Remplace l'adresse par celle de ton compte COP-PILOT :
-- insert into public.admins (user_id) select id from auth.users where email = 'ton.adresse@exemple.fr' on conflict do nothing;
