-- Add apikey and globalkey fields to conexoes table and remove status default
ALTER TABLE public.conexoes 
ADD COLUMN apikey text,
ADD COLUMN globalkey text;

-- Update status column to remove default value since we're removing it from forms
ALTER TABLE public.conexoes 
ALTER COLUMN status DROP DEFAULT;