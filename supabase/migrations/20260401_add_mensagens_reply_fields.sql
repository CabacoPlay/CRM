alter table if exists public.mensagens
  add column if not exists reply_to_message_id uuid references public.mensagens(id) on delete set null;

alter table if exists public.mensagens
  add column if not exists reply_to_external_id text;

alter table if exists public.mensagens
  add column if not exists reply_to_preview text;

create index if not exists idx_mensagens_reply_to_message_id
on public.mensagens(reply_to_message_id);
