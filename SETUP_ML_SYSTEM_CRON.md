# 🔄 Setup ML System Scheduled Functions

## Overview

The AI/ML system has two Edge Functions that need to be scheduled:

1. **`ml-auto-retrain`** - Periodically checks ML model performance and triggers retraining
2. **`ml-monitoring`** - Real-time monitoring (called on-demand, not scheduled)

## Current Status

- ✅ **`ml-predictions`** - Working (called from bot execution)
- ❌ **`ml-auto-retrain`** - Not scheduled (needs cron setup)
- ⚠️ **`ml-monitoring`** - Available but requires manual calls (not scheduled)

## Setup Instructions

### 1. Setup ML Auto-Retrain Schedule

#### Option A: Supabase Dashboard (Easiest)

1. Go to: https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc
2. Click **"Edge Functions"** → **"ml-auto-retrain"** → **"Schedules"** tab
3. Click **"Create Schedule"** or **"New Schedule"**
4. Configure:
   - **Schedule Name**: `ml-auto-retrain-daily`
   - **Cron Expression**: `0 2 * * *` (Daily at 2 AM UTC)
   - **HTTP Method**: `POST`
   - **Headers**:
     ```
     x-cron-secret: YOUR_CRON_SECRET_VALUE
     ```
   - **Enabled**: ✅ Yes
5. Click **"Save"**

#### Option B: External Cron Job with Script (Recommended for Production)

**Step 1: Upload the script to your server**

The script `scripts/call-ml-auto-retrain.sh` is already created. Upload it to your server:

```bash
# On your local machine, upload the script
scp scripts/call-ml-auto-retrain.sh root@srv853835:/root/scripts/

# Or if you're already on the server, create it:
mkdir -p /root/scripts
# Then copy the script content to /root/scripts/call-ml-auto-retrain.sh
chmod +x /root/scripts/call-ml-auto-retrain.sh
```

**Step 2: Set up environment variables**

Create or update `/root/.env.cron` with your credentials:

```bash
# On your server
nano /root/.env.cron
```

Add these lines (replace with your actual values):

```bash
SUPABASE_URL=https://dkawxgwdqiirgmmjbvhc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
CRON_SECRET=your_cron_secret_here
LOG_DIR=/var/log/bot-scheduler
```

**Get Required Values:**
- **SERVICE_ROLE_KEY**: Supabase Dashboard → Settings → API → `service_role` key
- **CRON_SECRET**: Supabase Dashboard → Edge Functions → Secrets → `CRON_SECRET`

**Step 3: Add to crontab**

```bash
# Edit crontab
crontab -e

# Add this line (daily at 2 AM UTC):
0 2 * * * /root/scripts/call-ml-auto-retrain.sh

# Save and exit (Ctrl+X, then Y, then Enter)
```

**Step 4: Test the script manually**

```bash
# Test the script
/root/scripts/call-ml-auto-retrain.sh

# Check the logs
tail -f /var/log/bot-scheduler/ml-auto-retrain.log
```

#### Option C: Direct Cron Command (Alternative)

If you prefer a direct cron command instead of a script:

```bash
# Edit crontab
crontab -e

# Add this line (replace YOUR_SERVICE_ROLE_KEY and YOUR_CRON_SECRET_VALUE):
0 2 * * * curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/ml-auto-retrain \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "x-cron-secret: YOUR_CRON_SECRET_VALUE" \
  -H "Content-Type: application/json" \
  -d '{}' \
  >> /var/log/ml-auto-retrain.log 2>&1
```

#### Alternative Cron Schedules

- **Every 6 hours**: `0 */6 * * *`
- **Every 12 hours**: `0 */12 * * *`
- **Daily at 2 AM UTC**: `0 2 * * *` (recommended)
- **Twice daily (2 AM and 2 PM UTC)**: `0 2,14 * * *`

### 2. Setup ML Monitoring (Optional - On-Demand)

`ml-monitoring` doesn't need a schedule - it's called on-demand from the frontend. However, you can test it manually:

```bash
# Get your access token from browser DevTools → Application → Local Storage → supabase.auth.token
curl -X GET "https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/ml-monitoring?action=dashboard" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

## Verify Setup

### Check ML Auto-Retrain Logs

1. Go to Supabase Dashboard → Edge Functions → `ml-auto-retrain` → Logs
2. You should see logs like:
   ```
   📥 ML Auto-Retrain function called
   🔄 Starting ML auto-retrain check...
   ✅ ML auto-retrain check complete: X bots checked, Y need retraining
   ```

### Check ML Monitoring Logs

1. Go to Supabase Dashboard → Edge Functions → `ml-monitoring` → Logs
2. Call the function from frontend or manually
3. You should see logs like:
   ```
   📥 ML Monitoring function called
   ✅ User authenticated: [user-id]
   🎯 Action: dashboard
   ```

## Troubleshooting

### No Logs Appearing

1. **Check if schedule is enabled**: Supabase Dashboard → Edge Functions → `ml-auto-retrain` → Schedules
2. **Check CRON_SECRET**: Must match in both schedule headers and Edge Function secrets
3. **Check function deployment**: Make sure the function is deployed
4. **Check logs**: Look for error messages in Edge Function logs

### Function Not Running

1. **Verify cron secret**: Check that `x-cron-secret` header matches `CRON_SECRET` environment variable
2. **Check authentication**: For `ml-monitoring`, ensure user is authenticated
3. **Check function status**: Ensure function is deployed and active

### Manual Testing

Test `ml-auto-retrain` manually:

```bash
curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/ml-auto-retrain \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "x-cron-secret: YOUR_CRON_SECRET_VALUE" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response:
```json
{
  "success": true,
  "checked": 5,
  "retrained": 0,
  "results": [...],
  "message": "Checked 5 bots, 0 need retraining"
}
```

## Next Steps

1. ✅ Set up `ml-auto-retrain` schedule (daily recommended)
2. ✅ Verify logs are appearing
3. ✅ Monitor bot activity logs for retraining recommendations
4. ✅ Test `ml-monitoring` from frontend or manually

## Related Files

- `supabase/functions/ml-auto-retrain/index.ts` - Auto-retrain function
- `supabase/functions/ml-monitoring/index.ts` - Monitoring function
- `setup_ml_auto_retrain_cron.sql` - SQL setup script
