create table if not exists public.respostas_rapidas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  titulo text not null,
  atalho text,
  mensagem text not null,
  created_by_user_id uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists respostas_rapidas_empresa_titulo_uniq
on public.respostas_rapidas(empresa_id, lower(titulo));

create unique index if not exists respostas_rapidas_empresa_atalho_uniq
on public.respostas_rapidas(empresa_id, lower(atalho))
where atalho is not null and length(trim(atalho)) > 0;

create index if not exists idx_respostas_rapidas_empresa_id
on public.respostas_rapidas(empresa_id);

alter table public.respostas_rapidas enable row level security;

create policy "permit select respostas_rapidas" on public.respostas_rapidas for select using (true);
create policy "permit insert respostas_rapidas" on public.respostas_rapidas for insert with check (true);
create policy "permit update respostas_rapidas" on public.respostas_rapidas for update using (true) with check (true);
create policy "permit delete respostas_rapidas" on public.respostas_rapidas for delete using (true);

create trigger update_respostas_rapidas_updated_at
  before update on public.respostas_rapidas
  for each row
  execute function public.update_updated_at_column();
