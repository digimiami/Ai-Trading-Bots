# Fix: Bot Only Trading Long, Not Short for SOLUSDT and DOGEUSDT

## Problem
The trading bot was only executing long trades and not short trades for pairs like SOLUSDT and DOGEUSDT, even when market conditions favored short entries.

## Root Cause
The issue was in the `evaluateHybridTrendMeanReversionStrategy` function in `bot-executor/index.ts`. The HTF (Higher Timeframe) trend confirmation logic had a bug:

1. **Incorrect EMA50 Check**: The code was checking `EMA50 > EMA200` for ALL trades, even when looking for short entries. In a downtrend (where shorts should be allowed), EMA50 should be BELOW EMA200, not above it.

2. **Logic Flow Issue**: The code structure checked EMA50 > EMA200 before branching into long vs short logic, which blocked short trades even when `bias_mode` was set to 'both' or 'auto'.

## Fix Applied

### 1. Fixed HTF Trend Confirmation Logic (Lines 2636-2714)
- **Before**: Checked `EMA50 > EMA200` unconditionally, blocking shorts in downtrends
- **After**: 
  - For LONG trades (price above EMA200): Requires EMA50 > EMA200
  - For SHORT trades (price below EMA200): Requires EMA50 < EMA200 (when shorts allowed)
  - Added explicit bias_mode checks for 'long-only' and 'short-only' modes

### 2. Added General Bias Mode Filter (Lines 2120-2141)
- Added a safety check that applies to ALL strategies after evaluation
- Filters out short trades if `bias_mode = 'long-only'`
- Filters out long trades if `bias_mode = 'short-only'`
- This ensures all strategies respect the bias_mode setting

## Code Changes

### File: `supabase/functions/bot-executor/index.ts`

**Changes in `evaluateHybridTrendMeanReversionStrategy`:**
- Added `htfEMA50BelowEMA200` check for short trades
- Restructured HTF trend checks to be conditional based on trade direction
- Added explicit bias_mode restrictions before trend checks

**Changes in `executeBot`:**
- Added general bias_mode filter after strategy evaluation
- Ensures all strategies respect bias_mode settings

## How to Verify the Fix

1. **Check Bot Configuration:**
   ```sql
   -- Run CHECK_BOT_BIAS_MODE_FOR_SHORT_TRADES.sql
   -- Verify bias_mode is set to 'both' or 'auto' for SOLUSDT/DOGEUSDT bots
   ```

2. **Monitor Trade Execution:**
   - Check bot activity logs for short trade signals
   - Verify that short trades are now being executed when market conditions favor shorts
   - Look for messages like "Hybrid SHORT: HTF downtrend (EMA200)..."

3. **Check Recent Trades:**
   ```sql
   SELECT 
     tb.symbol,
     t.side,
     COUNT(*) as trade_count,
     MAX(t.created_at) as latest_trade
   FROM trades t
   JOIN trading_bots tb ON tb.id = t.bot_id
   WHERE tb.symbol IN ('SOLUSDT', 'DOGEUSDT')
     AND t.created_at >= NOW() - INTERVAL '24 hours'
   GROUP BY tb.symbol, t.side
   ORDER BY tb.symbol, t.side;
   ```

## Expected Behavior After Fix

1. **When `bias_mode = 'both'` or `'auto'`:**
   - Bot will trade LONG when HTF is in uptrend (price > EMA200, EMA50 > EMA200)
   - Bot will trade SHORT when HTF is in downtrend (price < EMA200, EMA50 < EMA200)
   - Both directions are allowed based on market conditions

2. **When `bias_mode = 'long-only'`:**
   - Only long trades are executed
   - Short signals are blocked

3. **When `bias_mode = 'short-only'`:**
   - Only short trades are executed
   - Long signals are blocked

## Testing Recommendations

1. **Verify Configuration:**
   - Ensure bots for SOLUSDT and DOGEUSDT have `bias_mode` set to 'both' or 'auto'
   - Check that `require_price_vs_trend` is not set to 'above' (which would block shorts)

2. **Monitor in Different Market Conditions:**
   - Test during uptrends (should see long trades)
   - Test during downtrends (should see short trades)
   - Verify both directions are working

3. **Check Logs:**
   - Look for "Hybrid SHORT" messages in bot activity logs
   - Verify no "Bias mode filter: Blocking" messages unless intentionally configured

## Related Files
- `CHECK_BOT_BIAS_MODE_FOR_SHORT_TRADES.sql` - Diagnostic query to check bot configuration
- `supabase/functions/bot-executor/index.ts` - Main bot execution logic

