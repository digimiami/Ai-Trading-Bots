-- =====================================================
-- BOT SCHEDULER CRON SETUP
-- =====================================================
-- This sets up a cron job to run the bot-scheduler every minute.
-- The scheduler runs:
--   1. sync_positions_exit_strategy (Exit Strategy for all running real bots)
--   2. execute_all_bots (full strategy evaluation and orders)
-- =====================================================
-- Run instructions in Supabase SQL Editor (pg_cron) or use Dashboard (recommended).
-- =====================================================

-- =====================================================
-- Option 1: Supabase Dashboard (Recommended)
-- =====================================================
-- 1. Go to Supabase Dashboard → Edge Functions → bot-scheduler
-- 2. Open the "Schedules" tab
-- 3. Create a new schedule:
--    - Name: bot-scheduler-every-minute
--    - Cron expression: * * * * *   (every minute)
--    - HTTP method: POST
--    - Headers:
--        Key: x-cron-secret
--        Value: [same as CRON_SECRET in Edge Function env / secrets]
--    - Body (optional): {}  or leave empty
-- 4. Enable the schedule and save
--
-- Ensure bot-scheduler has env: CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY).

-- =====================================================
-- Option 2: pg_cron (if extensions available)
-- =====================================================
-- Requires: pg_cron and the http() extension (e.g. pgsql-http).
-- If http() or http_header() do not exist, use Option 1 (Dashboard) instead.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Trigger function (uses http() - skip if extension not available)
CREATE OR REPLACE FUNCTION trigger_bot_scheduler()
RETURNS void AS $$
DECLARE
  supabase_url TEXT;
  supabase_key TEXT;
  cron_secret TEXT;
  response_status INT;
  response_body TEXT;
BEGIN
  supabase_url := current_setting('app.supabase_url', true);
  supabase_key := current_setting('app.supabase_service_role_key', true);
  cron_secret := current_setting('app.cron_secret', true);

  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := 'https://YOUR_PROJECT_REF.supabase.co';
  END IF;

  IF supabase_key IS NULL OR supabase_key = '' THEN
    RAISE WARNING 'app.supabase_service_role_key not set; skipping bot-scheduler trigger.';
    RETURN;
  END IF;

  IF cron_secret IS NULL THEN
    cron_secret := '';
  END IF;

  SELECT status, content INTO response_status, response_body
  FROM http((
    'POST',
    supabase_url || '/functions/v1/bot-scheduler',
    ARRAY[
      http_header('Authorization', 'Bearer ' || supabase_key),
      http_header('Content-Type', 'application/json'),
      http_header('apikey', supabase_key),
      http_header('x-cron-secret', cron_secret)
    ],
    'application/json',
    '{}'
  )::http_request);

  RAISE NOTICE 'Bot scheduler triggered: Status %, Response %', response_status, left(response_body, 200);

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error triggering bot-scheduler: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unschedule if already present
SELECT cron.unschedule('bot-scheduler-every-minute')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'bot-scheduler-every-minute'
);

-- Schedule: every minute
SELECT cron.schedule(
  'bot-scheduler-every-minute',
  '* * * * *',
  $$SELECT trigger_bot_scheduler()$$
);

-- =====================================================
-- Option 3: External cron (crontab)
-- =====================================================
-- On your server: crontab -e
--
-- # Bot scheduler – every minute (Exit Strategy + execute all bots)
-- * * * * * curl -s -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/bot-scheduler" \
--   -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
--   -H "apikey: YOUR_ANON_OR_SERVICE_ROLE_KEY" \
--   -H "Content-Type: application/json" \
--   -H "x-cron-secret: YOUR_CRON_SECRET" \
--   -d '{}' >> /var/log/bot-scheduler.log 2>&1
--
-- Replace YOUR_PROJECT_REF, YOUR_SERVICE_ROLE_KEY, YOUR_CRON_SECRET.

-- =====================================================
-- Verification
-- =====================================================
-- If using pg_cron:
-- SELECT jobid, jobname, schedule, command
-- FROM cron.job
-- WHERE jobname = 'bot-scheduler-every-minute';
--
-- Recent runs:
-- SELECT jobid, runid, start_time, end_time, status
-- FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'bot-scheduler-every-minute')
-- ORDER BY start_time DESC
-- LIMIT 10;
