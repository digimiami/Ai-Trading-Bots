-- =============================================
-- FIX ALL BOTS STRATEGY_CONFIG - Set Proper Values
-- All strategy_config fields are NULL, so bots are using strict defaults
-- This script sets proper values for all bots
-- =============================================

-- ISSUE 1: Immediate Trading Bot - XRPUSDT
-- Set ultra-lenient scalping config
UPDATE trading_bots
SET 
  strategy_config = jsonb_build_object(
    'adx_min', 15,
    'min_volume_requirement', 0.1,
    'volume_multiplier', 0.3,
    'min_volatility_atr', 0.05,
    'rsi_oversold', 50,
    'rsi_overbought', 50,
    'time_filter_enabled', false,
    'cooldown_bars', 0,
    'immediate_execution', true,
    'fast_entry', true,
    'ema_fast', 9,
    'ema_slow', 21,
    'atr_period', 14,
    'atr_stop_multiplier', 1.5,
    'atr_tp_multiplier', 2.0,
    'bias_mode', 'both'
  )
WHERE name LIKE '%Immediate Trading Bot%'
  AND status = 'running';

-- ISSUE 2: Hybrid Trend + Mean Reversion Strategy - HBARUSDT
-- Enable shorts and lower ADX requirements
UPDATE trading_bots
SET 
  strategy_config = jsonb_build_object(
    'bias_mode', 'both',
    'adx_min_htf', 15,
    'adx_trend_min', 10,
    'adx_meanrev_max', 30,
    'require_price_vs_trend', NULL,
    'htf_timeframe', '4h',
    'htf_trend_indicator', 'EMA200',
    'rsi_oversold', 35,
    'rsi_overbought', 65,
    'momentum_threshold', 0.3,
    'vwap_distance', 0.5,
    'cooldown_bars', 2
  )
WHERE name LIKE '%Hybrid Trend + Mean Reversion Strategy%HBARUSDT%'
  AND status = 'running';

-- ISSUE 3: Scalping Strategy - Fast EMA Cloud - SOLUSDT
-- Lower volatility and volume requirements
UPDATE trading_bots
SET 
  strategy_config = jsonb_build_object(
    'min_volatility_atr', 0.15,
    'adx_min', 15,
    'min_volume_requirement', 0.3,
    'volume_multiplier', 0.5,
    'ema_fast', 9,
    'ema_slow', 21,
    'rsi_oversold', 40,
    'rsi_overbought', 60,
    'atr_period', 14,
    'atr_stop_multiplier', 1.5,
    'atr_tp_multiplier', 2.0,
    'time_filter_enabled', false,
    'cooldown_bars', 1,
    'bias_mode', 'both'
  )
WHERE name LIKE '%Scalping Strategy - Fast EMA Cloud%SOLUSDT%'
  AND status = 'running';

-- ISSUE 4: Hybrid Trend + Mean Reversion Strategy - FILUSDT
-- Lower ADX requirements
UPDATE trading_bots
SET 
  strategy_config = jsonb_build_object(
    'bias_mode', 'both',
    'adx_min_htf', 15,
    'adx_trend_min', 10,
    'adx_meanrev_max', 30,
    'require_price_vs_trend', NULL,
    'htf_timeframe', '4h',
    'htf_trend_indicator', 'EMA200',
    'rsi_oversold', 35,
    'rsi_overbought', 65,
    'momentum_threshold', 0.3,
    'vwap_distance', 0.5,
    'cooldown_bars', 2
  )
WHERE name LIKE '%Hybrid Trend + Mean Reversion Strategy%FILUSDT%'
  AND status = 'running';

-- ISSUE 5 & 6: Trend Following Strategy bots (HYPEUSDT, ASTERUSDT)
-- Set proper hybrid strategy config
UPDATE trading_bots
SET 
  strategy_config = jsonb_build_object(
    'bias_mode', 'both',
    'adx_min_htf', 15,
    'adx_trend_min', 10,
    'adx_meanrev_max', 30,
    'rsi_oversold', 40,
    'rsi_overbought', 60,
    'momentum_threshold', 0.3,
    'vwap_distance', 0.5,
    'require_price_vs_trend', NULL,
    'htf_timeframe', '4h',
    'htf_trend_indicator', 'EMA200',
    'cooldown_bars', 2
  )
WHERE name LIKE '%Trend Following Strategy%'
  AND status = 'running';

-- ISSUE 7: Advanced Dual-Mode Scalping Strategy - DOGEUSDT
-- Set proper advanced scalping config
UPDATE trading_bots
SET 
  strategy_config = jsonb_build_object(
    'scalping_mode', 'auto',
    'adx_min_continuation', 15,
    'adx_min_reversal', 12,
    'volume_multiplier_continuation', 0.3,
    'volume_multiplier_reversal', 0.4,
    'supertrend_period', 10,
    'supertrend_multiplier', 3.0,
    'ema_fast', 8,
    'ema_slow', 34,
    'rsi_period', 14,
    'rsi_oversold', 40,
    'rsi_overbought', 60,
    'bb_period', 20,
    'bb_std_dev', 2.0,
    'atr_period', 14,
    'atr_stop_multiplier', 1.2,
    'atr_tp1_multiplier', 1.5,
    'atr_tp2_multiplier', 2.5,
    'time_filter_enabled', false,
    'cooldown_bars', 1,
    'bias_mode', 'both'
  )
WHERE name LIKE '%Advanced Dual-Mode Scalping Strategy%'
  AND status = 'running';

-- =============================================
-- VERIFY ALL FIXES
-- =============================================

SELECT 
  id,
  name,
  symbol,
  timeframe,
  status,
  (strategy::jsonb)->>'type' as strategy_type,
  strategy_config->>'bias_mode' as bias_mode,
  strategy_config->>'adx_min' as adx_min,
  strategy_config->>'adx_min_htf' as adx_min_htf,
  strategy_config->>'adx_trend_min' as adx_trend_min,
  strategy_config->>'min_volatility_atr' as min_volatility_atr,
  strategy_config->>'min_volume_requirement' as min_volume_requirement,
  strategy_config->>'rsi_oversold' as rsi_oversold,
  strategy_config->>'rsi_overbought' as rsi_overbought,
  strategy_config->>'immediate_execution' as immediate_execution,
  CASE 
    WHEN strategy_config IS NULL THEN 'NULL - NEEDS FIX'
    WHEN strategy_config = '{}'::jsonb THEN 'EMPTY - NEEDS FIX'
    ELSE 'OK'
  END as config_status
FROM trading_bots
WHERE status = 'running'
  AND (
    name LIKE '%Immediate Trading Bot%' OR
    name LIKE '%Hybrid Trend%' OR
    name LIKE '%Scalping Strategy%' OR
    name LIKE '%Trend Following Strategy%' OR
    name LIKE '%Advanced Dual-Mode Scalping%'
  )
ORDER BY name;

