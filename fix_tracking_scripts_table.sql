-- Fix tracking_scripts table and policies
-- Run this in Supabase SQL Editor if the table exists but has issues

-- Drop the invalid policy if it exists
DROP POLICY IF EXISTS "Service role can manage tracking scripts" ON public.tracking_scripts;

-- Create proper admin policy
CREATE POLICY IF NOT EXISTS "Admins can manage tracking scripts" ON public.tracking_scripts
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'tracking_scripts' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

