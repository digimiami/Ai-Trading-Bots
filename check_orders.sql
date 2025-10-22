-- ============================================
-- SQL Script to Check Orders Being Placed
-- Pablo AI Trading Bot
-- ============================================

-- 1. Check recent orders (last 24 hours)
SELECT 
    id,
    bot_id,
    exchange,
    symbol,
    side,
    order_type,
    quantity,
    price,
    status,
    created_at,
    updated_at,
    error_message
FROM orders
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- ============================================
-- 2. Count orders by status
SELECT 
    status,
    COUNT(*) as count,
    MIN(created_at) as first_order,
    MAX(created_at) as last_order
FROM orders
GROUP BY status
ORDER BY count DESC;

-- ============================================
-- 3. Count orders by exchange
SELECT 
    exchange,
    COUNT(*) as total_orders,
    SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END) as filled,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
FROM orders
GROUP BY exchange
ORDER BY total_orders DESC;

-- ============================================
-- 4. Count orders by bot
SELECT 
    b.name as bot_name,
    b.id as bot_id,
    COUNT(o.id) as total_orders,
    SUM(CASE WHEN o.status = 'filled' THEN 1 ELSE 0 END) as successful,
    SUM(CASE WHEN o.status = 'failed' THEN 1 ELSE 0 END) as failed,
    MAX(o.created_at) as last_order_time
FROM bots b
LEFT JOIN orders o ON b.id = o.bot_id
GROUP BY b.id, b.name
ORDER BY total_orders DESC;

-- ============================================
-- 5. Recent failed orders with error messages
SELECT 
    o.id,
    b.name as bot_name,
    o.exchange,
    o.symbol,
    o.side,
    o.quantity,
    o.error_message,
    o.created_at
FROM orders o
LEFT JOIN bots b ON o.bot_id = b.id
WHERE o.status = 'failed'
ORDER BY o.created_at DESC
LIMIT 20;

-- ============================================
-- 6. Orders by symbol (last 7 days)
SELECT 
    symbol,
    exchange,
    COUNT(*) as total_orders,
    SUM(CASE WHEN side = 'Buy' THEN 1 ELSE 0 END) as buy_orders,
    SUM(CASE WHEN side = 'Sell' THEN 1 ELSE 0 END) as sell_orders,
    SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END) as filled,
    SUM(quantity::numeric) as total_quantity
FROM orders
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY symbol, exchange
ORDER BY total_orders DESC;

-- ============================================
-- 7. Order success rate by bot (last 30 days)
SELECT 
    b.name as bot_name,
    b.exchange,
    b.symbol,
    COUNT(o.id) as total_orders,
    SUM(CASE WHEN o.status = 'filled' THEN 1 ELSE 0 END) as successful,
    SUM(CASE WHEN o.status = 'failed' THEN 1 ELSE 0 END) as failed,
    ROUND(
        (SUM(CASE WHEN o.status = 'filled' THEN 1 ELSE 0 END)::numeric / 
         NULLIF(COUNT(o.id), 0) * 100), 
        2
    ) as success_rate_percentage
FROM bots b
LEFT JOIN orders o ON b.id = o.bot_id 
    AND o.created_at >= NOW() - INTERVAL '30 days'
WHERE b.status = 'running'
GROUP BY b.id, b.name, b.exchange, b.symbol
ORDER BY total_orders DESC;

-- ============================================
-- 8. Most recent orders with bot details
SELECT 
    o.id as order_id,
    o.created_at,
    b.name as bot_name,
    b.exchange,
    o.symbol,
    o.side,
    o.order_type,
    o.quantity,
    o.price,
    o.status,
    o.exchange_order_id,
    o.error_message
FROM orders o
LEFT JOIN bots b ON o.bot_id = b.id
ORDER BY o.created_at DESC
LIMIT 50;

-- ============================================
-- 9. Orders placed in the last hour (for real-time monitoring)
SELECT 
    o.id,
    o.created_at,
    b.name as bot_name,
    o.exchange,
    o.symbol,
    o.side,
    o.quantity,
    o.status,
    EXTRACT(EPOCH FROM (NOW() - o.created_at)) as seconds_ago
FROM orders o
LEFT JOIN bots b ON o.bot_id = b.id
WHERE o.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY o.created_at DESC;

-- ============================================
-- 10. Check if any orders were placed today
SELECT 
    DATE(created_at) as order_date,
    COUNT(*) as total_orders,
    SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END) as filled,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
    STRING_AGG(DISTINCT exchange, ', ') as exchanges_used
FROM orders
WHERE created_at >= CURRENT_DATE
GROUP BY DATE(created_at);

-- ============================================
-- 11. Order volume by hour (today)
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as orders_count,
    SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END) as successful,
    STRING_AGG(DISTINCT symbol, ', ') as symbols_traded
FROM orders
WHERE created_at >= CURRENT_DATE
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- ============================================
-- 12. Check for duplicate or stuck orders
SELECT 
    bot_id,
    symbol,
    side,
    quantity,
    COUNT(*) as duplicate_count,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM orders
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY bot_id, symbol, side, quantity
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- ============================================
-- QUICK CHECK: Latest order status
SELECT 
    'Latest Order' as info,
    id as order_id,
    created_at,
    exchange,
    symbol,
    side,
    status,
    error_message
FROM orders
ORDER BY created_at DESC
LIMIT 1;

