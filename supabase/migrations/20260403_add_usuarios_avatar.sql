alter table if exists public.usuarios
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('user-avatars', 'user-avatars', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Anyone can view user-avatars'
  ) then
    create policy "Anyone can view user-avatars"
    on storage.objects
    for select
    using (bucket_id = 'user-avatars');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Anyone can upload user-avatars'
  ) then
    create policy "Anyone can upload user-avatars"
    on storage.objects
    for insert
    with check (bucket_id = 'user-avatars');
  end if;
end $$;

