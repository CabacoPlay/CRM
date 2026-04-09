alter table if exists public.empresas
  add column if not exists billing_enabled boolean not null default false,
  add column if not exists billing_plan text not null default 'free',
  add column if not exists billing_due_date date,
  add column if not exists billing_grace_days int not null default 3,
  add column if not exists billing_status text not null default 'active',
  add column if not exists billing_last_notified_at timestamptz;

