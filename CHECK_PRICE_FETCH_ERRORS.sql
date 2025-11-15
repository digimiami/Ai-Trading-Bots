-- ============================================
-- CHECK LATEST PRICE FETCH ERRORS WITH API RESPONSES
-- ============================================
-- This query shows the most recent price fetch errors
-- including the API response summary and diagnostic info

SELECT 
    bal.id,
    tb.name AS bot_name,
    tb.symbol,
    tb.exchange,
    tb.trading_type,
    bal.level,
    bal.message,
    bal.details->>'error' AS error_message,
    bal.details->>'diagnostic' AS diagnostic_info,
    bal.details->'diagnostic'->>'apiResponses' AS api_responses,
    bal.details->'diagnostic'->>'apiUrl' AS api_url,
    bal.details->'diagnostic'->>'symbolVariants' AS symbol_variants,
    TO_CHAR(bal.created_at, 'YYYY-MM-DD HH24:MI:SS') AS error_time,
    NOW() - bal.created_at AS time_ago
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.level = 'error'
    AND bal.category = 'trade'
    AND bal.message LIKE '%Invalid or unavailable price%'
    AND bal.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY bal.created_at DESC
LIMIT 10;

-- ============================================
-- VIEW FULL ERROR DETAILS (JSON FORMATTED)
-- ============================================
SELECT 
    tb.name AS bot_name,
    bal.message AS error_message,
    jsonb_pretty(bal.details) AS full_details
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.level = 'error'
    AND bal.category = 'trade'
    AND bal.message LIKE '%Invalid or unavailable price%'
    AND bal.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY bal.created_at DESC
LIMIT 5;

