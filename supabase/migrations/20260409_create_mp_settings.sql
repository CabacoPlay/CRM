create table if not exists public.mp_settings (
  id text primary key default 'default',
  env text,
  access_token text,
  webhook_secret text,
  updated_at timestamptz not null default now()
);

alter table public.mp_settings enable row level security;
