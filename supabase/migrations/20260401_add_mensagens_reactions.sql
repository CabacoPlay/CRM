alter table if exists public.mensagens
  add column if not exists reacao_emoji text;

alter table if exists public.mensagens
  add column if not exists reacao_direcao text check (reacao_direcao in ('in','out'));

alter table if exists public.mensagens
  add column if not exists reacao_em timestamptz;

create index if not exists idx_mensagens_reacao_em
on public.mensagens(reacao_em);
