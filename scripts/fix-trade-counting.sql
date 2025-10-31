-- ============================================
-- Fix Trade Counting Issues
-- This script helps diagnose and fix trade counting
-- ============================================

-- 1. Check for trades with NULL executed_at (old trades that might be counted incorrectly)
SELECT 
    bot_id,
    COUNT(*) as trades_with_null_executed_at,
    MIN(created_at) as oldest_trade,
    MAX(created_at) as newest_trade
FROM trades
WHERE executed_at IS NULL
GROUP BY bot_id
ORDER BY trades_with_null_executed_at DESC;

-- 2. Fix old trades: Set executed_at = created_at for trades with NULL executed_at
-- UNCOMMENT THIS TO RUN:
/*
UPDATE trades
SET executed_at = created_at
WHERE executed_at IS NULL
AND status IN ('filled', 'completed', 'closed');
*/

-- 3. Check today's trades (corrected count)
SELECT 
    b.id,
    b.name,
    b.symbol,
    -- Corrected count (matching function logic)
    (SELECT COUNT(*) FROM trades 
     WHERE bot_id = b.id 
     AND executed_at IS NOT NULL
     AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
     AND executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
     AND status IN ('filled', 'completed', 'closed'))::int as trades_today_corrected,
    -- Old count (for comparison)
    (SELECT COUNT(*) FROM trades 
     WHERE bot_id = b.id 
     AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC'))::int as trades_today_old_method,
    -- Limit
    COALESCE((b.strategy_config->>'max_trades_per_day')::int, 8) as max_trades_per_day
FROM trading_bots b
WHERE b.status = 'running'
ORDER BY trades_today_corrected DESC;

-- 4. Reset bot status if bots were incorrectly paused
-- Check which bots should be unpaused (trades_today < max_trades_per_day)
WITH bot_stats AS (
    SELECT 
        b.id,
        b.name,
        b.status,
        COALESCE((b.strategy_config->>'max_trades_per_day')::int, 8) as max_trades_per_day,
        (SELECT COUNT(*) FROM trades 
         WHERE bot_id = b.id 
         AND executed_at IS NOT NULL
         AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
         AND executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
         AND status IN ('filled', 'completed', 'closed'))::int as trades_today
    FROM trading_bots b
)
SELECT 
    id,
    name,
    status,
    trades_today,
    max_trades_per_day,
    CASE 
        WHEN trades_today < max_trades_per_day AND status = 'paused' 
        THEN 'SHOULD BE RUNNING'
        ELSE 'OK'
    END as recommendation
FROM bot_stats
WHERE status = 'paused'
ORDER BY recommendation DESC;

-- 5. Unpause bots that were incorrectly paused
-- UNCOMMENT THIS TO RUN:
/*
UPDATE trading_bots
SET status = 'running',
    updated_at = NOW()
WHERE id IN (
    SELECT b.id
    FROM trading_bots b
    WHERE b.status = 'paused'
    AND COALESCE((b.strategy_config->>'max_trades_per_day')::int, 8) > (
        SELECT COUNT(*) FROM trades 
        WHERE bot_id = b.id 
        AND executed_at IS NOT NULL
        AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
        AND executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
        AND status IN ('filled', 'completed', 'closed')
    )
);
*/

