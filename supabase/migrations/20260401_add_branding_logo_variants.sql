alter table if exists public.branding_configs
  add column if not exists logo_url_light text;

alter table if exists public.branding_configs
  add column if not exists logo_url_dark text;
