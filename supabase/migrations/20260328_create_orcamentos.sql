create table if not exists public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  contato_id uuid references public.contatos(id) on delete set null,
  titulo text not null,
  descricao text,
  status text not null default 'Pendente' check (status in ('Pendente','Aprovado','Cancelado')),
  logo_url text,
  pdf_url text,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orcamentos_empresa_id_created_at
on public.orcamentos(empresa_id, created_at desc);

create table if not exists public.orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
  catalog_item_id uuid references public.catalog_items(id) on delete set null,
  tipo text not null check (tipo in ('Produto','Serviço')),
  nome text not null,
  descricao text,
  quantidade numeric(12,2) not null default 1,
  valor_unitario numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_orcamento_itens_orcamento_id_position
on public.orcamento_itens(orcamento_id, position);

create trigger update_orcamentos_updated_at
  before update on public.orcamentos
  for each row
  execute function public.update_updated_at_column();

alter table public.orcamentos enable row level security;
alter table public.orcamento_itens enable row level security;

create policy "permit select orcamentos" on public.orcamentos for select using (true);
create policy "permit insert orcamentos" on public.orcamentos for insert with check (true);
create policy "permit update orcamentos" on public.orcamentos for update using (true) with check (true);
create policy "permit delete orcamentos" on public.orcamentos for delete using (true);

create policy "permit select orcamento_itens" on public.orcamento_itens for select using (true);
create policy "permit insert orcamento_itens" on public.orcamento_itens for insert with check (true);
create policy "permit update orcamento_itens" on public.orcamento_itens for update using (true) with check (true);
create policy "permit delete orcamento_itens" on public.orcamento_itens for delete using (true);

insert into storage.buckets (id, name, public)
values ('orcamentos', 'orcamentos', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Anyone can view orcamentos'
  ) then
    create policy "Anyone can view orcamentos"
    on storage.objects
    for select
    using (bucket_id = 'orcamentos');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Anyone can upload orcamentos'
  ) then
    create policy "Anyone can upload orcamentos"
    on storage.objects
    for insert
    with check (bucket_id = 'orcamentos');
  end if;
end $$;
