create table if not exists public.mensagens_agendadas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  conexao_id uuid references public.conexoes(id) on delete set null,
  tipo text not null check (tipo in ('text','image','video','document','audio')),
  texto text,
  media_base64 text,
  mimetype text,
  file_name text,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','sent','error','cancelled')),
  sent_at timestamptz,
  external_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mensagens_agendadas_due
on public.mensagens_agendadas(status, scheduled_for);

create index if not exists idx_mensagens_agendadas_contato
on public.mensagens_agendadas(contato_id, scheduled_for);

alter table public.mensagens_agendadas enable row level security;

create policy "permit select mensagens_agendadas" on public.mensagens_agendadas for select using (true);
create policy "permit insert mensagens_agendadas" on public.mensagens_agendadas for insert with check (true);
create policy "permit update mensagens_agendadas" on public.mensagens_agendadas for update using (true) with check (true);
create policy "permit delete mensagens_agendadas" on public.mensagens_agendadas for delete using (true);

create trigger update_mensagens_agendadas_updated_at
  before update on public.mensagens_agendadas
  for each row
  execute function public.update_updated_at_column();
