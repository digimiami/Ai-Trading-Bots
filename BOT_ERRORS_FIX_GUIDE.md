# Bot Errors Fix Guide

## Current Issues

Based on the bot health status query, you have:

### 1. **TIMEOUT_ERRORS** (3 bots)
- Scalping Strategy - Fast EMA Cloud - SOLUSDT
- Trend Following Strategy-Find Trading Pairs - ASTERUSDT
- TRUSTUSDT

**Issue**: These bots are timing out after 15 seconds during execution.

**Possible Causes**:
- Complex strategy evaluation taking too long
- Slow API calls to exchanges
- Network latency issues
- Too many concurrent operations

**Fix Applied**: 
- Reset `next_execution_at` with a 5-minute cooldown to prevent immediate retry
- This gives the system time to recover and reduces load

### 2. **BITUNIX_API_ERROR** (1 bot)
- ETHUSDT

**Issue**: Bitunix API is returning errors (likely Code: 2 - System error).

**Possible Causes**:
- Bitunix API temporary issues
- Invalid or expired API key
- API key permissions issue
- Rate limiting

**Fix Applied**:
- Check API key status
- Reset execution with 2-minute cooldown
- Verify API key is active and valid

## How to Fix

### Step 1: Run the Diagnostic Script

Execute `FIX_TIMEOUT_AND_BITUNIX_ERRORS.sql` in Supabase SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Open `FIX_TIMEOUT_AND_BITUNIX_ERRORS.sql`
3. Copy all contents
4. Paste and click "Run"

This will:
- Analyze the errors in detail
- Reset execution times for affected bots
- Check API key status for Bitunix bot
- Show summary of fixes

### Step 2: Verify API Keys

For the Bitunix ETHUSDT bot:
1. Go to Settings → API Keys
2. Verify Bitunix API key is:
   - ✅ Active
   - ✅ Valid (not expired)
   - ✅ Has trading permissions
3. If needed, update the API key

### Step 3: Monitor Bot Health

After running the fix script, check bot health again:

```sql
SELECT 
  health_status,
  COUNT(*) as bot_count,
  STRING_AGG(name, ', ' ORDER BY name) as bot_names
FROM bot_health_status
WHERE name IN (
  'Scalping Strategy - Fast EMA Cloud - SOLUSDT',
  'Trend Following Strategy-Find Trading Pairs - ASTERUSDT',
  'TRUSTUSDT',
  'ETHUSDT'
)
GROUP BY health_status
ORDER BY bot_count DESC;
```

## Expected Results

After fixes:
- **TIMEOUT_ERRORS**: Should decrease as bots get fresh execution cycles
- **BITUNIX_API_ERROR**: Should resolve if API key is valid, or you'll get clear error about missing/invalid key

## If Issues Persist

### For Timeout Errors:
1. Check if bots are executing too frequently
2. Consider reducing strategy complexity
3. Check exchange API status
4. Review bot execution logs for specific slow operations

### For Bitunix Errors:
1. Verify API key in Bitunix dashboard
2. Check if Bitunix API is experiencing issues
3. Try regenerating API key
4. Ensure API key has correct permissions

## Monitoring

Check bot logs regularly:
```sql
SELECT 
  bot_id,
  level,
  message,
  timestamp
FROM public.bot_activity_logs
WHERE bot_id IN (
  SELECT id FROM public.trading_bots 
  WHERE name IN (
    'Scalping Strategy - Fast EMA Cloud - SOLUSDT',
    'Trend Following Strategy-Find Trading Pairs - ASTERUSDT',
    'TRUSTUSDT',
    'ETHUSDT'
  )
)
AND timestamp >= NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC
LIMIT 50;
```

