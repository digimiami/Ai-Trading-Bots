-- ============================================
-- Check Active Bots Settings
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. List all running bots with basic info
SELECT 
    id,
    name,
    status,
    exchange,
    symbol,
    trading_type,
    base_amount,
    leverage,
    risk_level,
    created_at,
    updated_at,
    last_execution_at
FROM trading_bots
WHERE status = 'running'
ORDER BY created_at DESC;

-- ============================================
-- 2. Detailed bot configurations
-- ============================================
SELECT 
    b.id,
    b.name,
    b.status,
    b.exchange,
    b.symbol,
    b.trading_type,
    b.base_amount,
    b.leverage,
    b.risk_level,
    b.strategy::text as strategy_config,
    b.strategy_config::text as advanced_config,
    b.created_at,
    b.updated_at
FROM trading_bots b
WHERE b.status = 'running'
ORDER BY b.created_at DESC;

-- ============================================
-- 3. Safety settings for active bots
-- ============================================
SELECT 
    b.id,
    b.name,
    b.status,
    -- Extract safety settings from strategy_config JSON
    COALESCE((b.strategy_config->>'max_consecutive_losses')::int, 5) as max_consecutive_losses,
    COALESCE((b.strategy_config->>'daily_loss_limit_pct')::numeric, 10.0) as daily_loss_limit_pct,
    COALESCE((b.strategy_config->>'weekly_loss_limit_pct')::numeric, 20.0) as weekly_loss_limit_pct,
    COALESCE((b.strategy_config->>'max_trades_per_day')::int, 10) as max_trades_per_day,
    COALESCE((b.strategy_config->>'max_concurrent')::int, 3) as max_concurrent_positions
FROM trading_bots b
WHERE b.status = 'running'
ORDER BY b.created_at DESC;

-- ============================================
-- 4. Bot activity summary (last 24 hours)
-- ============================================
SELECT 
    b.id,
    b.name,
    b.symbol,
    COUNT(t.id) as trades_24h,
    SUM(CASE WHEN t.pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
    SUM(CASE WHEN t.pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
    SUM(COALESCE(t.pnl, 0)) as total_pnl_24h,
    MAX(t.executed_at) as last_trade_time
FROM trading_bots b
LEFT JOIN trades t ON b.id = t.bot_id 
    AND t.executed_at >= NOW() - INTERVAL '24 hours'
WHERE b.status = 'running'
GROUP BY b.id, b.name, b.symbol
ORDER BY trades_24h DESC;

-- ============================================
-- 5. Current safety limit status
-- ============================================
WITH bot_stats AS (
    SELECT 
        b.id as bot_id,
        b.name,
        b.symbol,
        -- Get safety limits from config
        COALESCE((b.strategy_config->>'max_consecutive_losses')::int, 5) as max_consecutive_losses,
        COALESCE((b.strategy_config->>'daily_loss_limit_pct')::numeric, 10.0) as daily_loss_limit_pct,
        COALESCE((b.strategy_config->>'weekly_loss_limit_pct')::numeric, 20.0) as weekly_loss_limit_pct,
        COALESCE((b.strategy_config->>'max_trades_per_day')::int, 10) as max_trades_per_day,
        COALESCE((b.strategy_config->>'max_concurrent')::int, 3) as max_concurrent_positions,
        -- Calculate current stats
        (SELECT COUNT(*) FROM trades 
         WHERE bot_id = b.id 
         AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC'))::int as trades_today,
        (SELECT COUNT(*) FROM trades 
         WHERE bot_id = b.id 
         AND status IN ('open', 'pending')
         AND executed_at IS NOT NULL)::int as open_positions,
        (SELECT SUM(CASE WHEN pnl < 0 THEN ABS(pnl) ELSE 0 END) 
         FROM trades 
         WHERE bot_id = b.id 
         AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC'))::numeric as daily_loss,
        (SELECT SUM(CASE WHEN pnl < 0 THEN ABS(pnl) ELSE 0 END) 
         FROM trades 
         WHERE bot_id = b.id 
         AND executed_at >= DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC'))::numeric as weekly_loss
    FROM trading_bots b
    WHERE b.status = 'running'
)
SELECT 
    bot_id,
    name,
    symbol,
    trades_today || '/' || max_trades_per_day as trades_limit_status,
    open_positions || '/' || max_concurrent_positions as positions_limit_status,
    ROUND(daily_loss::numeric, 2) as daily_loss_usd,
    ROUND(weekly_loss::numeric, 2) as weekly_loss_usd,
    CASE 
        WHEN trades_today >= max_trades_per_day THEN '⚠️ TRADES LIMIT REACHED'
        WHEN open_positions >= max_concurrent_positions THEN '⚠️ POSITIONS LIMIT REACHED'
        ELSE '✅ OK'
    END as status
FROM bot_stats
ORDER BY name;

-- ============================================
-- 6. Recent bot executions (last 10)
-- ============================================
SELECT 
    id,
    bot_id,
    level,
    category,
    message,
    created_at
FROM bot_logs
WHERE bot_id IN (SELECT id FROM trading_bots WHERE status = 'running')
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- 7. Strategy thresholds for active bots
-- ============================================
SELECT 
    b.id,
    b.name,
    b.symbol,
    -- Extract from strategy JSON
    COALESCE((b.strategy::json->>'rsiThreshold')::numeric, NULL) as rsi_threshold,
    COALESCE((b.strategy::json->>'adxThreshold')::numeric, NULL) as adx_threshold,
    COALESCE((b.strategy_config->>'rsiThreshold')::numeric, NULL) as config_rsi_threshold,
    COALESCE((b.strategy_config->>'adxThreshold')::numeric, NULL) as config_adx_threshold
FROM trading_bots b
WHERE b.status = 'running'
ORDER BY b.name;

-- ============================================
-- 8. Complete bot settings overview
-- ============================================
SELECT 
    b.id,
    b.name,
    b.status,
    b.exchange,
    b.symbol,
    b.trading_type,
    b.base_amount,
    b.leverage,
    b.risk_level,
    b.strategy::text as strategy_json,
    b.strategy_config::text as advanced_config_json,
    b.created_at,
    b.updated_at,
    b.last_execution_at,
    -- Count stats
    (SELECT COUNT(*) FROM trades WHERE bot_id = b.id) as total_trades,
    (SELECT COUNT(*) FROM trades WHERE bot_id = b.id AND status IN ('open', 'pending')) as open_positions,
    (SELECT SUM(COALESCE(pnl, 0)) FROM trades WHERE bot_id = b.id) as total_pnl
FROM trading_bots b
WHERE b.status = 'running'
ORDER BY b.created_at DESC;

