alter table public.ias
  add column if not exists response_delay_min_ms integer not null default 900,
  add column if not exists response_delay_max_ms integer not null default 2800;
