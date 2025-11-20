-- ============================================
-- COMPREHENSIVE BOT TRADING DIAGNOSIS
-- ============================================
-- This query checks all potential reasons why bots are not trading
-- ============================================

-- 1. BOT STATUS OVERVIEW
SELECT 
    '=== BOT STATUS OVERVIEW ===' as section,
    COUNT(*) FILTER (WHERE status = 'running') as running_bots,
    COUNT(*) FILTER (WHERE status = 'stopped') as stopped_bots,
    COUNT(*) FILTER (WHERE status = 'paused') as paused_bots,
    COUNT(*) FILTER (WHERE paper_trading = true) as paper_trading_bots,
    COUNT(*) FILTER (WHERE paper_trading = false) as real_trading_bots
FROM trading_bots;

-- 2. BOTS WITH MISSING API KEYS (REAL TRADING)
SELECT 
    '=== BOTS MISSING API KEYS (REAL TRADING) ===' as section,
    tb.id,
    tb.name,
    tb.symbol,
    tb.status,
    tb.paper_trading,
    tb.exchange,
    CASE 
        WHEN ak.id IS NULL THEN '❌ NO API KEY'
        WHEN ak.active = false THEN '❌ API KEY INACTIVE'
        WHEN ak.exchange != tb.exchange THEN '❌ WRONG EXCHANGE'
        ELSE '✅ API KEY OK'
    END as api_key_status,
    ak.exchange as api_key_exchange,
    ak.active as api_key_active
FROM trading_bots tb
LEFT JOIN api_keys ak ON tb.user_id = ak.user_id AND ak.exchange = tb.exchange
WHERE tb.status = 'running' 
    AND tb.paper_trading = false
    AND (ak.id IS NULL OR ak.active = false OR ak.exchange != tb.exchange)
ORDER BY tb.name;

-- 3. BOTS WITH PROBLEMATIC STRATEGY CONFIG
SELECT 
    '=== BOTS WITH PROBLEMATIC STRATEGY CONFIG ===' as section,
    tb.id,
    tb.name,
    tb.symbol,
    tb.status,
    tb.strategy,
    CASE 
        WHEN tb.strategy_config IS NULL THEN '❌ NULL strategy_config'
        WHEN tb.strategy_config::text = '{}' THEN '❌ EMPTY strategy_config'
        WHEN (tb.strategy_config->>'adx_min_htf')::numeric < 15 THEN '⚠️ adx_min_htf too low'
        WHEN (tb.strategy_config->>'adx_min_htf')::numeric > 35 THEN '⚠️ adx_min_htf too high'
        WHEN (tb.strategy_config->>'cooldown_bars')::numeric > 100 THEN '⚠️ cooldown_bars too high'
        ELSE '✅ Config OK'
    END as config_status,
    tb.strategy_config->>'adx_min_htf' as adx_min_htf,
    tb.strategy_config->>'cooldown_bars' as cooldown_bars,
    tb.strategy_config->>'bias_mode' as bias_mode
FROM trading_bots tb
WHERE tb.status = 'running'
    AND (
        tb.strategy_config IS NULL 
        OR tb.strategy_config::text = '{}'
        OR (tb.strategy_config->>'adx_min_htf')::numeric < 15
        OR (tb.strategy_config->>'adx_min_htf')::numeric > 35
        OR (tb.strategy_config->>'cooldown_bars')::numeric > 100
    )
ORDER BY tb.name;

-- 4. RECENT ERRORS (LAST 24 HOURS)
SELECT 
    '=== RECENT ERRORS (LAST 24 HOURS) ===' as section,
    tb.name as bot_name,
    tb.symbol,
    tb.paper_trading,
    COUNT(*) as error_count,
    MAX(bal.timestamp) as last_error_time,
    STRING_AGG(DISTINCT SUBSTRING(bal.message, 1, 100), ' | ') as error_samples
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.level = 'error'
    AND bal.timestamp > NOW() - INTERVAL '24 hours'
    AND tb.status = 'running'
