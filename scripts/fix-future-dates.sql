-- Fix incorrect future dates in trading_bots table
-- This script corrects dates that were created with the buggy time sync offset

-- 1. First, check how many bots have future dates
SELECT 
  COUNT(*) as bots_with_future_dates,
  MIN(last_trade_at) as earliest_date,
  MAX(last_trade_at) as latest_date
FROM trading_bots
WHERE last_trade_at > NOW() + INTERVAL '1 year'; -- Dates more than 1 year in the future

-- 2. Fix last_trade_at dates that are in the future (reset to NULL or current time)
UPDATE trading_bots
SET 
  last_trade_at = CASE 
    WHEN last_trade_at > NOW() + INTERVAL '1 year' THEN NULL -- Reset future dates to NULL
    ELSE last_trade_at
  END,
  updated_at = NOW() -- Update the updated_at timestamp
WHERE last_trade_at > NOW() + INTERVAL '1 year';

-- 3. Also check and fix trades table if it has future dates
SELECT 
  COUNT(*) as trades_with_future_dates,
  MIN(executed_at) as earliest_trade,
  MAX(executed_at) as latest_trade
FROM trades
WHERE executed_at > NOW() + INTERVAL '1 year';

-- 4. Fix future dates in trades table
UPDATE trades
SET 
  executed_at = CASE 
    WHEN executed_at > NOW() + INTERVAL '1 year' THEN NOW() -- Set to current time for trades
    ELSE executed_at
  END
WHERE executed_at > NOW() + INTERVAL '1 year';

-- 5. Check bot_activity_logs for future timestamps
SELECT 
  COUNT(*) as logs_with_future_timestamps,
  MIN(timestamp) as earliest_log,
  MAX(timestamp) as latest_log
FROM bot_activity_logs
WHERE timestamp > NOW() + INTERVAL '1 year';

-- 6. Fix future timestamps in bot_activity_logs
UPDATE bot_activity_logs
SET 
  timestamp = CASE 
    WHEN timestamp > NOW() + INTERVAL '1 year' THEN NOW()
    ELSE timestamp
  END
WHERE timestamp > NOW() + INTERVAL '1 year';

-- 7. Verify the fixes
SELECT 
  'trading_bots' as table_name,
  COUNT(*) as future_dates_remaining
FROM trading_bots
WHERE last_trade_at > NOW() + INTERVAL '1 year'
UNION ALL
SELECT 
  'trades' as table_name,
  COUNT(*) as future_dates_remaining
FROM trades
WHERE executed_at > NOW() + INTERVAL '1 year'
UNION ALL
SELECT 
  'bot_activity_logs' as table_name,
  COUNT(*) as future_dates_remaining
FROM bot_activity_logs
WHERE timestamp > NOW() + INTERVAL '1 year';
