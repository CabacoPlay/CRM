-- Garantir exclusividade de slot por empresa/hora
ALTER TABLE public.agendamentos
ADD CONSTRAINT agendamentos_unique_slot UNIQUE (empresa_id, data_hora);

