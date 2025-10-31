-- ============================================
-- COMPREHENSIVE BOT TRADING DIAGNOSTIC SCRIPT
-- ============================================
-- This script checks all possible reasons why bots aren't trading:
-- 1. Bot status and configuration
-- 2. Recent activity and error logs
-- 3. Trade history and limits
-- 4. API key status
-- 5. Strategy configuration
-- 6. Safety limits and restrictions
-- ============================================

-- ============================================
-- 1. BOT STATUS OVERVIEW
-- ============================================
SELECT 
    '=== BOT STATUS OVERVIEW ===' AS section;

SELECT 
    id,
    name,
    status,
    exchange,
    symbol,
    leverage,
    risk_level,
    total_trades,
    pnl,
    pnl_percentage,
    win_rate,
    last_trade_at,
    CASE 
        WHEN last_trade_at IS NULL THEN 'Never traded'
        WHEN last_trade_at < NOW() - INTERVAL '1 hour' THEN 'No trades in last hour'
        WHEN last_trade_at < NOW() - INTERVAL '1 day' THEN 'No trades in last day'
        ELSE 'Trading recently'
    END AS trading_status,
    created_at,
    updated_at
FROM trading_bots
WHERE status = 'running'
ORDER BY last_trade_at DESC NULLS LAST;

-- ============================================
-- 2. RECENT ACTIVITY LOGS (ERRORS & WARNINGS)
-- ============================================
SELECT 
    '=== RECENT ERRORS & WARNINGS ===' AS section;

SELECT 
    bal.id,
    bal.bot_id,
    tb.name AS bot_name,
    bal.level,
    bal.category,
    bal.message,
    bal.details,
    bal.timestamp,
    NOW() - bal.timestamp AS time_ago
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.timestamp > NOW() - INTERVAL '24 hours'
    AND bal.level IN ('error', 'warning')
ORDER BY bal.timestamp DESC
LIMIT 50;

-- ============================================
-- 3. STRATEGY CONDITIONS NOT MET LOGS
-- ============================================
SELECT 
    '=== STRATEGY CONDITIONS NOT MET ===' AS section;

SELECT 
    bal.id,
    bal.bot_id,
    tb.name AS bot_name,
    bal.message,
    bal.details->>'reason' AS reason,
    bal.details->>'confidence' AS confidence,
    bal.details->>'rsi' AS rsi,
    bal.details->>'adx' AS adx,
    bal.timestamp,
    NOW() - bal.timestamp AS time_ago
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.timestamp > NOW() - INTERVAL '24 hours'
    AND bal.category = 'strategy'
    AND bal.level = 'info'
    AND bal.message LIKE '%Strategy conditions not met%'
ORDER BY bal.timestamp DESC
LIMIT 50;

-- ============================================
-- 4. TRADE HISTORY & DAILY LIMITS
-- ============================================
SELECT 
    '=== TRADE HISTORY & DAILY LIMITS ===' AS section;

-- Trades today per bot
SELECT 
    tb.id,
    tb.name,
    tb.status,
    COUNT(t.id) AS trades_today,
    COUNT(t.id) FILTER (WHERE t.side = 'buy') AS buy_trades_today,
    COUNT(t.id) FILTER (WHERE t.side = 'sell') AS sell_trades_today,
    MAX(t.executed_at) AS last_trade_at,
    CASE 
        WHEN tb.strategy_config->>'max_trades_per_day' IS NOT NULL 
        THEN (tb.strategy_config->>'max_trades_per_day')::int
        ELSE 8
    END AS max_trades_per_day,
    CASE 
        WHEN COUNT(t.id) >= COALESCE((tb.strategy_config->>'max_trades_per_day')::int, 8) 
        THEN '⚠️ DAILY LIMIT REACHED'
        ELSE '✅ Under limit'
    END AS limit_status
FROM trading_bots tb
LEFT JOIN trades t ON tb.id = t.bot_id 
    AND t.executed_at >= DATE_TRUNC('day', NOW())
WHERE tb.status = 'running'
GROUP BY tb.id, tb.name, tb.status, tb.strategy_config
ORDER BY trades_today DESC;

-- ============================================
-- 5. API KEY STATUS & CONFIGURATION
-- ============================================
SELECT 
    '=== API KEY STATUS ===' AS section;

