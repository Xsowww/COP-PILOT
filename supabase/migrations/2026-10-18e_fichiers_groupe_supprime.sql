-- Fichiers d'un groupe supprimé : à coller dans Supabase › SQL Editor (après 2026-10-18d_grand_test.sql).
-- Avant, l'application effaçait les fichiers puis supprimait le groupe : si la suppression échouait (coupure),
-- le groupe restait sans ses fichiers. Maintenant le groupe est supprimé d'abord ; la personne qui l'a supprimé
-- (ou le dernier membre parti) garde le droit d'effacer ses fichiers, et l'application les efface juste après
-- (ou à la prochaine ouverture si la connexion a coupé entre-temps).

create table if not exists public.deleted_groups (
  id uuid primary key,
  owner_id uuid not null, -- pas de clé vers auth.users : un compte supprimé emporte ses groupes pendant sa suppression
  deleted_at timestamptz not null default now()
);
alter table public.deleted_groups enable row level security;
revoke all on public.deleted_groups from anon, authenticated;
grant select, delete on public.deleted_groups to authenticated;
drop policy if exists "groupes supprimés : les miens" on public.deleted_groups;
create policy "groupes supprimés : les miens" on public.deleted_groups for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists "groupes supprimés : oublier" on public.deleted_groups;
create policy "groupes supprimés : oublier" on public.deleted_groups for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Seulement les groupes qui avaient des fichiers ; au nom de qui supprime (le propriétaire, le dernier membre).
create or replace function public.groups_after_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.uid(), old.owner_id) is not null
     and exists (select 1 from storage.objects where bucket_id = 'groups' and name like old.id::text || '/%') then
    insert into public.deleted_groups (id, owner_id) values (old.id, coalesce(auth.uid(), old.owner_id))
      on conflict (id) do nothing;
  end if;
  return old;
end;
$$;
revoke all on function public.groups_after_delete() from public, anon, authenticated;
drop trigger if exists groups_after_delete on public.groups;
create trigger groups_after_delete after delete on public.groups
  for each row execute procedure public.groups_after_delete();

create or replace function public.deleted_group_path(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.deleted_groups d
    where d.id::text = (storage.foldername(p_path))[1] and d.owner_id = auth.uid()
  );
$$;
revoke all on function public.deleted_group_path(text) from public, anon;
grant execute on function public.deleted_group_path(text) to authenticated;

drop policy if exists "groupes supprimés : lister les fichiers" on storage.objects;
create policy "groupes supprimés : lister les fichiers" on storage.objects for select to authenticated
  using (bucket_id = 'groups' and (select public.deleted_group_path(name)));
drop policy if exists "groupes supprimés : effacer les fichiers" on storage.objects;
create policy "groupes supprimés : effacer les fichiers" on storage.objects for delete to authenticated
  using (bucket_id = 'groups' and (select public.deleted_group_path(name)));
