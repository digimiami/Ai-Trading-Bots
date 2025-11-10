# 🚨 URGENT FIX: Run Database Migration

## Error Message:
```
Could not find the 'paper_trading' column of 'trading_bots' in the schema cache
```

## Solution: Run SQL Migration

### Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** (left sidebar)

### Step 2: Run Migration SQL
1. Click **New Query**
2. Copy the ENTIRE contents of `QUICK_FIX_PAPER_TRADING.sql`
3. Paste into SQL Editor
4. Click **Run** (or press Ctrl+Enter)

### Step 3: Verify
Run this query to verify:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'trading_bots' 
AND column_name = 'paper_trading';
```

Should return: `paper_trading | boolean`

---

## Alternative: Run Full Migration

If you want all paper trading tables, run `APPLY_MIGRATION.sql` instead (includes the full migration).

---

## After Running Migration:
1. ✅ Refresh your browser
2. ✅ Try creating a bot again
3. ✅ Paper trading should work!








