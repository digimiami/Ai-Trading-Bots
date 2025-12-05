-- =====================================================
-- DIAGNOSTIC SCRIPT FOR BOT: 47ee03f9-302e-4b38-bdee-aa3371b598f0
-- =====================================================
-- This script checks why the bot stopped trading
-- =====================================================

-- 1. Bot Basic Information
SELECT 
    id,
    name,
    user_id,
    status,
    exchange,
    symbol,
    trading_type,
    paper_trading,
    leverage,
    trade_amount,
    risk_level,
    stop_loss,
    take_profit,
    created_at,
    updated_at,
    last_trade_at,
    last_execution_at,
    next_execution_at,
    webhook_only
FROM trading_bots
WHERE id = '47ee03f9-302e-4b38-bdee-aa3371b598f0';

-- 2. Strategy Configuration
SELECT 
    id,
    name,
    strategy_config
FROM trading_bots
WHERE id = '47ee03f9-302e-4b38-bdee-aa3371b598f0';

-- 3. Recent Trades (Last 20)
-- Note: If this query fails, the trades table may use different column names
-- Common variations: entry_price/exit_price instead of price, quantity/size instead of amount
SELECT 
    id,
    symbol,
    side,
    pnl,
    status,
    created_at
FROM trades
WHERE bot_id = '47ee03f9-302e-4b38-bdee-aa3371b598f0'
ORDER BY created_at DESC
LIMIT 20;

-- 4. Paper Trading Trades (Last 20)
SELECT 
    id,
    symbol,
    side,
    entry_price,
    exit_price,
    quantity,
    pnl,
    fees,
    status,
    executed_at,
    created_at
FROM paper_trading_trades
WHERE bot_id = '47ee03f9-302e-4b38-bdee-aa3371b598f0'
ORDER BY COALESCE(executed_at, created_at) DESC
LIMIT 20;

-- 5. Open Positions (Real Trading)
-- Note: This table may not exist, so it's wrapped in a DO block
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'positions') THEN
        -- Table exists, query will be run separately
        NULL;
    END IF;
END $$;

-- If positions table exists, run this query separately:
-- SELECT 
--     id,
--     symbol,
--     side,
--     entry_price,
--     quantity,
--     leverage,
--     stop_loss_price,
--     take_profit_price,
--     status,
--     opened_at,
--     updated_at
-- FROM positions
-- WHERE bot_id = '47ee03f9-302e-4b38-bdee-aa3371b598f0'
-- AND status = 'open';

-- 6. Open Paper Trading Positions
SELECT 
    id,
    symbol,
    side,
    entry_price,
    quantity,
    leverage,
    stop_loss_price,
    take_profit_price,
    status,
    opened_at,
    updated_at
FROM paper_trading_positions
WHERE bot_id = '47ee03f9-302e-4b38-bdee-aa3371b598f0'
AND status = 'open';

-- 7. Recent Bot Activity Logs (Last 30)
SELECT 
    id,
    level,
    category,
    message,
    details,
    created_at
FROM bot_activity_logs
WHERE bot_id = '47ee03f9-302e-4b38-bdee-aa3371b598f0'
ORDER BY created_at DESC
LIMIT 30;

-- 8. Check for Risk Management Limits (from strategy_config)
SELECT 
    id,
    name,
    strategy_config->>'max_consecutive_losses' as max_consecutive_losses,
    strategy_config->>'daily_loss_limit_pct' as daily_loss_limit_pct,
    strategy_config->>'weekly_loss_limit_pct' as weekly_loss_limit_pct,
    strategy_config->>'max_trades_per_day' as max_trades_per_day,
    strategy_config->>'max_concurrent' as max_concurrent
FROM trading_bots
WHERE id = '47ee03f9-302e-4b38-bdee-aa3371b598f0';

-- 9. Calculate Recent Performance (Last 24 hours)
SELECT 
    COUNT(*) as total_trades_24h,
    COUNT(*) FILTER (WHERE pnl > 0) as winning_trades,
    COUNT(*) FILTER (WHERE pnl < 0) as losing_trades,
    SUM(pnl) as total_pnl_24h
