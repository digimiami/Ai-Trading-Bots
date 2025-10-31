# Fix Price Fetching Issue

## Problem Identified

From the logs, I can see:
- ✅ Bots ARE executing
- ✅ Trading conditions ARE being met (RSI, ADX triggers)
- ❌ **Price fetching is failing**: `category: ""` instead of `"linear"` for futures

The issue is that `fetchPrice` is not mapping `"futures"` to `"linear"` correctly for Bybit API.

## Fix Applied

I've updated `supabase/functions/bot-executor/index.ts` to:
1. **Map tradingType correctly**: `futures` → `linear` for Bybit API
2. **Fix strategy parsing**: Handle malformed strategy JSON (character array issue)

## Next Step: Deploy the Fix

You need to **deploy the updated `bot-executor` function**:

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard
2. Select your project: `dkawxgwdqiirgmmjbvhc`
3. Navigate to **Edge Functions** → **bot-executor**
4. Click **"Edit"** or **"Deploy"**
5. Copy the contents of `supabase/functions/bot-executor/index.ts`
6. Paste into the function editor
7. Click **"Deploy"** or **"Save"**

### Option 2: Via Git (if you have deployment set up)

```bash
# Commit and push the changes
git add supabase/functions/bot-executor/index.ts
git commit -m "Fix price fetching for futures (map to linear) and strategy parsing"
git push
```

## After Deployment

Once deployed:
1. Wait for the next cron run (every 5 minutes)
2. Check logs - prices should now be fetched correctly
3. Trades should execute when conditions are met

## What Was Fixed

1. **Price Fetching**: Now correctly maps `tradingType="futures"` → `category="linear"` for Bybit API
2. **Strategy Parsing**: Better handling of malformed JSON (character array issue)

The bots should start trading successfully after deployment!

