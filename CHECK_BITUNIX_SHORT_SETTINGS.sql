-- Check Bitunix bot configurations for short trading restrictions
-- This will show which bots are blocking short positions

SELECT 
  id,
  name,
  exchange,
  symbol,
  status,
  strategy_config->>'bias_mode' as bias_mode,
  strategy_config->>'require_price_vs_trend' as require_price_vs_trend,
  CASE 
    WHEN strategy_config->>'bias_mode' = 'long-only' THEN '❌ BLOCKED: bias_mode is long-only'
    WHEN strategy_config->>'require_price_vs_trend' = 'above' THEN '❌ BLOCKED: require_price_vs_trend is above'
    WHEN strategy_config->>'bias_mode' IS NULL AND strategy_config->>'require_price_vs_trend' IS NULL THEN '⚠️ DEFAULT: Will use auto/any (shorts allowed)'
    WHEN strategy_config->>'bias_mode' IN ('both', 'auto') 
      AND (strategy_config->>'require_price_vs_trend' IS NULL OR strategy_config->>'require_price_vs_trend' != 'above')
    THEN '✅ ALLOWED: Shorts enabled'
    ELSE '⚠️ CHECK: Unknown configuration'
  END as short_status,
  strategy_config as full_config
FROM trading_bots
WHERE exchange = 'bitunix'
  AND status = 'active'
ORDER BY symbol, name;

-- Show recent trades to see if any shorts were executed
SELECT 
  bot_id,
  symbol,
  side,
  COUNT(*) as trade_count,
  MAX(executed_at) as last_trade_time
FROM trades
WHERE exchange = 'bitunix'
  AND executed_at > NOW() - INTERVAL '7 days'
GROUP BY bot_id, symbol, side
ORDER BY last_trade_time DESC;
