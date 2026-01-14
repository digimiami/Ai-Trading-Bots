# ⏰ Quick Setup: ML Auto-Retrain Cron Job

## 🚀 Fastest Method: Supabase Dashboard

### Step 1: Set CRON_SECRET

1. Go to **Supabase Dashboard** → **Edge Functions** → **ml-auto-retrain**
2. Click **Settings** tab
3. Add environment variable:
   - **Name**: `CRON_SECRET`
   - **Value**: `[generate a random secret, e.g., use openssl rand -hex 32]`
4. Click **Save**

### Step 2: Create Cron Schedule

1. Still in **ml-auto-retrain** function page
2. Click **Schedules** tab
3. Click **Create Schedule** or **New Schedule**
4. Fill in:
   - **Schedule Name**: `ml-auto-retrain-check`
   - **Cron Expression**: `0 2 * * *` (Daily at 2 AM UTC)
   - **HTTP Method**: `POST`
   - **Headers**:
     - Click **Add Header**
     - **Key**: `x-cron-secret`
     - **Value**: `[SAME VALUE as CRON_SECRET from Step 1]`
   - **Enabled**: ✅ Yes
5. Click **Save**

**Done!** The cron job will now run daily at 2 AM UTC.

---

## 📋 Alternative: SQL Migration

If you prefer using SQL, run this in **Supabase SQL Editor**:

```sql
-- Run the migration file
-- File: supabase/migrations/20250127_setup_ml_auto_retrain_cron.sql
```

Then set up the schedule via Dashboard (Step 2 above).

---

## ✅ Verify It's Working

### Test Manually

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ml-auto-retrain \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
```json
{
  "success": true,
  "checked": 15,
  "retrained": 3,
  "results": [...]
}
```

### Check Logs

1. Go to **Supabase Dashboard** → **Edge Functions** → **ml-auto-retrain** → **Logs**
2. Look for execution logs after the scheduled time
3. Check for any errors

### Check Bot Activity Logs

The function logs recommendations to bot activity logs:
- Go to **Admin Panel** → **Bots** → Select a bot → **Activity Logs**
- Look for messages like: `🤖 ML Retraining Recommended: ...`

---

## 🔧 Troubleshooting

### Cron Job Not Running

1. **Check Schedule is Enabled**
   - Go to **Edge Functions** → **ml-auto-retrain** → **Schedules**
   - Verify schedule shows "Enabled: Yes"

2. **Verify CRON_SECRET Matches**
   - Check Edge Function secret: `CRON_SECRET`
   - Check Schedule header: `x-cron-secret`
   - They must be **exactly the same**

3. **Check Function Logs**
   - Look for errors in **ml-auto-retrain** function logs
   - Check for authentication errors

4. **Verify Function is Deployed**
   - Make sure `ml-auto-retrain` function is deployed
   - Check function exists in **Edge Functions** list

### No Bots Checked

- Verify bots have `useMLPrediction: true` in strategy
- Check bots are in "running" status
- Verify bots have recent predictions with outcomes

---

## 📅 Change Schedule Frequency

To change when the check runs:

1. Go to **Edge Functions** → **ml-auto-retrain** → **Schedules**
2. Click **Edit** on the schedule
3. Update **Cron Expression**:
   - `0 2 * * *` - Daily at 2 AM UTC (default)
   - `0 */6 * * *` - Every 6 hours
   - `0 */12 * * *` - Every 12 hours
   - `0 2 * * 1` - Weekly on Monday at 2 AM UTC
4. Click **Save**

---

## 🎯 What It Does

When the cron job runs, it:

1. ✅ Finds all active bots with ML enabled
2. ✅ Checks recent accuracy (last 7 days)
3. ✅ Identifies bots with accuracy < 55%
4. ✅ Logs retrain recommendations to bot activity logs
5. ✅ Returns summary report

**Result**: You'll see recommendations in bot activity logs when retraining is needed.

---

**Status**: ✅ Ready to set up! Follow Step 1 and Step 2 above.
