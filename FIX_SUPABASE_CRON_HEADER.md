# 🔧 Fix Supabase Cron Job Header Issue

## Problem

You're seeing `hasSecret: false` in logs, which means the Supabase cron job is not sending the `x-cron-secret` header.

## Solution: Configure Supabase Cron Job Headers

If you set up a cron job in Supabase Dashboard, you need to configure it to send the `x-cron-secret` header.

### Option 1: Update Supabase Cron Job (If Using Dashboard Cron)

1. Go to: **Supabase Dashboard** → **Database** → **Cron Jobs** (or **Integrations** → **Cron**)
2. Find your `ml-auto-retrain-check` cron job
3. Click **Edit**
4. Look for **Headers** or **HTTP Headers** section
5. Add header:
   - **Name**: `x-cron-secret`
   - **Value**: `80b911c55256ccf1c2a00d5c238202c49537dd9e1c70d02dc3a01d950c488f0b` (your ML_AUTO_RETRAIN_SECRET value)
6. Save

### Option 2: Use External Cron Script (Recommended)

Instead of using Supabase cron job, use the external script which already sends the header correctly:

1. **Remove/Disable** the Supabase cron job
2. **Use the external cron script** on your server:
   ```bash
   # Add to crontab
   crontab -e
   
   # Add this line (daily at 2 AM UTC):
   0 2 * * * /root/scripts/call-ml-auto-retrain.sh
   ```

The external script already:
- ✅ Loads `ML_AUTO_RETRAIN_SECRET` from `.env.cron`
- ✅ Sends it in the `x-cron-secret` header
- ✅ Logs everything properly

### Option 3: Make Function More Flexible (If Secret Not Required)

If you want the function to work without the secret (less secure), we can modify it, but **NOT RECOMMENDED** for production.

## Why External Script is Better

1. ✅ **Already configured** - Script is set up and working
2. ✅ **Better logging** - Logs to `/var/log/bot-scheduler/ml-auto-retrain.log`
3. ✅ **Easier to debug** - Can test manually with `./call-ml-auto-retrain.sh`
4. ✅ **More control** - Can adjust schedule easily
5. ✅ **Proper headers** - Already sends all required headers

## Current Status

- ✅ **External script works** (when you run it manually)
- ❌ **Supabase cron job fails** (not sending header)
- ✅ **Function code is correct** (just needs proper headers)

## Recommendation

**Use the external cron script** instead of Supabase cron job. It's already set up and working!
