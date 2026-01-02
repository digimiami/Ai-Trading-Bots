# 🚀 How to Use "Always Trade" Feature

The "Always Trade" feature makes your bot trade on **every execution cycle**, regardless of market conditions. This bypasses all strategy filters (RSI, ADX, EMA, etc.) and always generates a trade signal.

---

## 📋 **Quick Start**

### **Method 1: Update Existing Bot via SQL (Easiest)**

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable Always Trade for a specific bot
UPDATE trading_bots 
SET strategy_config = jsonb_build_object(
  'always_trade', true,
  'type', 'always_trade'
)
WHERE id = 'your-bot-id-here';

-- Or enable for multiple bots by name
UPDATE trading_bots 
SET strategy_config = jsonb_build_object(
  'always_trade', true,
  'type', 'always_trade'
)
WHERE name LIKE '%Your Bot Name%';
```

### **Method 2: Create New Bot with Always Trade**

```sql
-- Create a new bot with Always Trade enabled
INSERT INTO trading_bots (
  user_id,
  name,
  exchange,
  trading_type,
  symbol,
  timeframe,
  leverage,
  trade_amount,
  stop_loss,
  take_profit,
  risk_level,
  status,
  strategy,
  strategy_config,
  paper_trading,
  created_at
)
SELECT 
  u.id as user_id,
  'Always Trade Bot - BTCUSDT' as name,
  'bybit' as exchange,
  'futures' as trading_type,
  'BTCUSDT' as symbol,
  '1h' as timeframe,
  3 as leverage,
  100 as trade_amount,
  2.0 as stop_loss,
  4.0 as take_profit,
  'medium' as risk_level,
  'running' as status,
  jsonb_build_object(
    'type', 'always_trade',
    'name', 'Always Trade Strategy'
  ) as strategy,
  jsonb_build_object(
    'always_trade', true,
    'type', 'always_trade',
    'bias_mode', 'both'  -- 'both', 'long_only', or 'short_only'
  ) as strategy_config,
  true as paper_trading,  -- Set to false for real trading
  NOW() as created_at
FROM auth.users u
WHERE u.email = 'your-email@example.com'  -- Change to your email
LIMIT 1;
```

---

## ⚙️ **Configuration Options**

### **Basic Configuration**

```json
{
  "always_trade": true,
  "type": "always_trade"
}
```

### **With Directional Bias**

```json
{
  "always_trade": true,
  "type": "always_trade",
  "bias_mode": "long_only"  // Only buy trades
}
```

```json
{
  "always_trade": true,
  "type": "always_trade",
  "bias_mode": "short_only"  // Only sell/short trades
}
```

```json
{
  "always_trade": true,
  "type": "always_trade",
  "bias_mode": "both"  // Both buy and sell (default)
}
```

### **With Risk Management**

```json
{
  "always_trade": true,
  "type": "always_trade",
  "bias_mode": "both",
  "max_trades_per_day": 20,
  "max_concurrent": 3,
  "cooldown_bars": 0,  // No cooldown (trades every cycle)
  "risk_per_trade_pct": 1.0
}
```

---

## 🎯 **How It Works**

### **Trade Signal Logic**

The bot determines trade direction based on RSI:
- **RSI > 50** → **SELL/SHORT** signal
- **RSI ≤ 50** → **BUY/LONG** signal

### **Stop Loss & Take Profit**

Automatically set:
- **Stop Loss**: 2% from entry price
- **Take Profit 1**: 2% from entry price
- **Take Profit 2**: 5% from entry price

### **Confidence Level**

Fixed at **0.6** (60% confidence) - this is a moderate confidence level since we're trading regardless of conditions.

---

## 📊 **Examples**

### **Example 1: Enable for All Running Bots**

```sql
-- Enable Always Trade for all currently running bots
UPDATE trading_bots 
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
  'always_trade', true,
  'type', 'always_trade'
)
WHERE status = 'running';
```

### **Example 2: Enable for Paper Trading Bots Only**

```sql
-- Enable Always Trade for all paper trading bots
UPDATE trading_bots 
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
  'always_trade', true,
  'type', 'always_trade'
)
WHERE paper_trading = true;
```

### **Example 3: Enable for Specific Symbol**

```sql
-- Enable Always Trade for all BTCUSDT bots
UPDATE trading_bots 
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
  'always_trade', true,
  'type', 'always_trade'
)
WHERE symbol = 'BTCUSDT';
```

### **Example 4: Disable Always Trade**

```sql
-- Disable Always Trade (return to normal strategy)
UPDATE trading_bots 
SET strategy_config = strategy_config - 'always_trade' - 'type'
WHERE id = 'your-bot-id-here';
```

---

## ⚠️ **Important Warnings**

### **⚠️ High Trade Frequency**

- Bot will trade on **every execution cycle** (typically every 1-5 minutes)
- Can generate **hundreds of trades per day**
- Ensure you have:
  - ✅ Sufficient balance
  - ✅ Proper position sizing
  - ✅ Risk management limits set

### **⚠️ Risk Management**

**Recommended Settings:**
```json
{
  "always_trade": true,
  "max_trades_per_day": 20,      // Limit daily trades
  "max_concurrent": 2,            // Max open positions
  "cooldown_bars": 1,             // Small cooldown between trades
  "risk_per_trade_pct": 0.5,      // Lower risk per trade
  "daily_loss_limit_pct": 5.0     // Daily loss limit
}
```

### **⚠️ Paper Trading First**

**Strongly recommended** to test with `paper_trading: true` first:

```sql
-- Enable Always Trade for paper trading only
UPDATE trading_bots 
SET strategy_config = jsonb_build_object(
  'always_trade', true,
  'type', 'always_trade'
)
WHERE paper_trading = true
  AND id = 'your-bot-id';
