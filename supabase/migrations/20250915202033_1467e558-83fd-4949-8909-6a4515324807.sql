-- Add sexo column to ias table
ALTER TABLE public.ias 
ADD COLUMN sexo text CHECK (sexo IN ('Masculino', 'Feminino')) DEFAULT 'Masculino';

-- Add profile_img_url column to ias table
ALTER TABLE public.ias 
ADD COLUMN profile_img_url text;