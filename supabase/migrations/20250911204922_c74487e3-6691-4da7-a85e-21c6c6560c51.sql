-- Create branding configurations table
CREATE TABLE public.branding_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  system_name TEXT NOT NULL DEFAULT 'SaaS Preview',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#3B82F6',
  secondary_color TEXT NOT NULL DEFAULT '#10B981', 
  empresa_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.branding_configs ENABLE ROW LEVEL SECURITY;

-- Create policies for branding configs
CREATE POLICY "Allow public to view branding configs" 
ON public.branding_configs 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public to create branding configs" 
ON public.branding_configs 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public to update branding configs" 
ON public.branding_configs 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public to delete branding configs" 
ON public.branding_configs 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_branding_configs_updated_at
BEFORE UPDATE ON public.branding_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for branding_configs
ALTER TABLE public.branding_configs REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.branding_configs;