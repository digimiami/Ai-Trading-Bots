-- Quick diagnostic query to check why bots aren't executing trades
-- Run this in Supabase SQL Editor
-- FIXED: Changed strategyConfig to strategy_config (snake_case)

-- 1. Check all your bots and their status
SELECT 
  id,
  name,
  status,
  symbol,
  exchange,
  strategy,
  CASE 
    WHEN strategy_config IS NULL THEN 'No strategy config'
    WHEN strategy_config::text = '{}' THEN 'Empty strategy config'
    ELSE 'Has strategy config'
  END as config_status,
  created_at,
  updated_at,
  CASE 
    WHEN updated_at > NOW() - INTERVAL '1 hour' THEN 'Recent activity'
    WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 'Last 24h'
    ELSE 'Older than 24h'
  END as activity_status
FROM trading_bots
WHERE user_id = auth.uid()
ORDER BY updated_at DESC;

-- 2. Count bots by status
SELECT 
  status,
  COUNT(*) as count
FROM trading_bots
WHERE user_id = auth.uid()
GROUP BY status
ORDER BY count DESC;

-- 3. Check recent trades (if any)
SELECT 
  t.id,
  t.symbol,
  t.side,
  t.status,
  t.price,
  t.amount,
  t.pnl,
  t.created_at,
  tb.name as bot_name
FROM trades t
LEFT JOIN trading_bots tb ON t.bot_id = tb.id
WHERE t.user_id = auth.uid()
ORDER BY t.created_at DESC
LIMIT 10;

-- 4. Check if bots have API keys configured
SELECT 
  tb.id,
  tb.name,
  tb.status,
  tb.exchange,
  CASE 
    WHEN ak.id IS NULL THEN '❌ No API keys'
    WHEN ak.is_active = false THEN '⚠️ API keys inactive'
    ELSE '✅ API keys configured'
  END as api_status
FROM trading_bots tb
LEFT JOIN api_keys ak ON ak.user_id = tb.user_id AND ak.exchange = tb.exchange AND ak.is_active = true
WHERE tb.user_id = auth.uid()
ORDER BY tb.updated_at DESC;

-- 5. Find running bots that should be executing
SELECT 
  id,
  name,
  status,
  symbol,
  exchange,
  strategy,
  created_at,
  updated_at
FROM trading_bots
WHERE user_id = auth.uid()
  AND status = 'running'
ORDER BY updated_at DESC;

