create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  provider text not null default 'efi',
  provider_txid text not null,
  provider_location_id bigint,
  amount_cents integer not null,
  currency text not null default 'BRL',
  status text not null default 'pending',
  expires_at timestamptz,
  pix_copy_paste text,
  pix_qr_image text,
  raw jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists billing_invoices_provider_txid_uq on public.billing_invoices(provider_txid);
create index if not exists billing_invoices_empresa_status_idx on public.billing_invoices(empresa_id, status, created_at desc);

alter table public.billing_invoices enable row level security;

create policy "permit select billing_invoices" on public.billing_invoices for select using (true);
create policy "permit insert billing_invoices" on public.billing_invoices for insert with check (true);
create policy "permit update billing_invoices" on public.billing_invoices for update using (true);
