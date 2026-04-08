create table if not exists public.orcamento_settings (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  logo_url text,
  email text,
  instagram text,
  whatsapp text,
  pix_chave text,
  pix_nome text,
  pix_banco text,
  validade_dias int not null default 7,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger update_orcamento_settings_updated_at
  before update on public.orcamento_settings
  for each row
  execute function public.update_updated_at_column();

alter table public.orcamento_settings enable row level security;

create policy "permit select orcamento_settings" on public.orcamento_settings for select using (true);
create policy "permit insert orcamento_settings" on public.orcamento_settings for insert with check (true);
create policy "permit update orcamento_settings" on public.orcamento_settings for update using (true) with check (true);
create policy "permit delete orcamento_settings" on public.orcamento_settings for delete using (true);

