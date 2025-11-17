-- =============================================
-- Add Scalping Strategy Bot to Pablo Ready Bots
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
  'Scalping Strategy - Fast EMA Cloud',
  'High-frequency scalping strategy using fast EMA cloud (EMA 9/21), RSI for micro reversals, VWAP for intraday bias, ATR for volatility filter, and ADX for trend strength. Optimized for 1m, 3m, and 5m timeframes with tight stop losses and quick take profits.',
  'bybit',
  'BTCUSDT',
  'futures',
  1,
  'high',
  '{"type": "scalping", "name": "Scalping Strategy - Fast EMA Cloud"}'::jsonb,
  '{
    "timeframe": "3m",
    "ema_fast": 9,
    "ema_slow": 21,
    "rsi_period": 14,
    "rsi_oversold": 30,
    "rsi_overbought": 70,
    "atr_period": 14,
    "atr_multiplier": 1.5,
    "adx_period": 14,
    "adx_min": 20,
    "volume_multiplier": 1.2,
    "min_volatility_atr": 0.3,
    "tp1_r": 1.5,
    "tp2_r": 3.0,
    "tp1_size": 50,
    "breakeven_at_r": 1.0,
    "sl_atr_mult": 1.5,
    "time_filter_enabled": true,
    "allowed_hours_utc": [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
    "avoid_low_liquidity": true,
    "min_volume_requirement": 1.2,
    "vwap_period": 20
  }'::jsonb,
  100.00,
  0.5,
  1.5,
  '3m',
  true,
  true,
  3
);

