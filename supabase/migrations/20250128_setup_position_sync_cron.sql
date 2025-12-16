-- Position Sync Cron Job Setup
-- Migration: 20250128_setup_position_sync_cron.sql
-- Sets up a cron job to sync positions from exchange for all running bots

-- =====================================================
-- Option 1: Using Supabase Dashboard (Recommended)
-- =====================================================
-- 1. Go to Supabase Dashboard → Edge Functions → position-sync
-- 2. Click "Schedules" tab
-- 3. Create new schedule:
--    - Schedule Name: position-sync-schedule
--    - Cron Expression: */5 * * * * (every 5 minutes)
--    - HTTP Method: POST
--    - Headers:
--      x-cron-secret: YOUR_CRON_SECRET_VALUE
--    - Enabled: Yes
-- 4. Save

-- =====================================================
-- Option 2: Using pg_cron (if available)
-- =====================================================

-- Check if pg_cron extension exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if it exists
    BEGIN
      PERFORM cron.unschedule('position-sync-schedule');
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
    
    -- Schedule position sync every 5 minutes
    PERFORM cron.schedule(
      'position-sync-schedule',
      '*/5 * * * *', -- Every 5 minutes
      $$
      SELECT
        net.http_post(
          url := current_setting('app.supabase_url') || '/functions/v1/position-sync',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', current_setting('app.cron_secret', true)
          ),
          body := '{}'::jsonb
        ) AS request_id;
      $$
    );
    
    RAISE NOTICE 'Position sync cron job scheduled successfully (every 5 minutes)';
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Use Supabase Dashboard to set up cron job instead.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not set up pg_cron job: %. Use Supabase Dashboard instead.', SQLERRM;
END $$;

-- =====================================================
-- Option 3: External Cron Job (Alternative)
-- =====================================================
-- If Supabase cron jobs are not available, use external scheduler:
--
-- Add to your server's crontab (crontab -e):
-- 
-- # Position Sync - Every 5 minutes
-- */5 * * * * curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/position-sync \
--   -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
--   -H "x-cron-secret: YOUR_CRON_SECRET" \
--   -H "Content-Type: application/json" \
--   -d '{}' \
--   >> /var/log/position-sync.log 2>&1
--
-- Replace:
--   YOUR_PROJECT - Your Supabase project reference
--   YOUR_SERVICE_ROLE_KEY - Get from Supabase Dashboard → Settings → API
--   YOUR_CRON_SECRET - Set in Supabase Edge Function Secrets as CRON_SECRET

-- =====================================================
-- Verification
-- =====================================================

-- Check if cron job is scheduled (if using pg_cron):
-- SELECT * FROM cron.job WHERE jobname = 'position-sync-schedule';

-- Check recent job runs (if using pg_cron):
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'position-sync-schedule')
-- ORDER BY start_time DESC LIMIT 10;

-- =====================================================
-- Manual Test
-- =====================================================
-- Test the position sync function manually:
-- 
-- curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/position-sync \
--   -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
--   -H "x-cron-secret: YOUR_CRON_SECRET" \
--   -H "Content-Type: application/json" \
--   -d '{}'
