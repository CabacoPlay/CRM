-- Create empresas table with proper constraints and RLS
CREATE TABLE public.empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT,
  responsavel TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add case-insensitive unique constraint for nome
CREATE UNIQUE INDEX empresas_nome_unique_idx ON public.empresas (lower(nome));

-- Enable Row Level Security
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Allow authenticated users to view empresas" 
ON public.empresas 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to create empresas" 
ON public.empresas 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update empresas" 
ON public.empresas 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to delete empresas" 
ON public.empresas 
FOR DELETE 
TO authenticated
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_empresas_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();