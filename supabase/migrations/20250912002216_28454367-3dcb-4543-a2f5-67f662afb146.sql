-- Create function to create default phases for a company
CREATE OR REPLACE FUNCTION public.create_default_phases()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default phases for the new company
  INSERT INTO public.fases (nome, position, cor, empresa_id) VALUES
    ('Lead', 1, '#ef4444', NEW.id),
    ('Qualificado', 2, '#f97316', NEW.id),
    ('Proposta', 3, '#eab308', NEW.id),
    ('Fechado', 4, '#22c55e', NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create default phases when a company is created
CREATE TRIGGER create_default_phases_trigger
  AFTER INSERT ON public.empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_phases();