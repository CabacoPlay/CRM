alter table if exists public.contatos
  add column if not exists oculta boolean not null default false;

create index if not exists idx_contatos_oculta on public.contatos(oculta);
