# 🔍 Diagnose Why Bots Stopped Executing

## Quick Checks:

### 1. Check bot-scheduler Logs
Check if `bot-scheduler` is still being called and if it's successfully calling `bot-executor`:

**Go to**: https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc/functions/bot-scheduler → **Logs**

Look for:
- ✅ `✅ Bot-executor call completed successfully`
- ✅ `Status: 200 OK`
- ❌ `Status: 401 Unauthorized` (means CRON_SECRET issue is back)
- ❌ Any other errors

### 2. Check bot-executor Logs
**Go to**: https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc/functions/bot-executor → **Logs**

Look for:
- `🔍 [bot-executor] Cron detection:` - Should show if cron is detected
- `🚀 === BOT EXECUTION STARTED ===` - Shows if execution started
- `📊 Database query result: Found X running bots` - Shows if bots are found
- `❌` errors - Any execution errors

### 3. Check if Bots Were Auto-Paused
Bots can be automatically paused for safety reasons:
- Regulatory restrictions
- Insufficient balance (after trade)
- Safety checks fail

**Check in database:**
```sql
SELECT id, name, status, pause_reason, updated_at 
FROM trading_bots 
WHERE user_id = auth.uid()
ORDER BY updated_at DESC;
```

If status changed to 'paused', check `pause_reason`.

### 4. Check Recent Trades
See if orders were actually placed:

```sql
SELECT id, symbol, side, status, created_at, pnl
FROM trades 
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 10;
```

### 5. Verify Cron Job is Still Running
Check Supabase Dashboard → Database → Cron Jobs (or pg_cron) to see if the scheduled trigger is still active.

## Common Causes:

1. **401 Error Returned** - CRON_SECRET might not be matching (check logs)
2. **Bots Auto-Paused** - Check database for pause_reason
3. **No Running Bots** - Check if bot status is still 'running'
4. **Cron Job Stopped** - Scheduled trigger might be disabled
5. **Error in Execution** - Check bot-executor logs for specific errors

## Next Steps:

1. Share the latest `bot-scheduler` logs
2. Share the latest `bot-executor` logs  
3. Check if bots are still in 'running' status
4. Check if any bots were auto-paused

