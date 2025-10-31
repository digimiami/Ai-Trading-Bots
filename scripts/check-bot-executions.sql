-- ============================================
-- CHECK BOT EXECUTIONS & ACTIVITY
-- ============================================
-- This shows recent bot executions and what happened
-- ============================================

-- 1. Recent bot executions (last 2 hours)
SELECT 
    bal.bot_id,
    b.name AS bot_name,
    b.symbol,
    bal.category,
    bal.level,
    bal.message,
    bal.created_at,
    EXTRACT(EPOCH FROM (NOW() - bal.created_at)) / 60 AS minutes_ago,
    CASE 
        WHEN bal.message LIKE '%Trading conditions met%' OR bal.message LIKE '%order placed%' THEN '✅ TRADE EXECUTED'
        WHEN bal.message LIKE '%Strategy conditions not met%' THEN '⏸️ WAITING FOR CONDITIONS'
        WHEN bal.message LIKE '%Trading blocked%' THEN '❌ BLOCKED'
        WHEN bal.message LIKE '%execution started%' THEN '🔄 EXECUTING'
        WHEN bal.level = 'error' THEN '❌ ERROR'
        WHEN bal.level = 'warning' THEN '⚠️ WARNING'
        ELSE 'ℹ️ INFO'
    END AS activity_type
FROM bot_activity_logs bal
JOIN trading_bots b ON bal.bot_id = b.id
WHERE bal.created_at > NOW() - INTERVAL '2 hours'
    AND b.status = 'running'
    AND bal.category IN ('system', 'strategy', 'trade', 'safety', 'market')
ORDER BY bal.created_at DESC
LIMIT 50;

-- 2. Check if bots are being executed at all
SELECT 
    b.id,
    b.name,
    b.symbol,
    COUNT(bal.id) FILTER (WHERE bal.category = 'system' AND bal.message LIKE '%execution started%') AS executions_2h,
    MAX(bal.created_at) FILTER (WHERE bal.category = 'system' AND bal.message LIKE '%execution started%') AS last_execution,
    EXTRACT(EPOCH FROM (NOW() - MAX(bal.created_at) FILTER (WHERE bal.category = 'system' AND bal.message LIKE '%execution started%'))) / 60 AS minutes_since_execution,
    COUNT(bal.id) FILTER (WHERE bal.message LIKE '%Strategy conditions not met%') AS conditions_not_met_count,
    COUNT(bal.id) FILTER (WHERE bal.message LIKE '%Trading conditions met%' OR bal.message LIKE '%order placed%') AS trades_attempted,
    COUNT(bal.id) FILTER (WHERE bal.level = 'error') AS errors_count
FROM trading_bots b
LEFT JOIN bot_activity_logs bal ON b.id = bal.bot_id 
    AND bal.created_at > NOW() - INTERVAL '2 hours'
WHERE b.status = 'running'
GROUP BY b.id, b.name, b.symbol
ORDER BY last_execution DESC NULLS LAST;

-- 3. Strategy conditions not met details
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
WHERE bal.created_at > NOW() - INTERVAL '6 hours'
    AND bal.category = 'strategy'
    AND bal.level = 'info'
    AND bal.message LIKE '%Strategy conditions not met%'
    AND b.status = 'running'
ORDER BY bal.created_at DESC
LIMIT 20;

