# Setup ML Auto-Retrain Cron Job in Supabase

This guide shows you how to set up a Supabase Scheduled Trigger (pg_cron) to automatically call the `ml-auto-retrain` Edge Function every 6 hours.

## Prerequisites

1. **Get your Service Role Key:**
   - Go to Supabase Dashboard → Settings → API
   - Copy the `service_role` key (secret)

2. **Get your ML Auto-Retrain Secret:**
   - Go to Supabase Dashboard → Edge Functions → `ml-auto-retrain` → Secrets
   - Copy the `ML_AUTO_RETRAIN_SECRET` value
   - If it doesn't exist, create it (see `SETUP_CRON_SECRET.md`)

## Option 1: Using SQL Script (Recommended)

### Step 1: Open Supabase SQL Editor

1. Go to Supabase Dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**

### Step 2: Edit the Script

1. Open `setup_ml_auto_retrain_supabase_cron.sql` in your code editor
2. Find these lines and replace with your actual values:
   ```sql
   service_role_key := 'YOUR_SERVICE_ROLE_KEY';
   ml_secret := 'YOUR_ML_AUTO_RETRAIN_SECRET';
   ```
3. Replace:
   - `YOUR_SERVICE_ROLE_KEY` → Your actual service role key
   - `YOUR_ML_AUTO_RETRAIN_SECRET` → Your actual ML auto-retrain secret

### Step 3: Run the Script

1. Copy the entire script from `setup_ml_auto_retrain_supabase_cron.sql`
2. Paste it into the Supabase SQL Editor
3. Click **Run** or press `Ctrl+Enter`

### Step 4: Verify

Run this query to check if the job was created:

```sql
SELECT * FROM cron.job WHERE jobname = 'ml-auto-retrain-6h';
```

You should see a row with:
- `jobname`: `ml-auto-retrain-6h`
- `schedule`: `0 */6 * * *`
- `active`: `true`

## Option 2: Using Supabase Dashboard (Alternative)

If you prefer using the UI:

1. Go to **Database** → **Cron Jobs** in Supabase Dashboard
2. Click **New Cron Job**
3. Configure:
   - **Name**: `ml-auto-retrain-6h`
   - **Schedule**: `0 */6 * * *` (every 6 hours)
   - **SQL Command**: 
     ```sql
     SELECT trigger_ml_auto_retrain();
     ```
4. Click **Save**

**Note:** You'll still need to create the `trigger_ml_auto_retrain()` function first using the SQL script.

## Option 3: Set Values via Database Settings (More Secure)

Instead of hardcoding secrets in the function, you can set them as database settings:

### Step 1: Set Database Settings

Run these in Supabase SQL Editor (replace with your actual values):

```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://dkawxgwdqiirgmmjbvhc.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
ALTER DATABASE postgres SET app.ml_auto_retrain_secret = 'YOUR_ML_AUTO_RETRAIN_SECRET';
```

### Step 2: Run the Function Creation Script

The function will automatically use these settings instead of hardcoded values.

## Schedule Options

The script defaults to **every 6 hours** (`0 */6 * * *`). You can change it:

### Every 6 Hours (Recommended)
```sql
'0 */6 * * *'  -- Runs at 00:00, 06:00, 12:00, 18:00 UTC
```

### Every 4 Hours (More Frequent)
```sql
'0 */4 * * *'  -- Runs at 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
```

### Twice Daily
```sql
'0 2,14 * * *'  -- Runs at 02:00 and 14:00 UTC
```

### Daily
```sql
'0 2 * * *'  -- Runs daily at 02:00 UTC
```

To change the schedule, edit the `cron.schedule()` call in the script.

## Monitoring

### Check Job Status

```sql
SELECT * FROM cron.job WHERE jobname = 'ml-auto-retrain-6h';
```

### View Recent Runs

```sql
SELECT 
  runid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'ml-auto-retrain-6h')
ORDER BY start_time DESC 
LIMIT 10;
```

### Check HTTP Requests (Optional)

**Note:** This query may fail if the pg_net table structure differs. It's optional for monitoring.

```sql
-- First, check what columns exist:
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'net' AND table_name = 'http_request_queue';

-- Then use the appropriate columns (example):
SELECT 
  id,
  url,
  status_code,
  content,
  error_msg
FROM net.http_request_queue
WHERE url LIKE '%ml-auto-retrain%'
ORDER BY id DESC
LIMIT 10;
```

### Test Manually

```sql
SELECT trigger_ml_auto_retrain();
```

## Troubleshooting

### Job Not Running

1. **Check if pg_cron extension is enabled:**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. **Check if job is active:**
   ```sql
   SELECT active FROM cron.job WHERE jobname = 'ml-auto-retrain-6h';
   ```

3. **Check for errors in job runs:**
   ```sql
   SELECT return_message, status 
   FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'ml-auto-retrain-6h')
   ORDER BY start_time DESC 
   LIMIT 5;
   ```

### 401 Unauthorized Errors

- Verify `ML_AUTO_RETRAIN_SECRET` matches in:
  - Database settings (`app.ml_auto_retrain_secret`)
  - Edge Function secrets (`ML_AUTO_RETRAIN_SECRET`)
  - The function code (if using hardcoded values)

### Function Not Found

If you get "function trigger_ml_auto_retrain() does not exist":
- Make sure you ran the entire SQL script, including the function creation part
- Check if the function exists:
  ```sql
  SELECT proname FROM pg_proc WHERE proname = 'trigger_ml_auto_retrain';
  ```

## Disable/Remove the Job

### Disable (temporarily)
```sql
UPDATE cron.job SET active = false WHERE jobname = 'ml-auto-retrain-6h';
```

### Remove (permanently)
```sql
SELECT cron.unschedule('ml-auto-retrain-6h');
```

## Comparison: Supabase Cron vs External Cron

| Feature | Supabase Cron (pg_cron) | External Cron Script |
|---------|------------------------|---------------------|
| Setup | SQL script in Supabase | Server crontab |
| Monitoring | Supabase Dashboard | Server logs |
| Reliability | Managed by Supabase | Depends on server |
| Headers | Via pg_net function | Direct curl command |
| **Recommended** | ✅ For Supabase-native | ✅ For more control |

**Note:** You can use both! The external cron script (`scripts/call-ml-auto-retrain.sh`) is already working. The Supabase cron is an additional option that keeps everything in Supabase.

## Next Steps

1. ✅ Run the SQL script with your actual secrets
2. ✅ Verify the job is scheduled
3. ✅ Monitor the first few runs
4. ✅ Check Edge Function logs to confirm it's being called

After setup, the ML auto-retrain will run automatically every 6 hours!
