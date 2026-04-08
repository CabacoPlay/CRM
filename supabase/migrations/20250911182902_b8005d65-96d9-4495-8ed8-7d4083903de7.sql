-- Allow public access to create empresas without authentication

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Only owner and admin can create empresas" ON public.empresas;
DROP POLICY IF EXISTS "Allow authenticated users to view empresas" ON public.empresas;

-- Create new public policies for empresas
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