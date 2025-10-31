# AI Auto-Pilot Mode - Automatic Optimization Every Hour

## 🚀 **Auto-Pilot Mode Overview**

Auto-Pilot Mode automatically optimizes your trading bots **every 1 hour** without any manual intervention. The AI analyzes bot performance and applies optimizations when confidence is high enough.

---

## ✅ **How to Enable Auto-Pilot**

### Step 1: Enable AI/ML for Your Bot
1. Go to your bot settings
2. Toggle **"AI/ML Enabled"** to ON
3. Save the bot

### Step 2: Enable Auto-Pilot Mode
1. Go to bot details page
2. Scroll to **"AI Auto-Optimization"** section
3. Find the **"Auto-Pilot Mode"** toggle
4. **Toggle it ON** ✅

### Step 3: Done!
- Auto-pilot is now active
- Bot will optimize automatically every hour
- No manual intervention needed!

---

## 🔄 **How Auto-Pilot Works**

### Automatic Schedule
- **Runs every 1 hour** (3600000ms)
- Only runs if bot has `ai_ml_enabled = true`
- Only runs if bot status is `running`

### Optimization Process
1. **Analyzes bot performance** (win rate, PnL, profit factor)
2. **Calls OpenAI** for optimization recommendations
3. **Validates** all values (clamps to valid ranges)
4. **Auto-applies** if confidence ≥ 70%
5. **Logs** optimization to database

### Confidence Threshold
- **Auto-Pilot uses 70% confidence threshold**
- If AI confidence is ≥ 70%, optimization is automatically applied
- If confidence < 70%, optimization is skipped (bot keeps current settings)

---

## 📊 **What Gets Optimized Automatically**

### Basic Strategy Parameters:
- `rsiThreshold` (RSI threshold for buy/sell signals)
- `adxThreshold` (ADX threshold for trend strength)
- `bbWidthThreshold` (Bollinger Band width)
- `emaSlope` (EMA slope requirements)
- `atrPercentage` (ATR volatility filters)
- `vwapDistance` (VWAP distance requirements)
- `momentumThreshold` (Momentum indicators)

### Advanced Strategy Config:
- `adx_min_htf` (Higher timeframe ADX minimum)
- `adx_trend_min` (Trend ADX minimum)
- `risk_per_trade_pct` (Risk per trade percentage)
- `sl_atr_mult` (Stop loss ATR multiplier)
- `tp1_r`, `tp2_r` (Take profit risk/reward ratios)
- `bias_mode` (Directional bias)
- `regime_mode` (Trend vs mean-reversion)
- And all other advanced parameters

---

## 🔍 **Monitoring Auto-Pilot**

### Check Optimization History
- Go to bot details page
- Scroll to **"AI Optimization History"** section
- View all automatic optimizations applied

### Activity Logs
- Check **bot_activity_logs** table
- Look for entries with `category: 'strategy'`
- Message will say: "AI/ML Optimization Applied (Confidence: XX%)"

### Database Query
```sql
-- View recent auto-optimizations
SELECT 
  b.name as bot_name,
  so.status,
  so.confidence,
  so.reasoning,
  so.created_at
FROM strategy_optimizations so
JOIN trading_bots b ON b.id = so.bot_id
WHERE so.status = 'applied'
ORDER BY so.created_at DESC
LIMIT 10;
```

---

## ⚙️ **Auto-Pilot Settings**

### Current Configuration:
- **Interval**: Every 1 hour (3600000ms)
- **Confidence Threshold**: 70% for auto-apply
- **Requires**: Bot must have `ai_ml_enabled = true`
- **Requires**: Bot must be `status = 'running'`
- **Minimum Trades**: Needs at least 10 trades in last 30 days

### How to Change Interval
The interval is currently hardcoded to 1 hour. To change it:

1. Edit `src/hooks/useAutoOptimizer.ts`
2. Find line: `}, 3600000); // Run every hour`
3. Change `3600000` to your desired interval:
   - **30 minutes**: `1800000`
   - **2 hours**: `7200000`
   - **6 hours**: `21600000`
   - **24 hours**: `86400000`

---

## 🎯 **When Auto-Pilot Optimizes**

Auto-Pilot will optimize if:
- ✅ Bot has `ai_ml_enabled = true`
- ✅ Bot status is `running`
- ✅ Bot has ≥ 10 trades in last 30 days
- ✅ AI returns optimization with confidence ≥ 70%

Auto-Pilot will **NOT** optimize if:
- ❌ Bot doesn't have enough trades (< 10)
- ❌ AI confidence is too low (< 70%)
- ❌ Bot is not running
- ❌ OpenAI API key is not configured
- ❌ Optimization fails (database errors, etc.)

---

## 📈 **Example Auto-Pilot Flow**

```
Hour 1: Auto-Pilot runs
  → Bot has 12 trades, win rate 55%
  → AI suggests: Lower RSI from 70 to 65
  → Confidence: 75% ✅
  → Optimization applied automatically!

Hour 2: Auto-Pilot runs
  → Bot now has 13 trades, win rate 58%
  → AI suggests: Increase ADX threshold from 25 to 28
  → Confidence: 68% ❌ (below 70%)
  → Optimization skipped (confidence too low)

Hour 3: Auto-Pilot runs
  → Bot now has 15 trades, win rate 60%
  → AI suggests: Adjust risk_per_trade_pct from 0.75 to 1.0
  → Confidence: 82% ✅
  → Optimization applied automatically!
```

---

## 🔒 **Safety Features**

### Automatic Validation
- ✅ All values are **clamped to valid ranges** before applying
- ✅ Enum values are **validated** (bias_mode, regime_mode, etc.)
- ✅ Prevents database constraint errors

### Confidence-Based Application
- ✅ Only applies optimizations with **high confidence (≥ 70%)**
- ✅ Skips low-confidence optimizations to avoid bad changes
- ✅ Protects against poor AI recommendations

### Error Handling
- ✅ Catches and logs errors without crashing
- ✅ Continues running even if one optimization fails
- ✅ Logs all activities for monitoring

---

## 💡 **Best Practices**

1. **Monitor First Week**: Check optimization history after first few days
2. **Review Changes**: Look at what parameters were changed
3. **Track Performance**: Monitor if optimizations improve bot performance
4. **Adjust Threshold**: Can change confidence threshold in code if needed
5. **Enable for All Bots**: Can enable auto-pilot for multiple bots

---

## 🎉 **Summary**

**Auto-Pilot Mode = Fully Automated Optimization**

1. ✅ Enable AI/ML for bot
2. ✅ Toggle Auto-Pilot ON
3. ✅ Bot optimizes every hour automatically
4. ✅ No manual intervention needed!

The bot will continuously improve its strategy based on trading performance, adapting to market conditions automatically! 🚀

