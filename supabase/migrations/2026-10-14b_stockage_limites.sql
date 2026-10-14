-- Stockage : 50 Mo maximum par fichier, 200 Mo par compte (Drive + fichiers envoyés dans les groupes).
-- Pour changer le quota : modifie 200 dans storage_quota() (et QUOTA dans src/lib/blobStore.ts).
update storage.buckets set file_size_limit = 52428800 where id in ('drive', 'groups');

create or replace function public.storage_quota() returns bigint
language sql immutable as $$ select 200::bigint * 1024 * 1024 $$;

-- Place utilisée par le compte connecté, d'après la taille enregistrée de chaque fichier.
create or replace function public.storage_used() returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum((metadata ->> 'size')::bigint), 0)
  from storage.objects
  where owner_id = (select auth.uid())::text and bucket_id in ('drive', 'groups');
$$;
revoke all on function public.storage_used() from public, anon;
grant execute on function public.storage_used() to authenticated;

drop policy if exists "stockage : quota par compte" on storage.objects;
create policy "stockage : quota par compte" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id not in ('drive', 'groups') or public.storage_used() < public.storage_quota());
