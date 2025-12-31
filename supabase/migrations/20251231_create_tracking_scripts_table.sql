
-- Migration: 20251231_create_tracking_scripts_table.sql
-- Description: Create a table to manage tracking scripts (ads, analytics) for signup conversion tracking.

BEGIN;

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

-- Create RLS policies
-- Only service role and admin can manage tracking scripts
CREATE POLICY "Service role can manage tracking scripts" ON public.tracking_scripts
FOR ALL USING (EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND is_service_role = TRUE))
WITH CHECK (EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND is_service_role = TRUE));

-- Public read for active scripts (needed by the frontend during signup)
CREATE POLICY "Public can read active tracking scripts" ON public.tracking_scripts
FOR SELECT USING (is_active = TRUE);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tracking_scripts_updated_at
BEFORE UPDATE ON public.tracking_scripts
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

COMMIT;

