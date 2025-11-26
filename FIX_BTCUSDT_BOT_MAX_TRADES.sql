-- ============================================
-- Fix Max Trades Per Day for BTCUSDT Bot
-- Bot ID: 91be4053-28a4-4a11-9738-7871a5387c71
-- ============================================

-- OPTION 1: Increase max_trades_per_day to 50 (for active scalping)
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || 
    jsonb_build_object('max_trades_per_day', 50)
WHERE id = '91be4053-28a4-4a11-9738-7871a5387c71';

-- OPTION 2: Increase max_trades_per_day to 100 (for very active trading)
-- UPDATE trading_bots
-- SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || 
--     jsonb_build_object('max_trades_per_day', 100)
-- WHERE id = '91be4053-28a4-4a11-9738-7871a5387c71';

-- OPTION 3: Disable max_trades_per_day limit (set to 0 = unlimited)
-- UPDATE trading_bots
-- SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || 
--     jsonb_build_object('max_trades_per_day', 0)
-- WHERE id = '91be4053-28a4-4a11-9738-7871a5387c71';

-- OPTION 4: Reset today's trade count by updating last_trade_at (allows immediate trading)
-- UPDATE trading_bots
-- SET last_trade_at = NOW() - INTERVAL '1 day'
-- WHERE id = '91be4053-28a4-4a11-9738-7871a5387c71';

-- Verify the change
SELECT 
    id,
    name,
    symbol,
    status,
    COALESCE((strategy_config->>'max_trades_per_day')::int, 8) as max_trades_per_day,
    (SELECT COUNT(*) FROM trades 
     WHERE bot_id = '91be4053-28a4-4a11-9738-7871a5387c71'
       AND executed_at IS NOT NULL
       AND executed_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
       AND executed_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
       AND status IN ('filled', 'completed', 'closed'))::int as trades_today,
    last_trade_at
FROM trading_bots
WHERE id = '91be4053-28a4-4a11-9738-7871a5387c71';

