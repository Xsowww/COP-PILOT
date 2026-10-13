-- Synchro entre appareils : une version plus ancienne n'écrase jamais une plus récente.
-- Cas typique : un ordinateur resté hors ligne renvoie une note d'il y a une semaine alors
-- qu'elle a été modifiée depuis sur le téléphone. La mise à jour est alors ignorée.
-- (Les dates viennent des appareils : leurs horloges sont réglées automatiquement.)
create or replace function public.keep_newest() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.updated_at < old.updated_at then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists notes_keep_newest on public.notes;
create trigger notes_keep_newest before update on public.notes
  for each row execute function public.keep_newest();

drop trigger if exists drive_items_keep_newest on public.drive_items;
create trigger drive_items_keep_newest before update on public.drive_items
  for each row execute function public.keep_newest();
