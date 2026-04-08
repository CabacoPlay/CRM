create table if not exists public.agenda_settings (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo',
  schedule jsonb not null default '{}'::jsonb, -- {"mon":{"open":"08:00","close":"18:00"}, ...}
  slot_interval_minutes int not null default 30,
  min_advance_minutes int not null default 60,
  max_advance_days int not null default 60,
  reminder_hours int not null default 24,
  confirm_template text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_agenda_settings_updated_at
  before update on public.agenda_settings
  for each row execute function public.update_updated_at_column();

alter table public.agenda_settings enable row level security;

create policy "agenda_settings_select" on public.agenda_settings for select using (true);
create policy "agenda_settings_upsert" on public.agenda_settings for insert with check (true);
create policy "agenda_settings_update" on public.agenda_settings for update using (true) with check (true);

