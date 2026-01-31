-- =====================================================
-- PG_CRON TRIGGER CONFIG (app.* settings)
-- =====================================================
--
-- **SUPABASE: permission denied**
-- On Supabase you get: ERROR 42501: permission denied to set parameter "app.supabase_url"
-- Supabase does not allow ALTER DATABASE SET for custom parameters.
--
-- **Use Dashboard schedules instead (no SQL needed):**
-- 1. Edge Functions → bot-scheduler → Schedules → Create schedule
--    Cron: * * * * *   Headers: x-cron-secret = <BOT_SCHEDULER_SECRET>
-- 2. Edge Functions → promo-auto-poster / bot-executor-queue → Schedules (if you use them)
-- 3. Set BOT_SCHEDULER_SECRET in bot-scheduler and bot-executor Secrets (see BOT_SCHEDULER_SECRET_SETUP.md)
--
-- **Stop pg_cron jobs that are failing** (run the block below in SQL Editor):
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-scheduler-every-minute') THEN
    PERFORM cron.unschedule('bot-scheduler-every-minute');
    RAISE NOTICE 'Unscheduled bot-scheduler-every-minute';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'promo-auto-poster') THEN
    PERFORM cron.unschedule('promo-auto-poster');
    RAISE NOTICE 'Unscheduled promo-auto-poster';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-executor-queue') THEN
    PERFORM cron.unschedule('bot-executor-queue');
    RAISE NOTICE 'Unscheduled bot-executor-queue';
  END IF;
END $$;

-- =====================================================
-- BELOW: For self-hosted Postgres only (NOT Supabase)
-- =====================================================
-- On Supabase the ALTER statements fail with "permission denied".
-- If you run your own Postgres and have superuser, you can set app.* and use pg_cron triggers:
--
-- ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';
-- ALTER DATABASE postgres SET app.supabase_service_role_key = 'YOUR_SERVICE_ROLE_KEY';
-- ALTER DATABASE postgres SET app.cron_secret = 'YOUR_BOT_SCHEDULER_SECRET';
-- SELECT pg_reload_conf();
-- SELECT name, setting FROM pg_settings WHERE name LIKE 'app.%';
