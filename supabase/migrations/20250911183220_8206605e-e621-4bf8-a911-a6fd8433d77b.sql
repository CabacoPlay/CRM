-- Create usuarios and conexoes tables with proper role system

-- Create role enum for usuarios (Admin and Cliente)
CREATE TYPE public.usuario_papel AS ENUM ('admin', 'cliente');

-- Create usuarios table
CREATE TABLE public.usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  email text not null unique,
  empresa_id uuid references public.empresas(id) on delete set null,
  papel public.usuario_papel not null default 'cliente',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  
  -- Admin users don't need to be associated with an empresa
  constraint check_admin_empresa check (
    papel = 'admin' OR empresa_id is not null
  )
);

-- Create conexoes table
CREATE TABLE public.conexoes (
  id uuid primary key default gen_random_uuid(),
  nome_api text not null,
  api_url text not null,
  telefone text,
  status text not null default 'desconectado' check (status in ('desconectado', 'pendente', 'conectado')),
  empresa_id uuid references public.empresas(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Enable RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conexoes ENABLE ROW LEVEL SECURITY;

-- Create public policies for usuarios
CREATE POLICY "Allow public to create usuarios"
ON public.usuarios
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public to view usuarios"
ON public.usuarios
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public to update usuarios"
ON public.usuarios
FOR UPDATE
TO public
USING (true);

CREATE POLICY "Allow public to delete usuarios"
ON public.usuarios
FOR DELETE
TO public
USING (true);

-- Create public policies for conexoes
CREATE POLICY "Allow public to create conexoes"
ON public.conexoes
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public to view conexoes"
ON public.conexoes
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public to update conexoes"
ON public.conexoes
FOR UPDATE
TO public
USING (true);

CREATE POLICY "Allow public to delete conexoes"
ON public.conexoes
FOR DELETE
TO public
USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_usuarios_updated_at
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conexoes_updated_at
  BEFORE UPDATE ON public.conexoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();