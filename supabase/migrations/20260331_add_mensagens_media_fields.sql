alter table if exists public.mensagens
  add column if not exists tipo text not null default 'text' check (tipo in ('text','image','video','document','audio'));

alter table if exists public.mensagens
  add column if not exists media_url text;

alter table if exists public.mensagens
  add column if not exists mimetype text;

alter table if exists public.mensagens
  add column if not exists file_name text;

alter table if exists public.mensagens
  add column if not exists duration_ms integer;

create index if not exists idx_mensagens_tipo
on public.mensagens(tipo);
