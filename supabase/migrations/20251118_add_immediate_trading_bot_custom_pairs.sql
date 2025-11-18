-- =============================================
-- Immediate Trading Bot - Custom Pairs
-- Starts trading immediately when activated from Pablo Ready
-- Supports any custom trading pair
-- =============================================

INSERT INTO public.pablo_ready_bots (
  name,
  description,
  exchange,
  symbol,
  trading_type,
  leverage,
  risk_level,
  strategy,
  strategy_config,
  trade_amount,
  stop_loss,
  take_profit,
  timeframe,
  enabled,
  featured,
  order_index
) VALUES (
  'Immediate Trading Bot - Custom Pairs',
  'Fast-acting bot that starts trading immediately with any custom trading pair. Uses aggressive trend-following strategy with quick entry signals. Optimized for immediate execution and high trade frequency. Perfect for active traders who want instant action.',
  'bybit',
  'CUSTOM', -- Placeholder - user will input their own pair
  'futures',
  3,
  'medium',
  '{"type": "scalping", "name": "Immediate Trading Bot", "allows_custom_pair": true, "immediate_trading": true}'::jsonb,
  '{
    "bias_mode": "both",
    "ema_fast": 9,
    "ema_slow": 21,
    "rsi_period": 14,
    "rsi_oversold": 40,
    "rsi_overbought": 60,
    "atr_period": 14,
    "atr_stop_multiplier": 1.5,
    "atr_tp_multiplier": 2.0,
    "adx_min": 10,
    "min_volume_requirement": 0.2,
    "volume_multiplier": 0.5,
    "min_volatility_atr": 0.1,
    "time_filter_enabled": false,
    "allowed_hours_utc": [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
    "cooldown_bars": 1,
    "risk_per_trade_pct": 1.5,
    "daily_loss_limit_pct": 5.0,
    "weekly_loss_limit_pct": 10.0,
    "max_trades_per_day": 30,
    "max_concurrent": 3,
    "max_consecutive_losses": 5,
    "sl_atr_mult": 1.2,
    "tp1_r": 1.5,
    "tp2_r": 2.5,
    "tp1_size": 0.6,
    "tp2_size": 0.4,
    "breakeven_at_r": 0.5,
    "trail_after_tp1_atr": 1.0,
    "time_stop_hours": 12,
    "use_ml_prediction": false,
    "fast_entry": true,
    "immediate_execution": true
  }'::jsonb,
  100,
  1.5,
  3.0,
  '5m',
  true,
  true,
  10
) ON CONFLICT DO NOTHING;

