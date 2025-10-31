# 📊 How to View Execution Logs

Multiple ways to check if your bots are executing:

---

## **Method 1: Supabase Edge Function Logs (Dashboard)**

### **Step 1: Open Supabase Dashboard**
1. Go to [supabase.com](https://supabase.com)
2. Sign in to your project

### **Step 2: Navigate to Edge Functions**
1. Click **Edge Functions** in the left sidebar
2. Click **bot-executor** function

### **Step 3: View Logs**
1. Click the **Logs** tab
2. Filter by **Log level** (select "Log" or "Info" to see execution messages)
3. Look for messages like:
   - `🤖 Executing bot: ...`
   - `📊 Found X running bots`
   - `🚀 Executing X running bots`
   - `📊 Bot market data: ...`
   - `✅ Trade executed`

### **Filter Tips:**
- **Level**: Select "Log" or "Info" (not "Boot" or "Shutdown")
- **Search**: Type "Executing" or "bot" to filter
- **Time Range**: Select last hour or last 24 hours

---

## **Method 2: Database Bot Activity Logs (SQL)**

Run this SQL query in **Supabase SQL Editor**:

```sql
-- View recent bot execution logs
SELECT 
    b.name as bot_name,
    b.symbol,
    log.level,
    log.category,
    log.message,
    log.created_at
FROM bot_activity_logs log
JOIN trading_bots b ON log.bot_id = b.id
WHERE log.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY log.created_at DESC
LIMIT 50;
```

**What to look for:**
- `category: 'system'` → Bot execution started
- `category: 'market'` → Market data fetched
- `category: 'strategy'` → Strategy evaluation
- `category: 'trade'` → Trade executed
- `level: 'success'` → Successful operations
- `level: 'warning'` → Warnings (e.g., insufficient balance)

---

## **Method 3: Recent Trades (SQL)**

Check if trades are actually being executed:

```sql
-- View recent trades
SELECT 
    b.name as bot_name,
    b.symbol,
    t.side,
    t.amount,
    t.price,
    t.status,
    t.executed_at,
    t.created_at
FROM trades t
JOIN trading_bots b ON t.bot_id = b.id
WHERE t.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY t.created_at DESC
LIMIT 20;
```

---

## **Method 4: Cron Job Logs (Server)**

Check your cron job logs on the server:

```bash
# SSH into your server
ssh root@your-server

# View recent cron job logs
tail -f /var/log/bot-scheduler/bot-scheduler.log

# Or view last 50 lines
tail -n 50 /var/log/bot-scheduler/bot-scheduler.log
```

**Expected output:**
```
[2025-10-31 08:02:30] ✅ Bot scheduler called successfully (HTTP 200, 3.100474s)
"botsExecuted":4
```

**If you see errors:**
- `HTTP 401` → Missing authorization header
- `HTTP 500` → Function error
- `HTTP 200` with `botsExecuted:0` → No running bots found

---

## **Method 5: Comprehensive Execution Status (SQL)**

Get a complete overview of bot execution status:

```sql
-- Comprehensive bot execution status
WITH recent_logs AS (
    SELECT 
        bot_id,
        MAX(created_at) as last_execution,
        COUNT(*) as log_count,
        SUM(CASE WHEN category = 'trade' THEN 1 ELSE 0 END) as trade_logs,
        SUM(CASE WHEN category = 'market' THEN 1 ELSE 0 END) as market_logs
    FROM bot_activity_logs
    WHERE created_at >= NOW() - INTERVAL '1 hour'
    GROUP BY bot_id
),
recent_trades AS (
    SELECT 
        bot_id,
        COUNT(*) as trades_count,
        MAX(executed_at) as last_trade
    FROM trades
    WHERE created_at >= NOW() - INTERVAL '1 hour'
    AND status IN ('filled', 'completed', 'closed')
    GROUP BY bot_id
)
SELECT 
    b.id,
    b.name,
    b.symbol,
    b.status,
    rl.last_execution,
    rl.log_count,
    rl.trade_logs,
    rl.market_logs,
    rt.trades_count,
    rt.last_trade,
    CASE 
        WHEN rl.last_execution IS NULL THEN '❌ No execution logs'
        WHEN rl.last_execution < NOW() - INTERVAL '10 minutes' THEN '⚠️ Stale (10+ min ago)'
        WHEN rl.trade_logs > 0 THEN '✅ Active (trades executed)'
        WHEN rl.market_logs > 0 THEN '✅ Active (checking market)'
        ELSE '⚠️ Running but no activity'
    END as execution_status
FROM trading_bots b
LEFT JOIN recent_logs rl ON b.id = rl.bot_id
LEFT JOIN recent_trades rt ON b.id = rt.bot_id
WHERE b.status = 'running'
ORDER BY rl.last_execution DESC NULLS LAST;
```

---

## **Method 6: Real-Time Execution Monitor (SQL)**

Watch executions in real-time:

```sql
-- Real-time execution monitor
SELECT 
    b.name as bot_name,
    b.symbol,
    log.message,
    log.level,
    log.category,
    log.created_at,
    EXTRACT(EPOCH FROM (NOW() - log.created_at))::int as seconds_ago
FROM bot_activity_logs log
JOIN trading_bots b ON log.bot_id = b.id
WHERE log.created_at >= NOW() - INTERVAL '5 minutes'
AND b.status = 'running'
ORDER BY log.created_at DESC;
```

Refresh this query every few seconds to see live execution.

---

## **Quick Diagnostic Query**

Run this to quickly check if bots are executing:

```sql
-- Quick execution check
SELECT 
    b.name,
    b.symbol,
    (SELECT COUNT(*) FROM bot_activity_logs 
     WHERE bot_id = b.id 
     AND created_at >= NOW() - INTERVAL '10 minutes') as logs_last_10min,
    (SELECT MAX(created_at) FROM bot_activity_logs 
     WHERE bot_id = b.id) as last_log_time,
    (SELECT COUNT(*) FROM trades 
     WHERE bot_id = b.id 
     AND created_at >= NOW() - INTERVAL '10 minutes') as trades_last_10min
FROM trading_bots b
WHERE b.status = 'running'
ORDER BY last_log_time DESC;
```

**Interpretation:**
- `logs_last_10min > 0` → Bot is executing ✅
- `logs_last_10min = 0` → Bot not executing ⚠️
- `trades_last_10min > 0` → Bot is placing trades ✅

---

## **What Normal Execution Looks Like**

### **Every 5 minutes, you should see:**

1. **Cron Job Log** (server):
   ```
   ✅ Bot scheduler called successfully (HTTP 200, X.XXs)
   "botsExecuted":4
   ```

2. **Edge Function Logs** (Supabase):
   ```
   🔍 Cron: Looking for all running bots (service role)
   📊 Found 4 running bots
   🚀 Executing 4 running bots
   🤖 Executing bot: ETH $$$ (symbol)
   ```

3. **Bot Activity Logs** (Database):
   - `Bot execution started` (every 5 min)
   - `Market data: Price=..., RSI=..., ADX=...` (every 5 min)
   - `Strategy conditions not met: ...` OR `Trade executed` (when conditions met)

4. **Trades Table** (Database):
   - New trade rows every time a trade is executed

---

## **Troubleshooting**

### **No execution logs found?**

1. **Check cron job is running:**
   ```bash
   crontab -l  # Should show */5 * * * * /path/to/call-bot-scheduler.sh
   ```

2. **Check cron job logs:**
   ```bash
   tail -f /var/log/bot-scheduler/bot-scheduler.log
   ```

3. **Check bot status:**
   ```sql
   SELECT id, name, status FROM trading_bots WHERE status = 'running';
   ```

4. **Manually test scheduler:**
   ```bash
   bash /var/www/Ai-Trading-Bots/scripts/call-bot-scheduler.sh
   ```

### **Logs show errors?**

- `401 Unauthorized` → Check `.env.cron` has correct `SUPABASE_ANON_KEY`
- `500 Internal Server Error` → Check Edge Function logs for error details
- `No running bots found` → Check bot status in database

---

## **Best Practice: Set Up Monitoring**

Create a dashboard query you can bookmark:

```sql
-- Execution Health Dashboard
SELECT 
    b.name,
    b.symbol,
    b.status,
    CASE 
        WHEN (SELECT COUNT(*) FROM bot_activity_logs 
              WHERE bot_id = b.id 
              AND created_at >= NOW() - INTERVAL '10 minutes') > 0 
        THEN '✅ Executing'
        ELSE '❌ Not Executing'
    END as execution_status,
    (SELECT MAX(created_at) FROM bot_activity_logs WHERE bot_id = b.id) as last_execution,
    (SELECT COUNT(*) FROM trades 
     WHERE bot_id = b.id 
     AND created_at >= NOW() - INTERVAL '1 hour') as trades_last_hour
FROM trading_bots b
WHERE b.status = 'running'
ORDER BY last_execution DESC NULLS LAST;
```

Run this query periodically to monitor bot health! 🎯

