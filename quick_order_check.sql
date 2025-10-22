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
    'CLOSED TODAY',
    COUNT(*)
FROM trades
WHERE created_at >= CURRENT_DATE AND status = 'closed'
UNION ALL
SELECT 
    'OPEN POSITIONS',
    COUNT(*)
FROM trades
WHERE status = 'open'
UNION ALL
SELECT 
    'LAST HOUR',
    COUNT(*)
FROM trades
WHERE created_at >= NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 
    'PNL TODAY ($)',
    ROUND(SUM(pnl)::numeric, 2)
FROM trades
WHERE created_at >= CURRENT_DATE AND status = 'closed';

-- ============================================
-- LAST 10 TRADES
SELECT 
    t.id,
    t.created_at,
    b.name as bot,
    t.exchange,
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
LIMIT 10;

-- ============================================
-- ACTIVE BOTS STATUS
SELECT 
    name as bot_name,
    exchange,
    symbol,
    status,
    total_trades,
    win_rate,
    pnl,
    last_trade_at
FROM trading_bots
WHERE status = 'running'
ORDER BY last_trade_at DESC NULLS LAST;
