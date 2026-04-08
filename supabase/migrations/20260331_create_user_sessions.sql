create table if not exists public.user_sessions (
  token text primary key,
  user_id uuid not null references public.usuarios(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_sessions_user_id
on public.user_sessions(user_id);

create index if not exists idx_user_sessions_expires_at
on public.user_sessions(expires_at);
