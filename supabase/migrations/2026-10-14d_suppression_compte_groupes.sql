-- Suppression d'un compte qui a écrit dans un groupe : elle échouait (« violates foreign key
-- constraint group_notes_created_by_fkey »). En mettant l'auteur à vide, la base déclenchait
-- les fonctions ci-dessous, qui remettaient l'ancien auteur. Elles laissent maintenant passer
-- les mises à jour faites par la base elle-même.

create or replace function public.group_notes_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Mise à jour faite par la base elle-même (suppression d'un compte : son nom passe à vide dans
  -- ses notes, événements et fichiers de groupe) : on la laisse passer telle quelle.
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.group_id := old.group_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create or replace function public.group_events_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Mise à jour faite par la base elle-même (suppression d'un compte : son nom passe à vide dans
  -- ses notes, événements et fichiers de groupe) : on la laisse passer telle quelle.
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.group_id := old.group_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create or replace function public.group_files_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Mise à jour faite par la base elle-même (suppression d'un compte : son nom passe à vide dans
  -- ses notes, événements et fichiers de groupe) : on la laisse passer telle quelle.
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.id := old.id;
    new.group_id := old.group_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
