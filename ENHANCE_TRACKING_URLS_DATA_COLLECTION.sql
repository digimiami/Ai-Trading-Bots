-- Migration: Enhance Tracking URL Data Collection
-- Description: Adds additional fields to tracking_url_clicks for better analytics
-- Safe to run multiple times (uses ADD COLUMN IF NOT EXISTS)

BEGIN;

-- Add conversion tracking fields
ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS converted BOOLEAN DEFAULT FALSE;

ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS conversion_type TEXT;

ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS time_to_conversion_seconds INTEGER;

-- Add viewport and display details
ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS viewport_width INTEGER;

ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS viewport_height INTEGER;

ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS device_pixel_ratio DECIMAL(3,2);

ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS color_depth INTEGER;

ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS touch_support BOOLEAN;

-- Add navigation and behavior tracking
ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS landing_page_url TEXT;

ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS exit_page_url TEXT;

ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS pages_viewed INTEGER DEFAULT 1;

ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS session_duration_seconds INTEGER;

ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS bounce BOOLEAN DEFAULT TRUE;

-- Add UTM parameters (store separately for easier querying)
ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS utm_source TEXT;

ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS utm_medium TEXT;

ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS utm_content TEXT;

ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS utm_term TEXT;

-- Add ad platform click IDs
ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS gclid TEXT; -- Google Click ID

ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS fbclid TEXT; -- Facebook Click ID

-- Add user behavior flags
ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS is_returning_visitor BOOLEAN DEFAULT FALSE;

ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS is_mobile_traffic BOOLEAN;

-- Add connection details (if available via browser APIs)
ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS connection_type TEXT; -- 4g, wifi, ethernet, etc.

-- Add click context (if available)
ALTER TABLE public.tracking_url_clicks 
ADD COLUMN IF NOT EXISTS click_timestamp_ms BIGINT; -- Precise timestamp in milliseconds

-- Create indexes for new fields (for performance)
CREATE INDEX IF NOT EXISTS idx_tracking_url_clicks_converted ON public.tracking_url_clicks(converted) WHERE converted = TRUE;
CREATE INDEX IF NOT EXISTS idx_tracking_url_clicks_conversion_type ON public.tracking_url_clicks(conversion_type);
CREATE INDEX IF NOT EXISTS idx_tracking_url_clicks_utm_source ON public.tracking_url_clicks(utm_source);
CREATE INDEX IF NOT EXISTS idx_tracking_url_clicks_utm_campaign ON public.tracking_url_clicks(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_tracking_url_clicks_utm_medium ON public.tracking_url_clicks(utm_medium);
CREATE INDEX IF NOT EXISTS idx_tracking_url_clicks_device_type ON public.tracking_url_clicks(device_type);
CREATE INDEX IF NOT EXISTS idx_tracking_url_clicks_is_mobile ON public.tracking_url_clicks(is_mobile_traffic) WHERE is_mobile_traffic = TRUE;
CREATE INDEX IF NOT EXISTS idx_tracking_url_clicks_bounce ON public.tracking_url_clicks(bounce) WHERE bounce = TRUE;

-- Create a composite index for common conversion queries
CREATE INDEX IF NOT EXISTS idx_tracking_url_clicks_conversion_analysis 
ON public.tracking_url_clicks(utm_source, utm_campaign, converted, clicked_at);

COMMIT;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
SELECT pg_sleep(1);

-- Success message
SELECT 'Tracking URL data collection enhanced successfully! New fields added for conversion tracking, viewport details, UTM parameters, and behavioral analytics.' as status;

