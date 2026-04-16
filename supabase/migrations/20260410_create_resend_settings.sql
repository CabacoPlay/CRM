create table if not exists public.resend_settings (
  id text primary key default 'default',
  sender_title text,
  api_token text,
  updated_at timestamptz not null default now()
);

alter table public.resend_settings enable row level security;
