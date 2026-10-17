-- Titres de notification plus courts (ils étaient coupés sur l'écran d'un téléphone) : à coller dans
-- Supabase › SQL Editor, après 2026-10-21b_notifications_groupes.sql.
-- Le titre dit seulement qui a fait quoi (« Léo a ajouté un événement », « Compa a créé une note ») ;
-- le nom de la chose et sa date passent sur la ligne d'en dessous, puis l'agenda ou le groupe.

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
  what := case tg_op when 'INSERT' then ' a ajouté un événement' when 'UPDATE' then ' a modifié un événement' else ' a supprimé un événement' end;
  quand := public.fr_day(ev.date) || coalesce(' à ' || public.fr_time(ev.start_time), '');
  insert into public.reminders (user_id, key, fire_at, title, body, url, actor)
  select m.user_id, 'agenda:' || ev.id || ':' || tg_op || ':' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint, now(),
         left(coalesce(who, 'Un membre') || what, 200),
         left(
           '« ' || left(ev.title, 80) || ' » · ' || case tg_op when 'UPDATE' then 'maintenant le ' when 'DELETE' then 'prévu le ' else '' end || quand
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
             || case when r.n > 1 then r.n || ' périodes' else 'une période' end, 200),
           left('« ' || left(r.title, 60) || ' »' || coalesce(pour, '') || ' · ' || lower(left(dates, 1)) || substr(dates, 2)
             || E'\n' || 'Agenda partagé « ' || left(g.name, 60) || ' »', 300),
           '/agendas?g=' || r.group_id || case when p_op = 'INSERT' then '&jour=' || r.s else '' end,
           auth.uid()
    from public.group_members m
    where m.group_id = r.group_id and m.user_id is distinct from auth.uid()
    on conflict do nothing;
  end loop;
end;
$$;

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
         left(coalesce(who, 'Un membre') || ' a modifié une période', 200),
         left('« ' || left(new.title, 60) || ' » · ' || case when new.start_date = new.end_date then 'maintenant le ' || public.fr_day(new.start_date)
                   else 'maintenant du ' || public.fr_day(new.start_date) || ' au ' || public.fr_day(new.end_date) end
              || E'\n' || 'Agenda partagé « ' || left(g.name, 60) || ' »', 300),
         '/agendas?g=' || new.group_id || '&jour=' || new.start_date,
         auth.uid()
  from public.group_members m
  where m.group_id = new.group_id and m.user_id is distinct from auth.uid()
  on conflict do nothing;
  return null;
end;
$$;

create or replace function public.notify_group_file() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
  slot bigint := floor(extract(epoch from now()) / 120);
  since timestamptz := to_timestamp(floor(extract(epoch from now()) / 120) * 120);
  n integer;
  names text;
begin
  if pg_trigger_depth() > 1 or auth.uid() is null then return null; end if;
  select * into g from public.groups where id = new.group_id;
  if g.kind is distinct from 'groupe' then return null; end if;
  select string_agg(x.name, ', ')
    into names
    from (select f.name from public.group_files f
          where f.group_id = new.group_id and f.created_by = auth.uid() and f.created_at >= since
          order by f.created_at limit 3) x;
  select count(*) into n from public.group_files f where f.group_id = new.group_id and f.created_by = auth.uid() and f.created_at >= since;
  perform public.notify_group_members(
    new.group_id,
    'fichiers:' || new.group_id || ':' || auth.uid() || ':' || slot,
    public.actor_name() || case when n > 1 then ' a partagé ' || n || ' fichiers' else ' a partagé un fichier' end,
    left(names, 160) || case when n > 3 then '…' else '' end || E'\n' || 'Groupe « ' || left(g.name, 60) || ' »',
    '/groupes?g=' || new.group_id || '&onglet=fichiers',
    since + interval '2 minutes');
  return null;
end;
$$;

create or replace function public.notify_group_note() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
  t text := nullif(btrim(new.title), '');
begin
  if pg_trigger_depth() > 1 or auth.uid() is null then return null; end if;
  select * into g from public.groups where id = new.group_id;
  if g.kind is distinct from 'groupe' then return null; end if;
  perform public.notify_group_members(
    new.group_id,
    'note:' || new.id,
    public.actor_name() || ' a créé une note',
    case when t is null or t = 'Sans titre' then '' else '« ' || left(t, 100) || ' »' || E'\n' end || 'Groupe « ' || left(g.name, 60) || ' »',
    '/groupes?g=' || new.group_id || '&onglet=notes');
  return null;
end;
$$;

create or replace function public.notify_group_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
begin
  if pg_trigger_depth() > 1 or auth.uid() is null then return null; end if;
  select * into g from public.groups where id = new.group_id;
  if g.kind is distinct from 'groupe' then return null; end if;
  perform public.notify_group_members(
    new.group_id,
    'revision:' || new.id,
    public.actor_name() || ' propose un créneau',
    '« ' || left(new.title, 80) || ' » · ' || public.fr_day(new.date) || coalesce(' à ' || public.fr_time(new.start_time), '') || E'\n' || 'Groupe « ' || left(g.name, 60) || ' »',
    '/groupes?g=' || new.group_id || '&onglet=revisions');
  return null;
end;
$$;

create or replace function public.notify_group_joined() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then return null; end if; -- only someone joining by themselves
  select * into g from public.groups where id = new.group_id;
  if g.owner_id = new.user_id and g.created_at > now() - interval '1 minute' then return null; end if; -- its creator, at creation
  perform public.notify_group_members(
    new.group_id,
    'membre:' || new.group_id || ':' || new.user_id,
    public.actor_name() || case when g.kind = 'agenda' then ' a rejoint l’agenda' else ' a rejoint le groupe' end,
    case when g.kind = 'agenda' then 'Agenda partagé « ' else 'Groupe « ' end || left(g.name, 60) || ' »',
    case when g.kind = 'agenda' then '/agendas?g=' else '/groupes?g=' end || new.group_id || case when g.kind = 'agenda' then '' else '&onglet=membres' end);
  return null;
end;
$$;
