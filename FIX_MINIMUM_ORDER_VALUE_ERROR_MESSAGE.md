# 🔧 Fix: Minimum Order Value Error Message Calculation

## Problem

The error message for Bybit error code 110094 (minimum order value) was showing an absurdly high value:
```
Please increase trade amount to at least $500000000.00 per trade.
```

The actual minimum order value is only **5 USDT**, but the calculation was multiplying by `maxQty` (maximum quantity), resulting in an incorrect value.

## Root Cause

On line 6725, the calculation was:
```typescript
const requiredTradeAmount = (minOrderValue / currentMarketPrice) * maxQty;
```

This formula is **completely wrong**:
- `maxQty` is the maximum quantity allowed for the symbol (e.g., 136314.067612 for AVAXUSDT)
- Multiplying by `maxQty` results in an absurdly high value
- The formula doesn't account for leverage or risk multiplier

## Correct Calculation

The order value is calculated as:
```
Order Value = Trade Amount × Leverage × Risk Multiplier
```

To meet the minimum order value:
```
Required Trade Amount = Min Order Value / (Leverage × Risk Multiplier) × Buffer
```

Where:
- `Min Order Value` = 5 USDT (for most symbols)
- `Leverage` = bot's leverage (e.g., 3x)
- `Risk Multiplier` = 1.5x (medium), 2x (high), or 1x (low)
- `Buffer` = 1.2 (20% buffer to account for rounding and step size adjustments)

## Fix Applied

**File**: `supabase/functions/bot-executor/index.ts` (lines ~6721-6748)

**Before**:
```typescript
const requiredTradeAmount = (minOrderValue / currentMarketPrice) * maxQty;
```

**After**:
```typescript
// Calculate required trade amount to meet minimum order value
const leverage = bot?.leverage || 1;
const riskMultiplier = getRiskMultiplier(bot); // Use the same function as calculateTradeSizing
const multiplier = leverage * riskMultiplier;

// Calculate minimum trade amount needed (with 20% buffer for rounding/step size)
const requiredTradeAmount = (minOrderValue / multiplier) * 1.2;

// Ensure minimum trade amount is reasonable (at least $10 for futures, $5 for spot)
const minTradeAmount = bybitCategory === 'linear' ? 10 : 5;
const finalRequiredAmount = Math.max(requiredTradeAmount, minTradeAmount);
```

## Example Calculation

For SWARMSUSDT bot with:
- Trade Amount: $180
- Leverage: 3x
- Risk Level: High (2x multiplier)
- Min Order Value: 5 USDT

**Old (incorrect) calculation**:
```
requiredTradeAmount = (5 / price) * maxQty = (5 / 0.05) * 1000000 = $100,000,000 ❌
```

**New (correct) calculation**:
```
multiplier = 3 × 2 = 6x
requiredTradeAmount = (5 / 6) × 1.2 = $1.00
finalRequiredAmount = max($1.00, $10) = $10.00 ✅
```

## Additional Changes

1. **Added SWARMSUSDT to minimum order values** (line ~8833):
   ```typescript
   'SWARMSUSDT': { spot: 5, linear: 5 }
   ```

2. **Enhanced error logging**:
   - Logs current trade amount, leverage, and risk multiplier
   - Provides clear guidance on what to increase

3. **Added minimum trade amount check**:
   - Ensures suggested amount is at least $10 for futures or $5 for spot
   - Prevents suggesting unreasonably low amounts

## Expected Behavior

After deployment:
- ✅ Error messages show realistic trade amount suggestions
- ✅ Calculations account for leverage and risk multiplier
- ✅ Clear guidance on how much to increase trade amount
- ✅ Minimum trade amount suggestions are reasonable

## Testing

Test with:
- SWARMSUSDT (the reported case)
- Other symbols with different leverage/risk settings
- Bots with low trade amounts that trigger this error

## Related Files

- `supabase/functions/bot-executor/index.ts` (lines ~6721-6748, ~8815-8833)