FROM trades
WHERE bot_id = '47ee03f9-302e-4b38-bdee-aa3371b598f0'
AND created_at > NOW() - INTERVAL '24 hours';

-- 10. Calculate Paper Trading Performance (Last 24 hours)
SELECT 
    COUNT(*) as total_trades_24h,
    COUNT(*) FILTER (WHERE pnl > 0) as winning_trades,
    COUNT(*) FILTER (WHERE pnl < 0) as losing_trades,
    COUNT(*) FILTER (WHERE pnl < 0 AND executed_at > NOW() - INTERVAL '1 hour') as consecutive_losses_last_hour,
    SUM(pnl) as total_pnl_24h,
    SUM(fees) as total_fees_24h
FROM paper_trading_trades
WHERE bot_id = '47ee03f9-302e-4b38-bdee-aa3371b598f0'
AND executed_at > NOW() - INTERVAL '24 hours';

-- 11. Check API Keys Status
SELECT 
    u.id as user_id,
    u.email,
    ak.exchange,
    ak.is_testnet,
    ak.created_at as api_key_created_at,
    ak.updated_at as api_key_updated_at
FROM trading_bots tb
JOIN auth.users u ON tb.user_id = u.id
LEFT JOIN api_keys ak ON ak.user_id = u.id AND ak.exchange = tb.exchange
WHERE tb.id = '47ee03f9-302e-4b38-bdee-aa3371b598f0';

-- 12. Check for Daily/Weekly Loss Limits
WITH recent_trades AS (
    SELECT 
        pnl,
        created_at as executed_at,
        DATE(created_at) as trade_date
    FROM trades
    WHERE bot_id = '47ee03f9-302e-4b38-bdee-aa3371b598f0'
    AND created_at > NOW() - INTERVAL '7 days'
    UNION ALL
    SELECT 
        pnl,
        executed_at,
        DATE(executed_at) as trade_date
    FROM paper_trading_trades
    WHERE bot_id = '47ee03f9-302e-4b38-bdee-aa3371b598f0'
    AND executed_at > NOW() - INTERVAL '7 days'
)
SELECT 
    trade_date,
    SUM(pnl) as daily_pnl,
    COUNT(*) as trades_count,
    COUNT(*) FILTER (WHERE pnl < 0) as losses_count
FROM recent_trades
GROUP BY trade_date
ORDER BY trade_date DESC;

-- 13. Check Consecutive Losses
WITH ordered_trades AS (
    SELECT 
        pnl,
        created_at as executed_at,
        ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
    FROM trades
    WHERE bot_id = '47ee03f9-302e-4b38-bdee-aa3371b598f0'
    AND created_at > NOW() - INTERVAL '7 days'
    UNION ALL
    SELECT 
        pnl,
        executed_at,
        ROW_NUMBER() OVER (ORDER BY executed_at DESC) as rn
    FROM paper_trading_trades
    WHERE bot_id = '47ee03f9-302e-4b38-bdee-aa3371b598f0'
    AND executed_at > NOW() - INTERVAL '7 days'
)
SELECT 
    COUNT(*) as consecutive_losses,
    MIN(executed_at) as first_loss_time,
    MAX(executed_at) as last_loss_time
FROM (
    SELECT 
        pnl,
        executed_at,
        SUM(CASE WHEN pnl >= 0 THEN 1 ELSE 0 END) 
            OVER (ORDER BY rn DESC) as loss_group
    FROM ordered_trades
    WHERE rn <= 10  -- Check last 10 trades
) grouped
WHERE pnl < 0
GROUP BY loss_group
ORDER BY consecutive_losses DESC
LIMIT 1;

-- 14. Check if bot was manually stopped
SELECT 
    id,
    level,
    category,
    message,
    details,
    created_at
FROM bot_activity_logs
WHERE bot_id = '47ee03f9-302e-4b38-bdee-aa3371b598f0'
AND (
    message ILIKE '%stop%' OR 
    message ILIKE '%paused%' OR 
    message ILIKE '%disabled%' OR
    message ILIKE '%error%' OR
    message ILIKE '%failed%'
)
ORDER BY created_at DESC
LIMIT 20;

