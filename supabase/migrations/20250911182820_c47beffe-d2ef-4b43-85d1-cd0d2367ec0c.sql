-- Allow public access to create empresas, users, and connections without authentication

-- Update empresas policies to allow public access
DROP POLICY IF EXISTS "Only owner and admin can create empresas" ON public.empresas;

CREATE POLICY "Allow public to create empresas"
ON public.empresas
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public to view empresas"
ON public.empresas
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public to update empresas"
ON public.empresas
FOR UPDATE
TO public
USING (true);

CREATE POLICY "Allow public to delete empresas"
ON public.empresas
FOR DELETE
TO public
USING (true);

-- Create user_roles policies to allow public access
CREATE POLICY IF NOT EXISTS "Allow public to view user_roles"
ON public.user_roles
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public to create user_roles"
ON public.user_roles
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public to update user_roles"
ON public.user_roles
FOR UPDATE
TO public
USING (true);

CREATE POLICY "Allow public to delete user_roles"
ON public.user_roles
FOR DELETE
TO public
USING (true);