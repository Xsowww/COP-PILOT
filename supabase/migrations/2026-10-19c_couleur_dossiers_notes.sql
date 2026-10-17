-- Couleur des dossiers de notes : à coller dans Supabase › SQL Editor (après 2026-10-19b_photo_groupe_lecture.sql).
-- Les mêmes couleurs que les dossiers du Drive (bleu, rouge, orange…). Sans cette colonne, l'application garde
-- la couleur sur l'appareil seulement.
alter table public.note_folders add column if not exists color text
  check (color is null or color in ('bleu', 'rouge', 'orange', 'jaune', 'vert', 'violet', 'rose', 'gris'));
