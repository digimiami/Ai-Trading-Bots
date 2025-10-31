# ⏰ Setup Supabase Scheduled Trigger for Bot Execution

## Problem
Bots are not trading automatically because the scheduled trigger is not configured in Supabase.

## Quick Fix: Set up Supabase Scheduled Trigger

### Option 1: Using Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**:
   - Navigate to: https://supabase.com/dashboard
   - Select your project: `dkawxgwdqiirgmmjbvhc`

2. **Go to Edge Functions → Schedules**:
   - Click on "Edge Functions" in the left sidebar
   - Click on "bot-scheduler" function
   - Click on the "Schedules" tab

3. **Create New Schedule**:
   - Click "Create Schedule" or "New Schedule"
   - **Schedule Name**: `bot-execution-schedule`
   - **Cron Expression**: `*/5 * * * *` (every 5 minutes)
   - **HTTP Method**: `POST`
   - **Headers**:
     ```
     x-cron-secret: YOUR_CRON_SECRET_VALUE
     ```
   - **Enabled**: ✅ Yes
   - Click "Save"

### Option 2: Using SQL (Alternative)

Run this SQL in Supabase SQL Editor:

```sql
-- Create pg_cron extension if not exists
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule bot-scheduler to run every 5 minutes
SELECT cron.schedule(
  'bot-execution-schedule',           -- Job name
  '*/5 * * * *',                      -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url:='https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/bot-scheduler',
      headers:='{"Content-Type": "application/json", "x-cron-secret": "YOUR_CRON_SECRET_VALUE"}'::jsonb,
      body:='{}'::jsonb
    ) AS request_id;
  $$
);

-- Verify the schedule was created
SELECT * FROM cron.job WHERE jobname = 'bot-execution-schedule';
```

### Option 3: Using Supabase CLI (If Available)

```bash
# Create schedule via CLI
supabase functions schedule create bot-scheduler \
  --schedule "*/5 * * * *" \
  --header "x-cron-secret: YOUR_CRON_SECRET_VALUE"
```

## 🔑 Get Your CRON_SECRET

1. Go to Supabase Dashboard → Settings → Edge Functions → Secrets
2. Find `CRON_SECRET` value
3. If it doesn't exist, add it:
   - Click "Add Secret"
   - Name: `CRON_SECRET`
   - Value: Generate a secure random string (e.g., use `openssl rand -hex 32`)

## ✅ Verify Setup

After setting up the schedule:

1. **Check Supabase Logs**:
   - Go to Edge Functions → Logs
   - Filter by `bot-scheduler`
   - You should see requests every 5 minutes

2. **Check Bot Executor Logs**:
   - Look for `🚀 === BOT EXECUTION STARTED ===` messages
   - These should appear every 5 minutes when the schedule runs

3. **Manual Test**:
   ```bash
   curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/bot-scheduler \
     -H "Content-Type: application/json" \
     -H "x-cron-secret: YOUR_CRON_SECRET_VALUE" \
     -d '{}'
   ```

## 🐛 Troubleshooting

### No logs appearing?
- Check if `CRON_SECRET` matches in both schedule and function secrets
- Verify schedule is enabled (not paused)
- Check Edge Function logs for errors

### Schedule not running?
- Verify cron expression is correct: `*/5 * * * *` (every 5 minutes)
- Check Supabase project limits (free tier may have restrictions)
- Ensure `bot-scheduler` function is deployed

### Getting 401 Unauthorized?
- Verify `x-cron-secret` header matches `CRON_SECRET` secret exactly
- Check for extra spaces or quotes in the header value

## 📊 Expected Behavior

Once configured, you should see:
- Every 5 minutes: `bot-scheduler` function called
- Every 5 minutes: `bot-executor` receives `execute_all_bots` request
- Logs showing: `🚀 === BOT EXECUTION STARTED ===`
- Running bots get executed automatically