SELECT 
    tb.id AS bot_id,
    tb.name AS bot_name,
    tb.exchange,
    ak.id AS api_key_id,
    ak.exchange AS api_key_exchange,
    ak.is_testnet,
    CASE 
        WHEN ak.id IS NULL THEN '❌ NO API KEY CONFIGURED'
        WHEN ak.exchange != tb.exchange THEN '⚠️ API KEY EXCHANGE MISMATCH'
        ELSE '✅ API Key OK'
    END AS api_key_status,
    ak.created_at AS api_key_created_at,
    ak.updated_at AS api_key_updated_at
FROM trading_bots tb
LEFT JOIN api_keys ak ON tb.user_id = ak.user_id AND ak.exchange = tb.exchange
WHERE tb.status = 'running'
ORDER BY tb.name;

-- ============================================
-- 6. STRATEGY CONFIGURATION CHECK
-- ============================================
SELECT 
    '=== STRATEGY CONFIGURATION ===' AS section;

SELECT 
    tb.id,
    tb.name,
    tb.exchange,
    tb.symbol,
    tb.strategy_config->>'rsiThreshold' AS rsi_threshold,
    tb.strategy_config->>'adxThreshold' AS adx_threshold,
    tb.strategy_config->>'max_trades_per_day' AS max_trades_per_day,
    tb.strategy_config->>'max_concurrent' AS max_concurrent,
    tb.strategy_config->>'useMLPrediction' AS use_ml_prediction,
    CASE 
        WHEN tb.strategy_config IS NULL OR tb.strategy_config = '{}'::jsonb 
        THEN '⚠️ NO STRATEGY CONFIGURED'
        WHEN tb.strategy_config->>'rsiThreshold' IS NULL 
        THEN '⚠️ MISSING RSI THRESHOLD'
        WHEN tb.strategy_config->>'adxThreshold' IS NULL 
        THEN '⚠️ MISSING ADX THRESHOLD'
        ELSE '✅ Strategy configured'
    END AS strategy_status
FROM trading_bots tb
WHERE tb.status = 'running'
ORDER BY tb.name;

-- ============================================
-- 7. SAFETY LIMITS & RESTRICTIONS
-- ============================================
SELECT 
    '=== SAFETY LIMITS CHECK ===' AS section;

SELECT 
    tb.id,
    tb.name,
    tb.status,
    tb.pnl,
    tb.pnl_percentage,
    tb.strategy_config->>'daily_loss_limit_pct' AS daily_loss_limit_pct,
    tb.strategy_config->>'weekly_loss_limit_pct' AS weekly_loss_limit_pct,
    CASE 
        WHEN tb.status = 'paused' THEN '⚠️ BOT IS PAUSED'
        WHEN tb.strategy_config->>'daily_loss_limit_pct' IS NOT NULL 
            AND ABS(tb.pnl_percentage) >= (tb.strategy_config->>'daily_loss_limit_pct')::numeric
        THEN '⚠️ DAILY LOSS LIMIT REACHED'
        WHEN tb.strategy_config->>'weekly_loss_limit_pct' IS NOT NULL 
            AND ABS(tb.pnl_percentage) >= (tb.strategy_config->>'weekly_loss_limit_pct')::numeric
        THEN '⚠️ WEEKLY LOSS LIMIT REACHED'
        ELSE '✅ No safety limits breached'
    END AS safety_status
FROM trading_bots tb
WHERE tb.status IN ('running', 'paused')
ORDER BY tb.name;

-- ============================================
-- 8. RECENT EXECUTION LOGS
-- ============================================
SELECT 
    '=== RECENT EXECUTION ACTIVITY ===' AS section;

SELECT 
    bal.bot_id,
    tb.name AS bot_name,
    bal.level,
    bal.category,
    bal.message,
    bal.timestamp,
    NOW() - bal.timestamp AS time_ago,
    CASE 
        WHEN bal.message LIKE '%Trading conditions met%' THEN '✅ Trade executed'
        WHEN bal.message LIKE '%Trading conditions not met%' THEN '⏸️ Waiting for conditions'
        WHEN bal.message LIKE '%Strategy conditions not met%' THEN '⏸️ Strategy conditions not met'
        WHEN bal.message LIKE '%error%' OR bal.message LIKE '%Error%' THEN '❌ Error'
        WHEN bal.message LIKE '%Failed%' OR bal.message LIKE '%failed%' THEN '❌ Failure'
        ELSE 'ℹ️ Info'
    END AS activity_type
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.timestamp > NOW() - INTERVAL '6 hours'
    AND tb.status = 'running'
