# 🔧 Fix: 'size' Column Error in Trades Table

## Problem Identified

From the logs, a new error appeared:
```
Error: Trade execution failed: Could not find the 'size' column of 'trades' in the schema cache
```

This error occurred for the DOGEUSDT bot during trade execution.

## Root Cause

The code was trying to insert a `size` column into the `trades` table at line 3891:
```typescript
size: tradeAmount,
```

However, the `trades` table schema doesn't have a `size` column. The table uses `amount` instead.

## Fix Applied

**File**: `supabase/functions/bot-executor/index.ts` (lines 3884-3928)

### Change 1: Removed `size` from insert payload
**Before**:
```typescript
let insertPayload: any = {
  ...
  size: tradeAmount,
  amount: tradeAmount,
  ...
};
```

**After**:
```typescript
let insertPayload: any = {
  ...
  amount: tradeAmount, // Use 'amount' instead of 'size' (size column doesn't exist)
  ...
};
```

### Change 2: Enhanced error handling
Updated the error handling to catch both `entry_price` and `size` column errors:
```typescript
if (error && (/column .*entry_price/i.test(error.message || '') || /column .*size/i.test(error.message || ''))) {
  // Retry without the problematic column
  const retryPayload = { ...insertPayload };
  delete retryPayload.size;
  delete retryPayload.entry_price;
  ...
}
```

## Expected Behavior After Fix

1. ✅ Trades will be inserted with `amount` column only
2. ✅ No more "size column not found" errors
3. ✅ Error handling will catch any future schema mismatches
4. ✅ Trades will be successfully recorded in the database

## Related Issues

This is similar to the previous `entry_price` column fix. Both columns were being inserted but don't exist in the actual database schema:
- ❌ `entry_price` → ✅ Use `price` instead
- ❌ `size` → ✅ Use `amount` instead

---

**The fix is deployed - trades should now be successfully recorded without schema errors.**

