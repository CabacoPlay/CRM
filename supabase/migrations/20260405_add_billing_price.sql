alter table if exists public.empresas
  add column if not exists billing_price_cents integer,
  add column if not exists billing_currency text not null default 'BRL';

