-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Create policies for product images bucket
CREATE POLICY "Anyone can view product images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update their product images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete their product images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

-- Add image_url field to catalog_items table
ALTER TABLE public.catalog_items 
ADD COLUMN image_url text;

-- Create index for better performance on image_url lookups
CREATE INDEX idx_catalog_items_image_url ON public.catalog_items(image_url);