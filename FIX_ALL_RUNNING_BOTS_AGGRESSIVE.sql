-- =============================================
-- AGGRESSIVE FIX FOR ALL RUNNING BOTS
-- Updates ALL running bots to have lenient configs
-- Based on diagnostic: 7 bots have "conditions not met"
-- =============================================

-- STEP 1: Check current bot configurations first
SELECT 
  '=== CURRENT BOT CONFIGURATIONS (BEFORE FIX) ===' as section;

SELECT 
  id,
  name,
  symbol,
  (strategy::jsonb)->>'type' as strategy_type,
  strategy_config->>'bias_mode' as bias_mode,
  strategy_config->>'adx_min' as adx_min,
  strategy_config->>'adx_min_htf' as adx_min_htf,
  strategy_config->>'adx_trend_min' as adx_trend_min,
  strategy_config->>'min_volume_requirement' as min_volume_requirement,
  strategy_config->>'volume_multiplier' as volume_multiplier
FROM trading_bots
WHERE status = 'running'
ORDER BY name;

-- STEP 2: Fix ALL Hybrid Trend + Mean Reversion bots (regardless of current config)
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || jsonb_build_object(
    'bias_mode', 'both',
    'adx_min_htf', 15,
    'adx_trend_min', 15,
    'adx_meanrev_max', 30,
    'require_price_vs_trend', NULL,
    'htf_timeframe', '4h',
    'htf_trend_indicator', 'EMA200',
    'rsi_oversold', 30,
    'rsi_overbought', 70,
    'momentum_threshold', 0.5,
    'vwap_distance', 0.8,
    'cooldown_bars', 2,
    'min_24h_volume_usd', 100000000
  )::jsonb
WHERE status = 'running'
  AND (
    (strategy::jsonb)->>'type' = 'hybrid_trend_meanreversion'
    OR name LIKE '%Hybrid Trend%'
    OR name LIKE '%Hybrid%Mean Reversion%'
  );

-- STEP 3: Fix ALL Scalping bots (regardless of current config)
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || jsonb_build_object(
    'adx_min', 12,
    'min_volume_requirement', 0.3,
    'volume_multiplier', 0.5,
    'min_volatility_atr', 0.1,
    'rsi_oversold', 35,
    'rsi_overbought', 65,
    'ema_fast', 9,
    'ema_slow', 21,
    'atr_period', 14,
    'atr_stop_multiplier', 1.5,
    'atr_tp_multiplier', 2.0,
    'time_filter_enabled', false,
    'cooldown_bars', 1,
    'bias_mode', 'both'
  )::jsonb
WHERE status = 'running'
  AND (
    (strategy::jsonb)->>'type' = 'scalping'
    OR name LIKE '%Scalping%'
    OR name LIKE '%Scalp%'
  );

-- STEP 4: Fix ALL Advanced Scalping bots
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || jsonb_build_object(
    'scalping_mode', 'auto',
    'adx_min_continuation', 12,
    'adx_min_reversal', 10,
    'volume_multiplier_continuation', 0.3,
    'volume_multiplier_reversal', 0.4,
    'supertrend_period', 10,
    'supertrend_multiplier', 3.0,
    'ema_fast', 8,
    'ema_slow', 34,
    'rsi_period', 14,
    'rsi_oversold', 35,
    'rsi_overbought', 65,
    'bb_period', 20,
    'bb_std_dev', 2.0,
    'atr_period', 14,
    'atr_stop_multiplier', 1.2,
    'atr_tp1_multiplier', 1.5,
    'atr_tp2_multiplier', 2.5,
    'time_filter_enabled', false,
    'cooldown_bars', 1,
    'bias_mode', 'both'
  )::jsonb
WHERE status = 'running'
  AND (
    (strategy::jsonb)->>'type' = 'advanced_scalping'
    OR name LIKE '%Advanced%Scalping%'
    OR name LIKE '%Dual-Mode%Scalping%'
  );

-- STEP 5: Fix ALL Trendline Breakout bots
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || jsonb_build_object(
    'trendline_length', 30,
    'volume_multiplier', 1.0,
    'bias_mode', 'both',
    'enable_tp', false,
    'enable_trail_sl', false
  )::jsonb
WHERE status = 'running'
  AND (
    (strategy::jsonb)->>'type' = 'trendline_breakout'
    OR name LIKE '%Trendline%Breakout%'
    OR name LIKE '%Breakout%'
  );

