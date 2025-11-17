# 🔍 Fix: TradingView Alerts Not Placing Orders (But Webhook Tests Work)

## Problem

- ✅ **Webhook tests** (from testing interface) → **Placing orders on Bybit** ✅
- ❌ **TradingView alerts** (real alerts) → **NOT placing orders on Bybit** ❌

## Key Finding

From your data:
- Bot status: `"stopped"` 
- Bot paper_trading: `false` (real trading enabled)
- Webhook tests work, but TradingView alerts don't

## Root Cause Analysis

Both webhook tests and TradingView alerts go through the **same code path**:
1. `tradingview-webhook` receives payload
2. Creates `manual_trade_signals` record
3. Calls `bot-executor` with `execute_bot` action
4. `bot-executor` processes manual signals via `processManualSignals()`
5. `executeManualTrade()` should place the order

**The difference must be in the payload structure or timing.**

## Most Likely Causes

### 1. **TradingView Alert Payload Missing `mode: "real"`**

If TradingView alert doesn't explicitly send `mode: "real"`, the code defaults to checking `bot.paper_trading`. But if the bot is stopped, there might be an issue.

**Check TradingView alert JSON:**
```json
{
  "secret": "...",
  "botId": "...",
  "action": "buy",
  "mode": "real",  // ← Make sure this is included!
  ...
}
```

### 2. **Bot Status "stopped" May Affect Processing**

Even though manual signals should work when bot is stopped, there might be a check preventing trades.

**Fix:**
```sql
UPDATE trading_bots
SET status = 'running'
WHERE id = '59f7165e-aff9-4107-b4a7-66a2ecfc5087';
```

### 3. **TradingView Template Variables Not Replaced**

If TradingView alert contains template variables like `{{strategy.order.action}}` that aren't replaced, the webhook will fail to parse the side.

**Check TradingView alert configuration:**
- Make sure all template variables are properly formatted
- Use actual values in test alerts, not template variables

### 4. **Timing Issue - Signal Processed Before Manual Signal Created**

If `bot-executor` runs before the `manual_trade_signals` record is committed, it won't find the signal.

**This is unlikely** since webhook tests work, but worth checking.

## Diagnostic Steps

### Step 1: Check Manual Trade Signals

```sql
SELECT 
  id,
  bot_id,
  side,
  mode,
  status,
  error,
  created_at,
  processed_at
FROM manual_trade_signals
WHERE bot_id IN ('59f7165e-aff9-4107-b4a7-66a2ecfc5087', '02511945-ef73-47df-822d-15608d1bac9e')
ORDER BY created_at DESC
LIMIT 10;
```

**Look for:**
- `status = 'pending'` or `'processing'` → Signal not processed
- `status = 'failed'` → Check `error` field
- `status = 'completed'` → Signal processed, but no trade? Check bot-executor logs

### Step 2: Check Bot-Executor Logs for TradingView Alerts

```sql
SELECT 
  id,
  bot_id,
  level,
  category,
  message,
  details,
  created_at
FROM bot_activity_logs
WHERE bot_id IN ('59f7165e-aff9-4107-b4a7-66a2ecfc5087', '02511945-ef73-47df-822d-15608d1bac9e')
  AND created_at >= NOW() - INTERVAL '2 hours'
  AND (
    message LIKE '%TradingView%' OR
    message LIKE '%manual%' OR
    message LIKE '%BUY ALERT%' OR
    message LIKE '%SELL ALERT%' OR
    message LIKE '%EXECUTING MANUAL TRADE%'
  )
ORDER BY created_at DESC;
```

**Look for:**
- `"🟢 BUY ALERT RECEIVED: Processing TradingView webhook signal"` → Signal received
- `"🚀 === EXECUTING MANUAL TRADE ==="` → Manual trade execution started
- `"💵 Executing REAL trade"` → Real trade mode
- `"📝 Executing PAPER trade"` → Paper trade mode (wrong!)
- `"❌ Manual trade signal failed"` → Error occurred

### Step 3: Compare Webhook Test vs TradingView Alert Payloads

**Webhook Test (works):**
- `userAgent: "Mozilla/5.0..."` (browser)
- `origin: "http://168.231.114.76:4173"` (your app)
- `reason: "Test webhook from testing interface"`

**TradingView Alert (doesn't work):**
- `userAgent: "Go-http-client/1.1"` (TradingView)
- `origin: "unknown"`
- `reason: "TradingView alert signal"`

**The payload structure should be the same**, but check if TradingView is sending different fields.

### Step 4: Check if Bot Status Affects Manual Trades

Even though the code says manual signals work when bot is stopped, verify this:

```sql
-- Check recent manual signals for stopped bots
SELECT 
  mts.id,
  mts.bot_id,
  mts.status,
  mts.error,
  mts.processed_at,
  tb.name,
  tb.status as bot_status
FROM manual_trade_signals mts
JOIN trading_bots tb ON tb.id = mts.bot_id
WHERE mts.created_at >= NOW() - INTERVAL '2 hours'
  AND tb.status = 'stopped'
ORDER BY mts.created_at DESC;
```

## Quick Fixes

### Fix 1: Set Bot Status to "running"

```sql
UPDATE trading_bots
SET status = 'running'
WHERE id IN ('59f7165e-aff9-4107-b4a7-66a2ecfc5087', '02511945-ef73-47df-822d-15608d1bac9e');
```

### Fix 2: Ensure TradingView Alert Includes `mode: "real"`

In your TradingView alert JSON, make sure to include:
```json
{
  "secret": "{{webhook_secret}}",
  "botId": "{{bot_id}}",
  "action": "{{strategy.order.action}}",
  "mode": "real",  // ← Add this explicitly
  ...
}
```

### Fix 3: Check `webhook_trigger_immediate` Setting

```sql
SELECT id, name, webhook_trigger_immediate, status
FROM trading_bots
WHERE id IN ('59f7165e-aff9-4107-b4a7-66a2ecfc5087', '02511945-ef73-47df-822d-15608d1bac9e');
```

If `webhook_trigger_immediate = false`, the bot won't execute immediately. Set it to `true`:

```sql
UPDATE trading_bots
SET webhook_trigger_immediate = true
WHERE id IN ('59f7165e-aff9-4107-b4a7-66a2ecfc5087', '02511945-ef73-47df-822d-15608d1bac9e');
```

## Next Steps

1. **Run the diagnostic queries above** to identify the exact issue
2. **Check bot-executor logs** in Supabase dashboard for TradingView alerts
3. **Compare payloads** between webhook tests and TradingView alerts
4. **Set bot status to "running"** if it's currently "stopped"
5. **Verify TradingView alert JSON** includes `mode: "real"`

---

**Most Likely Fix:** Set bot status to `'running'` and ensure TradingView alert includes `mode: "real"` in the JSON payload.

