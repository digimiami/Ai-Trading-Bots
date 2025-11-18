# Fix: Bots Only Trading Long (No Short Signals)

## Problem
All bots are generating only LONG signals, no SHORT signals. This indicates either:
1. Bot configurations restrict to long-only
2. Short signal conditions are too strict
3. Market conditions aren't triggering shorts

## Root Causes Identified

### 1. Hybrid Strategy Short Restrictions
The `allowShorts` variable requires:
- `bias_mode === 'both' || bias_mode === 'auto'`
- `require_price_vs_trend !== 'above'`

If `require_price_vs_trend === 'above'`, shorts are disabled even if `bias_mode` allows both.

**Location**: `supabase/functions/bot-executor/index.ts` lines 2671-2673

### 2. Short Signal Conditions May Be Too Strict
For Hybrid Strategy shorts, both conditions must be met:
- RSI >= overbought (70)
- AND (VWAP distance >= threshold OR momentum >= threshold)

This might be too restrictive in downtrends.

**Location**: Lines 2855-2856

### 3. Trendline Breakout Strategy
Uses `trade_direction` config which can be:
- `'Long Only'` - blocks shorts
- `'Short Only'` - blocks longs  
- `'Both'` - allows both

**Location**: Lines 2572-2576

## Solutions

### Solution 1: Check and Update Bot Configurations
Run `CHECK_BOT_CONFIGS_FOR_BIAS.sql` to see current settings, then update:

```sql
-- Enable both directions for Hybrid Strategy
UPDATE trading_bots
SET strategy_config = jsonb_set(
  jsonb_set(
    COALESCE(strategy_config, '{}'::jsonb),
    '{bias_mode}',
    '"both"'
  ),
  '{require_price_vs_trend}',
  '"any"'
)
WHERE id = 'ea3038cc-ff8e-41fd-a760-da9a8b599669'; -- Hybrid Strategy bot

-- Enable both directions for Trendline Breakout
UPDATE trading_bots
SET strategy_config = jsonb_set(
  COALESCE(strategy_config, '{}'::jsonb),
  '{trade_direction}',
  '"Both"'
)
WHERE id = 'cd3ed89b-e9f5-4056-9857-30a94d82764a'; -- Trendline Breakout bot
```

### Solution 2: Relax Short Signal Conditions
Modify the Hybrid Strategy to be more lenient for shorts:

1. Lower RSI overbought threshold for shorts
2. Make VWAP/momentum conditions OR instead of AND
3. Allow shorts when HTF is clearly downtrending even if RSI isn't overbought

### Solution 3: Code Fix - Make Short Conditions More Flexible
Update `evaluateHybridTrendMeanReversionStrategy` to:
- Allow shorts when HTF trend is clearly down (EMA50 < EMA200, ADX strong)
- Lower RSI threshold for shorts (e.g., 65 instead of 70)
- Make conditions less strict overall

## Immediate Action Items

1. **Run `CHECK_BOT_CONFIGS_FOR_BIAS.sql`** to see current bot settings
2. **Check if `require_price_vs_trend = 'above'`** is blocking shorts
3. **Update bot configs** to allow both directions
4. **Review short signal logic** to ensure it's not too restrictive

## Expected Behavior After Fix

- Bots should generate both LONG and SHORT signals
- Short signals should trigger when:
  - HTF is in downtrend (price < EMA200, EMA50 < EMA200)
  - RSI is overbought (>= 65-70)
  - Market shows bearish momentum
- Signal distribution should be more balanced (not 100% long)

