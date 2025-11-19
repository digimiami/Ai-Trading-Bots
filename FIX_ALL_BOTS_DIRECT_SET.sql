-- =============================================
-- DIRECT SET ALL RUNNING BOTS - No Merge, Direct Assignment
-- Directly sets strategy_config for ALL running bots
-- =============================================

-- STEP 1: Show current state
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
  CASE 
    WHEN strategy_config IS NULL THEN 'NULL'
    WHEN strategy_config = '{}'::jsonb THEN 'EMPTY'
    ELSE 'HAS CONFIG'
  END as config_status
FROM trading_bots
WHERE status = 'running'
ORDER BY name;

-- STEP 2: DIRECT SET strategy_config for ALL running bots
-- This replaces the entire strategy_config, not merging
UPDATE trading_bots
SET strategy_config = jsonb_build_object(
    -- Directional Bias
    'bias_mode', 'both',
    'require_price_vs_trend', NULL,
    
    -- ADX Thresholds (lenient)
    'adx_min_htf', 15,
    'adx_trend_min', 15,
    'adx_min', 12,
    'adx_meanrev_max', 30,
    
    -- HTF Settings
    'htf_timeframe', '4h',
    'htf_trend_indicator', 'EMA200',
    
    -- RSI Settings
    'rsi_period', 14,
    'rsi_oversold', 30,
    'rsi_overbought', 70,
    
    -- Volume Requirements (lenient)
    'min_volume_requirement', 0.3,
    'volume_multiplier', 0.5,
    'min_volatility_atr', 0.1,
    'min_24h_volume_usd', 100000000,
    
    -- Momentum & VWAP
    'momentum_threshold', 0.5,
    'vwap_distance', 0.8,
    
    -- EMA Settings
    'ema_fast', 9,
    'ema_slow', 21,
    
    -- ATR Settings
    'atr_period', 14,
    'atr_stop_multiplier', 1.5,
    'atr_tp_multiplier', 2.0,
    
    -- Timing Filters (disabled)
    'time_filter_enabled', false,
    'cooldown_bars', 1,
    
    -- Scalping Mode (if applicable)
    'scalping_mode', 'auto',
    'adx_min_continuation', 12,
    'adx_min_reversal', 10,
    'volume_multiplier_continuation', 0.3,
    'volume_multiplier_reversal', 0.4,
    
    -- Supertrend (if applicable)
    'supertrend_period', 10,
    'supertrend_multiplier', 3.0,
    
    -- Bollinger Bands (if applicable)
    'bb_period', 20,
    'bb_std_dev', 2.0,
    
    -- Trendline (if applicable)
    'trendline_length', 30,
    'enable_tp', false,
    'enable_trail_sl', false
  )
WHERE status = 'running';

-- STEP 3: Verify the update
SELECT 
  '=== VERIFICATION: ALL BOTS AFTER DIRECT SET ===' as section;

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
  END as adx_trend_check,
  CASE 
    WHEN (strategy_config->>'adx_min')::numeric <= 15 THEN '✅'
    WHEN strategy_config->>'adx_min' IS NULL THEN '⚠️ NULL'
    ELSE '❌'
  END as adx_min_check
FROM trading_bots
WHERE status = 'running'
ORDER BY name;

-- STEP 4: Final summary
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

