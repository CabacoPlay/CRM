alter table if exists public.contatos
  add column if not exists profile_img_fetched_at timestamptz;
