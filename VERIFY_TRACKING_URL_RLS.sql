-- Verify tracking URL RLS policies and test public access

-- Check all policies on tracking_urls table
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'tracking_urls'
ORDER BY policyname;

-- Test: Check if we can see active tracking URLs (run this as anon user)
-- This should return rows if the public policy is working
SELECT 
  id,
  name,
  short_code,
  destination_url,
  is_active
FROM public.tracking_urls
WHERE is_active = true
LIMIT 10;

-- Check specific tracking URL by short code (case-sensitive)
SELECT 
  id,
  name,
  short_code,
  destination_url,
  is_active
FROM public.tracking_urls
WHERE short_code = '7jmCI9O0';

-- Check case variations
SELECT 
  id,
  name,
  short_code,
  destination_url,
  is_active
FROM public.tracking_urls
WHERE LOWER(short_code) = LOWER('7jmCI900');

