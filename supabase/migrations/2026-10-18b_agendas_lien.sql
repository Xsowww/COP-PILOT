-- Agendas partagés, suite : à coller dans Supabase › SQL Editor (après 2026-10-18_agendas_partages.sql).
-- - On rejoint un agenda seulement par son lien (un jeton secret de 64 caractères), plus par un code à 6 caractères.
-- - Le propriétaire est prévenu quand quelqu'un rejoint ; chaque ajout, modification ou suppression d'événement
--   prévient les autres membres.
-- - Les événements d'agenda ont une catégorie et des notes ; tout éditeur de l'agenda peut les modifier.

alter table public.groups add column if not exists invite_token text unique check (invite_token is null or invite_token ~ '^[0-9a-f]{64}$');
alter table public.group_events add column if not exists category text check (category is null or category in ('cours', 'examen', 'devoir', 'perso', 'sport'));
alter table public.group_events add column if not exists details text check (details is null or char_length(details) <= 2000);

-- Jeton de lien : 2 × 122 bits tirés au hasard (impossible à deviner, contrairement à un code court).
create or replace function public.new_agenda_token() returns text
language sql volatile security definer set search_path = '' as $$
  select replace(pg_catalog.gen_random_uuid()::text || pg_catalog.gen_random_uuid()::text, '-', '');
$$;
revoke all on function public.new_agenda_token() from public, anon, authenticated;
update public.groups set invite_token = public.new_agenda_token() where kind = 'agenda' and invite_token is null;

create or replace function public.groups_agenda_token() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind = 'agenda' and new.invite_token is null then new.invite_token := public.new_agenda_token(); end if;
  return new;
end;
$$;
drop trigger if exists groups_agenda_token on public.groups;
create trigger groups_agenda_token before insert on public.groups for each row execute procedure public.groups_agenda_token();

create or replace function public.is_agenda(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.groups where id = gid and kind = 'agenda');
$$;
revoke all on function public.is_agenda(uuid) from public, anon;
grant execute on function public.is_agenda(uuid) to authenticated;

-- Le lien d'un agenda : pour le propriétaire et les membres autorisés à inviter (comme le code d'un groupe).
create or replace function public.agenda_invite_token(p_group uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.mfa_ok() then raise exception 'mfa required'; end if;
  return (
    select g.invite_token from public.groups g
    where g.id = p_group and g.kind = 'agenda'
      and (g.owner_id = auth.uid()
           or exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = auth.uid() and m.can_invite))
  );
end;
$$;
revoke all on function public.agenda_invite_token(uuid) from public, anon;
grant execute on function public.agenda_invite_token(uuid) to authenticated;

