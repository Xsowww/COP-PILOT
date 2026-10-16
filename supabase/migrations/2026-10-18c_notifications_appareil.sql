-- Notifications : à coller dans Supabase › SQL Editor (après 2026-10-18b_agendas_lien.sql).
-- - Un appareil reçoit les notifications du compte qui s'en sert, pas celles des autres comptes enregistrés dessus
--   (sinon, avec deux comptes sur un même téléphone, on recevait la notification de ce qu'on venait de faire).
-- - La pastille « Agendas » : les nouveautés de chaque agenda partagé depuis la dernière visite.

-- Cet appareil (adresse d'envoi du navigateur) est désormais celui du compte connecté : les autres comptes ne
-- l'utilisent plus pour leurs notifications.
create or replace function public.claim_push_endpoint(p_endpoint text, p_p256dh text, p_auth text, p_device text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not public.mfa_ok() then raise exception 'mfa required'; end if;
  if p_endpoint is null or p_endpoint not like 'https://%' or char_length(p_endpoint) > 1000 then raise exception 'invalid endpoint'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id <> me;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device)
    values (me, p_endpoint, left(p_p256dh, 200), left(p_auth, 100), left(p_device, 200))
    on conflict (user_id, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device;
end;
$$;
revoke all on function public.claim_push_endpoint(text, text, text, text) from public, anon;
grant execute on function public.claim_push_endpoint(text, text, text, text) to authenticated;

-- Nouveautés des agendas partagés pour la personne connectée : le nombre de notifications d'agenda reçues après
-- sa dernière visite de chaque agenda (p_seen = { "<agenda>": "<date de la visite>" }).
create or replace function public.my_agenda_news(p_seen jsonb) returns table (group_id uuid, news integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.mfa_ok() then raise exception 'mfa required'; end if;
  return query
    select x.gid, count(*)::int
    from (
      select substring(r.url from 'g=([0-9a-f-]{36})')::uuid as gid, r.fire_at
      from public.reminders r
      where r.user_id = auth.uid() and r.key like 'agenda%' and r.fire_at > now() - interval '7 days'
    ) x
    where x.gid is not null
      and public.is_group_member(x.gid)
      and x.fire_at > coalesce((p_seen ->> x.gid::text)::timestamptz, '-infinity'::timestamptz)
    group by x.gid;
end;
$$;
revoke all on function public.my_agenda_news(jsonb) from public, anon;
grant execute on function public.my_agenda_news(jsonb) to authenticated;
