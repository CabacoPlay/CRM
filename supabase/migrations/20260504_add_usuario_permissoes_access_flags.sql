alter table if exists public.usuario_permissoes
  add column if not exists can_access_ia boolean not null default false;

alter table if exists public.usuario_permissoes
  add column if not exists can_access_catalogo boolean not null default false;

alter table if exists public.usuario_permissoes
  add column if not exists can_access_catalogo_publico boolean not null default false;

alter table if exists public.usuario_permissoes
  add column if not exists can_access_orcamentos boolean not null default false;
