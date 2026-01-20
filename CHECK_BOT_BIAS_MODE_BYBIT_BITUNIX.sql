-- Check bias_mode settings for Bybit and Bitunix bots
-- This will help identify why only long positions are being opened

SELECT 
  id,
  name,
  exchange,
  symbol,
  status,
  strategy_config->>'bias_mode' as bias_mode,
  strategy_config->>'require_price_vs_trend' as require_price_vs_trend,
  CASE 
    WHEN strategy_config->>'bias_mode' = 'long-only' THEN '❌ SHORTS BLOCKED - bias_mode is long-only'
    WHEN strategy_config->>'bias_mode' = 'short-only' THEN '❌ LONGS BLOCKED - bias_mode is short-only'
    WHEN strategy_config->>'bias_mode' = 'both' THEN '✅ Both directions allowed'
    WHEN strategy_config->>'bias_mode' = 'auto' THEN '✅ Auto mode (follows HTF trend)'
    WHEN strategy_config->>'bias_mode' IS NULL THEN '⚠️ bias_mode not set (defaults to blocking shorts if require_price_vs_trend=above)'
    ELSE '⚠️ Unknown bias_mode: ' || strategy_config->>'bias_mode'
  END as bias_status,
  CASE
    WHEN strategy_config->>'require_price_vs_trend' = 'above' THEN '⚠️ SHORTS BLOCKED - require_price_vs_trend=above blocks shorts'
    WHEN strategy_config->>'require_price_vs_trend' = 'below' THEN '⚠️ LONGS BLOCKED - require_price_vs_trend=below blocks longs'
    WHEN strategy_config->>'require_price_vs_trend' = 'any' THEN '✅ Both directions allowed'
    WHEN strategy_config->>'require_price_vs_trend' IS NULL THEN '✅ Default allows both'
    ELSE '⚠️ Unknown require_price_vs_trend: ' || strategy_config->>'require_price_vs_trend'
  END as price_vs_trend_status,
  COUNT(DISTINCT CASE WHEN t.side = 'long' THEN t.id END) as long_trades,
  COUNT(DISTINCT CASE WHEN t.side = 'short' THEN t.id END) as short_trades,
  MAX(t.created_at) as last_trade_at
FROM trading_bots tb
LEFT JOIN trades t ON t.bot_id = tb.id AND t.created_at >= NOW() - INTERVAL '30 days'
WHERE tb.exchange IN ('bybit', 'bitunix')
  AND tb.status = 'active'
GROUP BY tb.id, tb.name, tb.exchange, tb.symbol, tb.status, tb.strategy_config
ORDER BY tb.exchange, tb.symbol, tb.name;