-- Nouveau lien (l'ancien cesse de marcher) : propriétaire seulement.
create or replace function public.regenerate_agenda_token(p_group uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  t text := public.new_agenda_token();
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.mfa_ok() then raise exception 'mfa required'; end if;
  if not public.is_group_owner(p_group) or not public.is_agenda(p_group) then raise exception 'forbidden'; end if;
  update public.groups set invite_token = t where id = p_group;
  return t;
end;
$$;
revoke all on function public.regenerate_agenda_token(uuid) from public, anon;
grant execute on function public.regenerate_agenda_token(uuid) to authenticated;

-- Rejoindre par le lien. Renvoie l'agenda, ou null si le lien ne marche plus. Prévient le propriétaire.
create or replace function public.join_agenda(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  g public.groups;
  who text;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not public.mfa_ok() then raise exception 'mfa required'; end if;
  if (select count(*) from public.group_join_attempts where user_id = me and at > now() - interval '15 minutes') >= 15 then
    raise exception 'too many attempts';
  end if;
  select * into g from public.groups where kind = 'agenda' and invite_token = lower(btrim(coalesce(p_token, '')));
  if g.id is null then
    delete from public.group_join_attempts where user_id = me and at < now() - interval '1 day';
    insert into public.group_join_attempts (user_id) values (me);
    return null;
  end if;
  if exists (select 1 from public.group_members where group_id = g.id and user_id = me) then
    return g.id;
  end if;
  if (select count(*) from public.group_members where group_id = g.id) >= 50 then raise exception 'group full'; end if;
  if (select count(*) from public.group_members where user_id = me) >= 30 then raise exception 'too many groups'; end if;
  insert into public.group_members (group_id, user_id) values (g.id, me);
  select coalesce(nullif(btrim(name), ''), 'Quelqu’un') into who from public.profiles where id = me;
  if g.owner_id is not null then
    insert into public.reminders (user_id, key, fire_at, title, body, url)
    values (g.owner_id, 'agenda-membre:' || g.id || ':' || me, now(), left(coalesce(who, 'Quelqu’un') || ' a rejoint « ' || g.name || ' »', 200),
            'Nouveau membre' || E'\n' || 'Agenda « ' || left(g.name, 60) || ' »', '/agendas?g=' || g.id)
    on conflict do nothing;
  end if;
  return g.id;
end;
$$;
revoke all on function public.join_agenda(text) from public, anon;
grant execute on function public.join_agenda(text) to authenticated;

-- Un code à 6 caractères ne fait plus entrer dans un agenda (seulement dans un groupe).
create or replace function public.join_group(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  gid uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not public.mfa_ok() then raise exception 'mfa required'; end if;
  if (select count(*) from public.group_join_attempts where user_id = me and at > now() - interval '15 minutes') >= 15 then
    raise exception 'too many attempts';
  end if;
  select id into gid from public.groups where kind = 'groupe' and invite_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if gid is null then
    delete from public.group_join_attempts where user_id = me and at < now() - interval '1 day';
    insert into public.group_join_attempts (user_id) values (me);
    return null;
  end if;
  if exists (select 1 from public.group_members where group_id = gid and user_id = me) then
    return gid;
  end if;
  if (select count(*) from public.group_members where group_id = gid) >= 50 then
    raise exception 'group full';
  end if;
  if (select count(*) from public.group_members where user_id = me) >= 30 then
    raise exception 'too many groups';
  end if;
  insert into public.group_members (group_id, user_id) values (gid, me);
  return gid;
end;
$$;
revoke all on function public.join_group(text) from public, anon;
grant execute on function public.join_group(text) to authenticated;

-- Dans un agenda, tout éditeur modifie et supprime n'importe quel événement (dans un groupe : l'auteur ou le propriétaire).
drop policy if exists "révisions : modification" on public.group_events;
create policy "révisions : modification" on public.group_events for update to authenticated
  using ((select public.can_edit_group(group_id)) and (created_by = (select auth.uid()) or (select public.is_group_owner(group_id)) or (select public.is_agenda(group_id))))
  with check ((select public.can_edit_group(group_id)));
drop policy if exists "révisions : suppression" on public.group_events;
create policy "révisions : suppression" on public.group_events for delete to authenticated
  using ((select public.can_edit_group(group_id)) and (created_by = (select auth.uid()) or (select public.is_group_owner(group_id)) or (select public.is_agenda(group_id))));

-- Ajout, modification, suppression dans un agenda : les autres membres sont prévenus.
create or replace function public.notify_agenda_members() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ev public.group_events := case when tg_op = 'DELETE' then old else new end;
  g public.groups;
  who text;
  what text;
begin
  if pg_trigger_depth() > 1 then return null; end if; -- changes made by the database itself (account deleted…)
  select * into g from public.groups where id = ev.group_id;
  if g.kind is distinct from 'agenda' then return null; end if;
  if tg_op = 'UPDATE' and (old.title, old.date, old.start_time, old.end_time, old.category, old.details, old.place)
     is not distinct from (new.title, new.date, new.start_time, new.end_time, new.category, new.details, new.place) then
    return null;
  end if;
  select coalesce(nullif(btrim(name), ''), 'Un membre') into who from public.profiles where id = auth.uid();
  what := case tg_op when 'INSERT' then 'Ajouté' when 'UPDATE' then 'Modifié' else 'Supprimé' end;
  insert into public.reminders (user_id, key, fire_at, title, body, url)
  select m.user_id, 'agenda:' || ev.id || ':' || tg_op || ':' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint, now(),
         left(ev.title, 200),
         left(
           what || ' par ' || coalesce(who, 'un membre') || ' · ' || to_char(ev.date, 'DD/MM')
             || coalesce(' à ' || regexp_replace(replace(ev.start_time, ':', 'h'), 'h00$', 'h'), '')
             || E'\n' || 'Agenda « ' || left(g.name, 60) || ' »',
           300),
         '/agendas?g=' || ev.group_id || case when tg_op = 'DELETE' then '' else '&jour=' || ev.date end
  from public.group_members m
  where m.group_id = ev.group_id and m.user_id is distinct from auth.uid()
  on conflict do nothing;
  return null;
end;
$$;
revoke all on function public.notify_agenda_members() from public, anon, authenticated;
drop trigger if exists group_events_notify_agenda on public.group_events;
create trigger group_events_notify_agenda after insert or update or delete on public.group_events
  for each row execute procedure public.notify_agenda_members();
