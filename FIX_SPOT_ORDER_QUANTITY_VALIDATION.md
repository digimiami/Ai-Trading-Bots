# 🔧 Fix: Spot Order Quantity Validation Issue

## Problem

For AVAXUSDT spot orders, Bybit was rejecting orders with "Request parameter error" even though:
- Quantity `20.2` is valid for step size `0.1`
- Order value `$238.97` is above minimum
- The order was using `marketUnit=1` (quote currency/USDT)

## Root Cause

The code was validating the **base currency quantity** (`formattedQty = 20.2`) against step size constraints **even for spot orders with `marketUnit=1`**. 

When `marketUnit=1`:
- The `qty` field in the request body represents **USDT amount** (e.g., `238.97`), not base currency quantity
- We should **NOT** validate the base currency quantity against step size
- The validation was incorrectly checking if `20.2` matches step size `0.1`, but we're actually sending `238.97` USDT

## Fix Applied

**File**: `supabase/functions/bot-executor/index.ts` (lines ~6438-6479)

**Before**:
```typescript
// Final validation: ensure formatted quantity is valid before creating request
const finalQtyValue = parseFloat(formattedQty);
if (isNaN(finalQtyValue) || finalQtyValue < minQty || finalQtyValue > maxQty) {
  throw new Error(`Invalid formatted quantity ${formattedQty}...`);
}

// Verify step size match one more time
if (stepSize > 0) {
  // ... validation logic ...
}

// Then create request body
if (bybitCategory === 'spot') {
  requestBody.qty = orderValue.toFixed(2); // USDT amount
}
```

**After**:
```typescript
// Create request body first
const requestBody: any = { ... };

if (bybitCategory === 'spot') {
  // For spot with marketUnit=1, qty is USDT amount - no base currency validation needed
  requestBody.qty = orderValue.toFixed(2);
} else {
  // For futures/linear, validate base currency quantity against step size
  const finalQtyValue = parseFloat(formattedQty);
  if (isNaN(finalQtyValue) || finalQtyValue < minQty || finalQtyValue > maxQty) {
    throw new Error(`Invalid formatted quantity ${formattedQty}...`);
  }
  // Verify step size match
  if (stepSize > 0) {
    // ... validation logic ...
  }
  requestBody.qty = formattedQty.toString();
}
```

### Additional Fix: Improved Error Messages

**File**: `supabase/functions/bot-executor/index.ts` (lines ~6718-6730)

Updated error messages to show:
- For spot orders with `marketUnit=1`: Show USDT amount sent (e.g., "238.97 USDT")
- For futures/spot with `marketUnit=0`: Show base currency quantity with step size info
- More context-specific error messages based on order type

## How It Works Now

### For Spot Orders (`marketUnit=1`):
1. ✅ Calculate base currency quantity (`formattedQty = 20.2`)
2. ✅ Calculate order value (`orderValue = 20.2 * price = $238.97`)
3. ✅ Set `requestBody.qty = "238.97"` (USDT amount)
4. ✅ Set `requestBody.marketUnit = 1`
5. ✅ **Skip** base currency quantity validation (not needed)
6. ✅ Send order to Bybit

### For Futures/Linear Orders:
1. ✅ Calculate base currency quantity (`formattedQty = 20.2`)
2. ✅ Validate against min/max and step size
3. ✅ Set `requestBody.qty = "20.2"` (base currency quantity)
4. ✅ Send order to Bybit

## Expected Behavior

After deployment:
- ✅ Spot orders with `marketUnit=1` no longer validate base currency quantity
- ✅ Error messages show correct values (USDT amount for spot, base currency for futures)
- ✅ Orders should succeed when order value meets minimum requirements
- ✅ Clearer error messages for debugging

## Testing

Test with:
- AVAXUSDT spot orders (the reported case)
- Other spot trading pairs
- Futures/linear orders (should still validate step size)
- Orders with different order values

## Related Files

- `supabase/functions/bot-executor/index.ts` (lines ~6438-6479, ~6718-6730)