GROUP BY tb.id, tb.name, tb.symbol, tb.paper_trading
HAVING COUNT(*) > 0
ORDER BY error_count DESC, last_error_time DESC
LIMIT 20;

-- 5. BOTS WITH NO RECENT ACTIVITY (LAST 6 HOURS)
SELECT 
    '=== BOTS WITH NO RECENT ACTIVITY (LAST 6 HOURS) ===' as section,
    tb.id,
    tb.name,
    tb.symbol,
    tb.status,
    tb.paper_trading,
    MAX(bal.timestamp) as last_activity,
    EXTRACT(EPOCH FROM (NOW() - MAX(bal.timestamp))) / 3600 as hours_since_activity,
    COUNT(bal.id) FILTER (WHERE bal.timestamp > NOW() - INTERVAL '6 hours') as recent_logs
FROM trading_bots tb
LEFT JOIN bot_activity_logs bal ON tb.id = bal.bot_id
WHERE tb.status = 'running'
GROUP BY tb.id, tb.name, tb.symbol, tb.status, tb.paper_trading
HAVING COUNT(bal.id) FILTER (WHERE bal.timestamp > NOW() - INTERVAL '6 hours') = 0
    OR MAX(bal.timestamp) IS NULL
    OR MAX(bal.timestamp) < NOW() - INTERVAL '6 hours'
ORDER BY hours_since_activity DESC NULLS LAST;

-- 6. RECENT TRADING ATTEMPTS (SUCCESSFUL AND FAILED)
SELECT 
    '=== RECENT TRADING ATTEMPTS (LAST 24 HOURS) ===' as section,
    tb.name as bot_name,
    tb.symbol,
    tb.paper_trading,
    COUNT(*) FILTER (WHERE bal.category = 'trade' AND bal.level = 'info' AND bal.message LIKE '%✅%') as successful_trades,
    COUNT(*) FILTER (WHERE bal.category = 'trade' AND bal.level = 'error') as failed_trades,
    COUNT(*) FILTER (WHERE bal.message LIKE '%No trading signals%') as no_signals,
    COUNT(*) FILTER (WHERE bal.message LIKE '%Strategy signal%') as strategy_evaluations,
    MAX(bal.timestamp) as last_trade_attempt
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.timestamp > NOW() - INTERVAL '24 hours'
    AND tb.status = 'running'
    AND (
        bal.category = 'trade' 
        OR bal.message LIKE '%trading signals%'
        OR bal.message LIKE '%Strategy signal%'
        OR bal.message LIKE '%execute%'
    )
GROUP BY tb.id, tb.name, tb.symbol, tb.paper_trading
ORDER BY last_trade_attempt DESC;

-- 7. COOLDOWN STATUS CHECK
SELECT 
    '=== COOLDOWN STATUS CHECK ===' as section,
    tb.name as bot_name,
    tb.symbol,
    tb.paper_trading,
    COALESCE((tb.strategy_config->>'cooldown_bars')::numeric, 8) as cooldown_bars,
    COUNT(*) FILTER (WHERE bal.category = 'trade' AND bal.level = 'info' AND bal.message LIKE '%✅%') as recent_trades,
    MAX(bal.timestamp) FILTER (WHERE bal.category = 'trade' AND bal.level = 'info' AND bal.message LIKE '%✅%') as last_trade_time,
    CASE 
        WHEN COALESCE((tb.strategy_config->>'cooldown_bars')::numeric, 8) = 0 THEN '✅ Cooldown DISABLED'
        WHEN MAX(bal.timestamp) FILTER (WHERE bal.category = 'trade' AND bal.level = 'info' AND bal.message LIKE '%✅%') IS NULL THEN '⚠️ No trades yet'
        WHEN MAX(bal.timestamp) FILTER (WHERE bal.category = 'trade' AND bal.level = 'info' AND bal.message LIKE '%✅%') > NOW() - INTERVAL '1 hour' THEN '✅ Recent trade'
        ELSE '⏸️ Waiting for cooldown'
    END as cooldown_status
