-- =====================================================
-- BOT EXECUTOR QUEUE CRON SETUP
-- =====================================================
-- This script sets up pg_cron to run bot-executor-queue
-- every 30 seconds, processing 5 bots per run
-- =====================================================
-- Capacity: 5 bots/30s = 10 bots/min = 600 bots/hour
-- For 100 users with 3 bots each = 300 bots total
-- All bots processed in ~30 minutes
-- =====================================================
-- If you see "app.supabase_service_role_key not set" or
-- "unrecognized configuration parameter app.supabase_url",
-- run set_cron_app_settings.sql first (or use Dashboard schedules).
-- Note: This requires the pg_cron extension to be enabled.
-- Run this in Supabase SQL Editor.
-- =====================================================

-- 1. Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create function to trigger bot-executor-queue
CREATE OR REPLACE FUNCTION trigger_bot_executor_queue()
RETURNS void AS $$
DECLARE
  supabase_url TEXT;
  supabase_key TEXT;
  response_status INT;
  response_body TEXT;
BEGIN
  -- Get Supabase URL and service role key (only use current_setting(..., true) to avoid "unrecognized configuration parameter")
  supabase_url := current_setting('app.supabase_url', true);
  supabase_key := current_setting('app.supabase_service_role_key', true);
  
  -- Fallback URL when app.supabase_url is not set (do not call current_setting without true or it raises)
  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := 'https://dkawxgwdqiirgmmjbvhc.supabase.co';
  END IF;
  
  -- Service role key must be set (e.g. via Vault or ALTER DATABASE SET) or we skip the call
  IF supabase_key IS NULL OR supabase_key = '' THEN
    RAISE WARNING 'app.supabase_service_role_key not set; skipping bot-executor-queue trigger. Set it in Supabase Vault or Database settings.';
    RETURN;
  END IF;
  
  -- Call bot-executor-queue Edge Function
  SELECT status, content INTO response_status, response_body
  FROM http((
    'POST',
    supabase_url || '/functions/v1/bot-executor-queue',
    ARRAY[
      http_header('Authorization', 'Bearer ' || supabase_key),
      http_header('Content-Type', 'application/json'),
      http_header('apikey', supabase_key)
    ],
    'application/json',
    '{}'
  )::http_request);
  
  -- Log the response (optional)
  RAISE NOTICE 'Bot executor queue triggered: Status %, Response %', response_status, response_body;
  
EXCEPTION WHEN OTHERS THEN
  -- Log errors but don't fail
  RAISE WARNING 'Error triggering bot executor queue: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Schedule cron job to run every 30 seconds
-- Note: pg_cron uses standard cron syntax with seconds
-- Format: second minute hour day month weekday

-- Drop existing job if it exists
SELECT cron.unschedule('bot-executor-queue') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'bot-executor-queue'
);

-- Schedule new job (every 30 seconds)
SELECT cron.schedule(
  'bot-executor-queue',           -- Job name
  '*/30 * * * * *',               -- Every 30 seconds (cron with seconds)
  $$SELECT trigger_bot_executor_queue()$$  -- Function to execute
);

-- =====================================================
-- ALTERNATIVE: Manual HTTP Request (if pg_cron unavailable)
-- =====================================================
-- If pg_cron is not available, you can use Supabase's
-- built-in cron jobs or an external scheduler:
--
-- 1. Go to Supabase Dashboard > Database > Cron Jobs
-- 2. Create a new cron job:
--    - Name: bot-executor-queue
--    - Schedule: */30 * * * * * (every 30 seconds)
--    - SQL: SELECT trigger_bot_executor_queue();
--
-- OR use an external service like:
-- - GitHub Actions (scheduled workflow)
-- - Vercel Cron Jobs
-- - AWS EventBridge
-- - Google Cloud Scheduler
--
-- Example external HTTP call:
-- POST https://YOUR_PROJECT.supabase.co/functions/v1/bot-executor-queue
-- Headers:
--   Authorization: Bearer YOUR_SERVICE_ROLE_KEY
--   apikey: YOUR_SERVICE_ROLE_KEY
--   Content-Type: application/json
-- Body: {}

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Check if cron job is scheduled:
-- SELECT * FROM cron.job WHERE jobname = 'bot-executor-queue';

-- Check recent job runs:
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'bot-executor-queue')
-- ORDER BY start_time DESC LIMIT 10;



