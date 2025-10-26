-- Fix trade amounts and spot trading issues
-- Run this in Supabase SQL Editor

-- 1. Reduce trade amounts to prevent insufficient balance errors
UPDATE trading_bots
SET trade_amount = CASE
    WHEN trade_amount > 100 THEN 50  -- Reduce large amounts
    WHEN trade_amount > 50 THEN 25
    ELSE trade_amount
END
WHERE trade_amount > 50;

-- 2. Fix spot trading bots - they should only BUY (can't sell without owning)
-- Option A: Convert spot bots to futures (recommended)
UPDATE trading_bots
SET trading_type = 'futures',
    leverage = CASE WHEN leverage IS NULL OR leverage < 1 THEN 3 ELSE leverage END
WHERE trading_type = 'spot' OR trading_type IS NULL;

-- Option B: Or if you want to keep spot, ensure they only use BUY strategy
-- UPDATE trading_bots
-- SET strategy = jsonb_set(
--     COALESCE(strategy::jsonb, '{}'::jsonb),
--     '{onlyBuy}',
--     'true'::jsonb
-- )
-- WHERE trading_type = 'spot';

-- 3. Set reasonable default leverage for all futures bots
UPDATE trading_bots
SET leverage = 3
WHERE trading_type = 'futures' AND (leverage IS NULL OR leverage < 1 OR leverage > 10);

-- 4. Verify changes
SELECT 
    name,
    symbol,
    exchange,
    trading_type,
    trade_amount,
    leverage,
    status
FROM trading_bots
ORDER BY created_at DESC;

