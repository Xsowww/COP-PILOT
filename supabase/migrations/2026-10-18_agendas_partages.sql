-- Agendas partagés : à coller dans Supabase › SQL Editor (après 2026-10-17_rappels.sql).
-- Un agenda partagé est un groupe d'un autre genre (kind = 'agenda') : même code d'invitation, mêmes membres,
-- mêmes droits, même temps réel ; l'appli le montre dans son propre espace (« Agendas »), jamais avec les groupes.
-- Chaque événement ajouté prévient les autres membres (notification push, par la file des rappels).

alter table public.groups add column if not exists kind text not null default 'groupe' check (kind in ('groupe', 'agenda'));
grant select (kind) on public.groups to authenticated;

-- Création : un genre en plus (« groupe » par défaut, comme avant).
drop function if exists public.create_group(text, text);
create or replace function public.create_group(p_name text, p_color text default null, p_kind text default 'groupe') returns public.groups
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  g public.groups;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not public.mfa_ok() then raise exception 'mfa required'; end if;
  if (select count(*) from public.group_members where user_id = me) >= 30 then
    raise exception 'too many groups';
  end if;
  insert into public.groups (name, color, invite_code, owner_id, kind)
    values (btrim(p_name), nullif(lower(p_color), ''), public.new_group_code(), me, case when p_kind = 'agenda' then 'agenda' else 'groupe' end)
    returning * into g;
  insert into public.group_members (group_id, user_id) values (g.id, me);
  return g;
end;
$$;
revoke all on function public.create_group(text, text, text) from public, anon;
grant execute on function public.create_group(text, text, text) to authenticated;

-- Un événement ajouté à un agenda partagé : chaque autre membre reçoit une notification.
create or replace function public.notify_agenda_members() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
  who text;
begin
  select * into g from public.groups where id = new.group_id;
  if g.kind is distinct from 'agenda' then return new; end if;
  select coalesce(nullif(btrim(name), ''), 'Un membre') into who from public.profiles where id = auth.uid();
  insert into public.reminders (user_id, key, fire_at, title, body, url)
  select m.user_id, 'agenda:' || new.id, now(), left(new.title, 200),
         left(
           'Ajouté par ' || coalesce(who, 'un membre') || ' · ' || to_char(new.date, 'DD/MM')
             || coalesce(' à ' || replace(new.start_time, ':', 'h'), '')
             || E'\n' || 'Agenda « ' || g.name || ' »',
           300),
         '/agendas?g=' || new.group_id
  from public.group_members m
  where m.group_id = new.group_id and m.user_id is distinct from auth.uid()
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.notify_agenda_members() from public, anon, authenticated;
drop trigger if exists group_events_notify_agenda on public.group_events;
create trigger group_events_notify_agenda after insert on public.group_events
  for each row execute procedure public.notify_agenda_members();

-- Les rappels que l'appli remplace sont seulement les siens (événements et tâches) : les notifications
-- posées par la base (administration, agendas partagés) restent jusqu'à leur envoi.
create or replace function public.replace_my_reminders(p_items jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  if auth.uid() is null or not public.mfa_ok() then
    raise exception 'mfa required';
  end if;
  delete from public.reminders where user_id = auth.uid() and (key like 'event:%' or key like 'task:%')
    and (sent_at is null or sent_at < now() - interval '3 days');
  insert into public.reminders (user_id, key, fire_at, title, body, url)
  select auth.uid(), left(x.key, 200), x.fire_at, left(coalesce(nullif(btrim(x.title), ''), 'Rappel'), 200), left(coalesce(x.body, ''), 300),
         case when x.url like '/%' then left(x.url, 300) else '/' end
  from jsonb_to_recordset(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end)
       as x(key text, fire_at timestamptz, title text, body text, url text)
  where (x.key like 'event:%' or x.key like 'task:%') and x.fire_at > now() - interval '5 minutes' and x.fire_at < now() + interval '40 days'
  order by x.fire_at
  limit 300
  on conflict (user_id, key) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.replace_my_reminders(jsonb) from public, anon;
grant execute on function public.replace_my_reminders(jsonb) to authenticated;
