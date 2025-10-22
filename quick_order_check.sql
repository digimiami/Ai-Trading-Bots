-- ============================================
-- QUICK TRADE CHECK - Simple & Fast
-- Run this for instant trade status
-- ============================================

-- QUICK SUMMARY
SELECT 
    'TRADES TODAY' as metric,
    COUNT(*) as count
FROM trades
WHERE created_at >= CURRENT_DATE
UNION ALL
SELECT 
    'FILLED TODAY',
    COUNT(*)
FROM trades
WHERE created_at >= CURRENT_DATE AND status = 'filled'
UNION ALL
SELECT 
    'PENDING TRADES',
    COUNT(*)
FROM trades
WHERE status = 'pending'
UNION ALL
SELECT 
    'FAILED TRADES',
    COUNT(*)
FROM trades
WHERE status = 'failed'
UNION ALL
SELECT 
    'LAST HOUR',
    COUNT(*)
FROM trades
WHERE created_at >= NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 
    'PNL TODAY ($)',
    ROUND(COALESCE(SUM(pnl), 0)::numeric, 2)
FROM trades
WHERE created_at >= CURRENT_DATE AND status = 'filled';

-- ============================================
-- LAST 10 TRADES
SELECT 
    t.id,
    t.created_at,
    t.executed_at,
    b.name as bot,
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
LIMIT 10;

-- ============================================
-- ACTIVE BOTS STATUS
SELECT 
    name as bot_name,
    exchange,
    symbol,
    status,
    total_trades,
    ROUND(COALESCE(win_rate, 0)::numeric, 2) as win_rate,
    ROUND(COALESCE(pnl, 0)::numeric, 2) as pnl,
    last_trade_at
FROM trading_bots
WHERE status = 'running'
ORDER BY last_trade_at DESC NULLS LAST;
