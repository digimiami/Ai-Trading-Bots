# Fix: Bitunix Only Trading Long Positions, Not Short

## Problem
Bitunix bots are only executing long (BUY) trades and not short (SELL) trades, even when market conditions favor short entries.

## Root Cause

The issue is in the **bot configuration**, not the order placement code. Short positions are being blocked by one of two settings:

1. **`bias_mode = 'long-only'`** - Explicitly blocks all short trades
2. **`require_price_vs_trend = 'above'`** - Only allows trades when price is above EMA200 (blocks shorts in downtrends)

### Code Locations

The restrictions are enforced in two places:

1. **Strategy Evaluation** (`bot-executor/index.ts` lines 5313-5360):
   ```typescript
   const allowShorts =
     (biasMode === 'both' || biasMode === 'auto') &&
     config.require_price_vs_trend !== 'above';
   
   if (!htfPriceAboveEMA200 && !allowShorts) {
     return {
       shouldTrade: false,
       reason: `HTF price not above EMA200 and shorts disabled`,
       confidence: 0
     };
   }
   ```

2. **General Bias Filter** (`bot-executor/index.ts` lines 4440-4461):
   ```typescript
   if (biasMode === 'long-only' && (signalSide === 'sell' || signalSide === 'short')) {
     console.log(`🚫 Bias mode filter: Blocking ${signalSide} trade (bias_mode: long-only)`);
     shouldTrade = {
       shouldTrade: false,
       reason: `Bias mode 'long-only' blocks ${signalSide} trades`,
       confidence: 0
     };
   }
   ```

## Solution

### Option 1: Run SQL Fix Script (Recommended)

Run the existing fix script to update all Bitunix bots:

```sql
-- Run FIX_BOTS_TO_ALLOW_SHORTS.sql
-- This will:
-- 1. Set bias_mode to 'auto' (allows both long and short)
-- 2. Set require_price_vs_trend to 'any' (allows trades in both directions)
```

### Option 2: Check Current Configuration

First, check which bots are blocking shorts:

```sql
-- Run CHECK_BITUNIX_SHORT_SETTINGS.sql
-- This will show:
-- - Current bias_mode and require_price_vs_trend settings
-- - Which bots are blocking shorts
-- - Recent trade history (to see if any shorts were executed)
```

### Option 3: Manual Fix (Per Bot)

Update individual bot configurations:

```sql
UPDATE trading_bots
SET strategy_config = jsonb_set(
  jsonb_set(
    COALESCE(strategy_config, '{}'::jsonb),
    '{bias_mode}',
    '"auto"'
  ),
  '{require_price_vs_trend}',
  '"any"'
)
WHERE exchange = 'bitunix'
  AND id = '<bot_id>';
```

## Verification

After applying the fix, verify:

1. **Check bot configuration:**
   ```sql
   SELECT 
     id, name, symbol,
     strategy_config->>'bias_mode' as bias_mode,
     strategy_config->>'require_price_vs_trend' as require_price_vs_trend
   FROM trading_bots
   WHERE exchange = 'bitunix' AND status = 'active';
   ```

2. **Monitor bot logs:**
   - Look for `🚫 Bias mode filter: Blocking sell trade` messages (should not appear)
   - Look for `✅ Strategy signal: SELL` messages (should appear when conditions are met)

3. **Check trade history:**
   ```sql
   SELECT side, COUNT(*) as count
   FROM trades
   WHERE exchange = 'bitunix'
     AND executed_at > NOW() - INTERVAL '24 hours'
   GROUP BY side;
   ```

## Expected Behavior After Fix

- Bots should generate both LONG and SHORT signals based on market conditions
- Short signals should trigger when:
  - HTF is in downtrend (price < EMA200, EMA50 < EMA200)
  - RSI is overbought (>= 65-70)
  - Market shows bearish momentum
- Signal distribution should be more balanced (not 100% long)
- Order placement code already supports shorts correctly (no changes needed)

## Order Placement Code (Already Correct)

The Bitunix order placement code (`placeBitunixOrder`) already correctly handles short positions:

```typescript
const sideString = side.toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
orderParams.side = sideString; // "BUY" or "SELL"
orderParams.tradeSide = 'OPEN'; // Opens new position (works for both long and short)
```

No changes needed to the order placement logic.

## Notes

- The fix only changes bot configuration, not the trading logic
- Short trading conditions are already implemented in the strategy evaluation
- The issue was purely configuration-based restrictions
- After fixing, bots will automatically start generating short signals when market conditions are right
