-- ============================================
-- FIX: Bot with missing strategy evaluation
-- Bot ID: 7e333dd0-8bca-482b-b5ef-f7d1dfa1bcd3
-- ============================================

-- 1. Check this specific bot's recent logs
SELECT 
  '=== BOT WITH MISSING STRATEGY EVALUATION ===' as section,
  b.id,
  b.name,
  b.status,
  b.paper_trading,
  b.symbol,
  b.exchange,
  b.timeframe,
  b.strategy,
  b.strategy_config,
  bal.level,
  bal.category,
  bal.message,
  bal.timestamp,
  EXTRACT(EPOCH FROM (NOW() - bal.timestamp)) / 60 as minutes_ago,
  bal.details
FROM trading_bots b
LEFT JOIN bot_activity_logs bal ON bal.bot_id = b.id
WHERE b.id = '7e333dd0-8bca-482b-b5ef-f7d1dfa1bcd3'
  AND bal.timestamp > NOW() - INTERVAL '2 hours'
ORDER BY bal.timestamp DESC
LIMIT 30;

-- 2. Check for errors in this bot's execution
SELECT 
  '=== ERRORS FOR THIS BOT ===' as section,
  bal.level,
  bal.category,
  bal.message,
  bal.timestamp,
  bal.details->>'error' as error_details,
  bal.details->>'stack' as error_stack
FROM bot_activity_logs bal
WHERE bal.bot_id = '7e333dd0-8bca-482b-b5ef-f7d1dfa1bcd3'
  AND bal.level = 'error'
  AND bal.timestamp > NOW() - INTERVAL '24 hours'
ORDER BY bal.timestamp DESC;

-- 3. Check bot configuration
SELECT 
  '=== BOT CONFIGURATION CHECK ===' as section,
  b.id,
  b.name,
  b.status,
  b.paper_trading,
  b.symbol,
  b.exchange,
  b.timeframe,
  b.trade_amount,
  b.leverage,
  b.stop_loss,
  b.take_profit,
  CASE 
    WHEN b.strategy IS NULL THEN '❌ NO STRATEGY'
    WHEN b.strategy::text = '{}' THEN '❌ EMPTY STRATEGY'
    WHEN b.strategy::text = 'null' THEN '❌ NULL STRATEGY'
    ELSE '✅ STRATEGY CONFIGURED'
  END as strategy_status,
  CASE 
    WHEN b.strategy_config IS NULL THEN '⚠️ NO STRATEGY CONFIG'
    WHEN b.strategy_config::text = '{}' THEN '⚠️ EMPTY STRATEGY CONFIG'
    ELSE '✅ STRATEGY CONFIG OK'
  END as strategy_config_status
FROM trading_bots b
WHERE b.id = '7e333dd0-8bca-482b-b5ef-f7d1dfa1bcd3';

-- 4. Check market data logs vs strategy logs
SELECT 
  '=== MARKET DATA VS STRATEGY LOGS ===' as section,
  'Market Data Logs' as log_type,
  COUNT(*) as count,
  MAX(timestamp) as last_log
FROM bot_activity_logs
WHERE bot_id = '7e333dd0-8bca-482b-b5ef-f7d1dfa1bcd3'
  AND category = 'market'
  AND timestamp > NOW() - INTERVAL '2 hours'

UNION ALL

SELECT 
  '=== MARKET DATA VS STRATEGY LOGS ===' as section,
  'Strategy Logs' as log_type,
  COUNT(*) as count,
  MAX(timestamp) as last_log
FROM bot_activity_logs
WHERE bot_id = '7e333dd0-8bca-482b-b5ef-f7d1dfa1bcd3'
  AND category = 'strategy'
  AND timestamp > NOW() - INTERVAL '2 hours';

-- 5. Check all recent execution logs for this bot
SELECT 
  '=== ALL RECENT LOGS FOR THIS BOT ===' as section,
  bal.level,
  bal.category,
  bal.message,
  bal.timestamp,
  EXTRACT(EPOCH FROM (NOW() - bal.timestamp)) / 60 as minutes_ago
FROM bot_activity_logs bal
WHERE bal.bot_id = '7e333dd0-8bca-482b-b5ef-f7d1dfa1bcd3'
  AND bal.timestamp > NOW() - INTERVAL '2 hours'
ORDER BY bal.timestamp DESC;

