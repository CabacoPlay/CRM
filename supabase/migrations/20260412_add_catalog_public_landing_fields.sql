alter table public.catalog_public_settings
  add column if not exists headline text,
  add column if not exists subheadline text,
  add column if not exists cover_image_url text;
