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
    size as quantity,
    entry_price as price,
    exit_price,
    pnl,
    status,
    timestamp as executed_at,
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
    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
    SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_positions
FROM trades
GROUP BY exchange
ORDER BY total_trades DESC;

-- ============================================
-- 4. Count trades by bot
SELECT 
    b.name as bot_name,
    b.id as bot_id,
    COUNT(t.id) as total_trades,
    SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END) as closed_trades,
    SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END) as open_positions,
    SUM(t.pnl) as total_pnl,
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
    SUM(CASE WHEN side = 'long' THEN 1 ELSE 0 END) as long_trades,
    SUM(CASE WHEN side = 'short' THEN 1 ELSE 0 END) as short_trades,
    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
    SUM(size) as total_size,
    SUM(pnl) FILTER (WHERE status = 'closed') as total_pnl
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
    SUM(CASE WHEN t.status = 'closed' AND t.pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
    SUM(CASE WHEN t.status = 'closed' AND t.pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
    SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END) as open_positions,
    ROUND(
        (SUM(CASE WHEN t.status = 'closed' AND t.pnl > 0 THEN 1 ELSE 0 END)::numeric / 
         NULLIF(SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END), 0) * 100), 
        2
    ) as win_rate_percentage,
    SUM(t.pnl) FILTER (WHERE t.status = 'closed') as total_pnl
FROM trading_bots b
LEFT JOIN trades t ON b.id = t.bot_id 
    AND t.created_at >= NOW() - INTERVAL '30 days'
WHERE b.status = 'running'
GROUP BY b.id, b.name, b.exchange, b.symbol
ORDER BY total_trades DESC;

-- ============================================
-- 7. Most recent trades with bot details
SELECT 
    t.id as trade_id,
    t.created_at,
    b.name as bot_name,
    b.exchange,
    t.symbol,
    t.side,
    t.size,
    t.entry_price,
    t.exit_price,
    t.pnl,
    t.status
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
    t.size,
    t.entry_price,
    t.status,
    t.pnl,
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
    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
    SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_positions,
    SUM(pnl) FILTER (WHERE status = 'closed') as total_pnl,
    STRING_AGG(DISTINCT exchange, ', ') as exchanges_used
FROM trades
WHERE created_at >= CURRENT_DATE
GROUP BY DATE(created_at);

-- ============================================
-- 10. Trade volume by hour (today)
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as trades_count,
    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_trades,
    SUM(pnl) FILTER (WHERE status = 'closed') as hourly_pnl,
    STRING_AGG(DISTINCT symbol, ', ') as symbols_traded
FROM trades
WHERE created_at >= CURRENT_DATE
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- ============================================
-- 11. PnL Summary
SELECT 
    'Today' as period,
    COUNT(*) as total_trades,
    SUM(CASE WHEN status = 'closed' AND pnl > 0 THEN 1 ELSE 0 END) as winners,
    SUM(CASE WHEN status = 'closed' AND pnl < 0 THEN 1 ELSE 0 END) as losers,
    SUM(pnl) FILTER (WHERE status = 'closed') as total_pnl,
    AVG(pnl) FILTER (WHERE status = 'closed') as avg_pnl
FROM trades
WHERE created_at >= CURRENT_DATE
UNION ALL
SELECT 
    'Last 7 Days',
    COUNT(*),
    SUM(CASE WHEN status = 'closed' AND pnl > 0 THEN 1 ELSE 0 END),
    SUM(CASE WHEN status = 'closed' AND pnl < 0 THEN 1 ELSE 0 END),
    SUM(pnl) FILTER (WHERE status = 'closed'),
    AVG(pnl) FILTER (WHERE status = 'closed')
FROM trades
WHERE created_at >= NOW() - INTERVAL '7 days'
UNION ALL
SELECT 
    'Last 30 Days',
    COUNT(*),
    SUM(CASE WHEN status = 'closed' AND pnl > 0 THEN 1 ELSE 0 END),
    SUM(CASE WHEN status = 'closed' AND pnl < 0 THEN 1 ELSE 0 END),
    SUM(pnl) FILTER (WHERE status = 'closed'),
    AVG(pnl) FILTER (WHERE status = 'closed')
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
    t.size,
    t.entry_price,
    t.status,
    t.pnl
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
    SUM(t.pnl) FILTER (WHERE t.status = 'closed' AND t.created_at >= NOW() - INTERVAL '24 hours') as pnl_24h
FROM trading_bots b
LEFT JOIN trades t ON b.id = t.bot_id AND t.created_at >= NOW() - INTERVAL '24 hours'
WHERE b.status IN ('running', 'paused')
GROUP BY b.id, b.name, b.exchange, b.symbol, b.status, b.total_trades
ORDER BY recent_trades_24h DESC;
