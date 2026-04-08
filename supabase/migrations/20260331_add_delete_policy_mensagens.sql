do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'mensagens'
      and policyname = 'permit delete mensagens'
  )
  then
    create policy "permit delete mensagens" on public.mensagens for delete using (true);
  end if;
end $$;