FROM trading_bots tb
LEFT JOIN bot_activity_logs bal ON tb.id = bal.bot_id 
    AND bal.timestamp > NOW() - INTERVAL '24 hours'
WHERE tb.status = 'running'
GROUP BY tb.id, tb.name, tb.symbol, tb.paper_trading, tb.strategy_config
ORDER BY tb.name;

-- 8. PAPER TRADING SPECIFIC CHECKS
SELECT 
    '=== PAPER TRADING ACCOUNT STATUS ===' as section,
    tb.name as bot_name,
    tb.symbol,
    COUNT(DISTINCT pta.id) as paper_accounts,
    COUNT(DISTINCT ptp.id) FILTER (WHERE ptp.status = 'open') as open_positions,
    COUNT(DISTINCT ptt.id) as total_trades,
    MAX(ptt.executed_at) as last_paper_trade,
    SUM(COALESCE(ptt.profit_loss, 0)) as total_pnl
FROM trading_bots tb
LEFT JOIN paper_trading_accounts pta ON tb.user_id = pta.user_id
LEFT JOIN paper_trading_positions ptp ON tb.id = ptp.bot_id AND ptp.status = 'open'
LEFT JOIN paper_trading_trades ptt ON tb.id = ptt.bot_id
WHERE tb.status = 'running' AND tb.paper_trading = true
GROUP BY tb.id, tb.name, tb.symbol
ORDER BY tb.name;

-- 9. WEBHOOK EXECUTION STATUS
SELECT 
    '=== WEBHOOK EXECUTION STATUS (LAST 24 HOURS) ===' as section,
    tb.name as bot_name,
    tb.symbol,
    COUNT(DISTINCT wc.id) as webhook_calls,
    COUNT(DISTINCT wc.id) FILTER (WHERE wc.status = 'processed') as processed,
    COUNT(DISTINCT wc.id) FILTER (WHERE wc.status = 'failed') as failed,
    COUNT(DISTINCT wc.id) FILTER (WHERE wc.status = 'received') as received,
    MAX(wc.created_at) as last_webhook
FROM trading_bots tb
LEFT JOIN webhook_calls wc ON wc.raw_payload->>'botId' = tb.id::text
    AND wc.created_at > NOW() - INTERVAL '24 hours'
WHERE tb.status = 'running'
GROUP BY tb.id, tb.name, tb.symbol
HAVING COUNT(DISTINCT wc.id) > 0
ORDER BY last_webhook DESC;

-- 10. SUMMARY: TOP ISSUES
SELECT 
    '=== SUMMARY: TOP ISSUES ===' as section,
    'Missing API Keys (Real Trading)' as issue,
    COUNT(*) as affected_bots
FROM trading_bots tb
LEFT JOIN api_keys ak ON tb.user_id = ak.user_id AND ak.exchange = tb.exchange
WHERE tb.status = 'running' 
    AND tb.paper_trading = false
    AND (ak.id IS NULL OR ak.active = false)

UNION ALL

SELECT 
    '=== SUMMARY: TOP ISSUES ===' as section,
    'No Recent Activity (6+ hours)' as issue,
    COUNT(*) as affected_bots
FROM trading_bots tb
LEFT JOIN bot_activity_logs bal ON tb.id = bal.bot_id
WHERE tb.status = 'running'
GROUP BY tb.id
HAVING COUNT(bal.id) FILTER (WHERE bal.timestamp > NOW() - INTERVAL '6 hours') = 0
    OR MAX(bal.timestamp) IS NULL
    OR MAX(bal.timestamp) < NOW() - INTERVAL '6 hours'

UNION ALL

SELECT 
    '=== SUMMARY: TOP ISSUES ===' as section,
    'Recent Errors (24h)' as issue,
    COUNT(DISTINCT tb.id) as affected_bots
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.level = 'error'
    AND bal.timestamp > NOW() - INTERVAL '24 hours'
    AND tb.status = 'running';

