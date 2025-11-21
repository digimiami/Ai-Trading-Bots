# ⚡ Bot Execution Frequency Updated: Every 1 Minute

## ✅ What Was Changed

### 1. Frontend Display
- **File**: `src/pages/bots/page.tsx`
- **Change**: "Auto-execution every 5 minutes" → "Auto-execution every 1 minute"
- **Status**: ✅ Built and ready

### 2. PM2 Cron Script
- **File**: `scripts/bot-scheduler-cron.cjs`
- **Schedule**: Already set to `* * * * *` (every 1 minute)
- **Status**: ✅ Already configured

### 3. Setup Scripts
- **File**: `scripts/setup-cron.sh`
- **Change**: `*/5 * * * *` → `* * * * *`
- **Status**: ✅ Updated

### 4. Edge Function Documentation
- **File**: `supabase/functions/bot-scheduler/index.ts`
- **Change**: Updated comments to reflect 1-minute schedule
- **Status**: ✅ Deployed

---

## 🚀 How to Activate 1-Minute Execution

### If Using PM2 (Server):
```bash
# The PM2 cron is already set to 1 minute!
# Just restart it:
pm2 restart bot-scheduler-cron

# Verify it's running every 1 minute:
pm2 logs bot-scheduler-cron --lines 50
```

### If Using Supabase Scheduled Triggers:

#### Option A: Supabase Dashboard (Easiest)
1. Go to: https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc
2. Click **"Edge Functions"** → **"bot-scheduler"** → **"Schedules"** tab
3. Find your existing schedule
4. Click **"Edit"** or **"New Schedule"**
5. Set **Cron Expression**: `* * * * *` (instead of `*/5 * * * *`)
6. Click **"Save"**

#### Option B: SQL (Alternative)
1. Open Supabase SQL Editor
2. Run the SQL from `UPDATE_CRON_TO_1_MINUTE.sql`

---

## ✅ Verify It's Working

### Check Execution Frequency in Logs:
```bash
# If using PM2:
pm2 logs bot-scheduler-cron --lines 100

# You should see executions every ~60 seconds:
# [2025-11-20 XX:XX:01] ✅ Bot scheduler completed successfully
# [2025-11-20 XX:XX:61] ✅ Bot scheduler completed successfully
# [2025-11-20 XX:XX:121] ✅ Bot scheduler completed successfully
```

### Check Bot Activity in Database:
Run this SQL in Supabase SQL Editor:
```sql
-- Check recent bot executions (should be every ~1 minute)
SELECT 
  bot_id,
  message,
  created_at,
  EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY bot_id ORDER BY created_at))) / 60 as minutes_between_executions
FROM bot_activity_logs
WHERE category = 'execution'
  AND created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 20;
```

You should see `minutes_between_executions` around **1.0** (instead of 5.0).

---

## 📊 Expected Results

### Before (5 minutes):
- Bots evaluated strategy every 5 minutes
- Max 12 executions per hour per bot
- 288 executions per day per bot

### After (1 minute):
- Bots evaluate strategy every 1 minute ⚡
- 60 executions per hour per bot
- **1,440 executions per day per bot**
- **5x more responsive to market conditions!**

---

## ⚠️ Important Notes

### Resource Usage:
- **More frequent execution = more Supabase Edge Function invocations**
- Monitor your Supabase usage dashboard
- Free tier: 500K Edge Function invocations/month
- With 20 bots at 1-minute intervals: ~864K invocations/month
- **You may need to upgrade to Pro plan if you have many bots**

### Benefits:
- ✅ Faster entry/exit timing
- ✅ Better scalping opportunities
- ✅ More responsive to TradingView alerts
- ✅ Tighter risk management

### If You Experience Issues:
- Check Supabase function logs for errors
- Monitor database query performance
- Consider reducing to 2-minute intervals (`*/2 * * * *`) if needed

---

## 🎯 Quick Summary

✅ **Frontend**: Now shows "Auto-execution every 1 minute"  
✅ **PM2 Script**: Already configured for 1 minute  
✅ **Setup Scripts**: Updated to 1 minute  
✅ **Edge Function**: Deployed with updated docs  

**Next Step**: Update your Supabase scheduled trigger (Dashboard or SQL) to `* * * * *` and enjoy 5x faster bot execution!

