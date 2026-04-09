alter table if exists public.conexoes
  add column if not exists last_status_checked_at timestamptz,
  add column if not exists last_status_raw text,
  add column if not exists last_status_error text;

