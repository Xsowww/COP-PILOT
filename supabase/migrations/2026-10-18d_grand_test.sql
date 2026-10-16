-- Grand test : à coller dans Supabase › SQL Editor (après 2026-10-18c_notifications_appareil.sql).
-- - Un compte ne peut plus retirer l'abonnement push d'un autre en connaissant seulement son adresse d'envoi.
-- - La pastille « Agendas » ne plante plus sur une date de visite illisible.
-- - Les fichiers (storage.objects) : la base vérifie que la protection par ligne (RLS) est bien active.

-- Cet appareil passe au compte connecté seulement s'il le prouve : un autre compte enregistré sur ce même navigateur
-- a exactement les mêmes clés de chiffrement (p256dh, auth), que seul ce navigateur connaît.
create or replace function public.claim_push_endpoint(p_endpoint text, p_p256dh text, p_auth text, p_device text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not public.mfa_ok() then raise exception 'mfa required'; end if;
  if p_endpoint is null or p_endpoint not like 'https://%' or char_length(p_endpoint) > 1000 then raise exception 'invalid endpoint'; end if;
  if coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then raise exception 'invalid keys'; end if;
  delete from public.push_subscriptions
    where endpoint = p_endpoint and user_id <> me and p256dh = left(p_p256dh, 200) and auth = left(p_auth, 100);
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device)
    values (me, p_endpoint, left(p_p256dh, 200), left(p_auth, 100), left(p_device, 200))
    on conflict (user_id, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device;
end;
$$;
revoke all on function public.claim_push_endpoint(text, text, text, text) from public, anon;
grant execute on function public.claim_push_endpoint(text, text, text, text) to authenticated;

-- Une date lue sans risque : null si elle est illisible.
create or replace function public.try_timestamptz(p text) returns timestamptz
language plpgsql immutable set search_path = '' as $$
begin
  return p::timestamptz;
exception when others then
  return null;
end;
$$;
revoke all on function public.try_timestamptz(text) from public, anon, authenticated;

create or replace function public.my_agenda_news(p_seen jsonb) returns table (group_id uuid, news integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.mfa_ok() then raise exception 'mfa required'; end if;
  if jsonb_typeof(p_seen) is distinct from 'object' then p_seen := '{}'::jsonb; end if;
  return query
    select x.gid, count(*)::int
    from (
      select substring(r.url from 'g=([0-9a-f-]{36})')::uuid as gid, r.fire_at
      from public.reminders r
      where r.user_id = auth.uid() and r.key like 'agenda%' and r.fire_at > now() - interval '7 days'
    ) x
    where x.gid is not null
      and public.is_group_member(x.gid)
      and x.fire_at > coalesce(public.try_timestamptz(p_seen ->> x.gid::text), '-infinity'::timestamptz)
    group by x.gid;
end;
$$;
revoke all on function public.my_agenda_news(jsonb) from public, anon;
grant execute on function public.my_agenda_news(jsonb) to authenticated;

-- Supabase active la RLS sur storage.objects dès la création du projet ; on le vérifie au lieu de le supposer.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass) then
    begin
      alter table storage.objects enable row level security;
    exception when insufficient_privilege then
      raise warning 'storage.objects : la protection par ligne (RLS) est désactivée ; active-la dans Supabase › Storage › Policies.';
    end;
  end if;
end $$;
