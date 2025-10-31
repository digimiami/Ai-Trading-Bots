-- ============================================
-- SIMPLE BOT DIAGNOSIS - ALL INFO IN ONE QUERY
-- ============================================
-- This single query shows everything you need to know
-- Run this in Supabase SQL Editor
-- ============================================

SELECT 
    b.id,
    b.name,
    b.symbol,
    b.status,
    b.exchange,
    
    -- Trading status
    b.last_trade_at,
    CASE 
        WHEN b.last_trade_at IS NULL THEN '❌ NEVER TRADED'
        WHEN b.last_trade_at > NOW() - INTERVAL '1 hour' THEN '✅ TRADED < 1hr AGO'
        WHEN b.last_trade_at > NOW() - INTERVAL '24 hours' THEN '⚠️ LAST TRADE > 1hr AGO'
        ELSE '❌ LAST TRADE > 24hrs AGO'
    END AS trading_status,
    
    -- Safety limits
    COALESCE((b.strategy_config->>'max_trades_per_day')::int, 8) AS max_trades_per_day,
    (SELECT COUNT(*) FROM trades 
     WHERE bot_id = b.id 
     AND executed_at IS NOT NULL
     AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
     AND executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
     AND status IN ('filled', 'completed', 'closed'))::int AS trades_today,
    
    COALESCE((b.strategy_config->>'max_concurrent')::int, 2) AS max_concurrent,
    (SELECT COUNT(*) FROM trades 
     WHERE bot_id = b.id 
     AND status IN ('open', 'pending'))::int AS open_positions,
    
    -- API key status
    CASE 
        WHEN ak.id IS NULL THEN '❌ NO API KEY'
        WHEN ak.exchange != b.exchange THEN '❌ EXCHANGE MISMATCH'
        ELSE '✅ API KEY OK'
    END AS api_key_status,
    
    -- Strategy status
    CASE 
        WHEN b.strategy IS NULL OR b.strategy::text IN ('{}', '""', 'null', '') THEN '❌ NO STRATEGY'
        WHEN (b.strategy::json->>'rsiThreshold') IS NULL AND (b.strategy_config->>'rsiThreshold') IS NULL THEN '⚠️ NO RSI THRESHOLD'
        WHEN (b.strategy::json->>'adxThreshold') IS NULL AND (b.strategy_config->>'adxThreshold') IS NULL THEN '⚠️ NO ADX THRESHOLD'
        ELSE '✅ STRATEGY OK'
    END AS strategy_status,
    
    -- Recent errors (last hour)
    (SELECT COUNT(*) FROM bot_activity_logs 
     WHERE bot_id = b.id 
     AND level IN ('error', 'warning')
     AND created_at > NOW() - INTERVAL '1 hour')::int AS recent_errors_1h,
    
    -- Last activity
    (SELECT MAX(created_at) FROM bot_activity_logs 
     WHERE bot_id = b.id) AS last_activity,
    
    -- Main issue
    CASE 
        WHEN b.status != 'running' THEN 'Bot is not running'
        WHEN ak.id IS NULL THEN 'Missing API key'
        WHEN ak.exchange != b.exchange THEN 'API key exchange mismatch'
        WHEN (SELECT COUNT(*) FROM trades 
              WHERE bot_id = b.id 
              AND executed_at IS NOT NULL
              AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
              AND executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
              AND status IN ('filled', 'completed', 'closed')) >= COALESCE((b.strategy_config->>'max_trades_per_day')::int, 8)
            THEN 'Daily trade limit reached'
        WHEN (SELECT COUNT(*) FROM trades 
              WHERE bot_id = b.id 
              AND status IN ('open', 'pending')) >= COALESCE((b.strategy_config->>'max_concurrent')::int, 2)
            THEN 'Max concurrent positions reached'
        WHEN b.strategy IS NULL OR b.strategy::text IN ('{}', '""', 'null', '') THEN 'No strategy configured'
        WHEN (SELECT COUNT(*) FROM bot_activity_logs 
              WHERE bot_id = b.id 
              AND level = 'error' 
              AND created_at > NOW() - INTERVAL '1 hour') > 0
            THEN 'Recent errors detected'
        WHEN (SELECT MAX(created_at) FROM bot_activity_logs 
              WHERE bot_id = b.id) < NOW() - INTERVAL '2 hours'
            THEN 'No activity in last 2 hours'
        WHEN b.last_trade_at IS NULL THEN 'Never traded'
        WHEN b.last_trade_at < NOW() - INTERVAL '24 hours' THEN 'No trades in last 24 hours'
        ELSE 'Waiting for market conditions'
    END AS main_issue
    
FROM trading_bots b
LEFT JOIN api_keys ak ON b.user_id = ak.user_id AND ak.exchange = b.exchange
WHERE b.status = 'running'
ORDER BY 
    CASE 
        WHEN b.status != 'running' THEN 1
        WHEN ak.id IS NULL THEN 2
        WHEN (SELECT COUNT(*) FROM trades 
              WHERE bot_id = b.id 
              AND executed_at IS NOT NULL
              AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
              AND executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
              AND status IN ('filled', 'completed', 'closed')) >= COALESCE((b.strategy_config->>'max_trades_per_day')::int, 8)
            THEN 3
        ELSE 4
    END,
    b.name;

