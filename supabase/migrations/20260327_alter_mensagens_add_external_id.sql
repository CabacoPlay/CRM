alter table if exists public.mensagens
  add column if not exists external_id text;

create unique index if not exists mensagens_external_id_uniq
on public.mensagens(external_id)
where external_id is not null;

alter table if exists public.mensagens
  add column if not exists updated_at timestamptz default now();
