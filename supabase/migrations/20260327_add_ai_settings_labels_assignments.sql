alter table if exists public.contatos
  add column if not exists atendimento_mode text not null default 'ia' check (atendimento_mode in ('ia','humano'));

alter table if exists public.contatos
  add column if not exists assigned_user_id uuid references public.usuarios(id) on delete set null;

create index if not exists idx_contatos_assigned_user_id
on public.contatos(assigned_user_id);

alter table if exists public.mensagens
  add column if not exists ai_dispatched_at timestamptz;

create table if not exists public.empresa_settings (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo',
  business_hours jsonb not null default '{}'::jsonb,
  assignment_mode text not null default 'manual' check (assignment_mode in ('manual','round_robin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.empresa_settings enable row level security;
create policy "permit select empresa_settings" on public.empresa_settings for select using (true);
create policy "permit insert empresa_settings" on public.empresa_settings for insert with check (true);
create policy "permit update empresa_settings" on public.empresa_settings for update using (true) with check (true);

create trigger update_empresa_settings_updated_at
  before update on public.empresa_settings
  for each row
  execute function public.update_updated_at_column();

create table if not exists public.etiquetas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  nome text not null,
  cor text not null default '#3B82F6',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists etiquetas_empresa_nome_uniq
on public.etiquetas(empresa_id, lower(nome));

create trigger update_etiquetas_updated_at
  before update on public.etiquetas
  for each row
  execute function public.update_updated_at_column();

alter table public.etiquetas enable row level security;
create policy "permit select etiquetas" on public.etiquetas for select using (true);
create policy "permit insert etiquetas" on public.etiquetas for insert with check (true);
create policy "permit update etiquetas" on public.etiquetas for update using (true) with check (true);
create policy "permit delete etiquetas" on public.etiquetas for delete using (true);

create table if not exists public.contato_etiquetas (
  contato_id uuid references public.contatos(id) on delete cascade,
  etiqueta_id uuid references public.etiquetas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contato_id, etiqueta_id)
);

alter table public.contato_etiquetas enable row level security;
create policy "permit select contato_etiquetas" on public.contato_etiquetas for select using (true);
create policy "permit insert contato_etiquetas" on public.contato_etiquetas for insert with check (true);
create policy "permit delete contato_etiquetas" on public.contato_etiquetas for delete using (true);

create index if not exists idx_contato_etiquetas_etiqueta_id
on public.contato_etiquetas(etiqueta_id);
