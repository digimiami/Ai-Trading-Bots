-- ML Auto-Retrain Cron Job Setup
-- Migration: 20250127_setup_ml_auto_retrain_cron.sql
-- Sets up a cron job to check ML performance and recommend retraining daily

-- =====================================================
-- IMPORTANT: Set CRON_SECRET First
-- =====================================================
-- Before creating the cron schedule, make sure you have set:
-- 1. Go to Supabase Dashboard → Edge Functions → ml-auto-retrain → Settings
-- 2. Add Environment Variable: CRON_SECRET = [your-secret-value]
-- 3. Save

-- =====================================================
-- Option 1: Using Supabase Dashboard (RECOMMENDED)
-- =====================================================
-- This is the easiest and most reliable method
--
-- 1. Go to Supabase Dashboard → Edge Functions → ml-auto-retrain
-- 2. Click "Schedules" tab
-- 3. Create new schedule:
--    - Schedule Name: ml-auto-retrain-check
--    - Cron Expression: 0 2 * * * (Daily at 2 AM UTC)
--    - HTTP Method: POST
--    - Headers:
--      Key: x-cron-secret
--      Value: [SAME VALUE as CRON_SECRET environment variable]
--    - Enabled: Yes
-- 4. Save
--
-- This will automatically call the ml-auto-retrain function daily at 2 AM UTC

-- =====================================================
-- Option 2: Using pg_cron Extension (If Available)
-- =====================================================
-- Note: This requires pg_cron extension and net extension
-- If these are not available, use Option 1 (Supabase Dashboard) instead

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create function to trigger ml-auto-retrain Edge Function
CREATE OR REPLACE FUNCTION trigger_ml_auto_retrain()
RETURNS void AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
  cron_secret TEXT;
  response_status INT;
  response_body TEXT;
BEGIN
  -- Get configuration values
  -- These should be set in Supabase Dashboard → Settings → Database → Custom Config
  -- Or use environment variables if available
  
  -- Try to get from custom config first
  BEGIN
    supabase_url := current_setting('app.supabase_url', true);
    service_role_key := current_setting('app.supabase_service_role_key', true);
    cron_secret := current_setting('app.cron_secret', true);
  EXCEPTION WHEN OTHERS THEN
    -- If config not set, use defaults (will need to be replaced)
    supabase_url := 'https://YOUR_PROJECT.supabase.co';
    service_role_key := 'YOUR_SERVICE_ROLE_KEY';
    cron_secret := 'YOUR_CRON_SECRET';
  END;
  
  -- IMPORTANT: Replace these placeholders with actual values:
  -- supabase_url: Your Supabase project URL (e.g., https://dkawxgwdqiirgmmjbvhc.supabase.co)
  -- service_role_key: Get from Supabase Dashboard → Settings → API → service_role key
  -- cron_secret: Same value as CRON_SECRET in Edge Function secrets
  
  -- Call ml-auto-retrain Edge Function using net.http_post
  -- Note: This requires the net extension which may not be available
  -- If this fails, use Option 1 (Supabase Dashboard) instead
  SELECT status, content INTO response_status, response_body
  FROM net.http_post(
    url := supabase_url || '/functions/v1/ml-auto-retrain',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret,
      'Authorization', 'Bearer ' || service_role_key,
      'apikey', service_role_key
    ),
    body := '{}'::jsonb
  );
  
  -- Log the response
  RAISE NOTICE 'ML auto-retrain check triggered: Status %, Response %', response_status, response_body;
  
EXCEPTION WHEN OTHERS THEN
  -- Log errors but don't fail
  RAISE WARNING 'Error triggering ML auto-retrain: %. Use Supabase Dashboard cron instead.', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing job if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ml-auto-retrain-check') THEN
    PERFORM cron.unschedule('ml-auto-retrain-check');
  END IF;
END $$;

-- Schedule cron job to run daily at 2 AM UTC
-- Format: minute hour day month weekday
SELECT cron.schedule(
  'ml-auto-retrain-check',        -- Job name
  '0 2 * * *',                    -- Daily at 2 AM UTC
  $$SELECT trigger_ml_auto_retrain()$$  -- Function to execute
);

-- =====================================================
-- Option 3: External Cron Job (Alternative)
-- =====================================================
-- If Supabase cron jobs are not available, use external scheduler:
--
-- Add to your server's crontab (crontab -e):
-- 
-- # ML Auto-Retrain Check - Daily at 2 AM UTC
-- 0 2 * * * curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ml-auto-retrain \
--   -H "x-cron-secret: YOUR_CRON_SECRET" \
--   -H "Content-Type: application/json" \
--   -d '{}' \
--   >> /var/log/ml-auto-retrain.log 2>&1
--
-- Replace:
--   YOUR_PROJECT - Your Supabase project reference (e.g., dkawxgwdqiirgmmjbvhc)
--   YOUR_CRON_SECRET - Set in Supabase Edge Function Secrets as CRON_SECRET
--
-- Or use external services:
-- - GitHub Actions (scheduled workflow)
-- - Vercel Cron Jobs
-- - AWS EventBridge
-- - Google Cloud Scheduler
-- - EasyCron.com
-- - Cron-job.org

-- =====================================================
-- Verification
-- =====================================================

-- Check if cron job is scheduled (if using pg_cron):
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  nodename,
  nodeport
FROM cron.job 
WHERE jobname = 'ml-auto-retrain-check';

-- Check recent job runs (if using pg_cron):
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'ml-auto-retrain-check')
ORDER BY start_time DESC 
LIMIT 10;

-- =====================================================
-- Manual Test
-- =====================================================
-- Test the ml-auto-retrain function manually:
-- 
-- curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ml-auto-retrain \
--   -H "x-cron-secret: YOUR_CRON_SECRET" \
--   -H "Content-Type: application/json" \
--   -d '{}'
--
-- Expected response:
-- {
--   "success": true,
--   "checked": 15,
--   "retrained": 3,
--   "results": [...]
-- }

-- =====================================================
-- Update Schedule (If Needed)
-- =====================================================
-- To change the schedule frequency:
--
-- 1. Unschedule existing job:
--    SELECT cron.unschedule('ml-auto-retrain-check');
--
-- 2. Create new schedule with different frequency:
--    SELECT cron.schedule(
--      'ml-auto-retrain-check',
--      '0 */6 * * *',  -- Every 6 hours instead of daily
--      $$SELECT trigger_ml_auto_retrain()$$
--    );
--
-- Common schedules:
--   '0 2 * * *'     - Daily at 2 AM UTC
--   '0 */6 * * *'   - Every 6 hours
--   '0 */12 * * *'  - Every 12 hours
--   '0 2 * * 1'     - Weekly on Monday at 2 AM UTC

-- =====================================================
-- Troubleshooting
-- =====================================================
-- If cron job is not running:
--
-- 1. Check if pg_cron extension is enabled:
--    SELECT * FROM pg_extension WHERE extname = 'pg_cron';
--
-- 2. Check if net extension is available (required for HTTP calls):
--    SELECT * FROM pg_extension WHERE extname = 'net';
--
-- 3. If extensions are not available, use Option 1 (Supabase Dashboard)
--    or Option 3 (External Cron) instead
--
-- 4. Verify CRON_SECRET matches in:
--    - Edge Function secrets (ml-auto-retrain → Settings)
--    - Cron job headers (x-cron-secret)
--
-- 5. Check Edge Function logs for errors:
--    Supabase Dashboard → Edge Functions → ml-auto-retrain → Logs
