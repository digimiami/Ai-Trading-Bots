# Bot Executor Scalability Fix - Deployment Guide

## Overview
This fix optimizes the bot-executor to handle 100+ concurrent users by:
- Reducing execution timeouts (3s per bot instead of 6s)
- Adding smart bot filtering (skip bots that don't need execution)
- Implementing a queue system for distributed processing
- Adding database indexes for faster queries

## Changes Made

### 1. Bot Executor Optimizations (`bot-executor/index.ts`)
- **Reduced timeouts**: `PER_BOT_TIMEOUT_MS` from 6000ms to 3000ms
- **Optimized batching**: `BATCH_SIZE` from 2 to 3, `BATCH_DELAY_MS` from 500ms to 300ms
- **Better distribution**: `MAX_BOTS_PER_CYCLE` from 30 to 5 (prevents CPU timeout)
- **Smart filtering**: Skip bots that don't need execution (cooldown, no open positions, low frequency)
- **Single bot execution**: Support for `botId` parameter (for queue system)

### 2. Queue System (`bot-executor-queue/index.ts`)
- New Edge Function that processes 5 bots per execution
- Runs every 30 seconds via cron
- Capacity: 600 bots/hour (sufficient for 100 users with 3 bots each)

### 3. Database Optimizations (`optimize_bot_executor_scalability.sql`)
- Added `next_execution_at` column for queue prioritization
- Added `last_execution_at` column for smart filtering
- Created 9 indexes for faster queries

## Deployment Steps

### Step 1: Run Database Migrations

1. Open Supabase Dashboard > SQL Editor
2. Run `optimize_bot_executor_scalability.sql`:
   ```sql
   -- Copy and paste the entire SQL file content
   ```
3. Verify indexes were created:
   ```sql
   SELECT indexname FROM pg_indexes 
   WHERE tablename = 'trading_bots' 
   AND indexname LIKE 'idx_trading_bots%';
   ```

### Step 2: Deploy Edge Functions

#### Deploy bot-executor (updated)
```bash
# From project root
supabase functions deploy bot-executor
```

#### Deploy bot-executor-queue (new)
```bash
supabase functions deploy bot-executor-queue
```

**OR** deploy manually via Supabase Dashboard:
1. Go to Edge Functions > Create new function
2. Name: `bot-executor-queue`
3. Copy contents from `supabase/functions/bot-executor-queue/index.ts`
4. Deploy

### Step 3: Set Up Queue Cron Job

**Option A: Using Supabase Cron Jobs (Recommended)**
1. Go to Supabase Dashboard > Database > Cron Jobs
2. Create new cron job:
   - **Name**: `bot-executor-queue`
   - **Schedule**: `*/30 * * * * *` (every 30 seconds)
   - **SQL**: 
     ```sql
     SELECT net.http_post(
       url := current_setting('app.supabase_url') || '/functions/v1/bot-executor-queue',
       headers := jsonb_build_object(
         'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key'),
         'Content-Type', 'application/json',
         'apikey', current_setting('app.supabase_service_role_key')
       ),
       body := '{}'::jsonb
     );
     ```

**Option B: Using pg_cron (if available)**
1. Run `setup_bot_executor_queue_cron.sql` in SQL Editor
2. Verify job is scheduled:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'bot-executor-queue';
   ```

**Option C: External Scheduler (GitHub Actions, Vercel, etc.)**
- Set up a scheduled HTTP request to:
  ```
  POST https://YOUR_PROJECT.supabase.co/functions/v1/bot-executor-queue
  Headers:
    Authorization: Bearer YOUR_SERVICE_ROLE_KEY
    apikey: YOUR_SERVICE_ROLE_KEY
  ```
- Schedule: Every 30 seconds

### Step 4: Verify Deployment

1. **Check bot-executor logs**:
   - Go to Edge Functions > bot-executor > Logs
   - Look for "Smart filtering" messages
   - Verify bots are being filtered correctly

2. **Check bot-executor-queue logs**:
   - Go to Edge Functions > bot-executor-queue > Logs
   - Should see "BOT EXECUTOR QUEUE STARTED" every 30 seconds
   - Verify 5 bots are being processed per run

3. **Monitor bot execution**:
   - Check that bots continue trading normally
   - Verify no "CPU time exceeded" errors
   - Check bot activity logs for successful executions

## Expected Results

### Before
- ❌ CPU time exceeded errors
- ❌ Bots skipped due to timeout
- ❌ Limited to ~30 bots per execution

### After
- ✅ No CPU time exceeded errors
- ✅ All bots processed efficiently
- ✅ Smart filtering reduces unnecessary executions
- ✅ Queue system handles 100+ users (300+ bots)
- ✅ Capacity: 600 bots/hour

## Performance Metrics

- **Per-bot timeout**: 3s (reduced from 6s)
- **Batch size**: 3 bots (increased from 2)
- **Bots per cycle**: 5 (reduced from 30 for better distribution)
- **Queue frequency**: Every 30 seconds
- **Bots per queue run**: 5
- **Total capacity**: 600 bots/hour

## Rollback Plan

If issues occur:

1. **Revert bot-executor**:
   ```bash
   git checkout HEAD~1 supabase/functions/bot-executor/index.ts
   supabase functions deploy bot-executor
   ```

2. **Disable queue cron**:
   - Remove cron job from Supabase Dashboard
   - Or: `SELECT cron.unschedule('bot-executor-queue');`

3. **Bots will continue trading**:
   - Existing cron jobs will still work
   - Only queue system will be disabled

## Troubleshooting

### Issue: Queue not running
- Check cron job is scheduled correctly
- Verify Edge Function is deployed
- Check logs for errors

### Issue: Bots not executing
- Verify bots have `status = 'running'`
- Check `next_execution_at` is set (should be auto-set)
- Review smart filtering logs (may be skipping unnecessary bots)

### Issue: Still getting CPU timeouts
- Reduce `BOTS_PER_BATCH` in `bot-executor-queue/index.ts` from 5 to 3
- Reduce `MAX_BOTS_PER_CYCLE` in `bot-executor/index.ts` from 5 to 3
- Increase cron frequency to every 20 seconds

## Notes

- **Bots continue trading as before**: All optimizations are backward compatible
- **Smart filtering is safe**: Only skips bots that truly don't need execution
- **Queue system is optional**: Existing cron jobs still work if queue is disabled
- **No data loss**: All changes are additive (new columns, indexes, functions)



