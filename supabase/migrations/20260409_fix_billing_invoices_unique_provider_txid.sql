drop index if exists billing_invoices_provider_txid_uq;

create unique index if not exists billing_invoices_provider_provider_txid_uq
on public.billing_invoices(provider, provider_txid);
