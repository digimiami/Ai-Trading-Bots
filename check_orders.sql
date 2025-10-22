-- ============================================
-- SQL Script to Check Trades Being Placed
-- Pablo AI Trading Bot
-- Actual Database Schema Version
-- ============================================

-- 1. Check recent trades (last 24 hours)
SELECT 
    id,
    bot_id,
    user_id,
    exchange,
    symbol,
    side,
    ROUND(amount::numeric, 4) as amount,
    ROUND(price::numeric, 2) as price,
    ROUND(COALESCE(fee, 0)::numeric, 4) as fee,
    ROUND(COALESCE(pnl, 0)::numeric, 2) as pnl,
    status,
    exchange_order_id,
    executed_at,
    created_at
FROM trades
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- ============================================
-- 2. Count trades by status
SELECT 
    COALESCE(status, 'unknown') as status,
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
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
    ROUND(SUM(COALESCE(pnl, 0))::numeric, 2) as total_pnl
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
    ROUND(SUM(COALESCE(t.pnl, 0))::numeric, 2) as total_pnl,
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
    ROUND(SUM(amount)::numeric, 4) as total_amount,
    ROUND(SUM(COALESCE(pnl, 0))::numeric, 2) as total_pnl
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
    SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending,
    ROUND(
        (SUM(CASE WHEN t.status = 'filled' THEN 1 ELSE 0 END)::numeric / 
         NULLIF(COUNT(t.id), 0) * 100), 
        2
    ) as success_rate_percentage,
    ROUND(SUM(COALESCE(t.pnl, 0))::numeric, 2) as total_pnl
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
    t.exchange,
    t.symbol,
    t.side,
    ROUND(t.amount::numeric, 4) as amount,
    ROUND(t.price::numeric, 2) as price,
    ROUND(COALESCE(t.pnl, 0)::numeric, 2) as pnl,
    t.status,
    t.exchange_order_id
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
    ROUND(t.amount::numeric, 4) as amount,
    ROUND(t.price::numeric, 2) as price,
    t.status,
    t.exchange_order_id,
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
    ROUND(SUM(COALESCE(pnl, 0))::numeric, 2) as total_pnl,
    ROUND(SUM(COALESCE(fee, 0))::numeric, 4) as total_fees,
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
    ROUND(SUM(amount)::numeric, 4) as total_amount_traded,
    ROUND(SUM(COALESCE(pnl, 0))::numeric, 2) as hourly_pnl,
    STRING_AGG(DISTINCT symbol, ', ') as symbols_traded
FROM trades
WHERE created_at >= CURRENT_DATE
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- ============================================
-- 11. Trade Summary by Period
SELECT 
    'Today' as period,
    COUNT(*) as total_trades,
    SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END) as filled,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
    ROUND(SUM(amount)::numeric, 4) as total_volume,
    ROUND(SUM(COALESCE(pnl, 0))::numeric, 2) as total_pnl,
    ROUND(AVG(COALESCE(pnl, 0))::numeric, 2) as avg_pnl
FROM trades
WHERE created_at >= CURRENT_DATE
UNION ALL
SELECT 
    'Last 7 Days',
    COUNT(*),
    SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END),
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END),
    ROUND(SUM(amount)::numeric, 4),
    ROUND(SUM(COALESCE(pnl, 0))::numeric, 2),
    ROUND(AVG(COALESCE(pnl, 0))::numeric, 2)
FROM trades
WHERE created_at >= NOW() - INTERVAL '7 days'
UNION ALL
SELECT 
    'Last 30 Days',
    COUNT(*),
    SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END),
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END),
    ROUND(SUM(amount)::numeric, 4),
    ROUND(SUM(COALESCE(pnl, 0))::numeric, 2),
    ROUND(AVG(COALESCE(pnl, 0))::numeric, 2)
FROM trades
WHERE created_at >= NOW() - INTERVAL '30 days';

-- ============================================
-- 12. QUICK CHECK: Latest trade status
SELECT 
    'Latest Trade' as info,
    t.id as trade_id,
    t.created_at,
    b.name as bot_name,
    t.exchange,
    t.symbol,
    t.side,
    ROUND(t.amount::numeric, 4) as amount,
    ROUND(t.price::numeric, 2) as price,
    ROUND(COALESCE(t.pnl, 0)::numeric, 2) as pnl,
    t.status,
    t.exchange_order_id
FROM trades t
LEFT JOIN trading_bots b ON t.bot_id = b.id
ORDER BY t.created_at DESC
LIMIT 1;

-- ============================================
-- 13. Active Bots with Trade Count
SELECT 
    b.name,
    b.exchange,
    b.symbol,
    b.status,
    b.total_trades as bot_total_trades,
    COUNT(t.id) as recent_trades_24h,
    SUM(CASE WHEN t.status = 'filled' THEN 1 ELSE 0 END) as filled_24h,
    ROUND(SUM(COALESCE(t.pnl, 0))::numeric, 2) as pnl_24h
FROM trading_bots b
LEFT JOIN trades t ON b.id = t.bot_id AND t.created_at >= NOW() - INTERVAL '24 hours'
WHERE b.status IN ('running', 'paused')
GROUP BY b.id, b.name, b.exchange, b.symbol, b.status, b.total_trades
ORDER BY recent_trades_24h DESC;

-- ============================================
-- 14. Failed Trades with Details (if any)
SELECT 
    t.id,
    t.created_at,
    b.name as bot_name,
    t.exchange,
    t.symbol,
    t.side,
    ROUND(t.amount::numeric, 4) as amount,
    ROUND(t.price::numeric, 2) as price,
    t.status,
    t.exchange_order_id
FROM trades t
LEFT JOIN trading_bots b ON t.bot_id = b.id
WHERE t.status = 'failed'
ORDER BY t.created_at DESC
LIMIT 20;

-- ============================================
-- 15. Trades Without Exchange Order ID (potential issues)
SELECT 
    COUNT(*) as trades_without_order_id,
    MIN(created_at) as oldest,
    MAX(created_at) as newest
FROM trades
WHERE exchange_order_id IS NULL OR exchange_order_id = '';

-- ============================================
-- 16. Average Trade Metrics
SELECT 
    exchange,
    COUNT(*) as total_trades,
    ROUND(AVG(amount)::numeric, 4) as avg_amount,
    ROUND(AVG(price)::numeric, 2) as avg_price,
    ROUND(AVG(COALESCE(fee, 0))::numeric, 4) as avg_fee,
    ROUND(AVG(COALESCE(pnl, 0))::numeric, 2) as avg_pnl,
    ROUND(SUM(COALESCE(pnl, 0))::numeric, 2) as total_pnl
FROM trades
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY exchange;
