-- =============================================
-- FIX ALL BOTS NOT TRADING - Based on Activity Report Analysis
-- =============================================

-- ISSUE 1: Immediate Trading Bot - XRPUSDT
-- Problem: "No trading signals detected (all strategy parameters checked)"
-- Cause: Bot is using default strategy evaluation, not scalping strategy
-- Fix: Update strategy type and config to use scalping with ultra-lenient settings

UPDATE trading_bots
SET 
  strategy = '{"type": "scalping", "name": "Immediate Trading Bot", "allows_custom_pair": true, "immediate_trading": true}'::jsonb,
  strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || 
  jsonb_build_object(
    'adx_min', 5,
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
    'atr_tp_multiplier', 2.0
  )::jsonb,
  timeframe = '5m'
WHERE name LIKE '%Immediate Trading Bot%'
  AND status = 'running';

-- ISSUE 2: Hybrid Trend + Mean Reversion Strategy - HBARUSDT
-- Problem: "HTF price (0.15) not above EMA200 (0.17) and shorts disabled"
-- Fix: Enable shorts (bias_mode: both) and lower ADX requirements

UPDATE trading_bots
SET 
  strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || 
  jsonb_build_object(
    'bias_mode', 'both',
    'adx_min_htf', 8,
    'adx_trend_min', 10,
    'adx_meanrev_max', 30,
    'require_price_vs_trend', NULL
  )::jsonb
WHERE name LIKE '%Hybrid Trend + Mean Reversion Strategy%HBARUSDT%'
  AND status = 'running';

-- ISSUE 3: Scalping Strategy - Fast EMA Cloud - SOLUSDT
-- Problem: "Volatility too low: ATR 0.20% < minimum 0.3%"
-- Fix: Lower min_volatility_atr to 0.15%

UPDATE trading_bots
SET 
  strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || 
  jsonb_build_object(
    'min_volatility_atr', 0.15,
    'adx_min', 8,
    'min_volume_requirement', 0.3
  )::jsonb
WHERE name LIKE '%Scalping Strategy - Fast EMA Cloud%SOLUSDT%'
  AND status = 'running';

-- ISSUE 4: Hybrid Trend + Mean Reversion Strategy - FILUSDT
-- Problem: "HTF ADX (9.28) below minimum (23)"
-- Fix: Lower adx_min_htf to 8

UPDATE trading_bots
SET 
  strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || 
  jsonb_build_object(
    'bias_mode', 'both',
    'adx_min_htf', 8,
    'adx_trend_min', 10,
    'adx_meanrev_max', 30
  )::jsonb
WHERE name LIKE '%Hybrid Trend + Mean Reversion Strategy%FILUSDT%'
  AND status = 'running';

-- ISSUE 5 & 6: Trend Following Strategy bots (HYPEUSDT, ASTERUSDT)
-- Problem: "No trading signals detected"
-- Fix: Update to use proper strategy type and lenient config

UPDATE trading_bots
SET 
  strategy = COALESCE(strategy, '{}'::jsonb)::jsonb || 
  jsonb_build_object(
    'type', 'hybrid_trend_meanreversion',
    'name', 'Trend Following Strategy'
  )::jsonb,
  strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || 
  jsonb_build_object(
    'bias_mode', 'both',
    'adx_min_htf', 8,
    'adx_trend_min', 10,
    'adx_meanrev_max', 30,
    'rsi_oversold', 40,
    'rsi_overbought', 60,
    'momentum_threshold', 0.3,
    'vwap_distance', 0.5,
    'require_price_vs_trend', NULL
  )::jsonb
WHERE name LIKE '%Trend Following Strategy%'
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
  strategy->>'type' as strategy_type,
  strategy_config->>'bias_mode' as bias_mode,
  strategy_config->>'adx_min' as adx_min,
  strategy_config->>'adx_min_htf' as adx_min_htf,
  strategy_config->>'adx_trend_min' as adx_trend_min,
  strategy_config->>'min_volatility_atr' as min_volatility_atr,
  strategy_config->>'min_volume_requirement' as min_volume_requirement,
  strategy_config->>'rsi_oversold' as rsi_oversold,
  strategy_config->>'rsi_overbought' as rsi_overbought,
  strategy_config->>'immediate_execution' as immediate_execution
FROM trading_bots
WHERE status = 'running'
  AND (
    name LIKE '%Immediate Trading Bot%' OR
    name LIKE '%Hybrid Trend%' OR
    name LIKE '%Scalping Strategy%' OR
    name LIKE '%Trend Following Strategy%'
  )
ORDER BY name;

