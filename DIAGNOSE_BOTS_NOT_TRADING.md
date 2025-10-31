# 🔍 Diagnose Why Bots Are Not Trading

## Quick Test Script

I've created a comprehensive diagnostic SQL script: **`scripts/test-why-bots-not-trading.sql`**

### How to Run:

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project: `dkawxgwdqiirgmmjbvhc`
   - Navigate to **SQL Editor**

2. **Run the Diagnostic Script**
   - Open the file: `scripts/test-why-bots-not-trading.sql`
   - Copy the entire SQL script
   - Paste it into the SQL Editor
   - Click **Run** (or press `Ctrl+Enter`)

3. **Review Results**
   The script will show you:
   - ✅ Summary of all running bots
   - 🛡️ Safety limits status (trades today, positions, loss limits)
   - 🔑 API key configuration
   - 📊 Strategy configuration
   - ❌ Recent errors & warnings
   - ⏸️ Strategy conditions not met
   - 📈 Recent execution activity
   - 🚨 Potential issues summary

## Common Reasons Bots Don't Trade

### 1. **Safety Limits Reached** ⚠️
- **Daily trade limit reached** (e.g., 8/8 trades today)
- **Max concurrent positions reached** (e.g., 2/2 positions open)
- **Daily loss limit reached** (e.g., lost 10% today)
- **Weekly loss limit reached** (e.g., lost 20% this week)
- **Max consecutive losses reached** (e.g., 5 losses in a row)

### 2. **Strategy Conditions Not Met** ⏸️
- RSI not extreme enough (< 30 for buy, > 70 for sell)
- ADX not high enough (< 25, meaning weak trend)
- Market conditions don't match strategy thresholds

### 3. **Configuration Issues** ❌
- Missing API keys
- API key exchange mismatch
- No strategy configured
- Missing RSI/ADX thresholds

### 4. **Errors** ❌
- Insufficient balance
- Network errors
- API errors
- Authentication errors

## What to Check First

### Quick Check (Run This SQL):

```sql
-- Quick status check
SELECT 
    b.name,
    b.status,
    b.last_trade_at,
    COUNT(t.id) FILTER (
        WHERE t.executed_at >= DATE_TRUNC('day', NOW())
        AND t.status IN ('filled', 'completed', 'closed')
    ) AS trades_today,
    COALESCE((b.strategy_config->>'max_trades_per_day')::int, 8) AS max_trades
FROM trading_bots b
LEFT JOIN trades t ON b.id = t.bot_id
WHERE b.status = 'running'
GROUP BY b.id, b.name, b.status, b.last_trade_at, b.strategy_config;
```

## Expected Results

After running the diagnostic script, you should see:

1. **If bots are at limits:**
   - `❌ TRADES LIMIT REACHED` - Wait until tomorrow or increase `max_trades_per_day`
   - `❌ POSITIONS LIMIT REACHED` - Close some positions or increase `max_concurrent`

2. **If strategy conditions not met:**
   - `⏸️ WAITING FOR MARKET CONDITIONS` - This is normal, bots wait for good entry points

3. **If configuration issues:**
   - `❌ MISSING API KEY` - Add API keys in Settings
   - `❌ NO STRATEGY` - Configure strategy for the bot

4. **If errors:**
   - `❌ INSUFFICIENT BALANCE` - Add funds to exchange account
   - `❌ API ERROR` - Check API keys are valid

## Next Steps

Based on the diagnostic results:

1. **If safety limits reached:**
   - Wait for daily limit to reset (UTC midnight)
   - Or adjust limits in bot settings

2. **If strategy conditions not met:**
   - This is normal! Bots only trade when conditions are right
   - Adjust strategy thresholds if you want more frequent trades

3. **If configuration issues:**
   - Fix missing API keys
   - Configure strategy settings

4. **If errors:**
   - Check exchange balance
   - Verify API keys
   - Check network connectivity

## Files Created

- ✅ `scripts/test-why-bots-not-trading.sql` - Comprehensive diagnostic script
- ✅ `DIAGNOSE_BOTS_NOT_TRADING.md` - This guide

Run the SQL script in Supabase SQL Editor to find out why bots are not trading!

