# Fix Bot Creation Loading Issue

## Problem
Bot creation hangs/loads forever when trying to create a new bot.

## Root Cause
The database columns `symbols` and `custom_pairs` don't exist yet, causing a database error when inserting.

## Solution

### Option 1: Run Database Migration (Recommended)

Run this SQL in Supabase SQL Editor to add the missing columns:

```sql
-- Add custom pairs and symbols columns to trading_bots table
ALTER TABLE public.trading_bots 
ADD COLUMN IF NOT EXISTS symbols JSONB;

ALTER TABLE public.trading_bots 
ADD COLUMN IF NOT EXISTS custom_pairs TEXT;

-- Set default for symbols if it doesn't exist (store as JSON array)
UPDATE public.trading_bots 
SET symbols = jsonb_build_array(symbol) 
WHERE symbols IS NULL;
```

### Option 2: Temporary Workaround (Already Applied)

I've already modified the `bot-management` Edge Function to skip the new columns if they don't exist. The bot creation should now work without those columns.

However, the UI still shows the custom pairs feature, but it won't save the custom pairs yet.

### After Running the Migration

Once you've run the migration, update the Edge Function code to use the columns:

Find line 152 in `supabase/functions/bot-management/index.ts` and replace:

```typescript
// Add symbols and custom_pairs only if columns exist (will be added by migration)
// For now, skip these to avoid database errors
```

With:

```typescript
// Add symbols if provided
if (symbols && Array.isArray(symbols) && symbols.length > 0) {
  insertData.symbols = JSON.stringify(symbols)
} else {
  insertData.symbols = JSON.stringify([finalSymbol])
}

// Add custom pairs if provided  
if (customPairs) {
  insertData.custom_pairs = customPairs
}
```

## Next Steps

1. **Run the SQL migration** from `add_custom_pairs_columns.sql` in Supabase Dashboard
2. **Test bot creation** - it should now work
3. **Deploy the updated bot-management function** after uncommenting the columns code
4. **Verify custom pairs feature** works end-to-end

## Current Status

✅ Bot creation should work now (without custom pairs storage)  
✅ UI shows custom pairs option  
⏳ Waiting for database migration to enable full feature  
⏳ Need to deploy Edge Function after migration

