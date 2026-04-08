-- Drop existing restrictive INSERT policy for product-images bucket
DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;

-- Create new permissive INSERT policy for product-images bucket
CREATE POLICY "Anyone can upload product images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'product-images');

-- Ensure SELECT policy exists (create if doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Anyone can view product images'
    ) THEN
        CREATE POLICY "Anyone can view product images"
        ON storage.objects
        FOR SELECT
        USING (bucket_id = 'product-images');
    END IF;
END $$;

-- Keep UPDATE/DELETE restricted to authenticated users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can update their product images'
    ) THEN
        CREATE POLICY "Users can update their product images"
        ON storage.objects
        FOR UPDATE
        USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can delete their product images'
    ) THEN
        CREATE POLICY "Users can delete their product images"
        ON storage.objects
        FOR DELETE
        USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);
    END IF;
END $$;