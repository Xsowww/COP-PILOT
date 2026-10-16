-- Signalements dans les groupes et avis / bugs envoyés depuis l'appli.
-- À coller dans Supabase › SQL Editor. Sans elle, les boutons « Signaler » et « Donner mon avis »
-- répondent que l'envoi est impossible ; le reste de l'appli fonctionne.

-- ── Signalements ─────────────────────────────────────────────────────────────
-- Un membre signale une note, un fichier ou un événement d'un groupe. Une copie du contenu
-- signalé (titre et début du texte) est gardée pour que l'administrateur puisse juger,
-- même si l'auteur le modifie ensuite.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users on delete set null,
  group_id uuid references public.groups on delete set null,
  kind text not null check (kind in ('note', 'file', 'event')),
  item_id uuid not null,
  author_id uuid references auth.users on delete set null,
  reason text not null check (reason in ('illegal', 'hate', 'rights', 'spam', 'other')),
  message text check (message is null or char_length(message) <= 1000),
  snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'dismissed', 'removed')),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create index if not exists reports_status on public.reports (status, created_at desc);
create index if not exists reports_reporter on public.reports (reporter_id, created_at);
alter table public.reports enable row level security; -- aucune règle : seulement par les fonctions ci-dessous

create or replace function public.report_group_item(p_kind text, p_item uuid, p_reason text, p_message text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_group uuid;
  v_author uuid;
  v_snap jsonb;
begin
  if auth.uid() is null or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'mfa required';
  end if;
  -- 20 signalements par jour et par compte : assez pour un vrai problème, pas pour inonder.
  if (select count(*) from public.reports where reporter_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many reports';
  end if;
  if p_kind = 'note' then
    select group_id, created_by, jsonb_build_object('title', title, 'excerpt',
             left(btrim(regexp_replace(regexp_replace(content, '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g')), 600))
      into v_group, v_author, v_snap from public.group_notes where id = p_item;
  elsif p_kind = 'file' then
    select group_id, created_by, jsonb_build_object('title', name, 'mime', mime, 'size', size)
      into v_group, v_author, v_snap from public.group_files where id = p_item;
  elsif p_kind = 'event' then
    select group_id, created_by, jsonb_build_object('title', title, 'date', date, 'start', start_time, 'place', place)
      into v_group, v_author, v_snap from public.group_events where id = p_item;
  else
    raise exception 'bad kind';
  end if;
  if v_group is null or not public.is_group_member(v_group) then
    raise exception 'forbidden';
  end if;
  v_snap := v_snap || jsonb_build_object('group', (select name from public.groups where id = v_group));
  insert into public.reports (reporter_id, group_id, kind, item_id, author_id, reason, message, snapshot)
  values (auth.uid(), v_group, p_kind, p_item, v_author, p_reason, nullif(btrim(left(coalesce(p_message, ''), 1000)), ''), v_snap);
end;
$$;
revoke all on function public.report_group_item(text, uuid, text, text) from public, anon;
grant execute on function public.report_group_item(text, uuid, text, text) to authenticated;

-- ── Avis et bugs ─────────────────────────────────────────────────────────────
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users on delete set null,
  kind text not null check (kind in ('idea', 'bug')),
  message text not null check (char_length(btrim(message)) between 1 and 4000),
  page text check (page is null or char_length(page) <= 300),
  device text check (device is null or char_length(device) <= 300),
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists feedback_status on public.feedback (status, created_at desc);
alter table public.feedback enable row level security;
drop policy if exists "avis : envoi" on public.feedback;
create policy "avis : envoi" on public.feedback for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open');
drop policy if exists "2fa obligatoire" on public.feedback;
create policy "2fa obligatoire" on public.feedback as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));
revoke update, delete on public.feedback from anon, authenticated;

create or replace function public.feedback_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.created_at := now();
  if (select count(*) from public.feedback where user_id = new.user_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too many messages';
  end if;
  return new;
end;
$$;
drop trigger if exists feedback_limit on public.feedback;
create trigger feedback_limit before insert on public.feedback
  for each row execute procedure public.feedback_limit();

-- ── Administration ───────────────────────────────────────────────────────────
create or replace function public.admin_inbox() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'forbidden';
  end if;
  -- Gardés 2 ans au plus (politique de confidentialité).
  delete from public.feedback where created_at < now() - interval '2 years';
  delete from public.reports where created_at < now() - interval '2 years';
  return jsonb_build_object(
    'reports', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'kind', r.kind, 'item_id', r.item_id, 'group_id', r.group_id, 'reason', r.reason,
        'message', r.message, 'snapshot', r.snapshot, 'status', r.status, 'created_at', r.created_at,
        'reporter', ur.email, 'author', ua.email,
        'still_there', case r.kind
          when 'note' then exists (select 1 from public.group_notes n where n.id = r.item_id)
          when 'file' then exists (select 1 from public.group_files f where f.id = r.item_id)
          else exists (select 1 from public.group_events e where e.id = r.item_id) end
      ) order by (r.status = 'open') desc, r.created_at desc), '[]'::jsonb)
      from (select * from public.reports order by (status = 'open') desc, created_at desc limit 100) r
      left join auth.users ur on ur.id = r.reporter_id
      left join auth.users ua on ua.id = r.author_id),
    'feedback', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', f.id, 'kind', f.kind, 'message', f.message, 'page', f.page, 'device', f.device,
        'status', f.status, 'created_at', f.created_at, 'email', u.email
      ) order by (f.status = 'open') desc, f.created_at desc), '[]'::jsonb)
      from (select * from public.feedback order by (status = 'open') desc, created_at desc limit 100) f
      left join auth.users u on u.id = f.user_id)
  );
