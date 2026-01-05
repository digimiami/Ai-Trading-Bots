-- Migration: Update Tracking URLs Table
-- Description: Ensures tracking_urls table has all required columns and indexes
-- Safe to run multiple times (uses IF NOT EXISTS and CREATE OR REPLACE)

BEGIN;

-- Ensure tracking_urls table exists with all columns
DO $$
BEGIN
  -- Create table if it doesn't exist
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tracking_urls') THEN
    CREATE TABLE public.tracking_urls (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      destination_url TEXT NOT NULL,
      campaign_name TEXT,
      source TEXT,
      medium TEXT,
      content TEXT,
      term TEXT,
      custom_params JSONB DEFAULT '{}',
      short_code TEXT UNIQUE,
      is_active BOOLEAN DEFAULT TRUE,
      expires_at TIMESTAMP WITH TIME ZONE,
      created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  ELSE
    -- Add columns if they don't exist
    ALTER TABLE public.tracking_urls ADD COLUMN IF NOT EXISTS campaign_name TEXT;
    ALTER TABLE public.tracking_urls ADD COLUMN IF NOT EXISTS source TEXT;
    ALTER TABLE public.tracking_urls ADD COLUMN IF NOT EXISTS medium TEXT;
    ALTER TABLE public.tracking_urls ADD COLUMN IF NOT EXISTS content TEXT;
    ALTER TABLE public.tracking_urls ADD COLUMN IF NOT EXISTS term TEXT;
    ALTER TABLE public.tracking_urls ADD COLUMN IF NOT EXISTS custom_params JSONB DEFAULT '{}';
    ALTER TABLE public.tracking_urls ADD COLUMN IF NOT EXISTS short_code TEXT UNIQUE;
    ALTER TABLE public.tracking_urls ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.tracking_urls ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.tracking_urls ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    ALTER TABLE public.tracking_urls ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE public.tracking_urls ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    
    -- Update existing rows to have default custom_params if null
    UPDATE public.tracking_urls SET custom_params = '{}' WHERE custom_params IS NULL;
  END IF;
END $$;

-- Ensure tracking_url_clicks table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tracking_url_clicks') THEN
    CREATE TABLE public.tracking_url_clicks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tracking_url_id UUID NOT NULL REFERENCES public.tracking_urls(id) ON DELETE CASCADE,
      ip_address TEXT,
      user_agent TEXT,
      referrer TEXT,
      country TEXT,
      region TEXT,
      city TEXT,
      timezone TEXT,
      device_type TEXT,
      browser TEXT,
      browser_version TEXT,
      os TEXT,
      os_version TEXT,
      screen_width INTEGER,
      screen_height INTEGER,
      language TEXT,
      is_unique_visit BOOLEAN DEFAULT TRUE,
      session_id TEXT,
      user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  ELSE
    -- Add any missing columns
    ALTER TABLE public.tracking_url_clicks ADD COLUMN IF NOT EXISTS country TEXT;
    ALTER TABLE public.tracking_url_clicks ADD COLUMN IF NOT EXISTS region TEXT;
    ALTER TABLE public.tracking_url_clicks ADD COLUMN IF NOT EXISTS city TEXT;
    ALTER TABLE public.tracking_url_clicks ADD COLUMN IF NOT EXISTS timezone TEXT;
    ALTER TABLE public.tracking_url_clicks ADD COLUMN IF NOT EXISTS device_type TEXT;
    ALTER TABLE public.tracking_url_clicks ADD COLUMN IF NOT EXISTS browser TEXT;
    ALTER TABLE public.tracking_url_clicks ADD COLUMN IF NOT EXISTS browser_version TEXT;
    ALTER TABLE public.tracking_url_clicks ADD COLUMN IF NOT EXISTS os TEXT;
    ALTER TABLE public.tracking_url_clicks ADD COLUMN IF NOT EXISTS os_version TEXT;
    ALTER TABLE public.tracking_url_clicks ADD COLUMN IF NOT EXISTS screen_width INTEGER;
    ALTER TABLE public.tracking_url_clicks ADD COLUMN IF NOT EXISTS screen_height INTEGER;
    ALTER TABLE public.tracking_url_clicks ADD COLUMN IF NOT EXISTS language TEXT;
    ALTER TABLE public.tracking_url_clicks ADD COLUMN IF NOT EXISTS is_unique_visit BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.tracking_url_clicks ADD COLUMN IF NOT EXISTS session_id TEXT;
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_tracking_urls_short_code ON public.tracking_urls(short_code);
CREATE INDEX IF NOT EXISTS idx_tracking_urls_created_by ON public.tracking_urls(created_by);
CREATE INDEX IF NOT EXISTS idx_tracking_urls_active ON public.tracking_urls(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_tracking_url_clicks_url_id ON public.tracking_url_clicks(tracking_url_id);
CREATE INDEX IF NOT EXISTS idx_tracking_url_clicks_clicked_at ON public.tracking_url_clicks(clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_url_clicks_country ON public.tracking_url_clicks(country);
CREATE INDEX IF NOT EXISTS idx_tracking_url_clicks_session_id ON public.tracking_url_clicks(session_id);
CREATE INDEX IF NOT EXISTS idx_tracking_url_clicks_user_id ON public.tracking_url_clicks(user_id);

-- Enable RLS if not already enabled
ALTER TABLE public.tracking_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_url_clicks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to recreate them)
DROP POLICY IF EXISTS "Admins can manage tracking URLs" ON public.tracking_urls;
DROP POLICY IF EXISTS "Anyone can track clicks" ON public.tracking_url_clicks;
DROP POLICY IF EXISTS "Admins can view tracking clicks" ON public.tracking_url_clicks;

-- Create/Recreate RLS Policies for tracking_urls
CREATE POLICY "Admins can manage tracking URLs" ON public.tracking_urls
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

-- Create/Recreate RLS Policies for tracking_url_clicks
CREATE POLICY "Anyone can track clicks" ON public.tracking_url_clicks
FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view tracking clicks" ON public.tracking_url_clicks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users 
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

DROP TRIGGER IF EXISTS trg_tracking_urls_updated_at ON public.tracking_urls;
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

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
SELECT pg_sleep(1);

-- Success message
SELECT 'Tracking URLs table updated successfully! All columns, indexes, and policies are in place.' as status;

