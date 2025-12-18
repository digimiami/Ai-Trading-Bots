# 🔧 Fix: Spot Order marketUnit Format and Minimum Order Value

## Problem

AVAXUSDT spot orders are still being rejected with "Request parameter error" even after fixing quantity validation. The error message now correctly shows:
```
Invalid quantity for AVAXUSDT: 239.95 USDT (order value) Bybit API error: Request parameter error..
```

## Root Causes

1. **Order value might not meet minimum**: The order value calculation might not account for minimum order value requirements before sending
2. **marketUnit format**: Bybit API might expect a specific format for `marketUnit` parameter
3. **qty precision**: The USDT amount might need different precision or formatting

## Fixes Applied

### Fix 1: Ensure Minimum Order Value for Spot Orders
**File**: `supabase/functions/bot-executor/index.ts` (lines ~6450-6475)

**Before**:
```typescript
const orderValue = parseFloat(formattedQty) * currentMarketPrice;
requestBody.marketUnit = 1;
requestBody.qty = orderValue.toFixed(2);
```

**After**:
```typescript
const orderValue = parseFloat(formattedQty) * currentMarketPrice;
const minOrderValue = this.getMinimumOrderValue(symbol, bybitCategory);
const finalOrderValue = Math.max(orderValue, minOrderValue * 1.01); // Ensure minimum with buffer
requestBody.marketUnit = 1; // 1 = quoteCoin (USDT)
requestBody.qty = finalOrderValue.toFixed(2);
```

### Fix 2: Separate Handling for Buy vs Sell Orders
**File**: `supabase/functions/bot-executor/index.ts` (lines ~6450-6485)

- **Buy orders**: Use `marketUnit=1` (quoteCoin), `qty` in USDT
- **Sell orders**: Use `marketUnit=0` (baseCoin), `qty` in base currency with step size validation

### Fix 3: Enhanced Debug Logging
**File**: `supabase/functions/bot-executor/index.ts` (lines ~6509-6520)

Added detailed logging to show:
- Full request body being sent
- marketUnit value
- qty value and type
- Order value calculations

## Current Implementation

### For Spot Buy Orders:
```typescript
requestBody.marketUnit = 1; // quoteCoin (USDT)
requestBody.qty = finalOrderValue.toFixed(2); // USDT amount, e.g., "239.95"
```

### For Spot Sell Orders:
```typescript
requestBody.marketUnit = 0; // baseCoin (base currency)
requestBody.qty = formattedQty.toString(); // Base currency quantity, e.g., "20.2"
```

## Potential Issues Still Remaining

If orders still fail with "Request parameter error", possible causes:

1. **marketUnit format**: Bybit might expect:
   - String value: `"quoteCoin"` instead of numeric `1`
   - Or omitting `marketUnit` entirely (defaults to quoteCoin for buy orders)

2. **qty format**: Bybit might expect:
   - Number instead of string: `239.95` instead of `"239.95"`
   - Different precision: More or fewer decimal places

3. **Missing parameters**: Bybit might require additional fields for spot market orders

## Next Steps for Debugging

1. **Check request body in logs**: The enhanced logging will show exactly what's being sent
2. **Try omitting marketUnit**: For buy orders, try removing `marketUnit` parameter (defaults to quoteCoin)
3. **Try string format**: If numeric doesn't work, try `marketUnit: "quoteCoin"`
4. **Check Bybit API docs**: Verify exact parameter format requirements for v5 API

## Testing

After deployment, check logs for:
- `Request Body:` - Shows exact JSON being sent
- `MarketUnit:` - Shows the value being used
- `Qty (USDT):` - Shows the USDT amount

If errors persist, try:
1. Removing `marketUnit` parameter for buy orders
2. Using string `"quoteCoin"` instead of numeric `1`
3. Checking if qty needs to be a number instead of string

## Related Files

- `supabase/functions/bot-executor/index.ts` (lines ~6449-6485, ~6509-6520, ~6719-6740)
