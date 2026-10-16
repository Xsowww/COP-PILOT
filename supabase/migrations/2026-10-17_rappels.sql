-- Rappels et notifications push : à coller dans Supabase › SQL Editor.
-- Sans elle, l'appli marche comme avant (les rappels restent sur l'appareil, pas de notification site fermé).

-- ── Rappels sur les événements et les tâches ────────────────────────────────
-- Minutes avant le moment de l'élément (heure de début, ou 9 h s'il n'a pas d'heure) : [60, 15, 0]…
alter table public.events add column if not exists reminders jsonb
  check (reminders is null or (jsonb_typeof(reminders) = 'array' and jsonb_array_length(reminders) <= 10));
alter table public.todos add column if not exists due_time text check (due_time is null or due_time ~ '^\d{2}:\d{2}$');
alter table public.todos add column if not exists reminders jsonb
  check (reminders is null or (jsonb_typeof(reminders) = 'array' and jsonb_array_length(reminders) <= 10));

-- ── File des rappels à envoyer ──────────────────────────────────────────────
-- L'appli calcule les prochains rappels (elle connaît le fuseau horaire de la personne) et les dépose ici ;
-- le serveur du site envoie ceux qui arrivent à l'heure, puis les marque envoyés.
create table if not exists public.reminders (
  user_id uuid not null references auth.users on delete cascade,
  key text not null check (char_length(key) <= 200),
  fire_at timestamptz not null,
  title text not null check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 300),
  url text not null default '/' check (char_length(url) <= 300 and url like '/%'),
  sent_at timestamptz,
  primary key (user_id, key)
);
create index if not exists reminders_due on public.reminders (fire_at) where sent_at is null;
alter table public.reminders enable row level security; -- aucune règle : seulement par les fonctions ci-dessous

-- Remplace les rappels à venir de la personne connectée par la liste donnée (300 au plus, 40 jours).
-- Ceux déjà envoyés restent marqués : un rappel n'est jamais envoyé deux fois.
create or replace function public.replace_my_reminders(p_items jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  if auth.uid() is null or not public.mfa_ok() then
    raise exception 'mfa required';
  end if;
  -- (les notifications d'administration, « admin:… », ne viennent pas de l'appli : elles restent)
  delete from public.reminders where user_id = auth.uid() and key not like 'admin:%' and (sent_at is null or sent_at < now() - interval '3 days');
  insert into public.reminders (user_id, key, fire_at, title, body, url)
  select auth.uid(), left(x.key, 200), x.fire_at, left(coalesce(nullif(btrim(x.title), ''), 'Rappel'), 200), left(coalesce(x.body, ''), 300),
         case when x.url like '/%' then left(x.url, 300) else '/' end
  from jsonb_to_recordset(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end)
       as x(key text, fire_at timestamptz, title text, body text, url text)
  where x.key is not null and x.fire_at > now() - interval '5 minutes' and x.fire_at < now() + interval '40 days'
  order by x.fire_at
  limit 300
  on conflict (user_id, key) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.replace_my_reminders(jsonb) from public, anon;
grant execute on function public.replace_my_reminders(jsonb) to authenticated;

-- Pour le serveur du site seulement (clé « service_role ») : prend les rappels arrivés à l'heure et les marque envoyés.
-- Un rappel en retard de plus de 30 minutes (serveur arrêté) n'est plus envoyé.
create or replace function public.claim_due_reminders() returns table (user_id uuid, key text, title text, body text, url text, fire_at timestamptz)
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
  returning r.user_id, r.key, r.title, r.body, r.url, r.fire_at;
end;
$$;
revoke all on function public.claim_due_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_reminders() to service_role;

-- ── Appareils qui reçoivent les notifications push ──────────────────────────
-- Une ligne par compte et par navigateur (un téléphone avec un compte perso et un compte travail : deux lignes).
create table if not exists public.push_subscriptions (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  device text check (device is null or char_length(device) <= 200),
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "appareils : les siens" on public.push_subscriptions;
create policy "appareils : les siens" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "2fa obligatoire" on public.push_subscriptions;
create policy "2fa obligatoire" on public.push_subscriptions as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

-- ── Administration : ce qu'il reste à traiter ───────────────────────────────
-- Le nombre de signalements et d'avis ouverts, pour la pastille du menu (0 pour un compte qui n'est pas admin).
create or replace function public.admin_open_count() returns integer
language sql stable security definer set search_path = '' as $$
  select case when public.is_admin() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    then (select count(*)::int from public.reports where status = 'open') + (select count(*)::int from public.feedback where status = 'open')
    else 0 end;
$$;
revoke all on function public.admin_open_count() from public, anon;
grant execute on function public.admin_open_count() to authenticated;

-- Un signalement ou un avis arrive : chaque administrateur reçoit une notification (par la même file).
create or replace function public.notify_admins() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
  v_body text;
begin
  -- (deux branches : les deux tables n'ont pas les mêmes colonnes)
  if tg_table_name = 'reports' then
    v_title := 'Nouveau signalement';
    v_body := coalesce(new.snapshot ->> 'title', 'Un contenu de groupe');
  else
    v_title := case when new.kind = 'bug' then 'Nouveau bug signalé' else 'Nouvel avis' end;
    v_body := left(new.message, 140);
  end if;
  insert into public.reminders (user_id, key, fire_at, title, body, url)
  select a.user_id, 'admin:' || tg_table_name || ':' || new.id, now(), v_title, coalesce(v_body, ''), '/admin?vue=traiter'
  from public.admins a
  on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists reports_notify_admins on public.reports;
create trigger reports_notify_admins after insert on public.reports for each row execute procedure public.notify_admins();
drop trigger if exists feedback_notify_admins on public.feedback;
create trigger feedback_notify_admins after insert on public.feedback for each row execute procedure public.notify_admins();
