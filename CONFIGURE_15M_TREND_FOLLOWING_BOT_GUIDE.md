# 🎯 Configure 15m Trend-Following Bot Strategy

## Quick Setup Guide

This guide helps you configure your bot for a **15-minute trend-following strategy** with optimal risk management.

---

## 📋 Step 1: Find Your Bot ID

1. **Run `FIND_BOT_ID.sql`** in Supabase SQL Editor to find your bot ID
2. **Copy the bot ID** (UUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

---

## ⚙️ Step 2: Configure Bot Settings

1. **Open `CONFIGURE_15M_TREND_FOLLOWING_BOT.sql`**
2. **Replace `'YOUR_BOT_ID'`** with your actual bot ID (3 places)
3. **Run the SQL script** in Supabase SQL Editor

---

## ✅ What Gets Enabled

- ✅ **Directional Bias: Auto** - Follows 4H trend
- ✅ **HTF Timeframe: 4 Hours** - Swing standard
- ✅ **HTF Trend Indicator: EMA 200** - Long-term macro trend
- ✅ **Regime Filter: Auto Detect** - Automatically detects trend vs mean-reversion
- ✅ **Cooldown Bars: ON** - Prevents overtrading (4 bars = 1 hour on 15m)
- ✅ **Trailing Take-Profit: ON** - Protects profits
- ✅ **Smart Exit Trigger: ON** - Intelligent exit logic
- ✅ **Dynamic Upward Trailing: ON** - Adapts trailing stop
- ✅ **Volatility Pause: ON** - Pauses during high volatility
- ✅ **Funding Rate Filter: ON** - Filters trades based on funding rates

---

## ❌ What Gets Disabled

- ❌ **Always Trade Mode: OFF** - Won't force trades
- ❌ **Enable ML Prediction: OFF** - No ML predictions
- ❌ **Pair-Based Win Rate: OFF** - No pair-based calculations
- ❌ **Real-Time Pair Win Rate: OFF** - No real-time calculations
- ❌ **Auto-Rebalancing: OFF** - No automatic rebalancing
- ❌ **Automatic Execution: OFF** - Manual control (unless you enable it)

---

## 📊 Strategy Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| **RSI Threshold** | 65 | Overbought level (lower = more conservative) |
| **ADX Threshold** | 24 | Trend strength requirement |
| **BB Width Threshold** | 0.018 | Bollinger Band width (tighter = fewer trades) |
| **EMA Slope** | 0.35 | EMA momentum requirement |
| **Momentum Threshold** | 0.70 | Momentum filter level |
| **VWAP Distance** | 1.1 | Distance from VWAP for entry |
| **Min ML Samples** | 200 | Minimum samples for ML (if enabled) |

---

## 💰 Risk Management

| Setting | Value | Purpose |
|---------|-------|---------|
| **Risk per Trade** | 1.0% | % of account risked per trade |
| **Daily Loss Limit** | 2.5% | Auto-pause if daily loss exceeds this |
| **Weekly Loss Limit** | 5.0% | Auto-pause if weekly loss exceeds this |
| **Max Trades/Day** | 6 | Maximum trades per day |
| **Max Concurrent Positions** | 1 | Only one position at a time |
| **Max Consecutive Losses** | 3 | Auto-pause after 3 losses in a row |

---

## 🎯 Exit Strategy

| Exit | Value | Description |
|------|-------|-------------|
| **TP1** | 1.4% (1.4R) | First take profit - closes 45% of position |
| **TP2** | 3.2% (3.2R) | Second take profit - closes remaining position |
| **Trailing Stop** | ON | Manages remaining position after TP1 |

**Exit Flow:**
1. Hit TP1 (1.4%) → Close 45% of position
2. Trail remaining 55% with trailing stop
3. Hit TP2 (3.2%) → Close remaining position
4. Or let trailing stop manage the rest

---

## 🔍 Verification

After running the SQL, verify your settings:

```sql
SELECT 
    name,
    strategy_config->>'bias_mode' as bias_mode,
    strategy_config->>'htf_timeframe' as htf_timeframe,
    strategy_config->>'risk_per_trade_pct' as risk_per_trade,
    strategy_config->>'rsi_overbought' as rsi,
    strategy_config->>'adx_threshold' as adx,
    strategy_config->>'tp1_r' as tp1,
    strategy_config->>'tp2_r' as tp2
FROM trading_bots
WHERE id = 'YOUR_BOT_ID';
```

---

## 📝 Notes

- **RSI Threshold 65**: More conservative than default 70, reduces false signals
- **ADX Threshold 24**: Moderate trend strength requirement
- **BB Width 0.018**: Tighter threshold = fewer but higher quality trades
- **Max 1 Position**: Prevents overexposure
- **Cooldown 4 bars**: On 15m timeframe = 1 hour between trades
- **Trailing Take-Profit**: Protects profits while allowing trend continuation

---

## 🚀 Next Steps

1. ✅ Run `FIND_BOT_ID.sql` to find your bot
2. ✅ Run `CONFIGURE_15M_TREND_FOLLOWING_BOT.sql` with your bot ID
3. ✅ Verify settings in the bot editor UI
4. ✅ Start with paper trading to test
5. ✅ Monitor performance for 1-2 weeks
6. ✅ Adjust parameters if needed

