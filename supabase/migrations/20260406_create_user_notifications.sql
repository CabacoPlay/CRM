create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.usuarios(id) on delete cascade,
  empresa_id uuid references public.empresas(id) on delete cascade,
  type text not null,
  title text not null,
  description text not null,
  meta jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.user_notifications enable row level security;

create policy "permit select user_notifications" on public.user_notifications for select using (true);
create policy "permit insert user_notifications" on public.user_notifications for insert with check (true);
create policy "permit update user_notifications" on public.user_notifications for update using (true);

