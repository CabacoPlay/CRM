do $$
begin
  alter table public.agendamentos
    drop constraint if exists agendamentos_unique_slot;
exception
  when undefined_table then
    null;
end $$;

do $$
begin
  create unique index if not exists agendamentos_unique_slot_active_idx
    on public.agendamentos (empresa_id, data_hora)
    where status <> 'Cancelado';
exception
  when undefined_table then
    null;
end $$;
