-- Correctif de 2026-10-19_photo_groupe.sql : à coller dans Supabase › SQL Editor.
-- La table des groupes n'est lisible que colonne par colonne (le code d'invitation reste caché) ;
-- la nouvelle colonne « photo » n'était pas dans la liste, et le chargement des groupes était refusé.
grant select (photo) on public.groups to authenticated;
