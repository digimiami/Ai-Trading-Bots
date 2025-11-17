# Fix: DOGEUSDT Not Opening Short Trades

## Problem
DOGEUSDT bot is only opening buy (long) orders, but no sell (short) orders.

## Root Cause Analysis

The short trade conditions were **too strict**, requiring ALL of the following simultaneously:
1. RSI >= 70 (overbought)
2. Price above VWAP by >= 1.2% (same as long requirement)
3. Negative momentum >= 0.8% (same as long requirement)

This made it very difficult for shorts to trigger, especially in downtrends where price might not bounce above VWAP.

## Fix Applied

### 1. Made Short Conditions More Lenient (Lines 2841-2906)

**Before:**
- Required RSI >= 70 AND price above VWAP by 1.2% AND negative momentum >= 0.8%
- All conditions must be met simultaneously

**After:**
- Shorts can trigger with **EITHER**:
  - **Option 1**: RSI >= 70 AND price above VWAP by 0.6% (50% of long requirement)
  - **Option 2**: RSI >= 70 AND negative momentum >= 0.4% (50% of long requirement)

This allows shorts to trigger in two scenarios:
1. **Bounce Short**: Price bounces above VWAP in a downtrend (mean reversion)
2. **Continuation Short**: Price continues falling with negative momentum (trend following)

### 2. Added Explicit Price Check
- Added `!htfPriceAboveEMA200` check to ensure we're only looking for shorts when price is below HTF EMA200 (downtrend)

### 3. Improved Logging
- More detailed reason messages showing which conditions were met
- Shows condition type: 'bounce', 'continuation', or 'bounce+continuation'

## How to Verify

1. **Run Diagnostic Query:**
   ```sql
   -- Run DIAGNOSE_DOGEUSDT_NO_SHORT_TRADES.sql
   -- This will show:
   - Bot configuration (bias_mode, etc.)
   - Recent trades by side
   - Recent signals by side
   - Bot activity logs with short-related messages
   - Strategy evaluation results
   ```

2. **Check Bot Configuration:**
   - Ensure `bias_mode` is set to `'both'` or `'auto'` (not `'long-only'`)
   - Ensure `require_price_vs_trend` is not set to `'above'`

3. **Monitor Bot Activity:**
   - Look for "Hybrid SHORT" messages in bot activity logs
   - Check for "Short conditions not met" messages to see why shorts aren't triggering

## Expected Behavior After Fix

**Short trades will trigger when:**
- HTF price is **below** EMA200 (downtrend confirmed)
- HTF EMA50 is **below** EMA200 (downtrend structure)
- HTF ADX >= 23 (strong trend)
- **AND EITHER:**
  - RSI >= 70 AND price above VWAP by 0.6%, OR
  - RSI >= 70 AND negative momentum >= 0.4%

**This is much more lenient than before and should allow shorts to trigger more frequently.**

## Configuration Options

You can further customize short entry conditions by adding to `strategy_config`:
- `vwap_distance_short`: Custom VWAP distance for shorts (default: 50% of `vwap_distance`)
- `momentum_threshold_short`: Custom momentum threshold for shorts (default: 50% of `momentum_threshold`)

## Related Files
- `supabase/functions/bot-executor/index.ts` - Main bot execution logic (updated)
- `DIAGNOSE_DOGEUSDT_NO_SHORT_TRADES.sql` - Diagnostic query

