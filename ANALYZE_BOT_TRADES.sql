-- ============================================
-- Analyze Bot Trades for Bot ID: 91be4053-28a4-4a11-9738-7871a5387c71
-- Compare Bybit transaction log with database records
-- ============================================

-- 1. Bot Configuration
SELECT 
    id,
    name,
    symbol,
    status,
    COALESCE((strategy_config->>'max_trades_per_day')::int, 8) as max_trades_per_day,
    last_trade_at,
    total_trades,
    created_at
FROM trading_bots
WHERE id = '91be4053-28a4-4a11-9738-7871a5387c71';

-- 2. Today's Trades Count (as calculated by bot-executor)
SELECT 
    COUNT(*) as trades_today,
    COUNT(DISTINCT DATE_TRUNC('hour', executed_at)) as unique_hours,
    MIN(executed_at) as first_trade_today,
    MAX(executed_at) as last_trade_today
FROM trades
WHERE bot_id = '91be4053-28a4-4a11-9738-7871a5387c71'
  AND executed_at IS NOT NULL
  AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
  AND executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
  AND status IN ('filled', 'completed', 'closed');

-- 3. All Trades Today (Detailed)
SELECT 
    id,
    side,
    amount,
    price,
    status,
    executed_at,
    exchange_order_id,
    pnl,
    fee
FROM trades
WHERE bot_id = '91be4053-28a4-4a11-9738-7871a5387c71'
  AND executed_at IS NOT NULL
  AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
  AND executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
ORDER BY executed_at DESC
LIMIT 50;

-- 4. Trades by Status
SELECT 
    status,
    COUNT(*) as count,
    SUM(amount) as total_amount,
    SUM(COALESCE(pnl, 0)) as total_pnl,
    SUM(COALESCE(fee, 0)) as total_fees
FROM trades
WHERE bot_id = '91be4053-28a4-4a11-9738-7871a5387c71'
  AND executed_at IS NOT NULL
  AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
  AND executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
GROUP BY status
ORDER BY count DESC;

-- 5. Recent Trades (Last 24 hours)
SELECT 
    COUNT(*) as trades_last_24h,
    COUNT(DISTINCT DATE_TRUNC('hour', executed_at)) as unique_hours,
    MIN(executed_at) as first_trade,
    MAX(executed_at) as last_trade
FROM trades
WHERE bot_id = '91be4053-28a4-4a11-9738-7871a5387c71'
  AND executed_at IS NOT NULL
  AND executed_at >= NOW() - INTERVAL '24 hours'
  AND status IN ('filled', 'completed', 'closed');

-- 6. Check for Duplicate Trades (same exchange_order_id)
SELECT 
    exchange_order_id,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ') as trade_ids,
    STRING_AGG(executed_at::text, ', ') as executed_times
FROM trades
WHERE bot_id = '91be4053-28a4-4a11-9738-7871a5387c71'
  AND exchange_order_id IS NOT NULL
  AND executed_at IS NOT NULL
  AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
  AND executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
GROUP BY exchange_order_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 7. Trades by Hour (to see trading pattern)
SELECT 
    DATE_TRUNC('hour', executed_at) as hour,
    COUNT(*) as trades_in_hour,
    COUNT(DISTINCT side) as unique_sides,
    SUM(amount) as total_amount
FROM trades
WHERE bot_id = '91be4053-28a4-4a11-9738-7871a5387c71'
  AND executed_at IS NOT NULL
  AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
  AND executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
  AND status IN ('filled', 'completed', 'closed')
GROUP BY DATE_TRUNC('hour', executed_at)
ORDER BY hour DESC;

