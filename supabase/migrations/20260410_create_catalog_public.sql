create table if not exists public.catalog_public_settings (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  slug text not null,
  enabled boolean not null default true,
  primary_color text not null default '#22c55e',
  background_color text not null default '#0b0f14',
  card_color text not null default '#0f1720',
  whatsapp_phone text,
  cta_template text not null default 'Olá! Tenho interesse em {{item_nome}} ({{item_valor}}).',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists catalog_public_settings_slug_unique on public.catalog_public_settings (lower(slug));

create table if not exists public.catalog_public_flow (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  flow jsonb not null default '{"version":1,"start_step_id":"","steps":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.catalog_public_settings enable row level security;
alter table public.catalog_public_flow enable row level security;

create policy "Allow public to view catalog_public_settings" on public.catalog_public_settings for select using (true);
create policy "Allow public to create catalog_public_settings" on public.catalog_public_settings for insert with check (true);
create policy "Allow public to update catalog_public_settings" on public.catalog_public_settings for update using (true);
create policy "Allow public to delete catalog_public_settings" on public.catalog_public_settings for delete using (true);

create policy "Allow public to view catalog_public_flow" on public.catalog_public_flow for select using (true);
create policy "Allow public to create catalog_public_flow" on public.catalog_public_flow for insert with check (true);
create policy "Allow public to update catalog_public_flow" on public.catalog_public_flow for update using (true);
create policy "Allow public to delete catalog_public_flow" on public.catalog_public_flow for delete using (true);

do $$
begin
  if exists (select 1 from pg_proc where proname = 'update_updated_at_column') then
    create trigger update_catalog_public_settings_updated_at
      before update on public.catalog_public_settings
      for each row
      execute function public.update_updated_at_column();
  end if;
exception when duplicate_object then
  null;
end $$;
