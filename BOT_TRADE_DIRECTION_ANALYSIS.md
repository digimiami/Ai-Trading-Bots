# Bot Trade Direction Analysis

## Summary
This document analyzes whether bots are trading in both long and short directions.

## Strategy Support for Long/Short Trading

### ✅ Strategies That Support BOTH Directions:

1. **Trendline Breakout Strategy**
   - Supports: `tradeDirection = 'both'`, `'Long Only'`, or `'Short Only'`
   - Long: Price crosses above trendline
   - Short: Price crosses below trendline
   - Location: `evaluateTrendlineBreakoutStrategy()` (lines 2572-2598)

2. **Hybrid Trend + Mean Reversion Strategy**
   - Supports: Both directions when `bias_mode = 'both'` or `'auto'`
   - Long: HTF uptrend + RSI oversold + VWAP distance + momentum
   - Short: HTF downtrend + RSI overbought + VWAP distance + momentum
   - Location: `evaluateHybridTrendMeanReversionStrategy()` (lines 2796-2899)
   - **Note**: Short trades are allowed when `allowShorts = true` (line 2671-2673)

3. **Scalping Strategy - Fast EMA Cloud**
   - Supports: Both directions
   - Long: EMA bullish cross + price above VWAP + RSI not overbought
   - Short: EMA bearish cross + price below VWAP + RSI not oversold
   - Location: `evaluateScalpingStrategy()` (lines 3043-3123)

4. **Advanced Dual-Mode Scalping Strategy**
   - Supports: Both directions in both modes
   - **Reversal Mode**:
     - Long: HTF bullish + RSI oversold + price at lower BB
     - Short: HTF bearish + RSI overbought + price at upper BB
   - **Continuation Mode**:
     - Long: HTF bullish + EMA pullback bounce
     - Short: HTF bearish + EMA pullback bounce
   - Location: `evaluateAdvancedScalpingStrategy()` (lines 3404-3550)

5. **Standard RSI/ADX/EMA Strategies**
   - Supports: Both directions based on indicator signals
   - Location: Lines 2353-2451

## ⚠️ Configuration Restrictions

### Bias Mode Filter (Lines 2120-2140)
Bots can be restricted to one direction via `bias_mode`:
- `'long-only'`: Blocks all short/sell trades
- `'short-only'`: Blocks all long/buy trades
- `'both'` or `'auto'`: Allows both directions

### Trade Direction Filter (Trendline Strategy)
- `'Long Only'`: Only long trades
- `'Short Only'`: Only short trades
- `'Both'`: Both directions

## How to Check Actual Trade Directions

Run the SQL script: `CHECK_BOT_TRADE_DIRECTIONS.sql`

This script provides:
1. Real trades analysis (long vs short per bot)
2. Paper trades analysis (long vs short per bot)
3. Combined summary
4. Bot configuration check (bias_mode settings)
5. Recent trade signals analysis

## Expected Results

### If Bots Are Trading Both Directions:
- ✅ Status: "BOTH DIRECTIONS"
- Long trades > 0 AND Short trades > 0

### If Bots Are Restricted:
- ⚠️ Status: "LONG ONLY" or "SHORT ONLY"
- Check `bias_mode` or `trade_direction` in bot config

## Recommendations

1. **Check Bot Configurations**: Run query #4 in the SQL script to see which bots have `bias_mode` restrictions
2. **Check Actual Trades**: Run queries #1-3 to see actual trade distribution
3. **Check Recent Signals**: Run query #5 to see recent trade signals from logs

## Code Locations

- **Bias Mode Filter**: `supabase/functions/bot-executor/index.ts` lines 2120-2140
- **Trendline Strategy**: Lines 2572-2598
- **Hybrid Strategy**: Lines 2619-2900
- **Scalping Strategy**: Lines 2924-3123
- **Advanced Scalping**: Lines 3247-3550

