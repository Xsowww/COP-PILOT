-- Notifications des groupes de travail : à coller dans Supabase › SQL Editor (après 2026-10-21_notifications.sql).
-- Jusqu'ici seuls les agendas partagés prévenaient leurs membres. Maintenant, dans un groupe :
-- - un fichier partagé (plusieurs d'affilée : une seule notification, « Léo a partagé 5 fichiers ») ;
-- - une nouvelle note ;
-- - une révision proposée ;
-- et dans un groupe comme dans un agenda : quelqu'un qui le rejoint.
-- Même présentation que les agendas : le titre dit qui a fait quoi, la dernière ligne dit où.

-- Le nom de la personne connectée, pour les titres.
create or replace function public.actor_name() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select nullif(btrim(name), '') from public.profiles where id = auth.uid()), 'Un membre');
$$;
revoke all on function public.actor_name() from public, anon, authenticated;

-- Prévient les autres membres d'un groupe (pas la personne qui a fait le changement).
create or replace function public.notify_group_members(p_group uuid, p_key text, p_title text, p_body text, p_url text, p_fire timestamptz default now())
returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.reminders (user_id, key, fire_at, title, body, url, actor)
  select m.user_id, left(p_key, 200), p_fire, left(p_title, 200), left(p_body, 300), left(p_url, 300), auth.uid()
  from public.group_members m
  where m.group_id = p_group and m.user_id is distinct from auth.uid()
  on conflict (user_id, key) do update
    set title = excluded.title, body = excluded.body, fire_at = excluded.fire_at
    where public.reminders.sent_at is null;
end;
$$;
revoke all on function public.notify_group_members(uuid, text, text, text, text, timestamptz) from public, anon, authenticated;

-- ── Fichiers partagés dans un groupe ────────────────────────────────────────
-- Les fichiers envoyés à la suite par une même personne (un dossier partagé arrive fichier par fichier) sont
-- regroupés : la notification part deux minutes après le début de l'envoi, avec le nombre de fichiers.
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
    public.actor_name() || case when n > 1 then ' a partagé ' || n || ' fichiers' else ' a partagé « ' || left(new.name, 100) || ' »' end,
    case when n > 1 then left(names, 160) || case when n > 3 then '…' else '' end || E'\n' else '' end || 'Groupe « ' || left(g.name, 60) || ' »',
    '/groupes?g=' || new.group_id || '&onglet=fichiers',
    since + interval '2 minutes');
  return null;
end;
$$;
revoke all on function public.notify_group_file() from public, anon, authenticated;
drop trigger if exists group_files_notify on public.group_files;
create trigger group_files_notify after insert on public.group_files
  for each row execute procedure public.notify_group_file();

-- ── Nouvelle note dans un groupe ────────────────────────────────────────────
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
    public.actor_name() || case when t is null or t = 'Sans titre' then ' a commencé une nouvelle note' else ' a ajouté la note « ' || left(t, 100) || ' »' end,
    'Groupe « ' || left(g.name, 60) || ' »',
    '/groupes?g=' || new.group_id || '&onglet=notes');
  return null;
end;
$$;
revoke all on function public.notify_group_note() from public, anon, authenticated;
drop trigger if exists group_notes_notify on public.group_notes;
create trigger group_notes_notify after insert on public.group_notes
  for each row execute procedure public.notify_group_note();

-- ── Révision proposée dans un groupe (les agendas ont déjà la leur) ──────────
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
    public.actor_name() || ' a proposé « ' || left(new.title, 100) || ' »',
    'Le ' || public.fr_day(new.date) || coalesce(' à ' || public.fr_time(new.start_time), '') || E'\n' || 'Groupe « ' || left(g.name, 60) || ' »',
    '/groupes?g=' || new.group_id || '&onglet=revisions');
  return null;
end;
$$;
revoke all on function public.notify_group_event() from public, anon, authenticated;
drop trigger if exists group_events_notify_group on public.group_events;
create trigger group_events_notify_group after insert on public.group_events
  for each row execute procedure public.notify_group_event();

-- ── Quelqu'un rejoint un groupe ou un agenda ────────────────────────────────
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
    public.actor_name() || ' a rejoint « ' || left(g.name, 60) || ' »',
    case when g.kind = 'agenda' then 'Agenda partagé' else 'Groupe' end,
    case when g.kind = 'agenda' then '/agendas?g=' else '/groupes?g=' end || new.group_id || case when g.kind = 'agenda' then '' else '&onglet=membres' end);
  return null;
end;
$$;
revoke all on function public.notify_group_joined() from public, anon, authenticated;
drop trigger if exists group_members_notify on public.group_members;
create trigger group_members_notify after insert on public.group_members
  for each row execute procedure public.notify_group_joined();

-- ── Les rappels de l'appli ne remplacent plus les notifications des autres ────
-- Quand l'appli renvoie ses rappels (événements, tâches), elle remplaçait tout ce qui n'était pas encore parti,
-- y compris une notification de groupe ou d'agenda en attente : seuls ses propres rappels sont remplacés.
create or replace function public.replace_my_reminders(p_items jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  if auth.uid() is null or not public.mfa_ok() then
    raise exception 'mfa required';
  end if;
  delete from public.reminders
    where user_id = auth.uid() and (key like 'event:%' or key like 'task:%') and (sent_at is null or sent_at < now() - interval '3 days');
  insert into public.reminders (user_id, key, fire_at, title, body, url)
  select auth.uid(), left(x.key, 200), x.fire_at, left(coalesce(nullif(btrim(x.title), ''), 'Rappel'), 200), left(coalesce(x.body, ''), 300),
         case when x.url like '/%' then left(x.url, 300) else '/' end
  from jsonb_to_recordset(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end)
       as x(key text, fire_at timestamptz, title text, body text, url text)
  where x.key is not null and (x.key like 'event:%' or x.key like 'task:%')
    and x.fire_at > now() - interval '5 minutes' and x.fire_at < now() + interval '40 days'
  order by x.fire_at
  limit 300
  on conflict (user_id, key) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.replace_my_reminders(jsonb) from public, anon;
grant execute on function public.replace_my_reminders(jsonb) to authenticated;
