alter table if exists public.agendamentos
  add column if not exists created_by_user_id uuid references public.usuarios(id) on delete set null;

create index if not exists idx_agendamentos_created_by_user_id
on public.agendamentos(created_by_user_id);
