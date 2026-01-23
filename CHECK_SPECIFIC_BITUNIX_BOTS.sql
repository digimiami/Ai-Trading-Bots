-- Check specific Bitunix bot configurations that are only trading long
-- Based on recent trade history showing only "buy" trades

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
  AND id IN (
    '8d20c10f-b55d-44ec-a759-8ffe9948be0e', -- BTCUSDT
    'f1889d57-42a3-4a85-a2bf-c7959bbcf501', -- ETHUSDT
    'fb41b4ab-7723-40a6-aa97-5dac1b4e29cc', -- PIPPINUSDT
    '324c818d-5c22-4ca1-8324-6befcc077953'  -- RIVERUSDT
  )
ORDER BY symbol;

-- Fix these specific bots to allow shorts
UPDATE trading_bots
SET strategy_config = 
  CASE 
    -- If strategy_config is NULL or not a JSONB object, create a new object
    WHEN strategy_config IS NULL OR jsonb_typeof(strategy_config) != 'object' THEN
      '{"bias_mode": "auto", "require_price_vs_trend": "any"}'::jsonb
    -- Otherwise, update the existing object
    ELSE
      jsonb_set(
        jsonb_set(
          strategy_config,
          '{bias_mode}',
          '"auto"'
        ),
        '{require_price_vs_trend}',
        '"any"'
      )
  END
WHERE exchange = 'bitunix'
  AND id IN (
    '8d20c10f-b55d-44ec-a759-8ffe9948be0e', -- BTCUSDT
    'f1889d57-42a3-4a85-a2bf-c7959bbcf501', -- ETHUSDT
    'fb41b4ab-7723-40a6-aa97-5dac1b4e29cc', -- PIPPINUSDT
    '324c818d-5c22-4ca1-8324-6befcc077953'  -- RIVERUSDT
  )
  AND (
    strategy_config->>'bias_mode' = 'long-only' OR
    strategy_config->>'require_price_vs_trend' = 'above' OR
    strategy_config->>'bias_mode' IS NULL OR
    strategy_config IS NULL OR
    jsonb_typeof(strategy_config) != 'object'
  );

-- Verify the fix
SELECT 
  id,
  name,
  symbol,
  strategy_config->>'bias_mode' as new_bias_mode,
  strategy_config->>'require_price_vs_trend' as new_require_price_vs_trend,
  CASE 
    WHEN strategy_config->>'bias_mode' IN ('both', 'auto') 
      AND (strategy_config->>'require_price_vs_trend' IS NULL OR strategy_config->>'require_price_vs_trend' != 'above') 
    THEN '✅ Shorts now enabled'
    ELSE '❌ Still blocked'
  END as fix_status
FROM trading_bots
WHERE exchange = 'bitunix'
  AND id IN (
    '8d20c10f-b55d-44ec-a759-8ffe9948be0e',
    'f1889d57-42a3-4a85-a2bf-c7959bbcf501',
    'fb41b4ab-7723-40a6-aa97-5dac1b4e29cc',
    '324c818d-5c22-4ca1-8324-6befcc077953'
  )
ORDER BY symbol;
