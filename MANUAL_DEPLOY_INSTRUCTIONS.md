# Manual Deployment Instructions for Bot Executor Scalability Fix

Since the Supabase CLI has an .env parsing issue, use the Supabase Dashboard to deploy manually.

## Step 1: Deploy bot-executor (Updated)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Navigate to Edge Functions**
   - Click on "Edge Functions" in the left sidebar
   - Find "bot-executor" in the list

3. **Update the Function**
   - Click on "bot-executor"
   - Click "Edit" or "Update"
   - Copy the entire contents of `supabase/functions/bot-executor/index.ts`
   - Paste it into the editor
   - Click "Deploy" or "Save"

## Step 2: Deploy bot-executor-queue (New)

1. **Create New Edge Function**
   - In Edge Functions, click "Create new function"
   - Name: `bot-executor-queue`
   - Click "Create"

2. **Add Function Code**
   - Copy the entire contents of `supabase/functions/bot-executor-queue/index.ts`
   - Paste it into the editor
   - Click "Deploy" or "Save"

## Step 3: Verify Deployment

1. **Check bot-executor logs**
   - Go to Edge Functions > bot-executor > Logs
   - Look for recent executions

2. **Check bot-executor-queue logs**
   - Go to Edge Functions > bot-executor-queue > Logs
   - Should see logs when cron triggers it

## Step 4: Run Database Migration

1. **Open SQL Editor**
   - Go to SQL Editor in Supabase Dashboard
   - Click "New query"

2. **Run Migration**
   - Open `optimize_bot_executor_scalability.sql`
   - Copy and paste the entire SQL script
   - Click "Run" or press Ctrl+Enter

3. **Verify Indexes**
   - Run this query to verify indexes were created:
   ```sql
   SELECT indexname FROM pg_indexes 
   WHERE tablename = 'trading_bots' 
   AND indexname LIKE 'idx_trading_bots%';
   ```

## Step 5: Set Up Cron Job

### Option A: Supabase Cron Jobs (Recommended)

1. **Go to Database > Cron Jobs**
   - Click "Create new cron job"

2. **Configure Cron Job**
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
   - Click "Create"

### Option B: External Scheduler (Alternative)

If Supabase cron jobs aren't available, use an external service:

**GitHub Actions Example:**
```yaml
name: Bot Executor Queue
on:
  schedule:
    - cron: '*/1 * * * *'  # Every minute (GitHub Actions minimum)
jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Queue
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "apikey: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}' \
            https://YOUR_PROJECT.supabase.co/functions/v1/bot-executor-queue
```

**Or use a service like:**
- Vercel Cron Jobs
- AWS EventBridge
- Google Cloud Scheduler
- EasyCron.com

## Verification Checklist

- [ ] bot-executor Edge Function deployed
- [ ] bot-executor-queue Edge Function deployed
- [ ] Database migration run successfully
- [ ] Indexes created (verify with SQL query)
- [ ] Cron job scheduled (or external scheduler set up)
- [ ] Check logs for successful executions
- [ ] Monitor bots to ensure they continue trading

## Troubleshooting

### If deployment fails:
- Check for syntax errors in the code
- Verify all imports are correct
- Check Edge Function logs for errors

### If cron job doesn't run:
- Verify cron syntax is correct
- Check Supabase cron job logs
- Try manual HTTP request to test the function

### If bots aren't executing:
- Check bot status is "running"
- Verify `next_execution_at` column exists
- Review smart filtering logs (may be skipping unnecessary bots)
