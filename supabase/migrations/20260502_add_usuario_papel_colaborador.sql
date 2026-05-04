do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'usuario_papel'
      and e.enumlabel = 'colaborador'
  ) then
    alter type public.usuario_papel add value 'colaborador';
  end if;
end $$;
