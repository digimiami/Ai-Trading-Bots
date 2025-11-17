-- 🚨 URGENT: Run This SQL in Supabase SQL Editor
-- This adds the webhook_only column to trading_bots table

-- Step 1: Add webhook_only column
ALTER TABLE trading_bots 
ADD COLUMN IF NOT EXISTS webhook_only BOOLEAN DEFAULT false;

-- Step 2: Add comment to explain the column
COMMENT ON COLUMN trading_bots.webhook_only IS 'If true, bot only executes trades from webhook triggers (TradingView alerts). Scheduled/cron executions are skipped, but manual trade signals are still processed.';

-- Step 3: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_trading_bots_webhook_only 
ON trading_bots(webhook_only) 
WHERE webhook_only = true;

-- Step 4: Refresh PostgREST schema cache (important!)
NOTIFY pgrst, 'reload schema';

-- Step 5: Wait a moment for cache refresh
SELECT pg_sleep(1);

-- Step 6: Verify the column was added
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'trading_bots' 
  AND column_name = 'webhook_only';

-- Success message
SELECT '✅ webhook_only column added successfully! Schema cache refreshed.' as status;

