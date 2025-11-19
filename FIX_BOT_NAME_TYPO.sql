-- Fix 1.1: Correct bot name typo
-- Fix the typo in bot name
UPDATE trading_bots
SET name = 'ETH TRADINGVIEW ALERT TEST'
WHERE name = 'ETH TRADIVIES ALERT TEST'
AND id = 'f941a8bb-6414-435e-a043-3a1be7ca1218';

-- Verify the fix
SELECT id, name FROM trading_bots WHERE id = 'f941a8bb-6414-435e-a043-3a1be7ca1218';

