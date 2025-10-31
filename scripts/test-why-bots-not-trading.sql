-- ============================================
-- COMPREHENSIVE TEST: Why Bots Not Trading?
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- SUMMARY: Quick Overview of All Running Bots
-- ============================================
SELECT 
    '=== SUMMARY: ALL RUNNING BOTS ===' AS section;

SELECT 
    b.id,
    b.name,
    b.symbol,
    b.status,
    b.exchange,
    CASE 
        WHEN b.status != 'running' THEN '❌ NOT RUNNING'
        WHEN b.status = 'running' THEN '✅ RUNNING'
        ELSE '⚠️ ' || UPPER(b.status)
    END AS status_display,
    b.last_trade_at,
    CASE 
        WHEN b.last_trade_at IS NULL THEN '❌ NEVER TRADED'
        WHEN b.last_trade_at > NOW() - INTERVAL '1 hour' THEN '✅ TRADED RECENTLY (< 1hr)'
        WHEN b.last_trade_at > NOW() - INTERVAL '24 hours' THEN '⚠️ LAST TRADE > 1hr AGO'
        WHEN b.last_trade_at > NOW() - INTERVAL '7 days' THEN '⚠️ LAST TRADE > 1 DAY AGO'
        ELSE '❌ LAST TRADE > 7 DAYS AGO'
    END AS trading_status
FROM trading_bots b
WHERE b.status = 'running'
ORDER BY b.last_trade_at DESC NULLS LAST;

-- ============================================
-- 1. SAFETY LIMITS CHECK
-- ============================================
SELECT 
    '=== 1. SAFETY LIMITS CHECK ===' AS section;

WITH bot_safety AS (
    SELECT 
        b.id,
        b.name,
        b.symbol,
        -- Get safety limits
        COALESCE((b.strategy_config->>'max_trades_per_day')::int, 8) as max_trades_per_day,
        COALESCE((b.strategy_config->>'max_consecutive_losses')::int, 5) as max_consecutive_losses,
        COALESCE((b.strategy_config->>'daily_loss_limit_pct')::numeric, 10.0) as daily_loss_limit_pct,
        COALESCE((b.strategy_config->>'weekly_loss_limit_pct')::numeric, 20.0) as weekly_loss_limit_pct,
        COALESCE((b.strategy_config->>'max_concurrent')::int, 2) as max_concurrent,
        -- Calculate current stats (EXACT MATCH to bot-executor logic)
        (SELECT COUNT(*) FROM trades 
         WHERE bot_id = b.id 
         AND executed_at IS NOT NULL
         AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
         AND executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
         AND status IN ('filled', 'completed', 'closed'))::int as trades_today,
        (SELECT COUNT(*) FROM trades 
         WHERE bot_id = b.id 
         AND status IN ('open', 'pending'))::int as open_positions,
        (SELECT COALESCE(SUM(ABS(CASE WHEN pnl < 0 THEN pnl ELSE 0 END)), 0) 
         FROM trades 
         WHERE bot_id = b.id 
         AND executed_at IS NOT NULL
         AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
         AND executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
         AND status IN ('filled', 'completed', 'closed'))::numeric as daily_loss,
        (SELECT COALESCE(SUM(ABS(CASE WHEN pnl < 0 THEN pnl ELSE 0 END)), 0) 
         FROM trades 
         WHERE bot_id = b.id 
         AND executed_at IS NOT NULL
         AND executed_at >= DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC')
         AND status IN ('filled', 'completed', 'closed'))::numeric as weekly_loss
    FROM trading_bots b
    WHERE b.status = 'running'
)
SELECT 
    bot_safety.id,
    bot_safety.name,
    bot_safety.symbol,
    bot_safety.trades_today || '/' || bot_safety.max_trades_per_day AS trades_status,
    bot_safety.open_positions || '/' || bot_safety.max_concurrent AS positions_status,
    ROUND(bot_safety.daily_loss::numeric, 2) || ' USD' AS daily_loss,
    ROUND(bot_safety.weekly_loss::numeric, 2) || ' USD' AS weekly_loss,
    CASE 
        WHEN bot_safety.trades_today >= bot_safety.max_trades_per_day THEN '❌ TRADES LIMIT REACHED'
        WHEN bot_safety.open_positions >= bot_safety.max_concurrent THEN '❌ POSITIONS LIMIT REACHED'
        WHEN bot_safety.daily_loss > 0 AND bot_safety.daily_loss_limit_pct > 0 
            AND (bot_safety.daily_loss / NULLIF(b.trade_amount * bot_safety.max_trades_per_day, 0) * 100) >= bot_safety.daily_loss_limit_pct
            THEN '❌ DAILY LOSS LIMIT REACHED'
        ELSE '✅ OK'
    END AS safety_status
