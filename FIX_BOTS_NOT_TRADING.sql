-- ============================================
-- FIX BOTS NOT TRADING - Enable Shorts & Adjust Thresholds
-- ============================================
-- NOTE: All strategy_config fields are NULL, so bots are using strict defaults
-- This script sets proper values to enable trading

-- ISSUE 1: Hybrid Trend bots can't trade when price is below EMA200 because shorts are disabled
-- SOLUTION: Enable shorts by setting bias_mode to 'both' and lower ADX requirements

-- Fix Hybrid Trend + Mean Reversion Strategy bots
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || 
  jsonb_build_object(
    'bias_mode', 'both',
    'require_price_vs_trend', NULL,
    'adx_min_htf', CASE 
      WHEN symbol IN ('FILUSDT', 'HBARUSDT') THEN 15
      ELSE 20
    END,
    'adx_trend_min', CASE 
      WHEN symbol IN ('FILUSDT', 'HBARUSDT') THEN 18
      ELSE 22
    END,
    'adx_meanrev_max', 19,
    'rsi_oversold', 30,
    'rsi_overbought', 70,
    'momentum_threshold', 0.8,
    'vwap_distance', 1.2
  )::jsonb
WHERE status = 'running'
  AND name LIKE '%Hybrid Trend + Mean Reversion Strategy%';

-- ISSUE 2: Scalping bots have volume requirements too strict (default 1.2x minimum)
-- SOLUTION: Lower volume requirement to 0.5x for more trading opportunities

-- Fix Scalping Strategy - Fast EMA Cloud bots
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || 
  jsonb_build_object(
    'min_volume_requirement', 0.5,
    'adx_min', 15,
    'ema_fast', 9,
    'ema_slow', 21,
    'rsi_period', 14,
    'rsi_oversold', 30,
    'rsi_overbought', 70,
    'atr_period', 14,
    'atr_stop_multiplier', 1.5,
    'atr_tp_multiplier', 2.0
  )::jsonb
WHERE status = 'running'
  AND name LIKE '%Scalping Strategy - Fast EMA Cloud%';

-- ISSUE 3: Advanced Scalping bots - lower volume requirement for continuation mode
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || 
  jsonb_build_object(
    'volume_multiplier_continuation', 0.4,
    'volume_multiplier_reversal', 0.6,
    'adx_min_continuation', 15,
    'adx_min_reversal', 12,
    'supertrend_period', 10,
    'supertrend_multiplier', 3.0,
    'ema_fast', 8,
    'ema_slow', 34,
    'rsi_period', 14,
    'rsi_oversold', 30,
    'rsi_overbought', 70,
    'bb_period', 20,
    'bb_std_dev', 2.0,
    'atr_period', 14,
    'atr_stop_multiplier', 1.2,
    'atr_tp1_multiplier', 1.5,
    'atr_tp2_multiplier', 2.5
  )::jsonb
WHERE status = 'running'
  AND name LIKE '%Advanced Dual-Mode Scalping Strategy%';

-- ISSUE 4: Trend Following Strategy bots - need proper configuration
-- SOLUTION: Set appropriate defaults for trend following strategy

UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || 
  jsonb_build_object(
    'bias_mode', 'both',
    'adx_min', 20,
    'rsi_period', 14,
    'rsi_oversold', 30,
    'rsi_overbought', 70,
    'ema_fast', 12,
    'ema_slow', 26,
    'trend_confirmation_periods', 3,
    'min_volume_requirement', 0.8
  )::jsonb
WHERE status = 'running'
  AND name LIKE '%Trend Following Strategy%';

-- ISSUE 5: Trendline Breakout Strategy - ensure proper configuration
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || 
  jsonb_build_object(
    'bias_mode', 'both',
    'trendline_length', 30,
    'volume_multiplier', 1.2,
    'enable_tp', false,
    'enable_trail_sl', false
  )::jsonb
WHERE status = 'running'
  AND name LIKE '%Trendline Breakout Strategy%';

-- Verify changes
SELECT 
  id,
  name,
  symbol,
  strategy_config::jsonb->>'bias_mode' as bias_mode,
  strategy_config::jsonb->>'require_price_vs_trend' as require_price_vs_trend,
  strategy_config::jsonb->>'min_volume_requirement' as min_volume_requirement,
  strategy_config::jsonb->>'adx_min_htf' as adx_min_htf,
  strategy_config::jsonb->>'adx_trend_min' as adx_trend_min
FROM trading_bots
WHERE status = 'running'
ORDER BY name;

