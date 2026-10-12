-- COP-PILOT · corbeille, couleurs et étiquettes du Drive, liens des notes,
-- import .ics, liste de tâches, historique des sessions focus.

-- ── Corbeille : les éléments supprimés gardent une date de suppression ─────
alter table public.drive_items add column if not exists deleted_at timestamptz;
alter table public.notes add column if not exists deleted_at timestamptz;
alter table public.note_folders add column if not exists deleted_at timestamptz;

-- ── Drive : couleur de dossier et étiquettes ───────────────────────────────
alter table public.drive_items add column if not exists color text;
alter table public.drive_items add column if not exists tags text[] not null default '{}';

-- ── Notes liées à des fichiers / événements ────────────────────────────────
alter table public.notes add column if not exists links jsonb not null default '[]'::jsonb;

-- ── Calendrier : identifiant d'origine des événements importés (.ics) ──────
alter table public.events add column if not exists external_id text;

-- ── Liste de tâches ────────────────────────────────────────────────────────
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  done boolean not null default false,
  due date,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists todos_user on public.todos (user_id);

-- ── Sessions focus (temps de travail par matière) ──────────────────────────
create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject text not null default '',
  minutes integer not null check (minutes > 0 and minutes <= 600),
  started_at timestamptz not null default now()
);
create index if not exists focus_sessions_user on public.focus_sessions (user_id);

alter table public.todos enable row level security;
alter table public.focus_sessions enable row level security;

drop policy if exists "mes tâches" on public.todos;
create policy "mes tâches" on public.todos for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "mes sessions focus" on public.focus_sessions;
create policy "mes sessions focus" on public.focus_sessions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

do $$
declare t text;
begin
  foreach t in array array['todos', 'focus_sessions'] loop
    execute format('drop policy if exists "2fa obligatoire" on public.%I', t);
    execute format('create policy "2fa obligatoire" on public.%I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
  end loop;
end $$;
