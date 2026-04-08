-- Create storage bucket for branding assets
INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true);

-- Create storage policies for branding bucket
CREATE POLICY "Branding files are publicly accessible"
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'branding');

CREATE POLICY "Anyone can upload branding files"
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'branding');

CREATE POLICY "Anyone can update branding files"
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'branding');

CREATE POLICY "Anyone can delete branding files"
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'branding');