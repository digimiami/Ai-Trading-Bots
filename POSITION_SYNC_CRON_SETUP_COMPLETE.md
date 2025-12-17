# ✅ Position Sync Cron Job - Complete Setup Guide

## ✅ Step 1: Code Updated (Already Done)

The `position-sync` function now uses `POSITION_SYNC_SECRET` instead of `CRON_SECRET` to avoid conflicts with other functions.

## 🔐 Step 2: Set POSITION_SYNC_SECRET in Supabase

1. Go to **Supabase Dashboard** → **Edge Functions** → **position-sync**
2. Click **Settings** (or **Secrets** tab)
3. Find or add environment variable:
   - **Name**: `POSITION_SYNC_SECRET`
   - **Value**: `[your-secret-value]` (the value you already set)
4. Click **Save**

✅ **You mentioned you already set this - great!**

## ⏰ Step 3: Create Cron Schedule in Supabase Dashboard

1. Still in **position-sync** function, go to **Schedules** tab
2. Click **Create Schedule** (or **New Schedule**)
3. Fill in the form:

   **Schedule Configuration:**
   - **Schedule Name**: `position-sync-schedule`
   - **Cron Expression**: `*/5 * * * *` (every 5 minutes)
   - **HTTP Method**: `POST`
   - **Headers**: Click **Add Header**
     - **Key**: `x-cron-secret`
     - **Value**: `[SAME VALUE as POSITION_SYNC_SECRET]` ⚠️ **Must match exactly!**
   - **Enabled**: ✅ Yes
   
4. Click **Save**

## ✅ Step 4: Verify It's Working

### Check Logs (after 5-10 minutes):

1. Go to **position-sync** → **Logs** tab
2. Look for:
   - ✅ `Position Sync Cron Job STARTED` = Success!
   - ✅ `Found X running bot(s) to sync` = Working correctly
   - ✅ `Position sync completed` = Job finished successfully
   - ❌ `Unauthorized` = Secret mismatch (check values match)

### Manual Test (Optional):

You can test manually using curl:

```bash
curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/position-sync \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "x-cron-secret: YOUR_POSITION_SYNC_SECRET_VALUE" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Replace:
- `YOUR_SERVICE_ROLE_KEY` - From Settings → API → service_role key
- `YOUR_POSITION_SYNC_SECRET_VALUE` - The exact value you set in Step 2

## 📋 Summary

✅ **Code Updated**: Uses `POSITION_SYNC_SECRET`  
✅ **Secret Set**: `POSITION_SYNC_SECRET` in Supabase  
⏰ **Next Step**: Create schedule in Dashboard with matching secret value

## ⚠️ Important Notes

- The `POSITION_SYNC_SECRET` value in function secrets **MUST MATCH** the `x-cron-secret` header value in the schedule
- This secret is **separate** from other functions' `CRON_SECRET` - no conflicts!
- The cron job will run every 5 minutes automatically
- Only syncs **running bots** (status = 'running' and paper_trading = false)

## 🎯 What Happens When It Runs

Every 5 minutes, the cron job will:
1. Find all running bots (non-paper trading)
2. Fetch positions from exchange API for each bot
3. Update database positions with:
   - Current price
   - Unrealized PnL
   - Position size changes
4. Close positions if closed on exchange
5. Calculate realized PnL and update metrics

You're all set! 🚀
