-- ============================================
-- INVESTIGATE: Cooldown Check Loop Issue
-- ============================================
-- Bot is checking cooldown repeatedly but not showing results
-- Let's see what's happening after the cooldown check
-- ============================================

-- 1. Check if bot has any trades (to understand cooldown state)
SELECT 
    tb.name,
    tb.symbol,
    COUNT(DISTINCT ptt.id) FILTER (WHERE ptt.status = 'closed') as closed_trades,
    MAX(ptt.closed_at) as last_trade_time,
    EXTRACT(EPOCH FROM (NOW() - MAX(ptt.closed_at))) / 60 as minutes_since_last_trade
FROM trading_bots tb
LEFT JOIN paper_trading_trades ptt ON tb.id = ptt.bot_id AND ptt.status = 'closed'
WHERE tb.name = 'Trend Following Strategy-Find Trading Pairs - MYXUSDT'
GROUP BY tb.id, tb.name, tb.symbol;

-- 2. Check all activity logs around cooldown checks
SELECT 
    bal.level,
    bal.category,
    bal.message,
    bal.timestamp
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE tb.name = 'Trend Following Strategy-Find Trading Pairs - MYXUSDT'
    AND bal.timestamp > NOW() - INTERVAL '1 hour'
    AND (
        bal.message LIKE '%cooldown%'
        OR bal.message LIKE '%Checking%'
        OR bal.message LIKE '%Strategy%'
        OR bal.message LIKE '%signal%'
        OR bal.message LIKE '%trade%'
    )
ORDER BY bal.timestamp DESC
LIMIT 50;

-- 3. Check bot's cooldown configuration
SELECT 
    name,
    symbol,
    strategy_config->>'cooldown_bars' as cooldown_bars,
    strategy_config->>'adx_min_htf' as adx_min_htf,
    strategy_config->>'rsi_oversold' as rsi_oversold,
    strategy_config->>'bias_mode' as bias_mode
FROM trading_bots
WHERE name = 'Trend Following Strategy-Find Trading Pairs - MYXUSDT';

-- 4. Check for any errors or warnings after cooldown checks
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
    AND bal.timestamp > (
        SELECT MAX(timestamp) 
        FROM bot_activity_logs 
        WHERE bot_id = tb.id 
        AND message LIKE '%Checking cooldown bars%'
        AND timestamp > NOW() - INTERVAL '1 hour'
    )
    AND (
        bal.level = 'error'
        OR bal.level = 'warning'
        OR bal.message LIKE '%blocked%'
        OR bal.message LIKE '%skip%'
    )
ORDER BY bal.timestamp DESC
LIMIT 20;

