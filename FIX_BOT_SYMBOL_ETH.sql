-- Fix bot symbol from "ETH" to "ETHUSDT"
-- This fixes the "Scalping Strategy - Fast EMA Cloud - ETH" bot that has incomplete symbol

-- Step 1: Check current symbol
SELECT 
  id,
  name,
  symbol,
  exchange,
  trading_type,
  status
FROM trading_bots
WHERE id = '4080c0a5-bbff-4512-ba19-6aa9b529e35f';

-- Step 2: Update symbol from "ETH" to "ETHUSDT"
UPDATE trading_bots
SET symbol = 'ETHUSDT'
WHERE id = '4080c0a5-bbff-4512-ba19-6aa9b529e35f'
  AND symbol = 'ETH';

-- Step 3: Verify the change
SELECT 
  id,
  name,
  symbol,
  exchange,
  trading_type,
  status,
  CASE 
    WHEN symbol = 'ETHUSDT' THEN '✅ Fixed'
    WHEN symbol = 'ETH' THEN '⚠️ Still needs fixing'
    ELSE '❓ Unknown'
  END as status_check
FROM trading_bots
WHERE id = '4080c0a5-bbff-4512-ba19-6aa9b529e35f';

-- Step 4: Check for any other bots with incomplete symbols
SELECT 
  id,
  name,
  symbol,
  exchange,
  trading_type,
  status,
  CASE 
    WHEN symbol IN ('BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'XRP', 'DOGE', 'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'ATOM', 'ALGO', 'NEAR', 'FTM', 'SAND', 'MANA', 'AXS', 'GALA', 'ENJ', 'CHZ', 'HBAR', 'ICP', 'FLOW', 'THETA', 'FIL', 'EOS', 'TRX', 'LTC', 'BCH', 'XLM', 'VET', 'AAVE', 'MKR', 'COMP', 'SNX', 'CRV', 'SUSHI', '1INCH', 'PEPE', 'SHIB', 'FLOKI', 'BONK', 'WIF', 'HMAR') 
    THEN CONCAT('⚠️ Incomplete: Should be "', symbol, 'USDT"')
    ELSE '✅ Complete'
  END as symbol_status
FROM trading_bots
WHERE status = 'running'
  AND symbol IN ('BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'XRP', 'DOGE', 'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'ATOM', 'ALGO', 'NEAR', 'FTM', 'SAND', 'MANA', 'AXS', 'GALA', 'ENJ', 'CHZ', 'HBAR', 'ICP', 'FLOW', 'THETA', 'FIL', 'EOS', 'TRX', 'LTC', 'BCH', 'XLM', 'VET', 'AAVE', 'MKR', 'COMP', 'SNX', 'CRV', 'SUSHI', '1INCH', 'PEPE', 'SHIB', 'FLOKI', 'BONK', 'WIF', 'HMAR')
ORDER BY name;

-- Step 5: Auto-fix all bots with incomplete symbols (optional - run after reviewing Step 4)
-- UPDATE trading_bots
-- SET symbol = CONCAT(symbol, 'USDT')
-- WHERE status = 'running'
--   AND symbol IN ('BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'XRP', 'DOGE', 'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'ATOM', 'ALGO', 'NEAR', 'FTM', 'SAND', 'MANA', 'AXS', 'GALA', 'ENJ', 'CHZ', 'HBAR', 'ICP', 'FLOW', 'THETA', 'FIL', 'EOS', 'TRX', 'LTC', 'BCH', 'XLM', 'VET', 'AAVE', 'MKR', 'COMP', 'SNX', 'CRV', 'SUSHI', '1INCH', 'PEPE', 'SHIB', 'FLOKI', 'BONK', 'WIF', 'HMAR')
--   AND symbol NOT LIKE '%USDT%'
--   AND symbol NOT LIKE '%USD%'
--   AND symbol NOT LIKE '%BUSD%';