FROM bot_safety
JOIN trading_bots b ON bot_safety.id = b.id
ORDER BY 
    CASE 
        WHEN bot_safety.trades_today >= bot_safety.max_trades_per_day THEN 1
        WHEN bot_safety.open_positions >= bot_safety.max_concurrent THEN 2
        ELSE 3
    END,
    bot_safety.name;

-- ============================================
-- 2. API KEYS & EXCHANGE CONFIGURATION
-- ============================================
SELECT 
    '=== 2. API KEYS & EXCHANGE CHECK ===' AS section;

SELECT 
    b.id,
    b.name,
    b.exchange,
    b.symbol,
    ak.id AS api_key_id,
    ak.is_testnet,
    CASE 
        WHEN ak.id IS NULL THEN '❌ NO API KEY'
        WHEN ak.exchange != b.exchange THEN '❌ EXCHANGE MISMATCH'
        WHEN ak.is_testnet IS NULL THEN '⚠️ TESTNET STATUS UNKNOWN'
        ELSE '✅ API KEY OK'
    END AS api_key_status
FROM trading_bots b
LEFT JOIN api_keys ak ON b.user_id = ak.user_id AND ak.exchange = b.exchange
WHERE b.status = 'running'
ORDER BY 
    CASE 
        WHEN ak.id IS NULL THEN 1
        WHEN ak.exchange != b.exchange THEN 2
        ELSE 3
    END,
    b.name;

-- ============================================
-- 3. STRATEGY CONDITIONS CHECK
-- ============================================
SELECT 
    '=== 3. STRATEGY CONFIGURATION ===' AS section;

SELECT 
    b.id,
    b.name,
    b.symbol,
    COALESCE((b.strategy::json->>'rsiThreshold')::numeric, (b.strategy_config->>'rsiThreshold')::numeric, 70) as rsi_threshold,
    COALESCE((b.strategy::json->>'adxThreshold')::numeric, (b.strategy_config->>'adxThreshold')::numeric, 25) as adx_threshold,
    CASE 
        WHEN b.strategy IS NULL OR b.strategy::text IN ('{}', '""', 'null', '') THEN '❌ NO STRATEGY'
        WHEN (b.strategy::json->>'rsiThreshold') IS NULL AND (b.strategy_config->>'rsiThreshold') IS NULL THEN '⚠️ NO RSI THRESHOLD'
        WHEN (b.strategy::json->>'adxThreshold') IS NULL AND (b.strategy_config->>'adxThreshold') IS NULL THEN '⚠️ NO ADX THRESHOLD'
        ELSE '✅ STRATEGY OK'
    END AS strategy_status
FROM trading_bots b
WHERE b.status = 'running'
ORDER BY 
    CASE 
        WHEN b.strategy IS NULL OR b.strategy::text IN ('{}', '""', 'null', '') THEN 1
        ELSE 2
    END,
    b.name;

-- ============================================
-- 4. RECENT ERRORS & WARNINGS (Last 6 Hours)
-- ============================================
SELECT 
    '=== 4. RECENT ERRORS & WARNINGS (Last 6h) ===' AS section;

