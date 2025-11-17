-- Check Bot Execution Flow - Database Logs
-- This query shows the detailed execution steps for each bot

-- 1. See execution flow for all running bots (last hour)
SELECT 
  b.id as bot_id,
  b.name as bot_name,
  b.symbol,
  b.status,
  b.paper_trading,
  ba.created_at,
  ba.level,
  ba.category,
  ba.message,
  ba.details->>'step' as execution_step,
  ba.details->>'stopped' as stopped,
  ba.details->>'passed' as passed,
  ba.details
FROM bot_activity_logs ba
JOIN trading_bots b ON ba.bot_id = b.id
WHERE b.status = 'running'
  AND ba.category IN ('system', 'market')
  AND ba.created_at > NOW() - INTERVAL '1 hour'
ORDER BY ba.created_at DESC, b.name
LIMIT 100;

-- 2. Find where execution stopped for each bot
SELECT 
  b.id as bot_id,
  b.name as bot_name,
  b.symbol,
  b.status,
  b.paper_trading,
  MAX(ba.created_at) as last_log_time,
  MAX(ba.message) FILTER (WHERE ba.details->>'step' IS NOT NULL) as last_step_message,
  MAX(ba.details->>'step') as last_step,
  MAX(ba.details->>'stopped')::boolean as stopped,
  MAX(ba.details->>'passed')::boolean as passed,
  COUNT(*) as total_logs
FROM trading_bots b
LEFT JOIN bot_activity_logs ba ON b.id = ba.bot_id
WHERE b.status = 'running'
  AND ba.created_at > NOW() - INTERVAL '2 hours'
  AND ba.category IN ('system', 'market')
GROUP BY b.id, b.name, b.symbol, b.status, b.paper_trading
ORDER BY last_log_time DESC NULLS LAST;

-- 3. Check if bots reached "REAL TRADING MODE"
SELECT 
  b.id as bot_id,
  b.name as bot_name,
  b.symbol,
  b.paper_trading,
  COUNT(*) FILTER (WHERE ba.message LIKE '%REAL TRADING MODE%') as reached_real_trading,
  MAX(ba.created_at) FILTER (WHERE ba.message LIKE '%REAL TRADING MODE%') as real_trading_time,
  MAX(ba.created_at) as last_activity
FROM trading_bots b
LEFT JOIN bot_activity_logs ba ON b.id = ba.bot_id
WHERE b.status = 'running'
  AND ba.created_at > NOW() - INTERVAL '2 hours'
GROUP BY b.id, b.name, b.symbol, b.paper_trading
ORDER BY last_activity DESC;

-- 4. See full execution flow for a specific bot (replace BOT_ID)
-- SELECT 
--   created_at,
--   level,
--   category,
--   message,
--   details->>'step' as step,
--   details->>'stopped' as stopped,
--   details->>'passed' as passed,
--   details
-- FROM bot_activity_logs
-- WHERE bot_id = 'YOUR_BOT_ID'
--   AND category IN ('system', 'market')
--   AND created_at > NOW() - INTERVAL '1 hour'
-- ORDER BY created_at DESC
-- LIMIT 50;

-- 5. Check execution steps summary
SELECT 
  ba.details->>'step' as execution_step,
  COUNT(*) as occurrences,
  COUNT(*) FILTER (WHERE ba.details->>'stopped' = 'true') as stopped_count,
  COUNT(*) FILTER (WHERE ba.details->>'passed' = 'true') as passed_count,
  MAX(ba.created_at) as last_occurrence
FROM bot_activity_logs ba
JOIN trading_bots b ON ba.bot_id = b.id
WHERE b.status = 'running'
  AND ba.category IN ('system', 'market')
  AND ba.created_at > NOW() - INTERVAL '1 hour'
  AND ba.details->>'step' IS NOT NULL
GROUP BY ba.details->>'step'
ORDER BY last_occurrence DESC;

