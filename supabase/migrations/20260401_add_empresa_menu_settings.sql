alter table if exists public.empresa_settings
  add column if not exists menu_enabled boolean not null default false;

alter table if exists public.empresa_settings
  add column if not exists menu_greeting text not null default '';

alter table if exists public.empresa_settings
  add column if not exists menu_tree jsonb not null default '[]'::jsonb;

alter table if exists public.empresa_settings
  add column if not exists menu_timeout_minutes integer not null default 30;

create table if not exists public.menu_sessions (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  path text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists menu_sessions_empresa_contato_uniq
on public.menu_sessions(empresa_id, contato_id);

alter table public.menu_sessions enable row level security;
create policy "permit select menu_sessions" on public.menu_sessions for select using (true);
create policy "permit insert menu_sessions" on public.menu_sessions for insert with check (true);
create policy "permit update menu_sessions" on public.menu_sessions for update using (true) with check (true);
create policy "permit delete menu_sessions" on public.menu_sessions for delete using (true);
