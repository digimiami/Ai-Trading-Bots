-- ============================================
-- CREATE TRACKING_SCRIPTS TABLE
-- Run this in Supabase SQL Editor to create the tracking_scripts table
-- ============================================

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.tracking_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  script_content TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'signup', -- 'signup', 'page_view', 'payment', etc.
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tracking_scripts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to fix any invalid ones)
DROP POLICY IF EXISTS "Service role can manage tracking scripts" ON public.tracking_scripts;
DROP POLICY IF EXISTS "Admins can manage tracking scripts" ON public.tracking_scripts;

-- Create proper admin policy
CREATE POLICY "Admins can manage tracking scripts" ON public.tracking_scripts
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

-- Public read for active scripts (needed by the frontend during signup)
DROP POLICY IF EXISTS "Public can read active tracking scripts" ON public.tracking_scripts;
CREATE POLICY "Public can read active tracking scripts" ON public.tracking_scripts
FOR SELECT USING (is_active = TRUE);

-- Create or replace the update trigger function
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS trg_tracking_scripts_updated_at ON public.tracking_scripts;
CREATE TRIGGER trg_tracking_scripts_updated_at
BEFORE UPDATE ON public.tracking_scripts
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Verify the table was created
SELECT 
  'tracking_scripts table created successfully' as status,
  COUNT(*) as existing_rows
FROM public.tracking_scripts;

