# 🔧 Fix: "Could not find the 'entry_price' column" Error

## 🐛 Problem

Bot is trying to trade but failing with:
```
Trade execution failed: Could not find the 'entry_price' column of 'trades' in the schema cache
```

## 🔍 Root Cause

The code was trying to insert `entry_price` into the `trades` table, but:
1. The Supabase client schema cache doesn't recognize `entry_price` column
2. The migration (`20251111_update_trades_schema.sql`) uses `price` as the primary column
3. While `entry_price` might exist in some deployments, the schema cache validation fails before the insert

## ✅ Fix Applied

**Changed:** Removed `entry_price` from the insert payload for `trades` table
- Now only using `price` column (which is what the migration expects)
- Removed the problematic `entry_price: normalizedPrice` line
- Kept the fallback error handling for backward compatibility

**File:** `supabase/functions/bot-executor/index.ts` (lines 2840-2886)

### Before:
```typescript
let insertPayload: any = {
  // ...
  entry_price: normalizedPrice, // may not exist on some deployments
  price: normalizedPrice,
  // ...
};
```

### After:
```typescript
let insertPayload: any = {
  // ...
  price: normalizedPrice, // Primary column for entry price
  // ...
};
```

## 📋 Note

- `paper_trading_trades` table still uses `entry_price` (that's correct - it has that column)
- Only the `trades` table insert was fixed
- The migration shows `price` is the primary column for real trades

## 🚀 Next Steps

1. **Deploy the fix:**
   ```bash
   npm run build
   npx tsc --noEmit
   git add supabase/functions/bot-executor/index.ts
   git commit -m "Fix: Remove entry_price from trades insert to fix schema cache error"
   git push
   ```

2. **After deployment:**
   - Wait 2-5 minutes for Supabase auto-deploy
   - Bot should now successfully record trades
   - Check logs - should see "✅ Trade recorded successfully" instead of errors

## ✅ Expected Result

After fix:
- ✅ Trades will be successfully recorded in database
- ✅ No more "entry_price column not found" errors
- ✅ Bot will continue trading when strategy conditions are met

