alter table if exists public.contatos
  add column if not exists ai_session_id uuid,
  add column if not exists ai_session_updated_at timestamptz,
  add column if not exists ai_session_closed_at timestamptz;

create index if not exists idx_contatos_ai_session_id
on public.contatos(ai_session_id);

alter table if exists public.empresa_settings
  add column if not exists ai_session_timeout_minutes int not null default 60;
