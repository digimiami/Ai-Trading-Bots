# 🔍 Diagnose Why Bots Are Not Trading

## **What Your Logs Show**

### ✅ **Trade WAS Executed:**
- **Time**: 2025-10-31 08:43:03
- **Bot**: LABUSDT (d0f20c00-77d0-4de9-aeca-3fcdc8809e03)
- **Symbol**: LABUSDT
- **Side**: Buy
- **Amount**: 100
- **Price**: $0.2176
- **Status**: ✅ Filled
- **Order ID**: 31430a23-13f0-4fb6-bae0-8fd186a36662

---

## **Issues Found**

### **1. Price Fetching Error**

```
Error fetching price for LABUSDT: TypeError: Cannot read properties of undefined (reading '0')
```

**Problem**: Bybit API response structure might be different for some symbols, or the symbol might not exist in the response.

**Status**: ✅ Fixed in code (better error handling added)

---

### **2. Only One Bot Executing**

Looking at logs, only **LABUSDT** bot is executing. Other bots (ETH, SOLO) might be:
- Not running (status != 'running')
- Blocked by safety limits
- No trading signals detected

---

## **Diagnostic Steps**

### **Step 1: Check All Bot Statuses**

Run this SQL in Supabase:

```sql
SELECT 
    id,
    name,
    status,
    symbol,
    exchange,
    last_trade_at,
    created_at
FROM trading_bots
ORDER BY created_at DESC;
```

**What to look for:**
- ✅ `status = 'running'` - Bot should be running
- ⚠️ `status = 'paused'` - Bot paused (check why)
- ❌ `status = 'stopped'` - Bot stopped

---

### **Step 2: Check Safety Limits**

```sql
SELECT 
    b.id,
    b.name,
    b.symbol,
    -- Safety settings
    COALESCE((b.strategy_config->>'max_trades_per_day')::int, 8) as max_trades_per_day,
    COALESCE((b.strategy_config->>'max_concurrent')::int, 3) as max_concurrent,
    -- Current stats
    (SELECT COUNT(*) FROM trades 
     WHERE bot_id = b.id 
     AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
     AND status IN ('filled', 'completed', 'closed'))::int as trades_today,
    (SELECT COUNT(*) FROM trades 
     WHERE bot_id = b.id 
     AND status IN ('open', 'pending'))::int as open_positions
FROM trading_bots b
WHERE b.status = 'running';
```

**What to check:**
- `trades_today` >= `max_trades_per_day` → **Limit reached**
- `open_positions` >= `max_concurrent` → **Position limit reached**

---

### **Step 3: Check Strategy Conditions**

Your bots need **RSI conditions** to be met:

```sql
SELECT 
    b.id,
    b.name,
    b.symbol,
    (b.strategy::json->>'rsiThreshold')::numeric as rsi_threshold,
    -- This means: buys when RSI < (100 - rsiThreshold), sells when RSI > rsiThreshold
    CASE 
        WHEN (b.strategy::json->>'rsiThreshold')::numeric = 55 
        THEN 'Buys when RSI < 45, Sells when RSI > 55'
        ELSE 'Check threshold'
    END as trading_conditions
FROM trading_bots b
WHERE b.status = 'running';
```

---

### **Step 4: Check Recent Bot Logs**

Look for messages like:
- `"Trading conditions not met: No trading signals detected"` → Conditions not met
- `"Trading blocked: Max trades per day reached"` → Limit reached
- `"Trading blocked: Insufficient balance"` → Balance issue

```sql
SELECT 
    bot_id,
    level,
    category,
    message,
    created_at
FROM bot_activity_logs
WHERE bot_id IN (SELECT id FROM trading_bots WHERE status = 'running')
ORDER BY created_at DESC
LIMIT 20;
```

---

## **Common Reasons Bots Don't Trade**

### **1. Market Conditions Not Met**
- RSI is in neutral zone (40-60)
- Needs extreme RSI values (< 40 or > 60) depending on threshold

### **2. Safety Limits Reached**
- Max trades per day reached
- Max concurrent positions reached
- Daily/weekly loss limits hit

### **3. Balance Issues**
- Insufficient balance for orders
- Funds locked in open positions

### **4. Bot Status**
- Bot paused (check logs for reason)
- Bot stopped
- Emergency stop activated

### **5. Price Fetching Errors**
- Symbol not available on exchange
- API response structure different
- Network issues

---

## **Quick Fixes**

### **If RSI Conditions Too Strict:**

Lower your RSI thresholds to get more trades:
- Current (conservative): `rsiThreshold: 55` → Trades when RSI < 45 or > 55
- More aggressive: `rsiThreshold: 40` → Trades when RSI < 60 or > 40

### **If Safety Limits Too Low:**

Increase limits:
- `max_trades_per_day`: Increase from 8 to 20+
- `max_concurrent`: Increase from 3 to 5+

### **If Balance Issues:**

Add more funds to your Bybit account:
- Minimum: ~$400-500 USDT
- Recommended: $1000+ USDT for multiple bots

---

## **How to Check What's Blocking**

### **Run This SQL:**

```sql
-- Comprehensive bot status check
WITH bot_status AS (
    SELECT 
        b.id,
        b.name,
        b.symbol,
        b.status,
        b.exchange,
        -- Safety limits
        COALESCE((b.strategy_config->>'max_trades_per_day')::int, 8) as max_trades,
        COALESCE((b.strategy_config->>'max_concurrent')::int, 3) as max_positions,
        -- Current stats
        (SELECT COUNT(*) FROM trades 
         WHERE bot_id = b.id 
         AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
         AND status IN ('filled', 'completed', 'closed')) as trades_today,
        (SELECT COUNT(*) FROM trades 
         WHERE bot_id = b.id 
         AND status IN ('open', 'pending')) as open_pos,
        -- Last trade
        (SELECT MAX(executed_at) FROM trades WHERE bot_id = b.id) as last_trade
    FROM trading_bots b
)
SELECT 
    id,
    name,
    symbol,
    status,
    trades_today || '/' || max_trades as trades_status,
    open_pos || '/' || max_positions as positions_status,
    CASE 
        WHEN status != 'running' THEN '⚠️ Bot not running'
        WHEN trades_today >= max_trades THEN '⚠️ Max trades/day reached'
        WHEN open_pos >= max_positions THEN '⚠️ Max positions reached'
        ELSE '✅ Should be trading'
    END as status_message,
    last_trade
FROM bot_status
ORDER BY name;
```

---

## **Expected Behavior**

**Normal:**
- ✅ Bot executes every 5 minutes
- ✅ Strategy evaluates market conditions
- ✅ Trade executes **only when conditions are met**
- ✅ Not every execution = trade (this is correct!)

**If Not Trading:**
- ⚠️ Check bot status (should be 'running')
- ⚠️ Check safety limits (trades_today, open_positions)
- ⚠️ Check strategy thresholds (RSI values)
- ⚠️ Check balance

---

## **Summary**

Your logs show:
- ✅ **One trade executed** (LABUSDT)
- ✅ **System working correctly**
- ⚠️ **Price fetching error** (fixed in code)
- ❓ **Other bots not executing** (check status and limits)

**Next Steps:**
1. Run the diagnostic SQL queries above
2. Check bot statuses
3. Check safety limits
4. Verify strategy thresholds

**Remember**: Bots should **not** trade on every execution. They wait for the right conditions! 🎯

