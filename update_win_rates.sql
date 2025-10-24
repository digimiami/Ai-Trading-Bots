-- ============================================
-- UPDATE WIN RATES FOR ALL BOTS
-- Calculate win rate based on profitable trades
-- ============================================

-- Update win rates for all bots based on their trades
UPDATE trading_bots 
SET win_rate = (
    SELECT 
        CASE 
            WHEN COUNT(t.id) = 0 THEN 0
            ELSE ROUND(
                (SUM(CASE WHEN COALESCE(t.pnl, 0) > 0 THEN 1 ELSE 0 END)::numeric / 
                 COUNT(t.id) * 100), 
                2
            )
        END
    FROM trades t 
    WHERE t.bot_id = trading_bots.id 
    AND t.status = 'filled'
)
WHERE id IN (
    SELECT DISTINCT bot_id 
    FROM trades 
    WHERE status = 'filled'
);

-- Show updated win rates
SELECT 
    name as bot_name,
    exchange,
    symbol,
    total_trades,
    ROUND(COALESCE(win_rate, 0)::numeric, 2) as win_rate_percentage,
    ROUND(COALESCE(pnl, 0)::numeric, 2) as pnl,
    last_trade_at
FROM trading_bots
WHERE status IN ('running', 'paused')
ORDER BY win_rate DESC;

-- Show win rate calculation details
SELECT 
    b.name as bot_name,
    COUNT(t.id) as total_filled_trades,
    SUM(CASE WHEN COALESCE(t.pnl, 0) > 0 THEN 1 ELSE 0 END) as profitable_trades,
    SUM(CASE WHEN COALESCE(t.pnl, 0) <= 0 THEN 1 ELSE 0 END) as losing_trades,
    ROUND(
        (SUM(CASE WHEN COALESCE(t.pnl, 0) > 0 THEN 1 ELSE 0 END)::numeric / 
         NULLIF(COUNT(t.id), 0) * 100), 
        2
    ) as calculated_win_rate,
    ROUND(COALESCE(b.win_rate, 0)::numeric, 2) as stored_win_rate
FROM trading_bots b
LEFT JOIN trades t ON b.id = t.bot_id AND t.status = 'filled'
WHERE b.status IN ('running', 'paused')
GROUP BY b.id, b.name
ORDER BY calculated_win_rate DESC;