-- STEP 6: Fix ALL Trend Following bots - convert to hybrid with lenient settings
UPDATE trading_bots
SET 
  strategy = jsonb_build_object('type', 'hybrid_trend_meanreversion')::text,
  strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || jsonb_build_object(
    'bias_mode', 'both',
    'adx_min_htf', 15,
    'adx_trend_min', 15,
    'adx_meanrev_max', 30,
    'rsi_oversold', 30,
    'rsi_overbought', 70,
    'momentum_threshold', 0.5,
    'vwap_distance', 0.8,
    'require_price_vs_trend', NULL,
    'htf_timeframe', '4h',
    'htf_trend_indicator', 'EMA200',
    'cooldown_bars', 2,
    'min_24h_volume_usd', 100000000
  )::jsonb
WHERE status = 'running'
  AND (
    (strategy::jsonb)->>'type' = 'trend_following'
    OR name LIKE '%Trend Following%'
    OR name LIKE '%Trend-Following%'
  );

-- STEP 7: For ANY remaining bots, ensure bias_mode = 'both' and reasonable thresholds
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || jsonb_build_object(
    'bias_mode', 'both',
    'adx_min', COALESCE((strategy_config->>'adx_min')::numeric, 15),
    'adx_min_htf', COALESCE((strategy_config->>'adx_min_htf')::numeric, 15),
    'adx_trend_min', COALESCE((strategy_config->>'adx_trend_min')::numeric, 15),
    'min_volume_requirement', LEAST(COALESCE((strategy_config->>'min_volume_requirement')::numeric, 0.5), 0.5),
    'volume_multiplier', LEAST(COALESCE((strategy_config->>'volume_multiplier')::numeric, 1.0), 1.0),
    'rsi_oversold', GREATEST(COALESCE((strategy_config->>'rsi_oversold')::numeric, 30), 30),
    'rsi_overbought', LEAST(COALESCE((strategy_config->>'rsi_overbought')::numeric, 70), 70),
    'require_price_vs_trend', NULL
  )::jsonb
WHERE status = 'running'
  AND (
    strategy_config->>'bias_mode' != 'both'
    OR strategy_config->>'bias_mode' IS NULL
    OR (strategy_config->>'adx_min_htf')::numeric > 20
    OR (strategy_config->>'adx_trend_min')::numeric > 20
    OR (strategy_config->>'adx_min')::numeric > 20
    OR strategy_config->>'require_price_vs_trend' = 'above'
  );

-- STEP 8: Verify fixes applied
SELECT 
  '=== BOT CONFIGURATIONS AFTER FIX ===' as section;

SELECT 
  id,
  name,
  symbol,
  (strategy::jsonb)->>'type' as strategy_type,
  strategy_config->>'bias_mode' as bias_mode,
  strategy_config->>'adx_min' as adx_min,
  strategy_config->>'adx_min_htf' as adx_min_htf,
  strategy_config->>'adx_trend_min' as adx_trend_min,
  strategy_config->>'min_volume_requirement' as min_volume_requirement,
  strategy_config->>'volume_multiplier' as volume_multiplier,
  strategy_config->>'require_price_vs_trend' as require_price_vs_trend,
  CASE 
    WHEN strategy_config->>'bias_mode' = 'both' THEN '✅'
    WHEN strategy_config->>'bias_mode' = 'long-only' THEN '⚠️ LONG-ONLY'
    ELSE '❌'
  END as bias_status,
  CASE 
    WHEN (strategy_config->>'adx_min_htf')::numeric <= 15 THEN '✅'
    WHEN (strategy_config->>'adx_min_htf')::numeric > 20 THEN '⚠️ TOO HIGH'
    ELSE 'ℹ️'
  END as adx_htf_status,
  CASE 
    WHEN (strategy_config->>'adx_trend_min')::numeric <= 15 THEN '✅'
    WHEN (strategy_config->>'adx_trend_min')::numeric > 20 THEN '⚠️ TOO HIGH'
    ELSE 'ℹ️'
  END as adx_trend_status
FROM trading_bots
WHERE status = 'running'
ORDER BY name;

-- STEP 9: Summary of fixes
SELECT 
  '=== SUMMARY OF FIXES APPLIED ===' as section;

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

