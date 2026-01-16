-- Setup ML Auto-Retrain Scheduled Trigger
-- =============================================
-- This schedules the ml-auto-retrain Edge Function to run periodically
-- Recommended: Daily at 2 AM UTC (checks all bots with ML enabled)

-- Option 1: Using Supabase Dashboard (Recommended)
-- =============================================
-- 
-- 1. Go to: https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc
-- 2. Click "Edge Functions" → "ml-auto-retrain" → "Schedules" tab
-- 3. Click "Create Schedule" or "New Schedule"
-- 4. Configure:
--    - Schedule Name: ml-auto-retrain-daily
--    - Cron Expression: 0 2 * * * (Daily at 2 AM UTC)
--    - HTTP Method: POST
--    - Headers:
--      x-cron-secret: YOUR_CRON_SECRET_VALUE
--    - Enabled: ✅ Yes
-- 5. Click "Save"
--
-- Alternative Cron Expressions:
-- - Every 6 hours: 0 */6 * * *
-- - Every 12 hours: 0 */12 * * *
-- - Daily at 2 AM UTC: 0 2 * * *
-- - Twice daily (2 AM and 2 PM UTC): 0 2,14 * * *

-- Option 2: Using SQL (if pg_cron extension is available)
-- =============================================

-- First, check if pg_cron extension exists
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- If pg_cron exists, you can schedule it (but HTTP calls still need external cron)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Remove existing job if it exists
    BEGIN
      PERFORM cron.unschedule('ml-auto-retrain-daily');
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
    
    -- Note: pg_cron can't make HTTP calls directly to Edge Functions
    -- You still need external cron for actual HTTP calls
    RAISE NOTICE 'pg_cron extension found, but external cron still needed for HTTP calls to Edge Functions';
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Use external cron job instead.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not set up pg_cron job: %. Use external cron job instead.', SQLERRM;
END $$;

-- Option 3: External Cron Job (RECOMMENDED)
-- =============================================
-- Since Supabase Edge Functions need HTTP calls, use external cron job
-- This is the recommended method

-- Add to your server's crontab (crontab -e):
-- 
-- # ML Auto-Retrain - Daily at 2 AM UTC
-- 0 2 * * * curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/ml-auto-retrain \
--   -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
--   -H "x-cron-secret: YOUR_CRON_SECRET_VALUE" \
--   -H "Content-Type: application/json" \
--   -d '{}' \
--   >> /var/log/ml-auto-retrain.log 2>&1
--
-- Replace:
--   YOUR_SERVICE_ROLE_KEY - Get from Supabase Dashboard → Settings → API
--   YOUR_CRON_SECRET - Set in Supabase Edge Function Secrets as CRON_SECRET
--
-- This runs daily at 2 AM UTC

-- Verify the schedule (if using Supabase Dashboard)
-- =============================================
-- Go to Supabase Dashboard → Edge Functions → ml-auto-retrain → Schedules
-- You should see the scheduled job listed there
