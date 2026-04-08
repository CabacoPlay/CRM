-- Tabela de mensagens para chat omnichannel
create table if not exists public.mensagens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete set null,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  direcao text not null check (direcao in ('in','out')),
  conteudo text not null,
  status text not null default 'pendente' check (status in ('pendente','enviado','erro')),
  created_at timestamptz not null default now()
);

alter table public.mensagens enable row level security;

create policy "permit select mensagens" on public.mensagens for select using (true);
create policy "permit insert mensagens" on public.mensagens for insert with check (true);

