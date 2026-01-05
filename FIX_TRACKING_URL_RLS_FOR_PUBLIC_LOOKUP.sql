-- Fix RLS policies to allow public read access for tracking URL lookups
-- This allows case-insensitive lookups to work without authentication

-- Drop existing select policies
DROP POLICY IF EXISTS "Admins can view tracking URLs" ON public.tracking_urls;
DROP POLICY IF EXISTS "Anyone can view active tracking URLs" ON public.tracking_urls;

-- Create new policy: Allow anyone to read active tracking URLs (needed for redirect lookups)
CREATE POLICY "Public can view active tracking URLs"
ON public.tracking_urls
FOR SELECT
USING (is_active = true);

-- Keep admin policy for viewing all (including inactive)
CREATE POLICY "Admins can view all tracking URLs"
ON public.tracking_urls
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

COMMENT ON POLICY "Public can view active tracking URLs" ON public.tracking_urls IS 
'Allows anyone to read active tracking URLs for redirect lookups. This is necessary for the tracking redirect functionality.';

