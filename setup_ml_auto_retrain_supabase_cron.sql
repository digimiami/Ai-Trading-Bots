-- =====================================================
-- ML AUTO-RETRAIN SUPABASE CRON JOB SETUP
-- =====================================================
-- Sets up a Supabase Scheduled Trigger (pg_cron) to call
-- the ml-auto-retrain Edge Function every 6 hours
--
-- IMPORTANT: Before running this script:
-- 1. Get your ML_AUTO_RETRAIN_SECRET from Supabase Dashboard
--    → Edge Functions → ml-auto-retrain → Secrets
-- 2. Replace YOUR_ML_AUTO_RETRAIN_SECRET below with the actual value
-- 3. Get your SUPABASE_SERVICE_ROLE_KEY from Settings → API
-- 4. Replace YOUR_SERVICE_ROLE_KEY below with the actual value
-- =====================================================

-- Step 1: Enable required extensions
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Create function to call ml-auto-retrain Edge Function
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_ml_auto_retrain()
RETURNS void AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
  ml_secret TEXT;
  response_id BIGINT;
BEGIN
  -- Get configuration values
  -- Option 1: From custom settings (set via Supabase Dashboard → Database → Custom Config)
  supabase_url := current_setting('app.supabase_url', true);
  service_role_key := current_setting('app.service_role_key', true);
  ml_secret := current_setting('app.ml_auto_retrain_secret', true);
  
  -- Option 2: Fallback to hardcoded values (REPLACE THESE!)
  IF supabase_url IS NULL THEN
    supabase_url := 'https://dkawxgwdqiirgmmjbvhc.supabase.co';
  END IF;
  
  IF service_role_key IS NULL THEN
    -- ⚠️ REPLACE THIS WITH YOUR ACTUAL SERVICE ROLE KEY
    service_role_key := 'YOUR_SERVICE_ROLE_KEY';
  END IF;
  
  IF ml_secret IS NULL THEN
    -- ⚠️ REPLACE THIS WITH YOUR ACTUAL ML_AUTO_RETRAIN_SECRET
    ml_secret := 'YOUR_ML_AUTO_RETRAIN_SECRET';
  END IF;
  
  -- Make HTTP POST request to ml-auto-retrain Edge Function
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/ml-auto-retrain',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key,
      'apikey', service_role_key,
      'x-cron-secret', ml_secret
    ),
    body := '{}'::jsonb
  ) INTO response_id;
  
  -- Log the request ID (optional - you can check status later)
  RAISE NOTICE 'ML auto-retrain triggered: Request ID %', response_id;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the cron job
    RAISE WARNING 'Failed to trigger ML auto-retrain: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Remove existing job if it exists
-- =====================================================
DO $$
BEGIN
  -- Try to unschedule existing job
  BEGIN
    PERFORM cron.unschedule('ml-auto-retrain-6h');
  EXCEPTION
    WHEN OTHERS THEN
      -- Job doesn't exist, that's okay
      NULL;
  END;
END $$;

-- Step 4: Schedule the cron job (Every 6 hours)
-- =====================================================
-- Cron format: minute hour day month weekday
-- 0 */6 * * * = Every 6 hours at minute 0 (00:00, 06:00, 12:00, 18:00 UTC)

SELECT cron.schedule(
  'ml-auto-retrain-6h',                    -- Job name
  '0 */6 * * *',                          -- Every 6 hours
  $$SELECT trigger_ml_auto_retrain()$$    -- Function to execute
);

-- Alternative schedules (uncomment one if you prefer):
-- '0 */4 * * *'  -- Every 4 hours (6 times per day)
-- '0 2,14 * * *' -- Twice daily at 2 AM and 2 PM UTC
-- '0 2 * * *'    -- Daily at 2 AM UTC

-- Step 5: Verify the schedule was created
-- =====================================================
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job 
WHERE jobname = 'ml-auto-retrain-6h';

-- =====================================================
-- CONFIGURATION OPTIONS
-- =====================================================

-- Option A: Set values via custom database settings (Recommended)
-- Run these in Supabase SQL Editor:
/*
ALTER DATABASE postgres SET app.supabase_url = 'https://dkawxgwdqiirgmmjbvhc.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
ALTER DATABASE postgres SET app.ml_auto_retrain_secret = 'YOUR_ML_AUTO_RETRAIN_SECRET';
*/

-- Option B: Update the function directly with hardcoded values
-- Edit the function above and replace YOUR_SERVICE_ROLE_KEY and YOUR_ML_AUTO_RETRAIN_SECRET

-- =====================================================
-- MONITORING AND TROUBLESHOOTING
-- =====================================================

-- Check if job is scheduled:
SELECT * FROM cron.job WHERE jobname = 'ml-auto-retrain-6h';

-- Check recent job runs:
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
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'ml-auto-retrain-6h')
ORDER BY start_time DESC 
LIMIT 10;

-- Check HTTP request status (if using pg_net):
-- Note: This query may fail if pg_net table structure differs
-- Comment out if you get column errors - it's optional for monitoring
/*
SELECT 
  id,
  url,
  method,
  status_code,
  content,
  error_msg
FROM net.http_request_queue
WHERE url LIKE '%ml-auto-retrain%'
ORDER BY id DESC
LIMIT 10;
*/

-- Alternative: Check table structure first
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_schema = 'net' AND table_name = 'http_request_queue';

-- Manually trigger the function (for testing):
-- SELECT trigger_ml_auto_retrain();

-- Disable the job (if needed):
-- SELECT cron.unschedule('ml-auto-retrain-6h');

-- Re-enable the job:
-- SELECT cron.schedule('ml-auto-retrain-6h', '0 */6 * * *', $$SELECT trigger_ml_auto_retrain()$$);

-- =====================================================
-- NOTES
-- =====================================================
-- 1. This uses pg_cron and pg_net extensions which should be available in Supabase
-- 2. The function makes HTTP calls to the Edge Function with proper authentication
-- 3. The x-cron-secret header is included for security
-- 4. Errors are logged but won't stop the cron job from running
-- 5. You can monitor job runs using the queries above
-- 6. If pg_cron is not available, use the external cron script instead:
--    See: scripts/call-ml-auto-retrain.sh
