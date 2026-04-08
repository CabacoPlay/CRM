alter table if exists public.contatos
  add column if not exists conversa_status text not null default 'aberta' check (conversa_status in ('aberta','resolvida'));

alter table if exists public.contatos
  add column if not exists conversa_resolvida_em timestamptz;

alter table if exists public.contatos
  add column if not exists conversa_resolvida_por uuid references public.usuarios(id) on delete set null;

create index if not exists idx_contatos_conversa_status
on public.contatos(conversa_status);

create index if not exists idx_contatos_conversa_resolvida_em
on public.contatos(conversa_resolvida_em);
