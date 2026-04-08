do $$
begin
  alter table if exists public.agendamentos replica identity full;
exception
  when undefined_table then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.agendamentos;
exception
  when duplicate_object then null;
end $$;
