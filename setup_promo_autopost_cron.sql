-- =====================================================
-- PROMO AUTO-POSTER CRON SETUP
-- =====================================================
-- This script sets up pg_cron to run promo-auto-poster
-- every hour.
-- =====================================================
-- Note: Run this in Supabase SQL Editor
-- =====================================================

-- 1. Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create function to trigger promo-auto-poster
CREATE OR REPLACE FUNCTION trigger_promo_auto_poster()
RETURNS void AS $$
DECLARE
  supabase_url TEXT;
  supabase_key TEXT;
  cron_secret TEXT;
  response_status INT;
  response_body TEXT;
BEGIN
  -- Pull config (only use current_setting(..., true) to avoid "unrecognized configuration parameter")
  supabase_url := current_setting('app.supabase_url', true);
  supabase_key := current_setting('app.supabase_service_role_key', true);
  cron_secret := current_setting('app.cron_secret', true);

  -- Fallback URL when not set (do not call current_setting without true or it raises)
  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := 'https://dkawxgwdqiirgmmjbvhc.supabase.co';
  END IF;

  IF supabase_key IS NULL OR supabase_key = '' THEN
    RAISE WARNING 'app.supabase_service_role_key not set; skipping promo-auto-poster trigger.';
    RETURN;
  END IF;

  -- cron_secret can be null; function may still work depending on Edge Function config
  IF cron_secret IS NULL THEN
    cron_secret := '';
  END IF;

  -- Call promo-auto-poster Edge Function
  SELECT status, content INTO response_status, response_body
  FROM http((
    'POST',
    supabase_url || '/functions/v1/promo-auto-poster',
    ARRAY[
      http_header('Authorization', 'Bearer ' || supabase_key),
      http_header('Content-Type', 'application/json'),
      http_header('apikey', supabase_key),
      http_header('x-cron-secret', cron_secret)
    ],
    'application/json',
    '{}'
  )::http_request);

  -- Log the response (optional)
  RAISE NOTICE 'Promo auto-poster triggered: Status %, Response %', response_status, response_body;

EXCEPTION WHEN OTHERS THEN
  -- Log errors but don't fail
  RAISE WARNING 'Error triggering promo auto-poster: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Schedule cron job to run every hour
-- Format: minute hour day month weekday (pg_cron)

-- Drop existing job if it exists
SELECT cron.unschedule('promo-auto-poster') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'promo-auto-poster'
);

-- Schedule new job (every hour)
SELECT cron.schedule(
  'promo-auto-poster',           -- Job name
  '0 * * * *',                   -- At minute 0 of every hour
  $$SELECT trigger_promo_auto_poster()$$
);

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Check if cron job is scheduled:
-- SELECT * FROM cron.job WHERE jobname = 'promo-auto-poster';
--
-- Check recent job runs:
-- SELECT * FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'promo-auto-poster')
-- ORDER BY start_time DESC LIMIT 10;
