-- =============================================
-- FORCE UPDATE ALL RUNNING BOTS - No Conditions
-- Updates ALL 10 running bots regardless of current config
-- =============================================

-- STEP 1: Show what we're working with
SELECT 
  '=== CURRENT STATE (BEFORE FIX) ===' as section;

SELECT 
  id,
  name,
  symbol,
  (strategy::jsonb)->>'type' as strategy_type,
  strategy_config->>'bias_mode' as current_bias_mode,
  strategy_config->>'adx_min_htf' as current_adx_min_htf,
  strategy_config->>'adx_trend_min' as current_adx_trend_min,
  strategy_config->>'adx_min' as current_adx_min,
  CASE 
    WHEN strategy_config IS NULL THEN 'NULL'
    WHEN strategy_config = '{}'::jsonb THEN 'EMPTY'
    ELSE 'HAS CONFIG'
  END as config_status
FROM trading_bots
WHERE status = 'running'
ORDER BY name;

-- STEP 2: FORCE UPDATE ALL RUNNING BOTS - Set bias_mode = 'both' for ALL
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || 
  jsonb_build_object('bias_mode', 'both')::jsonb
WHERE status = 'running';

-- STEP 3: FORCE UPDATE ALL RUNNING BOTS - Set lenient ADX thresholds
-- This will add/update adx_min_htf, adx_trend_min, adx_min for ALL bots
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || 
  jsonb_build_object(
    'adx_min_htf', 15,
    'adx_trend_min', 15,
    'adx_min', 12,
    'adx_meanrev_max', 30
  )::jsonb
WHERE status = 'running';

-- STEP 4: FORCE UPDATE ALL RUNNING BOTS - Set lenient volume requirements
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || 
  jsonb_build_object(
    'min_volume_requirement', 0.3,
    'volume_multiplier', 0.5,
    'min_volatility_atr', 0.1
  )::jsonb
WHERE status = 'running';

-- STEP 5: FORCE UPDATE ALL RUNNING BOTS - Set reasonable RSI thresholds
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || 
  jsonb_build_object(
    'rsi_oversold', 30,
    'rsi_overbought', 70,
    'rsi_period', 14
  )::jsonb
WHERE status = 'running';

-- STEP 6: FORCE UPDATE ALL RUNNING BOTS - Remove restrictive filters
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || 
  jsonb_build_object(
    'require_price_vs_trend', NULL,
    'time_filter_enabled', false,
    'cooldown_bars', 1
  )::jsonb
WHERE status = 'running';

-- STEP 7: FORCE UPDATE ALL RUNNING BOTS - Set HTF settings for hybrid strategies
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || 
  jsonb_build_object(
    'htf_timeframe', '4h',
    'htf_trend_indicator', 'EMA200',
    'momentum_threshold', 0.5,
    'vwap_distance', 0.8,
    'min_24h_volume_usd', 100000000
  )::jsonb
WHERE status = 'running';

-- STEP 8: FORCE UPDATE ALL RUNNING BOTS - Set scalping-specific settings
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || 
  jsonb_build_object(
    'ema_fast', 9,
    'ema_slow', 21,
    'atr_period', 14,
    'atr_stop_multiplier', 1.5,
    'atr_tp_multiplier', 2.0
  )::jsonb
WHERE status = 'running';

-- STEP 9: Verify all fixes
SELECT 
  '=== VERIFICATION: ALL BOTS AFTER FORCE UPDATE ===' as section;

SELECT 
  id,
  name,
  symbol,
  (strategy::jsonb)->>'type' as strategy_type,
  strategy_config->>'bias_mode' as bias_mode,
  strategy_config->>'adx_min_htf' as adx_min_htf,
  strategy_config->>'adx_trend_min' as adx_trend_min,
  strategy_config->>'adx_min' as adx_min,
  strategy_config->>'min_volume_requirement' as min_volume_requirement,
  strategy_config->>'volume_multiplier' as volume_multiplier,
  strategy_config->>'require_price_vs_trend' as require_price_vs_trend,
  CASE 
    WHEN strategy_config->>'bias_mode' = 'both' THEN '✅'
    ELSE '❌'
  END as bias_check,
  CASE 
    WHEN (strategy_config->>'adx_min_htf')::numeric <= 15 THEN '✅'
    WHEN strategy_config->>'adx_min_htf' IS NULL THEN '⚠️ NULL'
    ELSE '❌'
  END as adx_htf_check,
  CASE 
    WHEN (strategy_config->>'adx_trend_min')::numeric <= 15 THEN '✅'
    WHEN strategy_config->>'adx_trend_min' IS NULL THEN '⚠️ NULL'
    ELSE '❌'
  END as adx_trend_check
FROM trading_bots
WHERE status = 'running'
ORDER BY name;

-- STEP 10: Final summary
SELECT 
  '=== FINAL SUMMARY ===' as section;

SELECT 
  'Total running bots' as metric,
  COUNT(*)::text as value
FROM trading_bots
WHERE status = 'running'

UNION ALL

SELECT 
  'Bots with bias_mode = both' as metric,
  COUNT(*)::text as value
FROM trading_bots
WHERE status = 'running'
  AND strategy_config->>'bias_mode' = 'both'

UNION ALL

SELECT 
  'Bots with adx_min_htf <= 15' as metric,
  COUNT(*)::text as value
FROM trading_bots
WHERE status = 'running'
  AND (strategy_config->>'adx_min_htf')::numeric <= 15

UNION ALL

SELECT 
  'Bots with adx_trend_min <= 15' as metric,
  COUNT(*)::text as value
FROM trading_bots
WHERE status = 'running'
  AND (strategy_config->>'adx_trend_min')::numeric <= 15

UNION ALL

SELECT 
  'Bots with adx_min <= 15' as metric,
  COUNT(*)::text as value
FROM trading_bots
WHERE status = 'running'
  AND (strategy_config->>'adx_min')::numeric <= 15

UNION ALL

SELECT 
  'Bots with require_price_vs_trend = NULL' as metric,
  COUNT(*)::text as value
FROM trading_bots
WHERE status = 'running'
  AND (strategy_config->>'require_price_vs_trend' IS NULL 
       OR strategy_config->>'require_price_vs_trend' = 'null')

UNION ALL

SELECT 
  'Bots still needing API key' as metric,
  COUNT(*)::text as value
FROM trading_bots tb
LEFT JOIN api_keys ak ON tb.user_id = ak.user_id 
  AND ak.exchange = tb.exchange
  AND ak.is_active = true
WHERE tb.status = 'running'
  AND ak.id IS NULL;

