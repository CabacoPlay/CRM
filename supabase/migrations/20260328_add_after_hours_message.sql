alter table if exists public.empresa_settings
  add column if not exists after_hours_message text not null default '';

alter table if exists public.contatos
  add column if not exists after_hours_last_sent_at timestamptz;
