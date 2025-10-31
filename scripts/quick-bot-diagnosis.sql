-- ============================================
-- QUICK BOT DIAGNOSIS - ALL ISSUES IN ONE VIEW
-- ============================================
-- This query shows all potential issues preventing bots from trading
-- Run this in Supabase SQL Editor for a quick overview
-- ============================================

WITH bot_stats AS (
    SELECT 
        tb.id,
        tb.name,
        tb.status,
        tb.exchange,
        tb.symbol,
        tb.last_trade_at,
        tb.strategy_config,
        COUNT(DISTINCT t.id) FILTER (WHERE t.executed_at >= DATE_TRUNC('day', NOW())) AS trades_today,
        COUNT(DISTINCT bal.id) FILTER (WHERE bal.level = 'error' AND bal.timestamp > NOW() - INTERVAL '1 hour') AS recent_errors,
        COUNT(DISTINCT bal.id) FILTER (WHERE bal.message LIKE '%Trading conditions not met%' AND bal.timestamp > NOW() - INTERVAL '6 hours') AS conditions_not_met_count,
        MAX(bal.timestamp) AS last_activity,
        MAX(bal.message) FILTER (WHERE bal.message LIKE '%Trading conditions not met%') AS last_condition_message,
        MAX(bal.details->>'reason') FILTER (WHERE bal.message LIKE '%Trading conditions not met%') AS last_condition_reason
    FROM trading_bots tb
    LEFT JOIN trades t ON tb.id = t.bot_id
    LEFT JOIN bot_activity_logs bal ON tb.id = bal.bot_id
    LEFT JOIN api_keys ak ON tb.user_id = ak.user_id AND ak.exchange = tb.exchange
    WHERE tb.status = 'running'
    GROUP BY tb.id, tb.name, tb.status, tb.exchange, tb.symbol, tb.last_trade_at, tb.strategy_config
),
issues AS (
    SELECT 
        bs.id,
        bs.name,
        bs.exchange,
        bs.symbol,
        bs.status,
        bs.last_trade_at,
        bs.trades_today,
        bs.recent_errors,
        bs.conditions_not_met_count,
        bs.last_activity,
        bs.last_condition_reason,
        CASE 
            WHEN ak.id IS NULL THEN '❌ MISSING API KEY'
            WHEN ak.exchange != bs.exchange THEN '⚠️ API KEY EXCHANGE MISMATCH'
            WHEN bs.strategy_config IS NULL OR bs.strategy_config = '{}'::jsonb THEN '❌ NO STRATEGY CONFIGURED'
            WHEN bs.strategy_config->>'rsiThreshold' IS NULL THEN '⚠️ MISSING RSI THRESHOLD'
            WHEN bs.strategy_config->>'adxThreshold' IS NULL THEN '⚠️ MISSING ADX THRESHOLD'
            WHEN bs.trades_today >= COALESCE((bs.strategy_config->>'max_trades_per_day')::int, 8) 
                THEN '⏸️ DAILY LIMIT REACHED (' || bs.trades_today || '/' || COALESCE((bs.strategy_config->>'max_trades_per_day')::int, 8) || ')'
            WHEN bs.recent_errors > 0 THEN '❌ RECENT ERRORS (' || bs.recent_errors || ')'
            WHEN bs.last_activity < NOW() - INTERVAL '2 hours' THEN '⚠️ NO ACTIVITY IN LAST 2 HOURS'
            WHEN bs.conditions_not_met_count > 0 THEN '⏸️ WAITING FOR MARKET CONDITIONS (' || bs.conditions_not_met_count || ' times in last 6h)'
            WHEN bs.last_trade_at < NOW() - INTERVAL '24 hours' THEN '⏸️ NO TRADES IN LAST 24 HOURS'
            ELSE NULL
        END AS primary_issue,
        CASE 
            WHEN bs.conditions_not_met_count > 0 THEN bs.last_condition_reason
            ELSE NULL
        END AS condition_details
    FROM bot_stats bs
    LEFT JOIN trading_bots tb ON bs.id = tb.id
    LEFT JOIN api_keys ak ON tb.user_id = ak.user_id AND ak.exchange = bs.exchange
)
SELECT 
    name AS "Bot Name",
    exchange AS "Exchange",
    symbol AS "Symbol",
    status AS "Status",
    CASE 
        WHEN last_trade_at IS NULL THEN 'Never'
        ELSE TO_CHAR(last_trade_at, 'YYYY-MM-DD HH24:MI')
    END AS "Last Trade",
    trades_today AS "Trades Today",
    CASE 
        WHEN last_activity IS NULL THEN 'None'
        ELSE TO_CHAR(last_activity, 'YYYY-MM-DD HH24:MI')
    END AS "Last Activity",
    primary_issue AS "🚨 MAIN ISSUE",
    condition_details AS "📊 Condition Details",
    recent_errors AS "Errors (1h)",
    conditions_not_met_count AS "Conditions Not Met (6h)"
FROM issues
ORDER BY 
    CASE 
        WHEN primary_issue LIKE '❌%' THEN 1
        WHEN primary_issue LIKE '⚠️%' THEN 2
        WHEN primary_issue LIKE '⏸️%' THEN 3
        ELSE 4
    END,
    name;

-- ============================================
-- RECENT STRATEGY EVALUATIONS (Last 6 Hours)
-- ============================================
SELECT 
    '=== RECENT STRATEGY EVALUATIONS ===' AS section;

SELECT 
    tb.name AS "Bot",
    bal.message AS "Message",
    bal.details->>'reason' AS "Reason",
    bal.details->>'rsi' AS "RSI",
    bal.details->>'adx' AS "ADX",
    bal.details->>'confidence' AS "Confidence",
    TO_CHAR(bal.timestamp, 'YYYY-MM-DD HH24:MI:SS') AS "Time",
    NOW() - bal.timestamp AS "Time Ago"
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.timestamp > NOW() - INTERVAL '6 hours'
    AND bal.category = 'strategy'
    AND bal.message LIKE '%conditions%'
ORDER BY bal.timestamp DESC
LIMIT 20;

-- ============================================
-- RECENT ERRORS (Last 6 Hours)
-- ============================================
SELECT 
    '=== RECENT ERRORS ===' AS section;

SELECT 
    tb.name AS "Bot",
    bal.level AS "Level",
    bal.message AS "Message",
    bal.details AS "Details",
    TO_CHAR(bal.timestamp, 'YYYY-MM-DD HH24:MI:SS') AS "Time",
    NOW() - bal.timestamp AS "Time Ago"
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.timestamp > NOW() - INTERVAL '6 hours'
    AND bal.level IN ('error', 'warning')
ORDER BY bal.timestamp DESC
LIMIT 20;

