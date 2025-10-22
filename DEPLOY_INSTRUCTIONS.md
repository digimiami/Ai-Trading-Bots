# Deployment Instructions

## Deploy Supabase Edge Function

After making changes to the bot-executor function, you need to redeploy it to Supabase:

### Option 1: Using Supabase CLI

```bash
# Login to Supabase
supabase login

# Link your project (if not already linked)
supabase link --project-ref your-project-ref

# Deploy the bot-executor function
supabase functions deploy bot-executor

# Or deploy all functions
supabase functions deploy
```

### Option 2: Using Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions**
3. Find the `bot-executor` function
4. Click **Deploy** or **Redeploy**
5. Upload the updated code from `supabase/functions/bot-executor/`

## Important Notes

### Recent Fixes Deployed:

1. **✅ Side Capitalization Fix** (`b337f005`)
   - Fixed Bybit V5 API to use `"Buy"` and `"Sell"` (capitalized)
   - Resolves "Side invalid (Code: 10001)" error

2. **✅ Trade Recording Fix** (`f010eef7`)
   - Fixed database insert to use correct columns:
     - `exchange_order_id` (not `order_id`)
     - Removed `strategy_data` and `exchange_response`
     - Added `fee` and `pnl` fields

### Verify Deployment:

After deploying, check the logs to ensure:
- No "Side invalid" errors
- Trades are being recorded in the database
- Check with: `SELECT * FROM trades ORDER BY created_at DESC LIMIT 10;`

### Troubleshooting:

If you still see "Side invalid" errors after deployment:
1. Verify the function redeployed successfully
2. Check Supabase Edge Function logs
3. Ensure the latest code from commit `b337f005` and `f010eef7` is deployed
4. Clear any function caches in Supabase

## Frontend Deployment

The frontend changes (Stop All button) will be deployed automatically if you're using Vercel/Netlify, or run:

```bash
npm run build
# Then deploy the 'out' or 'dist' directory to your hosting provider
```

