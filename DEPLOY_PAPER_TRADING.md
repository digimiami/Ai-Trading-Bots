# 🚀 DEPLOYMENT INSTRUCTIONS - Paper Trading System

## Step 1: Run Database Migration

### Option A: Using Supabase Dashboard (Recommended)
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy the entire contents of `APPLY_MIGRATION.sql`
6. Paste into the SQL Editor
7. Click **Run** (or press Ctrl+Enter)
8. Verify success message appears

### Option B: Using Supabase CLI (if installed)
```bash
supabase db push
```

---

## Step 2: Deploy Edge Functions

### Deploy bot-executor (with PaperTradingExecutor)
1. Go to Supabase Dashboard → **Edge Functions**
2. Find `bot-executor` function
3. Click **Edit** or **Deploy**
4. Copy contents of `supabase/functions/bot-executor/index.ts`
5. Paste into the function editor
6. Click **Deploy**

### Deploy paper-trading function (NEW)
1. Go to Supabase Dashboard → **Edge Functions**
2. Click **Create Function**
3. Name: `paper-trading`
4. Copy contents of `supabase/functions/paper-trading/index.ts`
5. Paste into the function editor
6. Click **Deploy**

### Deploy bot-management (updated)
1. Go to Supabase Dashboard → **Edge Functions**
2. Find `bot-management` function
3. Click **Edit** or **Deploy**
4. Copy contents of `supabase/functions/bot-management/index.ts`
5. Paste into the function editor
6. Click **Deploy**

---

## Step 3: Verify Deployment

### Check Database Tables
Run this SQL in Supabase SQL Editor:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'paper%';
```

Should return:
- `paper_trading_accounts`
- `paper_trading_positions`
- `paper_trading_trades`

### Check Columns Added
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'trading_bots' 
AND column_name IN ('paper_trading', 'paper_balance');
```

### Test Edge Functions
1. Create a new bot with Paper Trading enabled
2. Check function logs in Supabase Dashboard
3. Verify no errors occur

---

## ✅ Success Checklist

- [ ] Database migration completed successfully
- [ ] `paper_trading_accounts` table exists
- [ ] `paper_trading_positions` table exists
- [ ] `paper_trading_trades` table exists
- [ ] `trading_bots.paper_trading` column exists
- [ ] `bot-executor` function deployed
- [ ] `paper-trading` function deployed
- [ ] `bot-management` function deployed
- [ ] Can create bot with paper trading enabled
- [ ] Paper trading toggle works in UI

---

## 🐛 Troubleshooting

### If migration fails:
- Check SQL syntax errors
- Verify you have admin access
- Check for existing tables/columns

### If functions fail to deploy:
- Check Deno syntax errors
- Verify all imports are correct
- Check function logs for errors

### If paper trading doesn't work:
- Verify `paper_trading` column exists
- Check function logs
- Verify RLS policies are set correctly

---

## 📝 Quick SQL Check Commands

```sql
-- Check if columns exist
SELECT * FROM trading_bots LIMIT 1;

-- Check if tables exist
\dt paper*

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename LIKE 'paper%';
```

