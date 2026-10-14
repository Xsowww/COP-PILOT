-- Usage personnel pour l'instant : pas de quota par compte (la limite de 50 Mo par fichier reste).
-- Avant d'ouvrir au public, remettre une valeur, par exemple 50 Mo : select 50::bigint * 1024 * 1024
-- (et QUOTA dans src/lib/blobStore.ts).
create or replace function public.storage_quota() returns bigint
language sql immutable as $$ select 1024::bigint * 1024 * 1024 * 1024 $$;
