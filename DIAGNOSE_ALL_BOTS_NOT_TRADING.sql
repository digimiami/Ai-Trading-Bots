-- Comprehensive diagnostic: Why are NO bots trading (paper/real)?
-- =============================================

-- 1. Check ALL bot statuses
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
  created_at,
  updated_at
FROM trading_bots
WHERE status = 'running'
ORDER BY created_at DESC;

-- 2. Count bots by status
SELECT 
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE paper_trading = true) as paper_count,
  COUNT(*) FILTER (WHERE paper_trading = false) as real_count
FROM trading_bots
GROUP BY status
ORDER BY count DESC;

-- 3. Check API keys for ALL running bots
SELECT 
  tb.id,
  tb.name,
  tb.user_id,
  tb.exchange,
  tb.paper_trading,
  ak.id as api_key_id,
  ak.exchange as api_key_exchange,
  ak.is_active as api_key_active,
  CASE 
    WHEN tb.paper_trading = true THEN '✅ PAPER TRADING (No API key needed)'
    WHEN ak.id IS NULL THEN '❌ NO API KEY'
    WHEN ak.is_active = false THEN '❌ API KEY INACTIVE'
    WHEN ak.exchange != tb.exchange THEN '⚠️ EXCHANGE MISMATCH'
    ELSE '✅ API KEY OK'
  END as api_key_status
FROM trading_bots tb
LEFT JOIN api_keys ak ON tb.user_id = ak.user_id AND ak.exchange = tb.exchange AND ak.is_active = true
WHERE tb.status = 'running'
ORDER BY tb.paper_trading DESC, tb.created_at DESC;

-- 4. Check recent activity logs (last 6 hours) for ALL bots
SELECT 
  bal.bot_id,
  tb.name as bot_name,
  tb.paper_trading,
  bal.level,
  bal.category,
  bal.message,
  bal.created_at
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE tb.status = 'running'
  AND bal.created_at > NOW() - INTERVAL '6 hours'
ORDER BY bal.created_at DESC
LIMIT 100;

-- 5. Check for errors in the last 6 hours
SELECT 
  bal.bot_id,
  tb.name as bot_name,
  tb.paper_trading,
  bal.message,
  bal.details,
  bal.created_at
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE tb.status = 'running'
  AND bal.level = 'error'
  AND bal.created_at > NOW() - INTERVAL '6 hours'
ORDER BY bal.created_at DESC;

-- 6. Check strategy evaluation results (last 6 hours)
SELECT 
  bal.bot_id,
  tb.name as bot_name,
  tb.paper_trading,
  bal.message,
  bal.created_at
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE tb.status = 'running'
  AND bal.message LIKE '%Strategy signal%'
  AND bal.created_at > NOW() - INTERVAL '6 hours'
ORDER BY bal.created_at DESC;

-- 7. Check for "No trading signals" messages
SELECT 
  bal.bot_id,
  tb.name as bot_name,
  tb.paper_trading,
  COUNT(*) as no_signal_count,
  MAX(bal.created_at) as last_no_signal
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE tb.status = 'running'
  AND bal.message LIKE '%No trading signals%'
  AND bal.created_at > NOW() - INTERVAL '6 hours'
GROUP BY bal.bot_id, tb.name, tb.paper_trading
ORDER BY no_signal_count DESC;

-- 8. Check last execution time for each bot
SELECT 
  tb.id,
  tb.name,
  tb.status,
  tb.paper_trading,
  MAX(bal.created_at) as last_activity,
  COUNT(*) FILTER (WHERE bal.level = 'error') as error_count,
  COUNT(*) FILTER (WHERE bal.message LIKE '%Strategy signal%') as signal_count,
  COUNT(*) FILTER (WHERE bal.message LIKE '%No trading signals%') as no_signal_count,
  COUNT(*) FILTER (WHERE bal.message LIKE '%BUY%' OR bal.message LIKE '%SELL%') as trade_signal_count,
  COUNT(*) FILTER (WHERE bal.message LIKE '%Order placed%' OR bal.message LIKE '%Trade executed%') as trade_executed_count
FROM trading_bots tb
LEFT JOIN bot_activity_logs bal ON tb.id = bal.bot_id
WHERE tb.status = 'running'
  AND (bal.created_at > NOW() - INTERVAL '6 hours' OR bal.created_at IS NULL)
