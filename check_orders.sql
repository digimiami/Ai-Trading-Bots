-- ============================================
-- SQL Script to Check Trades Being Placed
-- Pablo AI Trading Bot
-- ============================================

-- 1. Check recent trades (last 24 hours)
SELECT 
    id,
    bot_id,
    user_id,
    exchange,
    symbol,
    side,
    amount,
    price,
    status,
    order_id,
    executed_at,
    created_at,
    updated_at
FROM trades
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- ============================================
-- 2. Count trades by status
SELECT 
    status,
    COUNT(*) as count,
    MIN(created_at) as first_trade,
    MAX(created_at) as last_trade
FROM trades
GROUP BY status
ORDER BY count DESC;

-- ============================================
-- 3. Count trades by exchange
SELECT 
    exchange,
    COUNT(*) as total_trades,
    SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END) as filled,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
FROM trades
GROUP BY exchange
ORDER BY total_trades DESC;

-- ============================================
-- 4. Count trades by bot
SELECT 
    b.name as bot_name,
    b.id as bot_id,
    COUNT(t.id) as total_trades,
    SUM(CASE WHEN t.status = 'filled' THEN 1 ELSE 0 END) as filled_trades,
    SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending_trades,
    SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed_trades,
    MAX(t.created_at) as last_trade_time
FROM trading_bots b
LEFT JOIN trades t ON b.id = t.bot_id
GROUP BY b.id, b.name
ORDER BY total_trades DESC;

-- ============================================
-- 5. Trades by symbol (last 7 days)
SELECT 
    symbol,
    exchange,
    COUNT(*) as total_trades,
    SUM(CASE WHEN side = 'buy' OR side = 'Buy' THEN 1 ELSE 0 END) as buy_trades,
    SUM(CASE WHEN side = 'sell' OR side = 'Sell' THEN 1 ELSE 0 END) as sell_trades,
    SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END) as filled,
    SUM(amount::numeric) as total_amount
FROM trades
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY symbol, exchange
ORDER BY total_trades DESC;

-- ============================================
-- 6. Trade success rate by bot (last 30 days)
SELECT 
    b.name as bot_name,
    b.exchange,
    b.symbol,
    COUNT(t.id) as total_trades,
    SUM(CASE WHEN t.status = 'filled' THEN 1 ELSE 0 END) as successful,
    SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed,
    ROUND(
        (SUM(CASE WHEN t.status = 'filled' THEN 1 ELSE 0 END)::numeric / 
         NULLIF(COUNT(t.id), 0) * 100), 
        2
    ) as success_rate_percentage
FROM trading_bots b
LEFT JOIN trades t ON b.id = t.bot_id 
    AND t.created_at >= NOW() - INTERVAL '30 days'
WHERE b.status IN ('running', 'paused')
GROUP BY b.id, b.name, b.exchange, b.symbol
ORDER BY total_trades DESC;

-- ============================================
-- 7. Most recent trades with bot details
SELECT 
    t.id as trade_id,
    t.created_at,
    t.executed_at,
    b.name as bot_name,
    b.exchange,
    t.symbol,
    t.side,
    t.amount,
    t.price,
    t.status,
    t.order_id
FROM trades t
LEFT JOIN trading_bots b ON t.bot_id = b.id
ORDER BY t.created_at DESC
LIMIT 50;

-- ============================================
-- 8. Trades placed in the last hour (for real-time monitoring)
SELECT 
    t.id,
    t.created_at,
    b.name as bot_name,
    t.exchange,
    t.symbol,
    t.side,
    t.amount,
    t.price,
    t.status,
    EXTRACT(EPOCH FROM (NOW() - t.created_at)) as seconds_ago
FROM trades t
LEFT JOIN trading_bots b ON t.bot_id = b.id
WHERE t.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY t.created_at DESC;

-- ============================================
-- 9. Check if any trades were placed today
SELECT 
    DATE(created_at) as trade_date,
    COUNT(*) as total_trades,
    SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END) as filled,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
    STRING_AGG(DISTINCT exchange, ', ') as exchanges_used
FROM trades
WHERE created_at >= CURRENT_DATE
GROUP BY DATE(created_at);

-- ============================================
-- 10. Trade volume by hour (today)
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as trades_count,
    SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END) as successful,
    SUM(amount::numeric) FILTER (WHERE status = 'filled') as total_amount_traded,
    STRING_AGG(DISTINCT symbol, ', ') as symbols_traded
FROM trades
WHERE created_at >= CURRENT_DATE
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- ============================================
-- 11. Trade Summary
SELECT 
    'Today' as period,
    COUNT(*) as total_trades,
    SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END) as filled,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
    SUM(amount::numeric) FILTER (WHERE status = 'filled') as total_volume
FROM trades
WHERE created_at >= CURRENT_DATE
UNION ALL
SELECT 
    'Last 7 Days',
    COUNT(*),
    SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END),
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END),
    SUM(amount::numeric) FILTER (WHERE status = 'filled')
FROM trades
WHERE created_at >= NOW() - INTERVAL '7 days'
UNION ALL
SELECT 
    'Last 30 Days',
    COUNT(*),
    SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END),
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END),
    SUM(amount::numeric) FILTER (WHERE status = 'filled')
FROM trades
WHERE created_at >= NOW() - INTERVAL '30 days';

-- ============================================
-- QUICK CHECK: Latest trade status
SELECT 
    'Latest Trade' as info,
    t.id as trade_id,
    t.created_at,
    b.name as bot_name,
    t.exchange,
    t.symbol,
    t.side,
    t.amount,
    t.price,
    t.status,
    t.order_id
FROM trades t
LEFT JOIN trading_bots b ON t.bot_id = b.id
ORDER BY t.created_at DESC
LIMIT 1;

-- ============================================
-- Active Bots with Trade Count
SELECT 
    b.name,
    b.exchange,
    b.symbol,
    b.status,
    b.total_trades as bot_total_trades,
    COUNT(t.id) as recent_trades_24h,
    SUM(CASE WHEN t.status = 'filled' THEN 1 ELSE 0 END) as filled_24h
FROM trading_bots b
LEFT JOIN trades t ON b.id = t.bot_id AND t.created_at >= NOW() - INTERVAL '24 hours'
WHERE b.status IN ('running', 'paused')
GROUP BY b.id, b.name, b.exchange, b.symbol, b.status, b.total_trades
ORDER BY recent_trades_24h DESC;

-- ============================================
-- Failed Trades with Details (if any)
SELECT 
    t.id,
    t.created_at,
    b.name as bot_name,
    t.exchange,
    t.symbol,
    t.side,
    t.amount,
    t.price,
    t.status,
    t.exchange_response
FROM trades t
LEFT JOIN trading_bots b ON t.bot_id = b.id
WHERE t.status = 'failed'
ORDER BY t.created_at DESC
LIMIT 20;
