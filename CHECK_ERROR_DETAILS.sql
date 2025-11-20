-- ============================================
-- CHECK ERROR DETAILS FOR PROBLEMATIC BOTS
-- ============================================
-- This query shows the actual error messages for bots with recent errors
-- ============================================

-- 1. DETAILED ERROR MESSAGES FOR THE 4 BOTS WITH ERRORS
SELECT 
    tb.name as bot_name,
    tb.symbol,
    bal.level,
    bal.category,
    bal.message,
    bal.details,
    bal.timestamp
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.level = 'error'
    AND bal.timestamp > NOW() - INTERVAL '24 hours'
    AND tb.name IN (
        'BTC TRADINGVIEW ALERT TEST',
        'ETH TRADINGVIEW ALERT TEST',
        'Hybrid Trend + Mean Reversion Strategy - STRKUSDT',
        'Trend Following Strategy-Find Trading Pairs - ASTERUSDT'
    )
ORDER BY tb.name, bal.timestamp DESC;

-- 2. ERROR SUMMARY BY TYPE
SELECT 
    tb.name as bot_name,
    SUBSTRING(bal.message, 1, 100) as error_type,
    COUNT(*) as error_count,
    MAX(bal.timestamp) as last_occurrence
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.level = 'error'
    AND bal.timestamp > NOW() - INTERVAL '24 hours'
    AND tb.name IN (
        'BTC TRADINGVIEW ALERT TEST',
        'ETH TRADINGVIEW ALERT TEST',
        'Hybrid Trend + Mean Reversion Strategy - STRKUSDT',
        'Trend Following Strategy-Find Trading Pairs - ASTERUSDT'
    )
GROUP BY tb.name, SUBSTRING(bal.message, 1, 100)
ORDER BY tb.name, error_count DESC;

-- 3. RECENT ACTIVITY FOR BTC BOT (MOST ERRORS)
SELECT 
    bal.level,
    bal.category,
    bal.message,
    bal.timestamp
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE tb.name = 'BTC TRADINGVIEW ALERT TEST'
    AND bal.timestamp > NOW() - INTERVAL '2 hours'
ORDER BY bal.timestamp DESC
LIMIT 30;

