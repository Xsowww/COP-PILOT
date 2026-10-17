-- Notifications plus claires, et plusieurs comptes sur un même appareil : à coller dans Supabase › SQL Editor
-- (après 2026-10-20_periodes_agendas.sql).
-- 1. Chaque compte gardé sur un téléphone reçoit ses notifications, même quand un autre compte est ouvert.
-- 2. Le titre dit qui a fait quoi : « Léo a ajouté « Ménage » », « Léo a supprimé « Ménage » ».
-- 3. Les périodes d'un agenda partagé préviennent aussi les membres (une seule notification pour une alternance).
-- 4. Ce que je fais avec un compte ne me revient pas en notification sur mon propre appareil, par l'autre compte.

-- ── 1. Un appareil, plusieurs comptes ───────────────────────────────────────
create or replace function public.claim_push_endpoint(p_endpoint text, p_p256dh text, p_auth text, p_device text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not public.mfa_ok() then raise exception 'mfa required'; end if;
  if p_endpoint is null or p_endpoint not like 'https://%' or char_length(p_endpoint) > 1000 then raise exception 'invalid endpoint'; end if;
  if coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then raise exception 'invalid keys'; end if;
  -- Les autres comptes de ce navigateur gardent leur ligne : chacun reçoit ses notifications ici.
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device)
    values (me, p_endpoint, left(p_p256dh, 200), left(p_auth, 100), left(p_device, 200))
    on conflict (user_id, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device;
end;
$$;
revoke all on function public.claim_push_endpoint(text, text, text, text) from public, anon;
grant execute on function public.claim_push_endpoint(text, text, text, text) to authenticated;

-- ── 4. Qui a fait le changement ─────────────────────────────────────────────
alter table public.reminders add column if not exists actor uuid;

drop function if exists public.claim_due_reminders();
create function public.claim_due_reminders() returns table (user_id uuid, key text, title text, body text, url text, fire_at timestamptz, actor uuid)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  -- Ménage : les rappels envoyés depuis plus d'une semaine.
  delete from public.reminders r where r.sent_at < now() - interval '7 days';
  return query
  with due as (
    select r.user_id, r.key from public.reminders r
    where r.sent_at is null and r.fire_at <= now() and r.fire_at > now() - interval '30 minutes'
    order by r.fire_at
    limit 500
    for update skip locked
  )
  update public.reminders r set sent_at = now()
  from due where r.user_id = due.user_id and r.key = due.key
  returning r.user_id, r.key, r.title, r.body, r.url, r.fire_at, r.actor;
end;
$$;
revoke all on function public.claim_due_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_reminders() to service_role;

-- ── Dates en français pour les notifications (« sam. 17 oct. », « 14h30 ») ─
create or replace function public.fr_day(d date) returns text
language sql immutable set search_path = '' as $$
  select (array['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'])[extract(dow from d)::int + 1]
    || ' ' || extract(day from d)::int
    || ' ' || (array['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'])[extract(month from d)::int];
$$;
create or replace function public.fr_time(t text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(replace(t, ':', 'h'), 'h00$', 'h');
$$;
revoke all on function public.fr_day(date) from public, anon;
revoke all on function public.fr_time(text) from public, anon;

-- ── 2. Événements d'un agenda partagé ───────────────────────────────────────
-- Titre : qui a fait quoi. Ligne 1 : quand. Ligne 2 : quel agenda.
create or replace function public.notify_agenda_members() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ev public.group_events := case when tg_op = 'DELETE' then old else new end;
  g public.groups;
  who text;
  what text;
  quand text;
begin
  if pg_trigger_depth() > 1 then return null; end if; -- changes made by the database itself (account deleted…)
  select * into g from public.groups where id = ev.group_id;
  if g.kind is distinct from 'agenda' then return null; end if;
  if tg_op = 'UPDATE' and (old.title, old.date, old.start_time, old.end_time, old.category, old.details, old.place)
     is not distinct from (new.title, new.date, new.start_time, new.end_time, new.category, new.details, new.place) then
    return null;
  end if;
  select coalesce(nullif(btrim(name), ''), 'Un membre') into who from public.profiles where id = auth.uid();
  what := case tg_op when 'INSERT' then ' a ajouté « ' when 'UPDATE' then ' a modifié « ' else ' a supprimé « ' end;
  quand := public.fr_day(ev.date) || coalesce(' à ' || public.fr_time(ev.start_time), '');
  insert into public.reminders (user_id, key, fire_at, title, body, url, actor)
  select m.user_id, 'agenda:' || ev.id || ':' || tg_op || ':' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint, now(),
         left(coalesce(who, 'Un membre') || what || left(ev.title, 120) || ' »', 200),
         left(
           case tg_op when 'INSERT' then 'Le ' when 'UPDATE' then 'Maintenant le ' else 'C’était prévu le ' end || quand
             || E'\n' || 'Agenda partagé « ' || left(g.name, 60) || ' »',
           300),
         '/agendas?g=' || ev.group_id || case when tg_op = 'DELETE' then '' else '&jour=' || ev.date end,
         auth.uid()
  from public.group_members m
  where m.group_id = ev.group_id and m.user_id is distinct from auth.uid()
  on conflict do nothing;
  return null;
end;
$$;
revoke all on function public.notify_agenda_members() from public, anon, authenticated;

-- ── 3. Périodes d'un agenda partagé ─────────────────────────────────────────
-- Ajout et suppression : une notification par période… ou une seule pour toutes celles d'une même alternance
-- (même nom, mêmes personnes, envoyées ensemble).
create or replace function public.notify_agenda_periods(p_rows jsonb, p_op text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  who text;
  g public.groups;
  pour text;
  dates text;
begin
  select coalesce(nullif(btrim(name), ''), 'Un membre') into who from public.profiles where id = auth.uid();
  for r in
    select x.group_id, x.title, coalesce(x.people, '{}') as people, count(*) as n, min(x.start_date) as s, max(x.end_date) as e, min(x.id::text) as first_id
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(id uuid, group_id uuid, title text, people uuid[], start_date date, end_date date)
    group by x.group_id, x.title, coalesce(x.people, '{}')
  loop
    select * into g from public.groups where id = r.group_id;
    if g.kind is distinct from 'agenda' then continue; end if;
    select ' pour ' || string_agg(coalesce(nullif(btrim(p.name), ''), 'un membre'), ', ' order by p.name)
      into pour from public.profiles p where p.id = any(r.people);
    dates := case when r.s = r.e then 'Le ' || public.fr_day(r.s) else 'Du ' || public.fr_day(r.s) || ' au ' || public.fr_day(r.e) end
      || case when r.n > 1 then ' (' || r.n || ' fois)' else '' end;
    insert into public.reminders (user_id, key, fire_at, title, body, url, actor)
    select m.user_id, 'periode:' || r.first_id || ':' || p_op || ':' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint, now(),
           left(coalesce(who, 'Un membre')
             || case p_op when 'INSERT' then ' a ajouté ' else ' a supprimé ' end
             || case when r.n > 1 then r.n || ' périodes « ' else 'la période « ' end
             || left(r.title, 60) || ' »' || coalesce(pour, ''), 200),
           left(dates || E'\n' || 'Agenda partagé « ' || left(g.name, 60) || ' »', 300),
           '/agendas?g=' || r.group_id || case when p_op = 'INSERT' then '&jour=' || r.s else '' end,
           auth.uid()
    from public.group_members m
    where m.group_id = r.group_id and m.user_id is distinct from auth.uid()
    on conflict do nothing;
  end loop;
end;
$$;
revoke all on function public.notify_agenda_periods(jsonb, text) from public, anon, authenticated;

create or replace function public.notify_agenda_periods_added() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() = 1 then perform public.notify_agenda_periods((select jsonb_agg(n) from new_rows n), 'INSERT'); end if;
  return null;
end;
$$;
create or replace function public.notify_agenda_periods_removed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() = 1 then perform public.notify_agenda_periods((select jsonb_agg(o) from old_rows o), 'DELETE'); end if;
  return null;
end;
$$;
revoke all on function public.notify_agenda_periods_added() from public, anon, authenticated;
revoke all on function public.notify_agenda_periods_removed() from public, anon, authenticated;

-- Modification d'une période (nom, dates, personnes) : « Léo a modifié la période « Stage » ».
create or replace function public.notify_agenda_period_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  who text;
  g public.groups;
begin
  if pg_trigger_depth() > 1 then return null; end if;
  if (old.title, old.start_date, old.end_date, old.people) is not distinct from (new.title, new.start_date, new.end_date, new.people) then return null; end if;
  select * into g from public.groups where id = new.group_id;
  if g.kind is distinct from 'agenda' then return null; end if;
  select coalesce(nullif(btrim(name), ''), 'Un membre') into who from public.profiles where id = auth.uid();
  insert into public.reminders (user_id, key, fire_at, title, body, url, actor)
  select m.user_id, 'periode:' || new.id || ':UPDATE:' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint, now(),
         left(coalesce(who, 'Un membre') || ' a modifié la période « ' || left(new.title, 60) || ' »', 200),
         left(case when new.start_date = new.end_date then 'Maintenant le ' || public.fr_day(new.start_date)
                   else 'Maintenant du ' || public.fr_day(new.start_date) || ' au ' || public.fr_day(new.end_date) end
              || E'\n' || 'Agenda partagé « ' || left(g.name, 60) || ' »', 300),
         '/agendas?g=' || new.group_id || '&jour=' || new.start_date,
         auth.uid()
  from public.group_members m
  where m.group_id = new.group_id and m.user_id is distinct from auth.uid()
  on conflict do nothing;
  return null;
end;
$$;
revoke all on function public.notify_agenda_period_changed() from public, anon, authenticated;

drop trigger if exists group_periods_notify_insert on public.group_periods;
create trigger group_periods_notify_insert after insert on public.group_periods
  referencing new table as new_rows for each statement execute procedure public.notify_agenda_periods_added();
drop trigger if exists group_periods_notify_delete on public.group_periods;
create trigger group_periods_notify_delete after delete on public.group_periods
  referencing old table as old_rows for each statement execute procedure public.notify_agenda_periods_removed();
drop trigger if exists group_periods_notify_update on public.group_periods;
create trigger group_periods_notify_update after update on public.group_periods
  for each row execute procedure public.notify_agenda_period_changed();

-- Administration : le même ton (« Nouveau signalement » → ce qui est signalé).
create or replace function public.notify_admins() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
  v_body text;
begin
  if tg_table_name = 'reports' then
    v_title := 'Nouveau signalement à traiter';
    v_body := '« ' || left(coalesce(new.snapshot ->> 'title', 'Un contenu de groupe'), 120) || ' »' || E'\n' || 'Administration';
  else
    v_title := case when new.kind = 'bug' then 'Nouveau bug signalé' else 'Nouvel avis reçu' end;
    v_body := left(new.message, 140) || E'\n' || 'Administration';
  end if;
  insert into public.reminders (user_id, key, fire_at, title, body, url)
  select a.user_id, 'admin:' || tg_table_name || ':' || new.id, now(), v_title, coalesce(v_body, ''), '/admin?vue=traiter'
  from public.admins a
  on conflict do nothing;
  return new;
end;
$$;
