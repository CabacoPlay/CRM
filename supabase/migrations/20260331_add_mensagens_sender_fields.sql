alter table if exists public.mensagens
  add column if not exists sender_user_id uuid references public.usuarios(id) on delete set null;

alter table if exists public.mensagens
  add column if not exists sender_name text;

create index if not exists idx_mensagens_sender_user
on public.mensagens(sender_user_id);
