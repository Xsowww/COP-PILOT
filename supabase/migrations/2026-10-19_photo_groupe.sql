-- Photo d'un groupe ou d'un agenda partagé : à coller dans Supabase › SQL Editor (après 2026-10-18e_fichiers_groupe_supprime.sql).
-- Une petite image carrée (256 px, JPEG) gardée dans la ligne du groupe, comme la couleur : seuls ses membres la voient,
-- seul son propriétaire la change (même règle que le nom et la couleur).

alter table public.groups add column if not exists photo text
  check (photo is null or (char_length(photo) <= 150000 and photo ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$'));

-- Les colonnes lisibles de la table sont listées une à une (le code d'invitation reste caché) : la photo s'y ajoute.
grant select (photo) on public.groups to authenticated;
grant update (name, color, photo) on public.groups to authenticated;
