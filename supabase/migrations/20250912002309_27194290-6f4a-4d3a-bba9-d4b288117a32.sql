-- Fix function security by setting search_path
CREATE OR REPLACE FUNCTION public.create_default_phases()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert default phases for the new company
  INSERT INTO public.fases (nome, position, cor, empresa_id) VALUES
    ('Lead', 1, '#ef4444', NEW.id),
    ('Qualificado', 2, '#f97316', NEW.id),
    ('Proposta', 3, '#eab308', NEW.id),
    ('Fechado', 4, '#22c55e', NEW.id);
  
  RETURN NEW;
END;
$$;