-- Create categorias table for organizing products/services
CREATE TABLE public.categorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#3B82F6',
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create enum for catalog item types
CREATE TYPE public.catalog_item_type AS ENUM ('Produto', 'Serviço');

-- Create catalog_items table for products and services
CREATE TABLE public.catalog_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo catalog_item_type NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  categoria_id UUID NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create fases table for CRM pipeline
CREATE TABLE public.fases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  cor TEXT NOT NULL DEFAULT '#3B82F6',
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contatos table for CRM leads/contacts
CREATE TABLE public.contatos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  contato TEXT NOT NULL,
  resumo TEXT,
  profile_img_url TEXT,
  fase_id UUID NOT NULL REFERENCES public.fases(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notas table for contact notes
CREATE TABLE public.notas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  texto TEXT NOT NULL,
  contato_id UUID NOT NULL REFERENCES public.contatos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (following public access pattern)
CREATE POLICY "Allow public to view categorias" ON public.categorias FOR SELECT USING (true);
CREATE POLICY "Allow public to create categorias" ON public.categorias FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public to update categorias" ON public.categorias FOR UPDATE USING (true);
CREATE POLICY "Allow public to delete categorias" ON public.categorias FOR DELETE USING (true);

CREATE POLICY "Allow public to view catalog_items" ON public.catalog_items FOR SELECT USING (true);
CREATE POLICY "Allow public to create catalog_items" ON public.catalog_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public to update catalog_items" ON public.catalog_items FOR UPDATE USING (true);
CREATE POLICY "Allow public to delete catalog_items" ON public.catalog_items FOR DELETE USING (true);

CREATE POLICY "Allow public to view fases" ON public.fases FOR SELECT USING (true);
CREATE POLICY "Allow public to create fases" ON public.fases FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public to update fases" ON public.fases FOR UPDATE USING (true);
CREATE POLICY "Allow public to delete fases" ON public.fases FOR DELETE USING (true);

CREATE POLICY "Allow public to view contatos" ON public.contatos FOR SELECT USING (true);
CREATE POLICY "Allow public to create contatos" ON public.contatos FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public to update contatos" ON public.contatos FOR UPDATE USING (true);
CREATE POLICY "Allow public to delete contatos" ON public.contatos FOR DELETE USING (true);

CREATE POLICY "Allow public to view notas" ON public.notas FOR SELECT USING (true);
CREATE POLICY "Allow public to create notas" ON public.notas FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public to update notas" ON public.notas FOR UPDATE USING (true);
CREATE POLICY "Allow public to delete notas" ON public.notas FOR DELETE USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_categorias_updated_at
  BEFORE UPDATE ON public.categorias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_catalog_items_updated_at
  BEFORE UPDATE ON public.catalog_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fases_updated_at
  BEFORE UPDATE ON public.fases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contatos_updated_at
  BEFORE UPDATE ON public.contatos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notas_updated_at
  BEFORE UPDATE ON public.notas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_catalog_items_categoria_id ON public.catalog_items(categoria_id);
CREATE INDEX idx_catalog_items_empresa_id ON public.catalog_items(empresa_id);
CREATE INDEX idx_contatos_fase_id ON public.contatos(fase_id);
CREATE INDEX idx_contatos_empresa_id ON public.contatos(empresa_id);
CREATE INDEX idx_notas_contato_id ON public.notas(contato_id);
CREATE INDEX idx_fases_position ON public.fases(position);

-- Insert some default phases for CRM
INSERT INTO public.fases (nome, position, cor) VALUES
  ('Lead', 1, '#10B981'),
  ('Qualificado', 2, '#3B82F6'),
  ('Proposta', 3, '#F59E0B'),
  ('Fechado', 4, '#EF4444');

-- Insert some default categories
INSERT INTO public.categorias (nome, cor) VALUES
  ('Produtos', '#3B82F6'),
  ('Serviços', '#10B981'),
  ('Consultoria', '#8B5CF6');