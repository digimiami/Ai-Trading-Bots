-- Diagnostic query to check why bots are not trading
-- Run this in Supabase SQL Editor to check bot status

-- 1. Check how many bots exist and their statuses
SELECT 
  status,
  COUNT(*) as count
FROM trading_bots
GROUP BY status
ORDER BY count DESC;

-- 2. List all running bots with details
SELECT 
  id,
  name,
  user_id,
  exchange,
  symbol,
  status,
  trading_type,
  strategy IS NOT NULL as has_strategy,
  created_at,
  updated_at,
  last_trade_at
FROM trading_bots
WHERE status = 'running'
ORDER BY updated_at DESC;

-- 3. Check if bots have API keys configured
SELECT 
  b.id,
  b.name,
  b.exchange,
  b.status,
  COUNT(ak.id) as api_key_count,
  BOOL_OR(ak.is_active) as has_active_key
FROM trading_bots b
LEFT JOIN api_keys ak ON ak.user_id = b.user_id AND ak.exchange = b.exchange
WHERE b.status = 'running'
GROUP BY b.id, b.name, b.exchange, b.status
ORDER BY b.name;

-- 4. Check recent bot activity logs
SELECT 
  bot_id,
  level,
  category,
  message,
  timestamp
FROM bot_activity_logs
WHERE timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC
LIMIT 50;

-- 5. Check if cron job is calling bot-scheduler
-- (This requires checking Edge Function logs in Supabase Dashboard)

-- 6. Check recent trades to see if any bots executed
SELECT 
  t.id,
  t.bot_id,
  b.name as bot_name,
  t.side,
  t.amount,
  t.price,
  t.status,
  t.executed_at
FROM trades t
JOIN trading_bots b ON b.id = t.bot_id
WHERE t.executed_at > NOW() - INTERVAL '24 hours'
ORDER BY t.executed_at DESC
LIMIT 20;

-- 7. Check for bots that should be running but aren't trading
SELECT 
  b.id,
  b.name,
  b.status,
  b.last_trade_at,
  NOW() - b.last_trade_at as time_since_last_trade,
  CASE 
    WHEN b.last_trade_at IS NULL THEN 'Never traded'
    WHEN NOW() - b.last_trade_at > INTERVAL '24 hours' THEN 'No trades in 24h'
    WHEN NOW() - b.last_trade_at > INTERVAL '1 hour' THEN 'No trades in 1h'
    ELSE 'Trading recently'
  END as trading_status
FROM trading_bots b
WHERE b.status = 'running'
ORDER BY b.last_trade_at ASC NULLS FIRST;
