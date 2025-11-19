-- Fix 1.2: Investigate error patterns
-- Check errors for the two problematic bots
SELECT 
    bal.id,
    bal.bot_id,
    bal.level,
    bal.category,
    bal.message,
    bal.details,
    bal.timestamp,
    tb.name as bot_name
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.bot_id IN (
    '81692bd2-43fe-4618-99ed-0422e9eb7714', -- BTC TRADINGVIEW ALERT TEST
    'f941a8bb-6414-435e-a043-3a1be7ca1218'  -- ETH TRADINGVIEW ALERT TEST (fixed name)
)
AND bal.level = 'error'
ORDER BY bal.timestamp DESC
LIMIT 100;

