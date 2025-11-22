-- Fixed query to check paper trades (uses entry_price instead of price)
SELECT 
    b.name,
    b.symbol,
    pt.side,
    pt.quantity,
    pt.entry_price,
    pt.exit_price,
    pt.pnl,
    pt.pnl_percentage,
    pt.status,
    pt.executed_at,
    pt.created_at
FROM paper_trading_trades pt
JOIN trading_bots b ON b.id = pt.bot_id
WHERE pt.created_at > NOW() - INTERVAL '1 hour'
ORDER BY pt.created_at DESC
LIMIT 50;