SELECT 
    bal.bot_id,
    b.name AS bot_name,
    bal.level,
    bal.category,
    bal.message,
    bal.created_at,
    EXTRACT(EPOCH FROM (NOW() - bal.created_at)) / 60 AS minutes_ago,
    CASE 
        WHEN bal.message LIKE '%insufficient balance%' OR bal.message LIKE '%not enough%' THEN '❌ BALANCE ISSUE'
        WHEN bal.message LIKE '%Strategy conditions not met%' THEN '⏸️ STRATEGY CONDITIONS'
        WHEN bal.message LIKE '%safety%' OR bal.message LIKE '%limit%' THEN '⚠️ SAFETY LIMIT'
        WHEN bal.level = 'error' THEN '❌ ERROR'
        WHEN bal.level = 'warning' THEN '⚠️ WARNING'
        ELSE 'ℹ️ INFO'
    END AS issue_type
FROM bot_activity_logs bal
JOIN trading_bots b ON bal.bot_id = b.id
WHERE bal.created_at > NOW() - INTERVAL '6 hours'
    AND bal.level IN ('error', 'warning')
    AND b.status = 'running'
ORDER BY bal.created_at DESC
LIMIT 50;

-- ============================================
-- 5. STRATEGY CONDITIONS NOT MET (Last 24h)
-- ============================================
SELECT 
    '=== 5. STRATEGY CONDITIONS NOT MET ===' AS section;

SELECT 
    bal.bot_id,
    b.name AS bot_name,
    b.symbol,
    bal.message,
    bal.details->>'reason' AS reason,
    bal.details->>'rsi' AS rsi,
    bal.details->>'adx' AS adx,
    bal.details->>'confidence' AS confidence,
    bal.created_at,
    EXTRACT(EPOCH FROM (NOW() - bal.created_at)) / 60 AS minutes_ago
FROM bot_activity_logs bal
JOIN trading_bots b ON bal.bot_id = b.id
WHERE bal.created_at > NOW() - INTERVAL '24 hours'
    AND bal.category = 'strategy'
    AND bal.level = 'info'
    AND bal.message LIKE '%Strategy conditions not met%'
    AND b.status = 'running'
ORDER BY bal.created_at DESC
LIMIT 20;

-- ============================================
-- 6. RECENT EXECUTION ACTIVITY (Last 24h)
-- ============================================
SELECT 
    '=== 6. RECENT EXECUTION ACTIVITY ===' AS section;

SELECT 
    bal.bot_id,
    b.name AS bot_name,
    b.symbol,
    COUNT(*) FILTER (WHERE bal.message LIKE '%Trading conditions met%' OR bal.message LIKE '%order placed%') AS trades_attempted,
    COUNT(*) FILTER (WHERE bal.message LIKE '%Strategy conditions not met%') AS conditions_not_met,
    COUNT(*) FILTER (WHERE bal.level = 'error') AS errors,
    COUNT(*) FILTER (WHERE bal.level = 'warning') AS warnings,
    MAX(bal.created_at) AS last_activity,
    EXTRACT(EPOCH FROM (NOW() - MAX(bal.created_at))) / 60 AS minutes_since_last_activity
FROM bot_activity_logs bal
JOIN trading_bots b ON bal.bot_id = b.id
WHERE bal.created_at > NOW() - INTERVAL '24 hours'
    AND b.status = 'running'
GROUP BY bal.bot_id, b.name, b.symbol
ORDER BY last_activity DESC NULLS LAST;

-- ============================================
-- 7. TRADES TODAY vs LIMITS
-- ============================================
SELECT 
    '=== 7. TRADES TODAY vs LIMITS ===' AS section;

SELECT 
    b.id,
    b.name,
    b.symbol,
    COUNT(t.id) FILTER (
        WHERE t.executed_at IS NOT NULL
        AND t.executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
        AND t.executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
        AND t.status IN ('filled', 'completed', 'closed')
    ) AS trades_today,
    COALESCE((b.strategy_config->>'max_trades_per_day')::int, 8) AS max_trades_per_day,
    MAX(t.executed_at) AS last_trade_at,
    CASE 
        WHEN COUNT(t.id) FILTER (
            WHERE t.executed_at IS NOT NULL
            AND t.executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
            AND t.executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
            AND t.status IN ('filled', 'completed', 'closed')
        ) >= COALESCE((b.strategy_config->>'max_trades_per_day')::int, 8)
        THEN '❌ LIMIT REACHED'
        ELSE '✅ UNDER LIMIT'
    END AS limit_status
