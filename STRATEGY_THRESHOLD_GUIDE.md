# Strategy Threshold Adjustment Guide

## 🎯 How to Make Your Bots Trade More Often

### Understanding Strategy Thresholds

Your bots use multiple conditions to decide when to trade. Adjusting these thresholds changes how often they trade.

---

## 📊 Key Thresholds Explained

### 1. **RSI (Relative Strength Index)**

**What it measures:** Momentum - is the market oversold or overbought?

| Setting | Conservative | Moderate | Aggressive | Ultra-Aggressive |
|---------|-------------|----------|------------|------------------|
| **Oversold (Buy)** | RSI < 30 | RSI < 35 | RSI < 45 | RSI < 50 |
| **Overbought (Sell)** | RSI > 70 | RSI > 65 | RSI > 55 | RSI > 50 |
| **Frequency** | Rare trades | Weekly | Daily | Multiple/day |

**Example:**
- Conservative: Only buy when RSI < 30 (deeply oversold - rare)
- Aggressive: Buy when RSI < 45 (moderately oversold - common)

---

### 2. **ADX (Average Directional Index)**

**What it measures:** Trend strength - is the market trending or ranging?

| Setting | Conservative | Moderate | Aggressive | Ultra-Aggressive |
|---------|-------------|----------|------------|------------------|
| **Minimum ADX** | > 25 | > 18 | > 12 | > 5 |
| **Meaning** | Strong trend only | Medium trend | Weak trend OK | Any movement |
| **Frequency** | Rare trades | Weekly | Daily | Multiple/day |

**Example:**
- Conservative: ADX > 25 (strong trend required)
- Aggressive: ADX > 10 (weak trend acceptable)

---

### 3. **ML Confidence Threshold**

**What it measures:** AI prediction confidence level

| Setting | Conservative | Moderate | Aggressive | Ultra-Aggressive |
|---------|-------------|----------|------------|------------------|
| **Min Confidence** | > 80% | > 60% | > 45% | > 30% |
| **Risk Level** | Very Low | Low | Medium | High |
| **Frequency** | Rare trades | Weekly | Daily | Multiple/day |

**Example:**
- Conservative: Only trade when ML is 80%+ confident
- Aggressive: Trade when ML is 40%+ confident

---

### 4. **Cooldown Bars**

**What it measures:** Minimum time between trades

| Setting | Conservative | Moderate | Aggressive | Ultra-Aggressive |
|---------|-------------|----------|------------|------------------|
| **Bars to Wait** | 8 bars | 5 bars | 2 bars | 1 bar |
| **5m timeframe** | 40 minutes | 25 minutes | 10 minutes | 5 minutes |
| **15m timeframe** | 2 hours | 75 minutes | 30 minutes | 15 minutes |

**Example:**
- Conservative: Wait 8 bars (40 min on 5m chart)
- Aggressive: Wait 2 bars (10 min on 5m chart)

---

### 5. **Higher Timeframe ADX Check**

**What it measures:** Trend confirmation from larger timeframe

| Setting | Conservative | Moderate | Aggressive |
|---------|-------------|----------|------------|
| **HTF Check** | Enabled (strict) | Enabled (relaxed) | Disabled |
| **Effect** | Need trend on both timeframes | Need trend on higher TF | No check |
| **Frequency** | Rare trades | Weekly | Daily+ |

**Example:**
- Conservative: 5m trade needs 1h trend confirmation
- Aggressive: No higher timeframe check

---

## 🔧 How to Adjust Thresholds

### **Method 1: Via Frontend (Recommended)**

1. Go to **Bots** page
2. Click **Edit** on any bot
3. Scroll to **Strategy Configuration**
4. Adjust sliders:
   - **RSI Oversold**: Move RIGHT to buy more (30 → 45)
   - **RSI Overbought**: Move LEFT to sell more (70 → 55)
   - **ADX Threshold**: Move LEFT to accept weaker trends (25 → 10)
   - **Cooldown**: Move LEFT to trade faster (8 → 2)
5. Toggle **OFF**: "Higher Timeframe ADX Check"
6. Click **Save**

---

### **Method 2: Via SQL (Bulk Update)**

Use the `CREATE_AGGRESSIVE_BOT_CONFIGS.sql` file to update multiple bots at once.

**Quick Command:**
```sql
-- Make all paper bots more aggressive
UPDATE trading_bots
SET strategy_config = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(strategy_config, '{}'::jsonb),
      '{rsi_oversold}', '45'::jsonb
    ),
    '{rsi_overbought}', '55'::jsonb
  ),
  '{adx_threshold}', '12'::jsonb
)
WHERE paper_trading = true
  AND status = 'running';
```