end;
$$;
revoke all on function public.admin_inbox() from public, anon;
grant execute on function public.admin_inbox() to authenticated;

-- Classer un signalement, ou retirer le contenu signalé. Pour un fichier, renvoie son chemin
-- dans le stockage : l'appli l'efface ensuite avec la règle « administrateur » ci-dessous.
create or replace function public.admin_handle_report(p_id uuid, p_action text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  r public.reports;
  v_path text;
begin
  if not public.is_admin() or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'forbidden';
  end if;
  select * into r from public.reports where id = p_id;
  if r.id is null then
    raise exception 'not found';
  end if;
  if p_action = 'remove' then
    if r.kind = 'note' then
      delete from public.group_notes where id = r.item_id;
    elsif r.kind = 'event' then
      delete from public.group_events where id = r.item_id;
    else
      delete from public.group_files where id = r.item_id returning group_id::text || '/' || id::text into v_path;
    end if;
    update public.reports set status = 'removed', handled_at = now()
      where kind = r.kind and item_id = r.item_id and status = 'open';
  elsif p_action = 'dismiss' then
    update public.reports set status = 'dismissed', handled_at = now() where id = p_id;
  else
    raise exception 'bad action';
  end if;
  return v_path;
end;
$$;
revoke all on function public.admin_handle_report(uuid, text) from public, anon;
grant execute on function public.admin_handle_report(uuid, text) to authenticated;

create or replace function public.admin_feedback_done(p_id uuid, p_done boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'forbidden';
  end if;
  update public.feedback set status = case when p_done then 'done' else 'open' end where id = p_id;
end;
$$;
revoke all on function public.admin_feedback_done(uuid, boolean) from public, anon;
grant execute on function public.admin_feedback_done(uuid, boolean) to authenticated;

-- L'administrateur peut effacer un fichier de groupe retiré après un signalement.
drop policy if exists "groupes : retrait par l'administrateur" on storage.objects;
create policy "groupes : retrait par l'administrateur" on storage.objects for delete to authenticated
  using (bucket_id = 'groups' and (select public.is_admin()) and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2');
