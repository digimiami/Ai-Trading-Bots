# 🔧 Fix Trade Counting Issue

## **Problem**

Your bots are showing incorrect trade counts (e.g., 346/8, 564/8) and are being paused incorrectly due to the "Max trades/day reached" limit.

## **Root Cause**

The SQL query in `check-bot-settings.sql` was not filtering trades correctly:
- ❌ Was counting ALL trades ever made
- ❌ Not filtering by status (`filled`, `completed`, `closed`)
- ❌ Not using upper bound (only checking `>= today`, not `< tomorrow`)
- ❌ Old trades might have NULL `executed_at` values

## **Solution**

### **Step 1: Run Diagnostic Query**

Run this in Supabase SQL Editor to see the corrected counts:

```sql
-- Check today's trades (corrected count)
SELECT 
    b.id,
    b.name,
    b.symbol,
    -- Corrected count (matching function logic)
    (SELECT COUNT(*) FROM trades 
     WHERE bot_id = b.id 
     AND executed_at IS NOT NULL
     AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
     AND executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
     AND status IN ('filled', 'completed', 'closed'))::int as trades_today_corrected,
    -- Limit
    COALESCE((b.strategy_config->>'max_trades_per_day')::int, 8) as max_trades_per_day,
    -- Status
    b.status
FROM trading_bots b
WHERE b.status = 'running'
ORDER BY trades_today_corrected DESC;
```

### **Step 2: Fix Old Trades (Optional)**

If you have old trades with NULL `executed_at`, run this to fix them:

```sql
-- Fix old trades: Set executed_at = created_at for trades with NULL executed_at
UPDATE trades
SET executed_at = created_at
WHERE executed_at IS NULL
AND status IN ('filled', 'completed', 'closed');
```

**Note**: This will only update trades that are `filled`, `completed`, or `closed`. Trades that are still `open` or `pending` will keep NULL `executed_at` until they're closed.

### **Step 3: Unpause Incorrectly Paused Bots**

If bots were paused due to incorrect counts, unpause them:

```sql
-- Unpause bots that were incorrectly paused
UPDATE trading_bots
SET status = 'running',
    updated_at = NOW()
WHERE id IN (
    SELECT b.id
    FROM trading_bots b
    WHERE b.status = 'paused'
    AND COALESCE((b.strategy_config->>'max_trades_per_day')::int, 8) > (
        SELECT COUNT(*) FROM trades 
        WHERE bot_id = b.id 
        AND executed_at IS NOT NULL
        AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
        AND executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
        AND status IN ('filled', 'completed', 'closed')
    )
);
```

### **Step 4: Redeploy Function (If Needed)**

If the deployed function still has old code, redeploy it:

1. **Via Supabase Dashboard:**
   - Go to **Edge Functions** → **bot-executor**
   - Copy the code from `supabase/functions/bot-executor/index.ts`
   - Paste and deploy

2. **Via CLI (if available):**
   ```bash
   supabase functions deploy bot-executor
   ```

## **What Changed**

### **SQL Query Fix:**

**Before:**
```sql
executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
-- This counts ALL trades from today onwards (no upper bound, no status filter)
```

**After:**
```sql
executed_at IS NOT NULL
AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
AND executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
AND status IN ('filled', 'completed', 'closed')
-- This only counts today's executed trades
```

### **Function Already Fixed:**

The `getTradesToday` function in `bot-executor/index.ts` already has the correct logic:
- ✅ Checks `executed_at IS NOT NULL`
- ✅ Uses upper bound (`< tomorrowISO`)
- ✅ Filters by status (`['filled', 'completed', 'closed']`)
- ✅ Falls back to `created_at` if `executed_at` fails

## **Verification**

After running the fixes:

1. **Check corrected counts:**
   ```sql
   -- Run the diagnostic query from Step 1
   ```

2. **Check bot status:**
   ```sql
   SELECT id, name, symbol, status, last_trade_at
   FROM trading_bots
   WHERE status IN ('running', 'paused')
   ORDER BY name;
   ```

3. **Monitor logs:**
   - Check Supabase Edge Function logs
   - Look for: `📊 Trades today for bot {id}: {count}`
   - Counts should now be accurate

## **Expected Behavior**

After the fix:
- ✅ Trade counts should be accurate (e.g., 5/8, 3/8, not 346/8)
- ✅ Bots should only pause when actual limit is reached
- ✅ Bots should automatically resume at midnight UTC

## **Files Updated**

1. ✅ `scripts/check-bot-settings.sql` - Fixed SQL queries
2. ✅ `scripts/fix-trade-counting.sql` - New diagnostic script
3. ✅ `FIX_TRADE_COUNTING_ISSUE.md` - This guide

## **Next Steps**

1. Run the diagnostic query (Step 1) to verify corrected counts
2. Optionally fix old trades (Step 2)
3. Unpause incorrectly paused bots (Step 3)
4. Monitor bot execution to ensure correct behavior

Your bots should now trade correctly! 🚀

