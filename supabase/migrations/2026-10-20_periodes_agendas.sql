-- Périodes des agendas partagés (« En entreprise », « Vacances »…) : à coller dans Supabase › SQL Editor
-- (après 2026-10-19c_couleur_dossiers_notes.sql). Les périodes de l'agenda perso sont dans les réglages
-- du compte : rien à créer pour elles.
-- Mêmes droits que les événements d'un agenda : tous les membres les voient, ses éditeurs les gèrent.

create table if not exists public.group_periods (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  start_date date not null,
  end_date date not null,
  color text not null default 'bleu' check (color in ('bleu', 'rouge', 'orange', 'jaune', 'vert', 'violet', 'rose', 'gris')),
  -- Les membres concernés (« Léa est en entreprise ») ; vide : tout le monde.
  people uuid[] not null default '{}' check (cardinality(people) <= 50),
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date <= 400)
);
-- (Déjà lancé avant l'ajout de « pour qui » : la colonne arrive ici.)
alter table public.group_periods add column if not exists people uuid[] not null default '{}' check (cardinality(people) <= 50);
create index if not exists group_periods_group on public.group_periods (group_id, start_date);
alter table public.group_periods enable row level security;
revoke all on public.group_periods from anon;

drop policy if exists "périodes : lecture" on public.group_periods;
create policy "périodes : lecture" on public.group_periods for select to authenticated
  using ((select public.is_group_member(group_id)));
drop policy if exists "périodes : ajout" on public.group_periods;
create policy "périodes : ajout" on public.group_periods for insert to authenticated
  with check ((select public.can_edit_group(group_id)));
drop policy if exists "périodes : modification" on public.group_periods;
create policy "périodes : modification" on public.group_periods for update to authenticated
  using ((select public.can_edit_group(group_id))) with check ((select public.can_edit_group(group_id)));
drop policy if exists "périodes : suppression" on public.group_periods;
create policy "périodes : suppression" on public.group_periods for delete to authenticated
  using ((select public.can_edit_group(group_id)));
drop policy if exists "2fa obligatoire" on public.group_periods;
create policy "2fa obligatoire" on public.group_periods as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

-- Pas plus de 300 périodes par agenda (une répétition sur un an en fait au plus 60).
create or replace function public.group_periods_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.group_periods where group_id = new.group_id) >= 300 then
    raise exception 'too many periods';
  end if;
  return new;
end;
$$;
revoke all on function public.group_periods_limit() from public, anon, authenticated;
drop trigger if exists group_periods_limit on public.group_periods;
create trigger group_periods_limit before insert on public.group_periods
  for each row execute procedure public.group_periods_limit();

-- En direct pour les autres membres.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_periods') then
    alter publication supabase_realtime add table public.group_periods;
  end if;
end $$;