GROUP BY tb.id, tb.name, tb.status, tb.paper_trading
ORDER BY last_activity DESC NULLS LAST;

-- 9. Check for cooldown issues
SELECT 
  tb.id,
  tb.name,
  tb.paper_trading,
  strategy_config->>'cooldown_bars' as cooldown_bars,
  MAX(bal.created_at) FILTER (WHERE bal.message LIKE '%cooldown%' OR bal.message LIKE '%waiting%') as last_cooldown_check,
  COUNT(*) FILTER (WHERE bal.message LIKE '%cooldown%' OR bal.message LIKE '%waiting%') as cooldown_checks
FROM trading_bots tb
LEFT JOIN bot_activity_logs bal ON tb.id = bal.bot_id
WHERE tb.status = 'running'
  AND (bal.created_at > NOW() - INTERVAL '6 hours' OR bal.created_at IS NULL)
GROUP BY tb.id, tb.name, tb.paper_trading, strategy_config->>'cooldown_bars';

-- 10. Check recent trades (if any)
SELECT 
  t.id,
  t.bot_id,
  tb.name as bot_name,
  tb.paper_trading,
  t.symbol,
  t.side,
  t.status,
  t.created_at
FROM trades t
JOIN trading_bots tb ON t.bot_id = tb.id
WHERE tb.status = 'running'
  AND t.created_at > NOW() - INTERVAL '24 hours'
ORDER BY t.created_at DESC
LIMIT 50;

-- 11. Check paper trading positions
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
WHERE tb.status = 'running'
  AND ptp.status = 'open'
ORDER BY ptp.opened_at DESC;

-- 12. Check paper trading trades
SELECT 
  ptt.id,
  ptt.bot_id,
  tb.name as bot_name,
  ptt.symbol,
  ptt.side,
  ptt.status,
  ptt.created_at
FROM paper_trading_trades ptt
JOIN trading_bots tb ON ptt.bot_id = tb.id
WHERE tb.status = 'running'
  AND ptt.created_at > NOW() - INTERVAL '24 hours'
ORDER BY ptt.created_at DESC
LIMIT 50;

-- 13. Summary of issues
SELECT 
  'Bots not running' as issue_type,
  COUNT(*) as issue_count,
  STRING_AGG(name, ', ') as affected_bots
FROM trading_bots
WHERE status != 'running'

UNION ALL

SELECT 
  'Real trading bots missing API keys' as issue_type,
  COUNT(*) as issue_count,
  STRING_AGG(tb.name, ', ') as affected_bots
FROM trading_bots tb
LEFT JOIN api_keys ak ON tb.user_id = ak.user_id AND ak.exchange = tb.exchange AND ak.is_active = true
WHERE tb.status = 'running'
  AND tb.paper_trading = false
  AND ak.id IS NULL

UNION ALL

SELECT 
  'No recent activity (6h)' as issue_type,
  COUNT(*) as issue_count,
  STRING_AGG(tb.name, ', ') as affected_bots
FROM trading_bots tb
LEFT JOIN bot_activity_logs bal ON tb.id = bal.bot_id AND bal.created_at > NOW() - INTERVAL '6 hours'
WHERE tb.status = 'running'
  AND bal.id IS NULL

UNION ALL

SELECT 
  'Recent errors' as issue_type,
  COUNT(DISTINCT bal.bot_id) as issue_count,
  STRING_AGG(DISTINCT tb.name, ', ') as affected_bots
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE tb.status = 'running'
  AND bal.level = 'error'
  AND bal.created_at > NOW() - INTERVAL '6 hours'

UNION ALL

SELECT 
  'Only "No trading signals" messages' as issue_type,
  COUNT(DISTINCT bal.bot_id) as issue_count,
  STRING_AGG(DISTINCT tb.name, ', ') as affected_bots
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE tb.status = 'running'
  AND bal.message LIKE '%No trading signals%'
  AND bal.created_at > NOW() - INTERVAL '6 hours'
  AND NOT EXISTS (
    SELECT 1 FROM bot_activity_logs bal2
    WHERE bal2.bot_id = bal.bot_id
      AND bal2.message LIKE '%Strategy signal: BUY%' OR bal2.message LIKE '%Strategy signal: SELL%'
      AND bal2.created_at > NOW() - INTERVAL '6 hours'
  );

