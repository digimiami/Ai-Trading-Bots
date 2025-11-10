# 🚨 CRITICAL: Database Migration Required

## Error:
```
Could not find the 'paper_trading' column of 'trading_bots' in the schema cache
```

## ✅ SOLUTION - Run This SQL Now:

### Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Select your project: `dkawxgwdqiirgmmjbvhc`
3. Click **SQL Editor** (left sidebar)

### Step 2: Copy & Run This SQL:
```sql
-- Add paper_trading column to trading_bots table
ALTER TABLE trading_bots 
ADD COLUMN IF NOT EXISTS paper_trading BOOLEAN DEFAULT false;

ALTER TABLE trading_bots
ADD COLUMN IF NOT EXISTS paper_balance DECIMAL DEFAULT 10000;

-- Refresh PostgREST schema cache (important!)
NOTIFY pgrst, 'reload schema';

-- Wait a moment for cache refresh
SELECT pg_sleep(1);

-- Success message
SELECT 'paper_trading columns added successfully! Schema cache refreshed.' as status;
```

### Step 3: Verify
After running, you should see:
- ✅ "paper_trading columns added successfully! Schema cache refreshed."

### Step 4: Test
1. Refresh your browser (Ctrl+F5)
2. Try creating the bot again
3. Should work now!

---

## 📝 Alternative: Use Full Migration

If you want all paper trading tables, run `APPLY_MIGRATION.sql` instead (includes accounts, positions, trades tables).

---

## ⚠️ Why This Happened:
- Code was deployed but database migration wasn't run
- Supabase needs SQL migrations to be run manually in SQL Editor
- Schema cache needs to be refreshed after adding columns

---

## ✅ After Running:
- Paper trading toggle will work
- Bot creation will succeed
- All paper trading features will be available










