-- Allow public read access to active tracking URLs
-- This is necessary for the tracking redirect functionality to work
-- Safe to run multiple times - checks if policy exists first

-- Drop the policy if it exists (to recreate with correct name)
DROP POLICY IF EXISTS "Public can view active tracking URLs for redirects" ON public.tracking_urls;

-- Add policy to allow anyone to read active tracking URLs
CREATE POLICY "Public can view active tracking URLs for redirects"
ON public.tracking_urls
FOR SELECT
USING (is_active = true);

COMMENT ON POLICY "Public can view active tracking URLs for redirects" ON public.tracking_urls IS 
'Allows anyone (even unauthenticated users) to read active tracking URLs. 
This is necessary for the /t/:shortCode redirect functionality to work. 
Only active tracking URLs are visible to the public.';

-- Verify the policy was created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'tracking_urls' 
  AND policyname = 'Public can view active tracking URLs for redirects';
