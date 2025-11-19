-- Analyze the 40 errors for each stopped bot
-- This will help identify the error patterns

-- 1. Get error summary by category and message
SELECT 
    tb.name as bot_name,
    bal.category,
    bal.message,
    COUNT(*) as error_count,
    MAX(bal.timestamp) as last_error_time,
    MIN(bal.timestamp) as first_error_time
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.bot_id IN (
    '81692bd2-43fe-4618-99ed-0422e9eb7714', -- BTC TRADINGVIEW ALERT TEST
    'f941a8bb-6414-435e-a043-3a1be7ca1218'  -- ETH TRADINGVIEW ALERT TEST
)
AND bal.level = 'error'
GROUP BY tb.name, bal.category, bal.message
ORDER BY error_count DESC, last_error_time DESC;

-- 2. Get recent errors with details
SELECT 
    tb.name as bot_name,
    bal.timestamp,
    bal.category,
    bal.message,
    bal.details->>'http_status' as http_status,
    bal.details->>'error' as error_message,
    bal.details->>'symbol' as symbol,
    bal.details->>'domains_tried' as domains_tried
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.bot_id IN (
    '81692bd2-43fe-4618-99ed-0422e9eb7714', -- BTC TRADINGVIEW ALERT TEST
    'f941a8bb-6414-435e-a043-3a1be7ca1218'  -- ETH TRADINGVIEW ALERT TEST
)
AND bal.level = 'error'
ORDER BY bal.timestamp DESC
LIMIT 20;

-- 3. Check if errors are related to HTTP 403 or price fetching
SELECT 
    tb.name as bot_name,
    COUNT(*) FILTER (WHERE bal.message LIKE '%403%' OR bal.message LIKE '%Forbidden%') as http_403_errors,
    COUNT(*) FILTER (WHERE bal.message LIKE '%price%' OR bal.message LIKE '%fetch%') as price_fetch_errors,
    COUNT(*) FILTER (WHERE bal.details->>'http_status' = '403') as http_403_in_details,
    COUNT(*) as total_errors
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.bot_id IN (
    '81692bd2-43fe-4618-99ed-0422e9eb7714', -- BTC TRADINGVIEW ALERT TEST
    'f941a8bb-6414-435e-a043-3a1be7ca1218'  -- ETH TRADINGVIEW ALERT TEST
)
AND bal.level = 'error'
GROUP BY tb.name;

