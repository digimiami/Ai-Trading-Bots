# Track Bot Execution Flow - Database Logging

## ✅ Changes Deployed

Added comprehensive **database logging** to track bot execution flow in real-time. All execution steps are now logged to the `bot_activity_logs` table, making it easy to identify exactly where execution stops.

## 🔍 What Was Added

### Database Logging for Every Critical Step:

1. **💰 REAL TRADING MODE** - Logs when real trading mode starts
2. **⏱️ Cooldown Check** - Logs before/after cooldown check with results
3. **🕐 Trading Hours Check** - Logs before/after trading hours check with results
4. **🛡️ Safety Limits Check** - Logs before/after safety check with results
5. **📊 Market Data Fetch** - Logs each step:
   - Starting market data fetch
   - Fetching price (before/after)
   - Fetching RSI (before/after)
   - Fetching ADX (before/after)

### Log Structure

Each log entry includes:
- **Level**: `info`, `warning`, or `error`
- **Category**: `system`, `market`, `trade`, etc.
- **Message**: Human-readable message with emoji indicators
- **Details**: JSON object with:
  - `step`: Current execution step
  - `bot_name`: Bot name
  - `symbol`: Trading symbol
  - `stopped`: `true` if execution stopped at this step
  - `passed`: `true` if check passed
  - Additional step-specific data

## 📊 How to Check Bot Execution

### SQL Query to See Execution Flow

```sql
-- Check latest execution flow for a specific bot
SELECT 
  created_at,
  level,
  category,
  message,
  details->>'step' as step,
  details->>'stopped' as stopped,
  details->>'passed' as passed,
  details
FROM bot_activity_logs
WHERE bot_id = 'YOUR_BOT_ID'
  AND category IN ('system', 'market')
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 50;
```

### SQL Query to Find Where Execution Stops

```sql
-- Find the last step reached for each bot
SELECT 
  b.id as bot_id,
  b.name as bot_name,
  b.symbol,
  b.status,
  b.paper_trading,
  MAX(ba.created_at) as last_log_time,
  MAX(ba.message) FILTER (WHERE ba.details->>'step' IS NOT NULL) as last_step,
  MAX(ba.details->>'stopped')::boolean as stopped,
  MAX(ba.details->>'passed')::boolean as passed
FROM trading_bots b
LEFT JOIN bot_activity_logs ba ON b.id = ba.bot_id
WHERE b.status = 'running'
  AND ba.created_at > NOW() - INTERVAL '2 hours'
GROUP BY b.id, b.name, b.symbol, b.status, b.paper_trading
ORDER BY last_log_time DESC;
```

### SQL Query to Check All Recent Execution Steps

```sql
-- See all execution steps for all running bots
SELECT 
  b.name as bot_name,
  b.symbol,
  ba.created_at,
  ba.message,
  ba.details->>'step' as execution_step,
  ba.details->>'stopped' as stopped,
  ba.details->>'passed' as passed
FROM bot_activity_logs ba
JOIN trading_bots b ON ba.bot_id = b.id
WHERE b.status = 'running'
  AND ba.category IN ('system', 'market')
  AND ba.created_at > NOW() - INTERVAL '1 hour'
ORDER BY ba.created_at DESC, b.name;
```

## 🎯 What to Look For

### Execution Flow Indicators:

1. **✅ "💰 REAL TRADING MODE - Execution started"**
   - Bot entered real trading mode (not paper trading)

2. **✅ "⏱️ Checking cooldown bars..."**
   - Cooldown check started

3. **✅ "✅ Cooldown check passed - can trade"** OR **⏸️ "⏸️ Cooldown active: [reason]"**
   - Cooldown check result

4. **✅ "🕐 Checking trading hours..."**
   - Trading hours check started

5. **✅ "✅ Trading hours check passed - can trade"** OR **⏸️ "🕐 Outside trading hours: [reason]"**
   - Trading hours check result

6. **✅ "🛡️ Checking safety limits..."**
   - Safety check started

7. **✅ "✅ Safety checks passed - can trade"** OR **⚠️ "⚠️ Trading blocked: [reason]"**
   - Safety check result

8. **✅ "📊 Starting market data fetch..."**
   - Market data fetch started

9. **✅ "📊 Fetching price..." → "✅ Price fetched: [price]"**
   - Price fetch result

10. **✅ "📊 Fetching RSI..." → "✅ RSI fetched: [rsi]"**
    - RSI fetch result

11. **✅ "📊 Fetching ADX..." → "✅ ADX fetched: [adx]"**
    - ADX fetch result

### If Execution Stops:

- **Last log shows `stopped: true`** → Execution stopped at that step
- **Last log shows `passed: false`** → Check failed at that step
- **No logs after a certain step** → Execution may have crashed or errored

## 🔧 Troubleshooting

### Bot Not Reaching Real Trading Mode

If you don't see "💰 REAL TRADING MODE - Execution started":
- Check if `paper_trading = true` in the database
- Bot may be in paper trading mode

### Execution Stops at Cooldown

If you see "⏸️ Cooldown active":
- Check `cooldown_bars` setting in bot configuration
- Check last trade time in `trades` table
- Wait for cooldown period to pass

### Execution Stops at Trading Hours

If you see "🕐 Outside trading hours":
- Check `trading_hours` setting in bot configuration
- Verify current time is within allowed hours

### Execution Stops at Safety Check

If you see "⚠️ Trading blocked":
- Check safety limits (max daily trades, max loss, etc.)
- Review `details` in the log for specific reason

### Execution Stops at Market Data Fetch

If you see "❌ Market data fetch error":
- Check API key validity
- Check exchange connectivity
- Review error details in log

## 📝 Next Steps

1. **Wait for auto-deployment** (2-5 minutes)
2. **Monitor bot activity logs** after next bot execution
3. **Query the database** to see execution flow
4. **Identify the blocker** using the step indicators
5. **Fix the issue** based on the identified blocker

## 🎉 Benefits

- **Real-time tracking**: See exactly where execution stops
- **Database persistence**: Logs survive function restarts
- **Easy querying**: Use SQL to analyze execution patterns
- **Clear indicators**: Emoji and step names make logs easy to read
- **No console log filtering**: Database logs are always accessible

---

**Deployed**: Changes pushed to git and will auto-deploy to Supabase
**Status**: ✅ Ready to track bot execution flow