```

---

## 🔍 **Verify It's Working**

### **Check Bot Logs**

After enabling, check the bot execution logs. You should see:

```
🚀 [ALWAYS TRADE MODE] Generating BUY signal regardless of conditions (RSI: 45.23)
```

or

```
🚀 [ALWAYS TRADE MODE] Generating SELL signal regardless of conditions (RSI: 65.78)
```

### **Check Recent Trades**

```sql
-- Check if bot is trading frequently
SELECT 
  bot_id,
  symbol,
  side,
  created_at,
  COUNT(*) as trade_count
FROM trades
WHERE bot_id = 'your-bot-id'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY bot_id, symbol, side, created_at
ORDER BY created_at DESC;
```

---

## 🛠️ **Troubleshooting**

### **Bot Still Not Trading?**

1. **Check bot status:**
```sql
SELECT id, name, status, strategy_config 
FROM trading_bots 
WHERE id = 'your-bot-id';
```

2. **Verify always_trade is set:**
```sql
SELECT 
  id,
  name,
  strategy_config->>'always_trade' as always_trade,
  strategy_config->>'type' as strategy_type
FROM trading_bots 
WHERE id = 'your-bot-id';
```

3. **Check for bias_mode restrictions:**
```sql
-- If bias_mode is 'long-only', bot won't sell
-- If bias_mode is 'short-only', bot won't buy
SELECT 
  id,
  name,
  strategy_config->>'bias_mode' as bias_mode
FROM trading_bots 
WHERE id = 'your-bot-id';
```

4. **Check bot logs for errors:**
```sql
SELECT 
  level,
  category,
  message,
  details,
  created_at
FROM bot_activity_logs
WHERE bot_id = 'your-bot-id'
ORDER BY created_at DESC
LIMIT 20;
```

### **Too Many Trades?**

Add cooldown and limits:
```sql
UPDATE trading_bots 
SET strategy_config = strategy_config || jsonb_build_object(
  'cooldown_bars', 5,           -- Wait 5 bars between trades
  'max_trades_per_day', 10,     -- Max 10 trades per day
  'max_concurrent', 1            -- Only 1 open position at a time
)
WHERE id = 'your-bot-id';
```

---

## 📝 **Summary**

**To Enable Always Trade:**
1. ✅ Set `always_trade: true` in `strategy_config`
2. ✅ Set `type: 'always_trade'` (optional but recommended)
3. ✅ Ensure bot status is `'running'`
4. ✅ Deploy the updated bot-executor function (if not already deployed)

**What Happens:**
- ✅ Bot trades on every execution cycle
- ✅ Trade direction based on RSI (>50 = sell, ≤50 = buy)
- ✅ Automatic stop loss (2%) and take profit (2%/5%)
- ✅ Works with both paper and real trading

**Remember:**
- ⚠️ Start with paper trading
- ⚠️ Set proper risk limits
- ⚠️ Monitor trade frequency
- ⚠️ Ensure sufficient balance

---

**Ready to use!** 🚀

