-- Synchro entre appareils, suite :
-- 1. Événements, tâches et dossiers de notes : une copie plus ancienne (appareil resté hors ligne)
--    n'écrase plus une version plus récente. Chaque envoi porte l'heure de la modification.
-- 2. Réglages : chaque appareil n'envoie que les réglages qu'il a changés, fusionnés avec les autres
--    (une catégorie créée sur le téléphone ne disparaît plus quand l'ordinateur enregistre un réglage).
alter table public.events add column if not exists updated_at timestamptz;
alter table public.todos add column if not exists updated_at timestamptz;
alter table public.note_folders add column if not exists updated_at timestamptz;

-- Sans heure d'un côté ou de l'autre (anciennes versions de l'appli) : la modification passe, comme avant.
create or replace function public.keep_newest_if_dated() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.updated_at is not null and old.updated_at is not null and new.updated_at < old.updated_at then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists events_keep_newest on public.events;
create trigger events_keep_newest before update on public.events
  for each row execute function public.keep_newest_if_dated();

drop trigger if exists todos_keep_newest on public.todos;
create trigger todos_keep_newest before update on public.todos
  for each row execute function public.keep_newest_if_dated();

drop trigger if exists note_folders_keep_newest on public.note_folders;
create trigger note_folders_keep_newest before update on public.note_folders
  for each row execute function public.keep_newest_if_dated();

-- Droits du compte connecté (security invoker) : les règles de la table profiles s'appliquent.
create or replace function public.merge_settings(patch jsonb) returns void
language sql security invoker set search_path = '' as $$
  update public.profiles set settings = coalesce(settings, '{}'::jsonb) || patch where id = (select auth.uid());
$$;
revoke all on function public.merge_settings(jsonb) from public, anon;
grant execute on function public.merge_settings(jsonb) to authenticated;

notify pgrst, 'reload schema';
