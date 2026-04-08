alter table if exists public.contatos
  add column if not exists conexao_id uuid references public.conexoes(id) on delete set null;

create index if not exists idx_contatos_conexao_id
on public.contatos(conexao_id);

alter table if exists public.mensagens
  add column if not exists conexao_id uuid references public.conexoes(id) on delete set null;

create index if not exists idx_mensagens_conexao_id
on public.mensagens(conexao_id);
