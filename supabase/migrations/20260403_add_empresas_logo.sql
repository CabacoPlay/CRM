alter table if exists public.empresas
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public)
values ('empresa-logos', 'empresa-logos', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Anyone can view empresa-logos'
  ) then
    create policy "Anyone can view empresa-logos"
    on storage.objects
    for select
    using (bucket_id = 'empresa-logos');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Anyone can upload empresa-logos'
  ) then
    create policy "Anyone can upload empresa-logos"
    on storage.objects
    for insert
    with check (bucket_id = 'empresa-logos');
  end if;
end $$;

