-- Drop existing restrictive INSERT policy for product-images bucket
DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;

-- Create new permissive INSERT policy for product-images bucket
CREATE POLICY "Anyone can upload product images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'product-images');

-- Ensure SELECT policy exists (should already exist)
CREATE POLICY IF NOT EXISTS "Anyone can view product images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'product-images');

-- Keep UPDATE/DELETE restricted to authenticated users
CREATE POLICY IF NOT EXISTS "Users can update their product images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "Users can delete their product images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);