create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  type text not null,
  detail text,
  created_at timestamptz not null default now()
);

