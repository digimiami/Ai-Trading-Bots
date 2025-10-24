-- ============================================
-- TEST WIN RATE FUNCTIONALITY
-- Quick check to see if win rates are working
-- ============================================

-- Check current win rates
SELECT 
    name as bot_name,
    exchange,
    symbol,
    status,
    total_trades,
    ROUND(COALESCE(win_rate, 0)::numeric, 2) as win_rate_percentage,
    ROUND(COALESCE(pnl, 0)::numeric, 2) as pnl,
    last_trade_at
FROM trading_bots
ORDER BY win_rate DESC NULLS LAST;

-- Check if we have any trades to calculate win rates from
SELECT 
    COUNT(*) as total_trades,
    SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END) as filled_trades,
    SUM(CASE WHEN COALESCE(pnl, 0) > 0 THEN 1 ELSE 0 END) as profitable_trades,
    SUM(CASE WHEN COALESCE(pnl, 0) <= 0 THEN 1 ELSE 0 END) as losing_trades
FROM trades;

-- Show recent trades with PnL
SELECT 
    t.id,
    t.created_at,
    b.name as bot_name,
    t.symbol,
    t.side,
    ROUND(t.amount::numeric, 4) as amount,
    ROUND(t.price::numeric, 2) as price,
    ROUND(COALESCE(t.pnl, 0)::numeric, 2) as pnl,
    t.status
FROM trades t
LEFT JOIN trading_bots b ON t.bot_id = b.id
ORDER BY t.created_at DESC
LIMIT 10;