ORDER BY bal.timestamp DESC
LIMIT 100;

-- ============================================
-- 9. BOT EXECUTION SUMMARY
-- ============================================
SELECT 
    '=== EXECUTION SUMMARY (LAST 24 HOURS) ===' AS section;

SELECT 
    tb.id,
    tb.name,
    tb.status,
    COUNT(DISTINCT DATE_TRUNC('hour', bal.timestamp)) AS hours_active,
    COUNT(bal.id) AS total_logs,
    COUNT(bal.id) FILTER (WHERE bal.level = 'error') AS error_count,
    COUNT(bal.id) FILTER (WHERE bal.level = 'warning') AS warning_count,
    COUNT(bal.id) FILTER (WHERE bal.message LIKE '%Trading conditions met%') AS trades_attempted,
    COUNT(bal.id) FILTER (WHERE bal.message LIKE '%Trading conditions not met%') AS conditions_not_met,
    COUNT(bal.id) FILTER (WHERE bal.category = 'strategy') AS strategy_logs,
    MAX(bal.timestamp) AS last_activity,
    COUNT(t.id) AS trades_executed
FROM trading_bots tb
LEFT JOIN bot_activity_logs bal ON tb.id = bal.bot_id 
    AND bal.timestamp > NOW() - INTERVAL '24 hours'
LEFT JOIN trades t ON tb.id = t.bot_id 
    AND t.executed_at > NOW() - INTERVAL '24 hours'
WHERE tb.status = 'running'
GROUP BY tb.id, tb.name, tb.status
ORDER BY last_activity DESC NULLS LAST;

-- ============================================
-- 10. POTENTIAL ISSUES SUMMARY
-- ============================================
SELECT 
    '=== POTENTIAL ISSUES SUMMARY ===' AS section;

WITH issues AS (
    SELECT 
        tb.id,
        tb.name,
        CASE 
            WHEN ak.id IS NULL THEN 'Missing API key'
            WHEN ak.exchange != tb.exchange THEN 'API key exchange mismatch'
            WHEN tb.strategy_config IS NULL OR tb.strategy_config = '{}'::jsonb THEN 'No strategy configured'
            WHEN tb.strategy_config->>'rsiThreshold' IS NULL THEN 'Missing RSI threshold'
            WHEN tb.strategy_config->>'adxThreshold' IS NULL THEN 'Missing ADX threshold'
            WHEN COUNT(t.id) >= COALESCE((tb.strategy_config->>'max_trades_per_day')::int, 8) 
                THEN 'Daily trade limit reached'
            WHEN tb.status = 'paused' THEN 'Bot is paused'
            WHEN COUNT(bal.id) FILTER (WHERE bal.level = 'error' AND bal.timestamp > NOW() - INTERVAL '1 hour') > 0 
                THEN 'Recent errors detected'
            WHEN MAX(bal.timestamp) < NOW() - INTERVAL '2 hours' 
                THEN 'No activity in last 2 hours'
            WHEN MAX(t.executed_at) < NOW() - INTERVAL '24 hours' 
                THEN 'No trades in last 24 hours'
            ELSE NULL
        END AS issue
    FROM trading_bots tb
    LEFT JOIN api_keys ak ON tb.user_id = ak.user_id AND ak.exchange = tb.exchange
    LEFT JOIN bot_activity_logs bal ON tb.id = bal.bot_id
    LEFT JOIN trades t ON tb.id = t.bot_id
    WHERE tb.status = 'running'
    GROUP BY tb.id, tb.name, ak.id, ak.exchange, tb.exchange, tb.strategy_config, tb.status
)
SELECT 
    name,
    issue,
    CASE 
        WHEN issue LIKE '%Missing%' OR issue LIKE '%No %' THEN '❌ CRITICAL'
        WHEN issue LIKE '%limit%' OR issue LIKE '%paused%' THEN '⚠️ WARNING'
        ELSE 'ℹ️ INFO'
    END AS severity
FROM issues
WHERE issue IS NOT NULL
ORDER BY 
    CASE 
        WHEN issue LIKE '%Missing%' OR issue LIKE '%No %' THEN 1
        WHEN issue LIKE '%limit%' OR issue LIKE '%paused%' THEN 2
        ELSE 3
    END,
    name;

-- ============================================
-- END OF DIAGNOSTIC SCRIPT
-- ============================================
SELECT 
    '=== DIAGNOSTIC COMPLETE ===' AS section,
    NOW() AS completed_at;

