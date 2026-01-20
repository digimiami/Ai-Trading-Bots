-- Fix bots on Bybit and Bitunix to allow short positions
-- This updates bots that have bias_mode='long-only' or require_price_vs_trend='above'

-- First, show what will be changed
SELECT 
  id,
  name,
  exchange,
  symbol,
  strategy_config->>'bias_mode' as current_bias_mode,
  strategy_config->>'require_price_vs_trend' as current_require_price_vs_trend,
  CASE 
    WHEN strategy_config->>'bias_mode' = 'long-only' THEN 'Will change bias_mode to auto'
    WHEN strategy_config->>'require_price_vs_trend' = 'above' THEN 'Will change require_price_vs_trend to any'
    ELSE 'No change needed'
  END as change_needed
FROM trading_bots
WHERE exchange IN ('bybit', 'bitunix')
  AND status = 'active'
  AND (
    strategy_config->>'bias_mode' = 'long-only' OR
    strategy_config->>'require_price_vs_trend' = 'above'
  )
ORDER BY exchange, symbol;

-- Update bots to allow shorts
UPDATE trading_bots
SET strategy_config = jsonb_set(
  jsonb_set(
    COALESCE(strategy_config, '{}'::jsonb),
    '{bias_mode}',
    '"auto"'
  ),
  '{require_price_vs_trend}',
  '"any"'
)
WHERE exchange IN ('bybit', 'bitunix')
  AND status = 'active'
  AND (
    strategy_config->>'bias_mode' = 'long-only' OR
    strategy_config->>'require_price_vs_trend' = 'above' OR
    strategy_config->>'bias_mode' IS NULL
  );

-- Verify the changes
SELECT 
  id,
  name,
  exchange,
  symbol,
  strategy_config->>'bias_mode' as new_bias_mode,
  strategy_config->>'require_price_vs_trend' as new_require_price_vs_trend,
  CASE 
    WHEN strategy_config->>'bias_mode' IN ('both', 'auto') 
      AND strategy_config->>'require_price_vs_trend' != 'above' 
    THEN '✅ Shorts allowed'
    ELSE '❌ Shorts still blocked'
  END as short_status
FROM trading_bots
WHERE exchange IN ('bybit', 'bitunix')
  AND status = 'active'
ORDER BY exchange, symbol;
