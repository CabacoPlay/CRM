create table if not exists public.catalog_item_attributes (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  key text not null,
  value text not null,
  created_at timestamptz not null default now(),
  primary key (catalog_item_id, key)
);

create index if not exists catalog_item_attributes_empresa_key_value_idx
  on public.catalog_item_attributes (empresa_id, key, value);

alter table public.catalog_item_attributes enable row level security;

create policy "Allow public to view catalog_item_attributes" on public.catalog_item_attributes for select using (true);
create policy "Allow public to create catalog_item_attributes" on public.catalog_item_attributes for insert with check (true);
create policy "Allow public to update catalog_item_attributes" on public.catalog_item_attributes for update using (true);
create policy "Allow public to delete catalog_item_attributes" on public.catalog_item_attributes for delete using (true);
