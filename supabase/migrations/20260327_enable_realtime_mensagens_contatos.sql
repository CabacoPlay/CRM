alter table if exists public.mensagens replica identity full;
alter table if exists public.contatos replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.mensagens;
  exception when duplicate_object then
    null;
  end;
  begin
    alter publication supabase_realtime add table public.contatos;
  exception when duplicate_object then
    null;
  end;
end $$;
