# 🔗 Webhook-Only Mode Setup Instructions

## ⚠️ IMPORTANT: Run Migration First!

The `webhook_only` column doesn't exist yet. You need to run the migration SQL first.

## Step 1: Run Migration (REQUIRED)

### Open Supabase SQL Editor:
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**

### Copy & Run This SQL:
Open `RUN_WEBHOOK_ONLY_MIGRATION.sql` and copy the entire contents, then:
1. Paste into SQL Editor
2. Click **Run** (or press Ctrl+Enter)
3. You should see: `✅ webhook_only column added successfully!`

## Step 2: Enable Webhook-Only Mode

After the migration succeeds, run `ENABLE_WEBHOOK_ONLY_MODE.sql`:

1. Open `ENABLE_WEBHOOK_ONLY_MODE.sql`
2. Copy the entire contents
3. Paste into Supabase SQL Editor
4. Click **Run**

This will enable webhook-only mode for your TradingView bots.

## Step 3: Verify

Run this query to verify:

```sql
SELECT 
  id,
  name,
  status,
  webhook_only,
  paper_trading
FROM trading_bots
WHERE id IN (
  '02511945-ef73-47df-822d-15608d1bac9e',
  '59f7165e-aff9-4107-b4a7-66a2ecfc5087'
);
```

You should see `webhook_only = true` for both bots.

## What This Does

- ✅ Bots will **only trade via TradingView alerts** (webhooks)
- ❌ Bots will **skip scheduled/cron executions**
- ✅ **Saves API calls** - no unnecessary market data fetching
- ✅ **Full control** - you decide exactly when to trade

---

**After running the migration, you can use `ENABLE_WEBHOOK_ONLY_MODE.sql` to enable the feature!**

