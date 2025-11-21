-- Update Supabase Cron Schedule to Execute Every 1 Minute
-- =============================================
-- This updates the bot-scheduler cron job from every 5 minutes to every 1 minute

-- Option 1: If using pg_cron (run this in Supabase SQL Editor)
-- =============================================

-- First, check if the job exists
SELECT * FROM cron.job WHERE jobname = 'bot-execution-schedule';

-- If it exists, unschedule it first
SELECT cron.unschedule('bot-execution-schedule');

-- Then create new schedule with 1 minute interval
SELECT cron.schedule(
  'bot-execution-schedule',           -- Job name
  '* * * * *',                        -- Every 1 minute (was */5 * * * *)
  $$
  SELECT
    net.http_post(
      url:='https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/bot-scheduler',
      headers:='{"Content-Type": "application/json", "x-cron-secret": "YOUR_CRON_SECRET_VALUE"}'::jsonb,
      body:='{}'::jsonb
    ) AS request_id;
  $$
);

-- Verify the schedule was updated
SELECT * FROM cron.job WHERE jobname = 'bot-execution-schedule';

-- =============================================
-- Option 2: Using Supabase Dashboard
-- =============================================
-- 
-- 1. Go to: https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc
-- 2. Click "Edge Functions" → "bot-scheduler" → "Schedules" tab
-- 3. Find existing schedule and click "Edit"
-- 4. Update Cron Expression from `*/5 * * * *` to `* * * * *`
-- 5. Click "Save"
--
-- That's it! Bots will now execute every 1 minute.

-- =============================================
-- Verify Bot Execution Frequency
-- =============================================

-- Check recent bot activity logs (should be every ~1 minute)
SELECT 
  bot_id,
  message,
  created_at,
  EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY bot_id ORDER BY created_at))) / 60 as minutes_between_executions
FROM bot_activity_logs
WHERE category = 'execution'
  AND created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 50;

-- Check bot execution intervals
SELECT 
  ROUND(AVG(EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at))) / 60)::numeric, 2) as avg_minutes_between_executions,
  COUNT(*) as execution_count
FROM bot_activity_logs
WHERE category = 'execution'
  AND created_at > NOW() - INTERVAL '30 minutes';

