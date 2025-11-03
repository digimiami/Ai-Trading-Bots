-- Check if bots were auto-paused
SELECT 
  id,
  name,
  status,
  pause_reason,
  updated_at,
  CASE 
    WHEN updated_at > NOW() - INTERVAL '1 hour' THEN 'Recent update'
    WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 'Last 24h'
    ELSE 'Older'
  END as update_recency
FROM trading_bots 
WHERE user_id = auth.uid()
ORDER BY updated_at DESC;

-- Check recent trades to see what was executed
SELECT 
  id,
  symbol,
  side,
  status,
  amount,
  price,
  entry_price,
  exit_price,
  pnl,
  created_at,
  closed_at
FROM trades 
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 20;

-- Check bot activity logs for any errors or pauses
SELECT 
  bot_id,
  level,
  category,
  message,
  timestamp,
  details
FROM bot_activity_logs
WHERE bot_id IN (SELECT id FROM trading_bots WHERE user_id = auth.uid())
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC
LIMIT 50;

-- Check which bots are currently running
SELECT 
  id,
  name,
  status,
  symbol,
  exchange,
  CASE 
    WHEN status = 'running' THEN '✅ Active'
    WHEN status = 'paused' THEN '⏸️ Paused'
    ELSE '❌ Stopped'
  END as status_indicator
FROM trading_bots 
WHERE user_id = auth.uid()
ORDER BY 
  CASE status 
    WHEN 'running' THEN 1
    WHEN 'paused' THEN 2
    ELSE 3
  END,
  updated_at DESC;

