drop table if exists public.efi_settings;

alter table public.billing_invoices
  alter column provider set default 'mercadopago';
