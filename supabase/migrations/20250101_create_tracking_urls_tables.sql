-- Migration: Create tracking URLs system for ad campaigns
-- Description: Tables for generating tracking URLs and capturing click/view analytics with geographic data

BEGIN;

-- Table for tracking URL configurations
CREATE TABLE IF NOT EXISTS public.tracking_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  campaign_name TEXT,
  source TEXT, -- utm_source
  medium TEXT, -- utm_medium
  content TEXT, -- utm_content
  term TEXT, -- utm_term
  custom_params JSONB DEFAULT '{}', -- Additional custom tracking parameters
  short_code TEXT UNIQUE, -- Short code for URL like /t/abc123
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for tracking URL clicks/views with geographic data
CREATE TABLE IF NOT EXISTS public.tracking_url_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_url_id UUID NOT NULL REFERENCES public.tracking_urls(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  timezone TEXT,
  device_type TEXT, -- mobile, desktop, tablet
  browser TEXT,
  browser_version TEXT,
  os TEXT,
  os_version TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  language TEXT,
  is_unique_visit BOOLEAN DEFAULT TRUE,
  session_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- If user is logged in
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tracking_urls_short_code ON public.tracking_urls(short_code);
CREATE INDEX IF NOT EXISTS idx_tracking_urls_created_by ON public.tracking_urls(created_by);
CREATE INDEX IF NOT EXISTS idx_tracking_urls_active ON public.tracking_urls(is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_tracking_url_clicks_url_id ON public.tracking_url_clicks(tracking_url_id);
CREATE INDEX IF NOT EXISTS idx_tracking_url_clicks_clicked_at ON public.tracking_url_clicks(clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_url_clicks_country ON public.tracking_url_clicks(country);
CREATE INDEX IF NOT EXISTS idx_tracking_url_clicks_session_id ON public.tracking_url_clicks(session_id);
CREATE INDEX IF NOT EXISTS idx_tracking_url_clicks_user_id ON public.tracking_url_clicks(user_id);

-- Enable RLS
ALTER TABLE public.tracking_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_url_clicks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tracking_urls
CREATE POLICY "Admins can manage tracking URLs" ON public.tracking_urls
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- RLS Policies for tracking_url_clicks
-- Allow anyone to insert (for tracking)
CREATE POLICY "Anyone can track clicks" ON public.tracking_url_clicks
FOR INSERT WITH CHECK (true);

-- Only admins can view analytics
CREATE POLICY "Admins can view tracking clicks" ON public.tracking_url_clicks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_tracking_urls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tracking_urls_updated_at
BEFORE UPDATE ON public.tracking_urls
FOR EACH ROW
EXECUTE FUNCTION public.set_tracking_urls_updated_at();

-- Function to generate unique short code
CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.tracking_urls WHERE short_code = result) LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMIT;

