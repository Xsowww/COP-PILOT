-- Catégories créées par l'étudiant : l'événement garde l'identifiant « c-… » (nom et couleur dans ses réglages).
alter table public.events drop constraint if exists events_category_check;
alter table public.events add constraint events_category_check
  check (category in ('cours', 'examen', 'devoir', 'perso', 'sport') or category ~ '^c-[a-z0-9-]{1,40}$');
