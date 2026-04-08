-- Add observacoes_ia column to contatos table for IA observations
ALTER TABLE public.contatos 
ADD COLUMN IF NOT EXISTS observacoes_ia TEXT;