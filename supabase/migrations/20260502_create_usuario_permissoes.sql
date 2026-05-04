create table if not exists public.usuario_permissoes (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  user_id uuid not null references public.usuarios(id) on delete cascade,
  can_view_contact_phone boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (empresa_id, user_id)
);

alter table public.usuario_permissoes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'usuario_permissoes'
      and policyname = 'permit select usuario_permissoes'
  ) then
    create policy "permit select usuario_permissoes" on public.usuario_permissoes for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'usuario_permissoes'
      and policyname = 'permit insert usuario_permissoes'
  ) then
    create policy "permit insert usuario_permissoes" on public.usuario_permissoes for insert with check (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'usuario_permissoes'
      and policyname = 'permit update usuario_permissoes'
  ) then
    create policy "permit update usuario_permissoes" on public.usuario_permissoes for update using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'usuario_permissoes'
      and policyname = 'permit delete usuario_permissoes'
  ) then
    create policy "permit delete usuario_permissoes" on public.usuario_permissoes for delete using (true);
  end if;
end $$;

drop trigger if exists update_usuario_permissoes_updated_at on public.usuario_permissoes;
create trigger update_usuario_permissoes_updated_at
  before update on public.usuario_permissoes
  for each row
  execute function public.update_updated_at_column();
