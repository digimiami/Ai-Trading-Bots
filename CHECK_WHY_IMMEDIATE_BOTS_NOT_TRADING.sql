-- Check why Immediate Trading Bot bots haven't started trading
-- =============================================

-- 1. Check bot status and configuration
SELECT 
  id,
  name,
  status,
  symbol,
  exchange,
  trading_type,
  paper_trading,
  strategy::jsonb->>'type' as strategy_type,
  strategy_config->>'cooldown_bars' as cooldown_bars,
  strategy_config->>'adx_min' as adx_min,
  strategy_config->>'immediate_execution' as immediate_execution,
  strategy_config->>'disable_htf_adx_check' as disable_htf_adx_check,
  strategy_config->>'max_trades_per_day' as max_trades_per_day,
  created_at,
  updated_at
FROM trading_bots
WHERE name LIKE '%Immediate Trading Bot - Custom Pairs%'
ORDER BY created_at DESC;

-- 2. Check recent activity logs for these bots
SELECT 
  bal.bot_id,
  tb.name as bot_name,
  bal.level,
  bal.category,
  bal.message,
  bal.details,
  bal.created_at
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE tb.name LIKE '%Immediate Trading Bot - Custom Pairs%'
  AND bal.created_at > NOW() - INTERVAL '24 hours'
ORDER BY bal.created_at DESC
LIMIT 50;

-- 3. Check for errors in the last 24 hours
SELECT 
  bal.bot_id,
  tb.name as bot_name,
  bal.level,
  bal.message,
  bal.details,
  bal.created_at
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE tb.name LIKE '%Immediate Trading Bot - Custom Pairs%'
  AND bal.level = 'error'
  AND bal.created_at > NOW() - INTERVAL '24 hours'
ORDER BY bal.created_at DESC;

-- 4. Check API key status for these bots
SELECT 
  tb.id,
  tb.name,
  tb.user_id,
  tb.exchange,
  ak.id as api_key_id,
  ak.exchange as api_key_exchange,
  ak.is_active as api_key_active,
  ak.created_at as api_key_created_at,
  CASE 
    WHEN ak.id IS NULL THEN '❌ NO API KEY'
    WHEN ak.is_active = false THEN '❌ API KEY INACTIVE'
    WHEN ak.exchange != tb.exchange THEN '⚠️ EXCHANGE MISMATCH'
    ELSE '✅ API KEY OK'
  END as api_key_status
FROM trading_bots tb
LEFT JOIN api_keys ak ON tb.user_id = ak.user_id AND ak.exchange = tb.exchange AND ak.is_active = true
WHERE tb.name LIKE '%Immediate Trading Bot - Custom Pairs%'
ORDER BY tb.created_at DESC;

-- 5. Check last execution time and strategy evaluation results
SELECT 
  tb.id,
  tb.name,
  tb.status,
  MAX(bal.created_at) as last_activity,
  COUNT(*) FILTER (WHERE bal.level = 'error') as error_count,
  COUNT(*) FILTER (WHERE bal.message LIKE '%Strategy signal%') as signal_count,
  COUNT(*) FILTER (WHERE bal.message LIKE '%No trading signals%') as no_signal_count,
  COUNT(*) FILTER (WHERE bal.message LIKE '%BUY%' OR bal.message LIKE '%SELL%') as trade_signal_count,
  COUNT(*) FILTER (WHERE bal.message LIKE '%Order placed%' OR bal.message LIKE '%Trade executed%') as trade_executed_count
FROM trading_bots tb
LEFT JOIN bot_activity_logs bal ON tb.id = bal.bot_id
WHERE tb.name LIKE '%Immediate Trading Bot - Custom Pairs%'
  AND (bal.created_at > NOW() - INTERVAL '24 hours' OR bal.created_at IS NULL)
GROUP BY tb.id, tb.name, tb.status
ORDER BY last_activity DESC NULLS LAST;

-- 6. Check for manual trade signals pending
SELECT 
  mts.id,
  mts.bot_id,
  tb.name as bot_name,
  mts.side,
  mts.status,
  mts.created_at,
  mts.processed_at
