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
