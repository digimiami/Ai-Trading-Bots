# Timeout Errors - Comprehensive Solution

## Current Situation

You have **3 bots with timeout errors** that are taking longer than 15 seconds to execute:
- Scalping Strategy - Fast EMA Cloud - SOLUSDT
- Trend Following Strategy-Find Trading Pairs - ASTERUSDT  
- TRUSTUSDT

**Good News**: 2 of these bots (SOLUSDT and TRUSTUSDT) are also showing as HEALTHY, which means they're recovering but still experiencing occasional timeouts.

## Root Causes

Timeout errors occur when bot execution exceeds the 15-second limit. Common causes:

1. **Complex Strategy Evaluation**: Some strategies require multiple API calls and calculations
2. **Slow Exchange APIs**: Exchange APIs can be slow during high traffic
3. **Network Latency**: Connection issues between Supabase and exchanges
4. **Too Many Concurrent Operations**: Multiple operations happening simultaneously
5. **Large Data Processing**: Processing large amounts of market data

## Solutions

### Immediate Fix (Run This SQL)

Execute `AGGRESSIVE_FIX_TIMEOUT_ERRORS.sql` in Supabase SQL Editor:

1. This will reset execution times with **15-minute cooldowns** (prevents immediate retries)
2. Analyzes timeout patterns to identify the issue
3. Checks execution frequency to prevent loops

### Long-term Solutions

#### Option 1: Increase Timeout (Recommended)
The current timeout is 15 seconds. We can increase it to 20-25 seconds for complex strategies.

**To implement**: Update `PER_BOT_TIMEOUT_MS` in `bot-executor/index.ts`:
```typescript
const PER_BOT_TIMEOUT_MS = 20000; // Increase from 15000 to 20000
```

#### Option 2: Optimize Strategy Execution
- Reduce the number of API calls per execution
- Cache market data more aggressively
- Simplify complex strategy calculations

#### Option 3: Stagger Bot Execution
- Ensure bots don't all execute at the same time
- Add random delays between executions
- Use the queue system more effectively

## Bitunix API Error

The ETHUSDT bot on Bitunix is experiencing API errors. This is likely:

1. **Temporary Bitunix API Issue**: Code 2 errors are system errors from Bitunix
2. **API Key Issue**: Invalid or expired API key
3. **Rate Limiting**: Too many requests to Bitunix API

**Fix**: The SQL script will:
- Check API key status
- Reset execution with 10-minute cooldown
- Pause bot if no valid API key found

## Monitoring

After running the fix script, monitor these bots:

```sql
-- Check recent activity
SELECT 
  name,
  level,
  message,
  timestamp
FROM public.bot_activity_logs bal
INNER JOIN public.trading_bots tb ON bal.bot_id = tb.id
WHERE tb.name IN (
  'Scalping Strategy - Fast EMA Cloud - SOLUSDT',
  'Trend Following Strategy-Find Trading Pairs - ASTERUSDT',
  'TRUSTUSDT',
  'ETHUSDT'
)
AND timestamp >= NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC
LIMIT 30;
```

## Expected Results

After running `AGGRESSIVE_FIX_TIMEOUT_ERRORS.sql`:

1. **Timeout bots**: Will have 15-minute cooldown before next execution
2. **Bitunix bot**: Will be reset or paused based on API key status
3. **Health status**: Should improve over the next hour

## If Timeouts Continue

If bots still timeout after the fix:

1. **Check execution logs** for specific slow operations
2. **Consider increasing timeout** to 20-25 seconds
3. **Review strategy complexity** - may need optimization
4. **Check exchange API status** - exchanges may be slow

## Next Steps

1. ✅ Run `AGGRESSIVE_FIX_TIMEOUT_ERRORS.sql`
2. ✅ Monitor bot health status in 30 minutes
3. ✅ Check execution logs for patterns
4. ⚠️ If issues persist, consider increasing timeout limit

