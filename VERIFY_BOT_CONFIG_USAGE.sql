-- ============================================
-- VERIFY BOT IS USING UPDATED CONFIG
-- ============================================
-- Check if the bot's strategy evaluation is using the relaxed parameters
-- ============================================

-- Check BTC bot's current config
SELECT 
    name,
    symbol,
    strategy_config->>'adx_min_htf' as adx_min_htf,
    strategy_config->>'adx_trend_min' as adx_trend_min,
    strategy_config->>'rsi_oversold' as rsi_oversold,
    strategy_config->>'rsi_overbought' as rsi_overbought,
    strategy_config->>'bias_mode' as bias_mode,
    strategy_config->>'cooldown_bars' as cooldown_bars
FROM trading_bots
WHERE name = 'BTC TRADINGVIEW ALERT TEST';

-- Check recent strategy evaluation logs to see what thresholds are being checked
SELECT 
    bal.message,
    bal.details,
    bal.timestamp
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE tb.name = 'BTC TRADINGVIEW ALERT TEST'
    AND bal.category = 'strategy'
    AND bal.message LIKE '%ADX%'
    AND bal.timestamp > NOW() - INTERVAL '1 hour'
ORDER BY bal.timestamp DESC
LIMIT 10;

