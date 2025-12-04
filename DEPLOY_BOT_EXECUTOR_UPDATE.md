# Bot Executor Update - Bitunix Support

## Overview
This update fixes Bitunix exchange integration issues:
- ✅ Fixed order placement (404 errors)
- ✅ Fixed price fetching (returning 0)
- ✅ Added CoinGecko fallback for major coins
- ✅ Improved error logging and debugging

## Deployment Steps

### Step 1: Run SQL Migration
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open and run `update_bot_executor_bitunix.sql`
3. This will:
   - Create tracking tables for deployments
   - Update Bitunix bot configurations
   - Create monitoring views and functions

### Step 2: Deploy Edge Function
1. Go to **Supabase Dashboard** → **Edge Functions**
2. Select `bot-executor`
3. Click **Deploy** or **Update**
4. The function code is already updated in the repository

### Step 3: Verify Deployment
Run this query in SQL Editor to check the deployment:
```sql
SELECT * FROM get_active_bot_executor_version();
```

### Step 4: Monitor Bitunix Bots
Check Bitunix bot status:
```sql
SELECT * FROM bitunix_bots_status 
ORDER BY last_error_at DESC NULLS LAST;
```

### Step 5: Check for Errors
Monitor recent errors:
```sql
SELECT 
    bot_id,
    error_type,
    error_message,
    exchange,
    symbol,
    occurred_at
FROM bot_execution_errors
WHERE exchange = 'bitunix'
  AND occurred_at > NOW() - INTERVAL '24 hours'
ORDER BY occurred_at DESC;
```

## What Was Fixed

### Order Placement
- Removed invalid endpoints (`/api/spot/v1/order`, `/api/futures/v1/order`)
- Now tries: `/api/v1/trade/order`, `/api/v1/order`, `/api/trade/order`, `/api/order`
- Uses correct double SHA256 signature method
- Tries multiple base URLs (fapi.bitunix.com for futures, api.bitunix.com for spot)

### Price Fetching
- Enhanced logging for debugging
- Improved symbol matching (handles underscores, dashes)
- Added CoinGecko fallback for major coins:
  - BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, ADAUSDT, XRPUSDT, DOGEUSDT
  - DOTUSDT, MATICUSDT, AVAXUSDT, LINKUSDT, UNIUSDT
- Better error messages

## Testing

After deployment, test with:
1. **ADAUSDT Bot** - Should fetch price and place orders
2. **ETHUSDT Bot** - Should fetch price and place orders
3. Check logs for any remaining issues

## Rollback

If issues occur, you can:
1. Check `bot_execution_errors` table for details
2. Review Edge Function logs in Supabase Dashboard
3. Contact support with error details

## Maintenance

### Clean Old Error Logs (Optional)
Run periodically to clean old error logs:
```sql
SELECT clean_old_bot_execution_errors(30); -- Keep last 30 days
```

### Check Bot Executor Version
```sql
SELECT * FROM bot_executor_versions 
WHERE is_active = true 
ORDER BY deployed_at DESC;
```

