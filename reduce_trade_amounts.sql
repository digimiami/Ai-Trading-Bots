-- Update all bot trade amounts to smaller, more reasonable values
-- This will reduce the risk and make trades more manageable

-- First, check current trade amounts
SELECT 
    id,
    name,
    symbol,
    trade_amount,
    leverage,
    trading_type,
    status
FROM trading_bots 
WHERE status = 'active'
ORDER BY trade_amount DESC;

-- Update all active bots to use smaller trade amounts
UPDATE trading_bots 
SET 
    trade_amount = CASE 
        -- High-value pairs (BTC, ETH) - smaller amounts
        WHEN symbol IN ('BTCUSDT', 'ETHUSDT') THEN 20.00
        -- Medium-value pairs (BNB, SOL) - medium amounts  
        WHEN symbol IN ('BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT') THEN 15.00
        -- Lower-value pairs (XRP, MATIC) - slightly higher amounts
        WHEN symbol IN ('XRPUSDT', 'MATICUSDT', 'UNIUSDT', 'AVAXUSDT') THEN 25.00
        -- Default for any other pairs
        ELSE 20.00
    END,
    updated_at = NOW()
WHERE status = 'active';

-- Verify the updates
SELECT 
    id,
    name,
    symbol,
    trade_amount,
    leverage,
    trading_type,
    status,
    updated_at
FROM trading_bots 
WHERE status = 'active'
ORDER BY symbol;

-- Show the new trade calculations
SELECT 
    name,
    symbol,
    trade_amount,
    leverage,
    ROUND(trade_amount * leverage * 1.5, 2) as estimated_order_value,
    trading_type
FROM trading_bots 
WHERE status = 'active'
ORDER BY estimated_order_value DESC;
