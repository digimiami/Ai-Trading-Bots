# 🚨 URGENT: Fix Pablo Ready Bot - Run This SQL NOW

## The Problem:
- Bot is showing **BTCUSDT** instead of **SOLUSDT**
- Timeframe is showing **1h** instead of **1d**
- Multi TP and Trailing SL badges are showing (should be hidden)

## ✅ SOLUTION: Run This SQL in Supabase Dashboard

### Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**

### Step 2: Copy & Paste This SQL:

```sql
-- Fix Pablo Ready Bot - Update to SOLUSDT, 1d, disable Multi TP/Trailing SL
UPDATE public.pablo_ready_bots
SET 
  symbol = 'SOLUSDT',
  timeframe = '1d',
  strategy_config = jsonb_set(
    jsonb_set(
      COALESCE(strategy_config, '{}'::jsonb),
      '{enable_tp}',
      'false'::jsonb
    ),
    '{enable_trail_sl}',
    'false'::jsonb
  ),
  description = 'Advanced trendline breakout strategy using linear regression with volume confirmation. Optimized for SOLUSDT on Daily timeframe.'
WHERE name = 'Trendline Breakout Strategy';

-- Verify the update
SELECT 
  name,
  symbol,
  timeframe,
  strategy_config->>'enable_tp' as enable_tp,
  strategy_config->>'enable_trail_sl' as enable_trail_sl
FROM public.pablo_ready_bots
WHERE name = 'Trendline Breakout Strategy';
```

### Step 3: Click "Run" (or press Ctrl+Enter)

### Step 4: Verify Results
You should see:
- **symbol**: SOLUSDT ✅
- **timeframe**: 1d ✅
- **enable_tp**: false ✅
- **enable_trail_sl**: false ✅

### Step 5: Refresh Your Browser
1. Go back to the Pablo Ready page
2. Press **Ctrl+F5** (hard refresh)
3. The bot should now show:
   - Symbol: **SOLUSDT**
   - Timeframe: **1d**
   - No "Multi TP" or "Trailing SL" badges

---

## Alternative: Use the SQL File

You can also copy the entire contents of `RUN_THIS_NOW.sql` and run it in Supabase SQL Editor.

---

## Why This Happened:
The migration files need to be run manually in Supabase. The code changes are correct, but the database record still has the old values.

