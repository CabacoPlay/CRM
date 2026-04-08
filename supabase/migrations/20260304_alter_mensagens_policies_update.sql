-- Torna update idempotente
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
      and tablename = 'mensagens' 
      and policyname = 'permit update mensagens'
  )
  then
    create policy "permit update mensagens" on public.mensagens for update using (true) with check (true);
  end if;
end $$;

