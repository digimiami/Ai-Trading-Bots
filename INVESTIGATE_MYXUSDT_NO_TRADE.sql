-- ============================================
-- INVESTIGATE: Why MYXUSDT Not Trading Despite Good Conditions
-- ============================================
-- MYXUSDT shows: RSI=31.02 (oversold), ADX=65.14 (strong trend)
-- This should trigger a trade, but it's not. Let's find out why.
-- ============================================

-- 1. Check bot configuration
SELECT 
    name,
    symbol,
    strategy,
    strategy_config->>'adx_min_htf' as adx_min_htf,
    strategy_config->>'adx_trend_min' as adx_trend_min,
    strategy_config->>'rsi_oversold' as rsi_oversold,
    strategy_config->>'bias_mode' as bias_mode,
    strategy_config->>'regime_mode' as regime_mode,
    paper_trading,
    status
FROM trading_bots
WHERE name = 'Trend Following Strategy-Find Trading Pairs - MYXUSDT';

-- 2. Check recent strategy evaluation logs for MYXUSDT
SELECT 
    bal.level,
    bal.category,
    bal.message,
    bal.details,
    bal.timestamp
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE tb.name = 'Trend Following Strategy-Find Trading Pairs - MYXUSDT'
    AND bal.timestamp > NOW() - INTERVAL '1 hour'
    AND (
        bal.category = 'strategy'
        OR bal.message LIKE '%Strategy%'
        OR bal.message LIKE '%signal%'
        OR bal.message LIKE '%trade%'
        OR bal.message LIKE '%ADX%'
        OR bal.message LIKE '%RSI%'
    )
ORDER BY bal.timestamp DESC
LIMIT 20;

-- 3. Check for any blocking conditions
SELECT 
    bal.message,
    bal.timestamp
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE tb.name = 'Trend Following Strategy-Find Trading Pairs - MYXUSDT'
    AND bal.timestamp > NOW() - INTERVAL '1 hour'
    AND (
        bal.message LIKE '%blocked%'
        OR bal.message LIKE '%prevent%'
        OR bal.message LIKE '%skip%'
        OR bal.message LIKE '%cooldown%'
        OR bal.level = 'error'
        OR bal.level = 'warning'
    )
ORDER BY bal.timestamp DESC;