FROM trading_bots b
LEFT JOIN trades t ON b.id = t.bot_id
WHERE b.status = 'running'
GROUP BY b.id, b.name, b.symbol, b.strategy_config
ORDER BY trades_today DESC;

-- ============================================
-- 8. POTENTIAL ISSUES SUMMARY
-- ============================================
SELECT 
    '=== 8. POTENTIAL ISSUES SUMMARY ===' AS section;

WITH issues AS (
    SELECT 
        b.id,
        b.name,
        b.symbol,
        b.status,
        -- Check for various issues
        CASE 
            WHEN b.status != 'running' THEN 'Bot is not running'
            WHEN ak.id IS NULL THEN 'Missing API key'
            WHEN ak.exchange != b.exchange THEN 'API key exchange mismatch'
            WHEN COUNT(t.id) FILTER (
                WHERE t.executed_at IS NOT NULL
                AND t.executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
                AND t.executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
                AND t.status IN ('filled', 'completed', 'closed')
            ) >= COALESCE((b.strategy_config->>'max_trades_per_day')::int, 8)
            THEN 'Daily trade limit reached'
            WHEN COUNT(t.id) FILTER (WHERE t.status IN ('open', 'pending')) >= COALESCE((b.strategy_config->>'max_concurrent')::int, 2)
            THEN 'Max concurrent positions reached'
            WHEN b.strategy IS NULL OR b.strategy::text IN ('{}', '""', 'null', '') THEN 'No strategy configured'
            WHEN (SELECT COUNT(*) FROM bot_activity_logs 
                  WHERE bot_id = b.id 
                  AND level = 'error' 
                  AND created_at > NOW() - INTERVAL '1 hour') > 0
            THEN 'Recent errors detected'
            WHEN MAX(bal.created_at) < NOW() - INTERVAL '2 hours'
            THEN 'No activity in last 2 hours'
            WHEN b.last_trade_at IS NULL THEN 'Never traded'
            WHEN b.last_trade_at < NOW() - INTERVAL '24 hours'
            THEN 'No trades in last 24 hours'
            ELSE NULL
        END AS issue
    FROM trading_bots b
    LEFT JOIN api_keys ak ON b.user_id = ak.user_id AND ak.exchange = b.exchange
    LEFT JOIN trades t ON b.id = t.bot_id
    LEFT JOIN bot_activity_logs bal ON b.id = bal.bot_id
    WHERE b.status = 'running'
    GROUP BY b.id, b.name, b.symbol, b.status, ak.id, ak.exchange, b.strategy, b.strategy_config, b.last_trade_at
)
SELECT 
    name,
    symbol,
    issue,
    CASE 
        WHEN issue LIKE '%limit%' OR issue LIKE '%reached%' THEN '⚠️ LIMIT'
        WHEN issue LIKE '%Missing%' OR issue LIKE '%No %' OR issue LIKE '%Never%' THEN '❌ CRITICAL'
        WHEN issue LIKE '%error%' OR issue LIKE '%activity%' THEN '⚠️ WARNING'
        ELSE 'ℹ️ INFO'
    END AS severity
FROM issues
WHERE issue IS NOT NULL
ORDER BY 
    CASE 
        WHEN issue LIKE '%Missing%' OR issue LIKE '%No %' OR issue LIKE '%Never%' THEN 1
        WHEN issue LIKE '%limit%' OR issue LIKE '%reached%' THEN 2
        ELSE 3
    END,
    name;

-- ============================================
-- END OF DIAGNOSTIC TEST
-- ============================================
SELECT 
    '=== TEST COMPLETE ===' AS section,
    NOW() AS completed_at;

