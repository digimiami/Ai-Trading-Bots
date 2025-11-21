-- Make "Immediate Trading Bot - Custom Pairs" SUPER AGGRESSIVE
-- No restrictions, starts trading immediately when activated
-- =============================================

-- Update the bot in pablo_ready_bots (template)
UPDATE public.pablo_ready_bots
SET strategy_config = '{
  "bias_mode": "both",
  "ema_fast": 5,
  "ema_slow": 10,
  "rsi_period": 14,
  "rsi_oversold": 0,
  "rsi_overbought": 100,
  "atr_period": 14,
  "atr_stop_multiplier": 1.0,
  "atr_tp_multiplier": 1.5,
  "adx_min": 0,
  "adx_min_htf": 15,
  "adx_trend_min": 0,
  "min_volume_requirement": 0,
  "volume_multiplier": 0,
  "min_volatility_atr": 0,
  "time_filter_enabled": false,
  "allowed_hours_utc": [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
  "cooldown_bars": 0,
  "risk_per_trade_pct": 2.0,
  "daily_loss_limit_pct": 10.0,
  "weekly_loss_limit_pct": 20.0,
  "max_trades_per_day": 999,
  "max_concurrent": 10,
  "max_consecutive_losses": 999,
  "sl_atr_mult": 1.0,
  "tp1_r": 1.0,
  "tp2_r": 1.5,
  "tp1_size": 0.5,
  "tp2_size": 0.5,
  "breakeven_at_r": 0.3,
  "trail_after_tp1_atr": 0.5,
  "time_stop_hours": 24,
  "use_ml_prediction": false,
  "fast_entry": true,
  "immediate_execution": true,
  "disable_htf_adx_check": true,
  "scalping_mode": true,
  "adx_min_continuation": 0,
  "adx_min_reversal": 0,
  "volume_multiplier_continuation": 0,
  "volume_multiplier_reversal": 0,
  "momentum_threshold": 0,
  "vwap_distance": 0,
  "require_price_vs_trend": false,
  "adx_min_htf": 15
}'::jsonb
WHERE name = 'Immediate Trading Bot - Custom Pairs';

-- Update ALL existing bots created from this template
UPDATE public.trading_bots
SET strategy_config = jsonb_build_object(
  'bias_mode', 'both',
  'ema_fast', 5,
  'ema_slow', 10,
  'rsi_period', 14,
  'rsi_oversold', 0,
  'rsi_overbought', 100,
  'atr_period', 14,
  'atr_stop_multiplier', 1.0,
  'atr_tp_multiplier', 1.5,
  'adx_min', 0,
  'adx_min_htf', 15,
  'adx_trend_min', 0,
  'min_volume_requirement', 0,
  'volume_multiplier', 0,
  'min_volatility_atr', 0,
  'time_filter_enabled', false,
  'allowed_hours_utc', ARRAY[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
  'cooldown_bars', 0,
  'risk_per_trade_pct', 2.0,
  'daily_loss_limit_pct', 10.0,
  'weekly_loss_limit_pct', 20.0,
  'max_trades_per_day', 999,
  'max_concurrent', 10,
  'max_consecutive_losses', 999,
  'sl_atr_mult', 1.0,
  'tp1_r', 1.0,
  'tp2_r', 1.5,
  'tp1_size', 0.5,
  'tp2_size', 0.5,
  'breakeven_at_r', 0.3,
  'trail_after_tp1_atr', 0.5,
  'time_stop_hours', 24,
  'use_ml_prediction', false,
  'fast_entry', true,
  'immediate_execution', true,
  'disable_htf_adx_check', true,
  'scalping_mode', true,
  'adx_min_continuation', 0,
  'adx_min_reversal', 0,
  'volume_multiplier_continuation', 0,
  'volume_multiplier_reversal', 0,
  'momentum_threshold', 0,
  'vwap_distance', 0,
  'require_price_vs_trend', false
)
WHERE name LIKE '%Immediate Trading Bot - Custom Pairs%'
   OR (strategy::jsonb->>'immediate_trading')::boolean = true;

-- Also update strategy JSON to ensure it's scalping type
UPDATE public.pablo_ready_bots
SET strategy = '{"type": "scalping", "name": "Immediate Trading Bot", "allows_custom_pair": true, "immediate_trading": true, "super_aggressive": true}'::jsonb
WHERE name = 'Immediate Trading Bot - Custom Pairs';

UPDATE public.trading_bots
SET strategy = '{"type": "scalping", "name": "Immediate Trading Bot", "allows_custom_pair": true, "immediate_trading": true, "super_aggressive": true}'::jsonb
WHERE name LIKE '%Immediate Trading Bot - Custom Pairs%'
   OR (strategy::jsonb->>'immediate_trading')::boolean = true;

-- Verify the update
SELECT 
  name,
  strategy::jsonb->>'type' as strategy_type,
  strategy_config->>'cooldown_bars' as cooldown_bars,
  strategy_config->>'adx_min' as adx_min,
  strategy_config->>'max_trades_per_day' as max_trades_per_day,
  strategy_config->>'disable_htf_adx_check' as disable_htf_adx_check,
  strategy_config->>'immediate_execution' as immediate_execution
FROM public.pablo_ready_bots
WHERE name = 'Immediate Trading Bot - Custom Pairs';

SELECT 
  name,
  strategy::jsonb->>'type' as strategy_type,
  strategy_config->>'cooldown_bars' as cooldown_bars,
  strategy_config->>'adx_min' as adx_min,
  strategy_config->>'max_trades_per_day' as max_trades_per_day,
  strategy_config->>'disable_htf_adx_check' as disable_htf_adx_check,
  strategy_config->>'immediate_execution' as immediate_execution
FROM public.trading_bots
WHERE name LIKE '%Immediate Trading Bot - Custom Pairs%'
   OR (strategy::jsonb->>'immediate_trading')::boolean = true;

