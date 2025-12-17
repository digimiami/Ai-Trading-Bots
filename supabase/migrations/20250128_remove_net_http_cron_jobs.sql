-- Remove Cron Jobs Using net.http_post (Not Available in Supabase)
-- Migration: 20250128_remove_net_http_cron_jobs.sql
-- This removes existing cron jobs that try to use net.http_post

-- =====================================================
-- Step 1: List all cron jobs to see what exists
-- =====================================================
-- Run this first to see all cron jobs:
-- SELECT jobid, jobname, schedule, command FROM cron.job ORDER BY jobid;

-- =====================================================
-- Step 2: Remove cron jobs that use net.http_post
-- =====================================================

DO $$
DECLARE
  job_record RECORD;
  removed_count INTEGER := 0;
BEGIN
  -- Find and remove all cron jobs that use net.http_post
  FOR job_record IN 
    SELECT jobid, jobname 
    FROM cron.job 
    WHERE command LIKE '%net.http_post%'
  LOOP
    BEGIN
      PERFORM cron.unschedule(job_record.jobname);
      RAISE NOTICE 'Removed cron job: % (ID: %)', job_record.jobname, job_record.jobid;
      removed_count := removed_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Failed to remove cron job %: %', job_record.jobname, SQLERRM;
    END;
  END LOOP;
  
  IF removed_count = 0 THEN
    RAISE NOTICE 'No cron jobs using net.http_post found to remove.';
  ELSE
    RAISE NOTICE 'Successfully removed % cron job(s) using net.http_post.', removed_count;
  END IF;
END $$;

-- =====================================================
-- Step 3: Verify removal
-- =====================================================
-- Check remaining cron jobs:
-- SELECT jobid, jobname, schedule, command FROM cron.job ORDER BY jobid;

-- =====================================================
-- IMPORTANT: Set up cron jobs using Supabase Dashboard instead
-- =====================================================
-- After removing these jobs, set them up properly using:
--
-- 1. Go to Supabase Dashboard → Edge Functions
-- 2. For each function (bot-scheduler, position-sync, etc.):
--    - Click on the function
--    - Go to "Schedules" tab
--    - Create new schedule with proper headers
--    - Do NOT use SQL cron jobs with net.http_post
--
-- Example for bot-scheduler:
-- - Schedule Name: bot-execution-schedule
-- - Cron Expression: * * * * * (every minute)
-- - HTTP Method: POST
-- - Headers: x-cron-secret: YOUR_CRON_SECRET_VALUE
--
-- Example for position-sync:
-- - Schedule Name: position-sync-schedule
-- - Cron Expression: */5 * * * * (every 5 minutes)
-- - HTTP Method: POST
-- - Headers: x-cron-secret: YOUR_CRON_SECRET_VALUE