FROM manual_trade_signals mts
JOIN trading_bots tb ON mts.bot_id = tb.id
WHERE tb.name LIKE '%Immediate Trading Bot - Custom Pairs%'
  AND mts.status = 'pending'
ORDER BY mts.created_at DESC;

-- 7. Check recent trades (if any)
SELECT 
  t.id,
  t.bot_id,
  tb.name as bot_name,
  t.symbol,
  t.side,
  t.status,
  t.created_at
FROM trades t
JOIN trading_bots tb ON t.bot_id = tb.id
WHERE tb.name LIKE '%Immediate Trading Bot - Custom Pairs%'
  AND t.created_at > NOW() - INTERVAL '24 hours'
ORDER BY t.created_at DESC
LIMIT 20;

-- 8. Check paper trading positions (if paper trading)
SELECT 
  ptp.id,
  ptp.bot_id,
  tb.name as bot_name,
  ptp.symbol,
  ptp.side,
  ptp.status,
  ptp.opened_at
FROM paper_trading_positions ptp
JOIN trading_bots tb ON ptp.bot_id = tb.id
WHERE tb.name LIKE '%Immediate Trading Bot - Custom Pairs%'
  AND ptp.status = 'open'
ORDER BY ptp.opened_at DESC;

-- 9. Check for cooldown issues
SELECT 
  tb.id,
  tb.name,
  tb.status,
  tb.symbol,
  strategy_config->>'cooldown_bars' as cooldown_bars,
  MAX(bal.created_at) FILTER (WHERE bal.message LIKE '%cooldown%' OR bal.message LIKE '%waiting%') as last_cooldown_check,
  COUNT(*) FILTER (WHERE bal.message LIKE '%cooldown%' OR bal.message LIKE '%waiting%') as cooldown_checks
FROM trading_bots tb
LEFT JOIN bot_activity_logs bal ON tb.id = bal.bot_id
WHERE tb.name LIKE '%Immediate Trading Bot - Custom Pairs%'
  AND (bal.created_at > NOW() - INTERVAL '6 hours' OR bal.created_at IS NULL)
GROUP BY tb.id, tb.name, tb.status, tb.symbol, strategy_config->>'cooldown_bars';

-- 10. Summary of all issues
SELECT 
  'Bot Status' as check_type,
  COUNT(*) FILTER (WHERE status != 'running') as issue_count,
  STRING_AGG(name, ', ') FILTER (WHERE status != 'running') as affected_bots
FROM trading_bots
WHERE name LIKE '%Immediate Trading Bot - Custom Pairs%'

UNION ALL

SELECT 
  'Missing API Keys' as check_type,
  COUNT(*) as issue_count,
  STRING_AGG(tb.name, ', ') as affected_bots
FROM trading_bots tb
LEFT JOIN api_keys ak ON tb.user_id = ak.user_id AND ak.exchange = tb.exchange AND ak.is_active = true
WHERE tb.name LIKE '%Immediate Trading Bot - Custom Pairs%'
  AND ak.id IS NULL

UNION ALL

SELECT 
  'No Recent Activity (24h)' as check_type,
  COUNT(*) as issue_count,
  STRING_AGG(tb.name, ', ') as affected_bots
FROM trading_bots tb
LEFT JOIN bot_activity_logs bal ON tb.id = bal.bot_id AND bal.created_at > NOW() - INTERVAL '24 hours'
WHERE tb.name LIKE '%Immediate Trading Bot - Custom Pairs%'
  AND bal.id IS NULL

UNION ALL

SELECT 
  'Recent Errors' as check_type,
  COUNT(DISTINCT bal.bot_id) as issue_count,
  STRING_AGG(DISTINCT tb.name, ', ') as affected_bots
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE tb.name LIKE '%Immediate Trading Bot - Custom Pairs%'
  AND bal.level = 'error'
  AND bal.created_at > NOW() - INTERVAL '24 hours';