---

## 🎚️ Recommended Presets

### **Preset 1: Conservative (Current Default)**
```json
{
  "rsi_oversold": 30,
  "rsi_overbought": 70,
  "adx_threshold": 25,
  "min_confidence": 0.6,
  "cooldown_bars": 8,
  "htf_adx_check": true
}
```
**Expected frequency:** 1-3 trades per week per bot

---

### **Preset 2: Moderate (Balanced)**
```json
{
  "rsi_oversold": 38,
  "rsi_overbought": 62,
  "adx_threshold": 18,
  "min_confidence": 0.5,
  "cooldown_bars": 4,
  "htf_adx_check": true
}
```
**Expected frequency:** 3-7 trades per week per bot

---

### **Preset 3: Aggressive (Active Trading)**
```json
{
  "rsi_oversold": 45,
  "rsi_overbought": 55,
  "adx_threshold": 12,
  "min_confidence": 0.4,
  "cooldown_bars": 2,
  "htf_adx_check": false
}
```
**Expected frequency:** 1-3 trades per day per bot

---

### **Preset 4: Ultra-Aggressive (Scalping)**
```json
{
  "rsi_oversold": 50,
  "rsi_overbought": 50,
  "adx_threshold": 5,
  "min_confidence": 0.3,
  "cooldown_bars": 1,
  "htf_adx_check": false
}
```
**Expected frequency:** 5-10+ trades per day per bot

---

## ⚠️ Important Warnings

### 🔴 **Risks of Aggressive Settings**

1. **More Trades = More Fees**
   - Each trade costs 0.05-0.1% in fees
   - 10 trades/day = 1-2% daily in fees alone

2. **More False Signals**
   - Loose thresholds = more bad trades
   - Win rate may drop from 60% to 45%

3. **Overtrading**
   - Can deplete capital quickly
   - Emotional stress from frequent trades

4. **Slippage**
   - Fast trading = worse execution prices
   - Especially in volatile markets

### ✅ **Best Practices**

1. **Start with Paper Trading**
   - Test aggressive settings for 1-2 weeks
   - Monitor win rate and P&L

2. **Use Different Presets for Different Pairs**
   - Volatile pairs (meme coins): Conservative
   - Stable pairs (BTC/ETH): Moderate-Aggressive

3. **Monitor Fee Impact**
   - Track fees as % of profit
   - If fees > 30% of profit, reduce frequency

4. **Adjust Based on Market**
   - Trending market: More aggressive
   - Ranging market: More conservative

---

## 📈 Monitoring Your Changes

After adjusting thresholds, monitor these metrics:

1. **Trade Frequency**
   - Target: 1-3 trades/day per bot (aggressive)
   - Too many? Increase cooldown or tighten RSI

2. **Win Rate**
   - Target: > 50% win rate
   - Too low? Tighten thresholds

3. **Profit Factor**
   - Target: > 1.5 (win $1.50 for every $1 lost)
   - Too low? Adjust stop loss/take profit

4. **Fee Impact**
   - Target: Fees < 20% of gross profit
   - Too high? Reduce trade frequency

---

## 🔄 Quick Reference: What to Change

| Goal | Adjust |
|------|--------|
| **Trade more often** | Increase RSI oversold (30→45), Decrease ADX (25→12) |
| **Trade less often** | Decrease RSI oversold (45→30), Increase ADX (12→25) |
| **Faster trades** | Reduce cooldown bars (8→2) |
| **More confirmations** | Enable HTF ADX check |
| **Catch more trends** | Lower ADX threshold (25→15) |
| **Only strong signals** | Raise ML confidence (0.4→0.7) |

---

## 💡 Strategy-Specific Tips

### **Scalping Strategies**
- Use 5m or 15m timeframe
- RSI: 45/55 (tight range)
- Cooldown: 1-2 bars
- ADX: 8-12 (accept weak trends)

### **Trend Following**
- Use 15m or 1h timeframe
- RSI: 35/65 (wider range)
- Cooldown: 3-5 bars
- ADX: 15-20 (medium trends)

### **Mean Reversion**
- Use 5m or 15m timeframe
- RSI: 25/75 (extreme values)
- Cooldown: 2-4 bars
- ADX: < 20 (prefer ranging markets)

---

## 📞 Need Help?

If you're unsure which settings to use:
1. Start with **Moderate preset** (Preset 2)
2. Run for 3-5 days
3. Adjust based on results
4. Check the dashboard query to see why bots wait

