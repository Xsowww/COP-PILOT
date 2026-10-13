-- COP-PILOT · corbeille unique : les événements du calendrier vont aussi à la corbeille.

alter table public.events add column if not exists deleted_at timestamptz;
