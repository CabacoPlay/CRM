-- Create enum for AI personality types
CREATE TYPE public.ia_personalidade AS ENUM ('Formal', 'Informal', 'Casual');

-- Create ias table
CREATE TABLE public.ias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  personalidade ia_personalidade NOT NULL DEFAULT 'Formal',
  prompt TEXT NOT NULL,
  ativa BOOLEAN NOT NULL DEFAULT true,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create faqs table
CREATE TABLE public.faqs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pergunta TEXT NOT NULL,
  resposta TEXT NOT NULL,
  ia_id UUID NOT NULL REFERENCES public.ias(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ias (following the public access pattern)
CREATE POLICY "Allow public to view ias" ON public.ias FOR SELECT USING (true);
CREATE POLICY "Allow public to create ias" ON public.ias FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public to update ias" ON public.ias FOR UPDATE USING (true);
CREATE POLICY "Allow public to delete ias" ON public.ias FOR DELETE USING (true);

-- Create RLS policies for faqs (following the public access pattern)
CREATE POLICY "Allow public to view faqs" ON public.faqs FOR SELECT USING (true);
CREATE POLICY "Allow public to create faqs" ON public.faqs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public to update faqs" ON public.faqs FOR UPDATE USING (true);
CREATE POLICY "Allow public to delete faqs" ON public.faqs FOR DELETE USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_ias_updated_at
  BEFORE UPDATE ON public.ias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_faqs_updated_at
  BEFORE UPDATE ON public.faqs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();