-- Find your bot ID(s) to use in the configuration script
-- Run this first to find the bot you want to configure

-- List all your bots
SELECT 
    id,
    name,
    symbol,
    exchange,
    trading_type,
    status,
    paper_trading,
    created_at
FROM trading_bots
ORDER BY created_at DESC;

-- Or search by name
-- SELECT id, name, symbol FROM trading_bots WHERE name ILIKE '%trend%' OR name ILIKE '%15m%';

