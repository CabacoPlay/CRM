-- Create roles enum and user_roles table if not exists
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- Update RLS policies for empresas
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow authenticated users to create empresas" ON public.empresas;
  DROP POLICY IF EXISTS "Allow authenticated users to update empresas" ON public.empresas;
  DROP POLICY IF EXISTS "Allow authenticated users to delete empresas" ON public.empresas;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY "Only owner and admin can create empresas"
ON public.empresas
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')
);

-- Optional: keep select for authenticated users
CREATE POLICY IF NOT EXISTS "Allow authenticated users to view empresas"
ON public.empresas
FOR SELECT
TO authenticated
USING (true);
