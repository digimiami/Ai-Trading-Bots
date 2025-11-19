-- Monitor if the 403 error fix is working
-- Run this query after restarting the bots to see if errors are decreasing

-- 1. Check recent errors (last hour)
SELECT 
    tb.name as bot_name,
    COUNT(*) FILTER (WHERE bal.message LIKE '%403%' OR bal.message LIKE '%Forbidden%') as http_403_errors,
    COUNT(*) FILTER (WHERE bal.message LIKE '%CoinGecko%' OR bal.message LIKE '%fallback%') as coingecko_fallbacks,
    COUNT(*) FILTER (WHERE bal.message LIKE '%price fetch%' OR bal.message LIKE '%price%') as price_errors,
    COUNT(*) as total_errors,
    MAX(bal.timestamp) as last_error_time
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.bot_id IN (
    '81692bd2-43fe-4618-99ed-0422e9eb7714', -- BTC TRADINGVIEW ALERT TEST
    'f941a8bb-6414-435e-a043-3a1be7ca1218'  -- ETH TRADINGVIEW ALERT TEST
)
AND bal.level = 'error'
AND bal.timestamp > NOW() - INTERVAL '1 hour'
GROUP BY tb.name
ORDER BY total_errors DESC;

-- 2. Check if CoinGecko fallback is being used successfully
SELECT 
    tb.name as bot_name,
    bal.timestamp,
    bal.message,
    bal.level,
    bal.category
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.bot_id IN (
    '81692bd2-43fe-4618-99ed-0422e9eb7714',
    'f941a8bb-6414-435e-a043-3a1be7ca1218'
)
AND (
    bal.message LIKE '%CoinGecko%'
    OR bal.message LIKE '%fallback%'
    OR bal.message LIKE '%403%'
)
AND bal.timestamp > NOW() - INTERVAL '1 hour'
ORDER BY bal.timestamp DESC
LIMIT 20;

-- 3. Success rate: Compare errors vs successful price fetches
SELECT 
    tb.name as bot_name,
    COUNT(*) FILTER (WHERE bal.level = 'error' AND bal.message LIKE '%price%') as price_fetch_errors,
    COUNT(*) FILTER (WHERE bal.level = 'info' AND bal.message LIKE '%price%' AND bal.message LIKE '%✅%') as successful_price_fetches,
    COUNT(*) FILTER (WHERE bal.level = 'info' AND bal.message LIKE '%CoinGecko%') as coingecko_successes,
    ROUND(
        COUNT(*) FILTER (WHERE bal.level = 'info' AND (bal.message LIKE '%price%' OR bal.message LIKE '%CoinGecko%'))::numeric / 
        NULLIF(COUNT(*) FILTER (WHERE bal.level IN ('error', 'info') AND bal.message LIKE '%price%'), 0) * 100, 
        2
    ) as success_rate_percent
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.bot_id IN (
    '81692bd2-43fe-4618-99ed-0422e9eb7714',
    'f941a8bb-6414-435e-a043-3a1be7ca1218'
)
AND bal.timestamp > NOW() - INTERVAL '1 hour'
AND bal.message LIKE '%price%'
GROUP BY tb.name;

-- 4. Error trend over time (last 6 hours, by hour)
SELECT 
    DATE_TRUNC('hour', bal.timestamp) as hour,
    tb.name as bot_name,
    COUNT(*) FILTER (WHERE bal.message LIKE '%403%') as http_403_errors,
    COUNT(*) FILTER (WHERE bal.message LIKE '%CoinGecko%') as coingecko_fallbacks,
    COUNT(*) as total_errors
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.bot_id IN (
    '81692bd2-43fe-4618-99ed-0422e9eb7714',
    'f941a8bb-6414-435e-a043-3a1be7ca1218'
)
AND bal.level = 'error'
AND bal.timestamp > NOW() - INTERVAL '6 hours'
GROUP BY hour, tb.name
ORDER BY hour DESC, tb.name;

