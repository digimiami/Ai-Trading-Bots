-- =============================================
-- Pablo Ready Bots System
-- Allows admins to create and manage ready-to-use bots for users
-- =============================================

-- Create pablo_ready_bots table
CREATE TABLE IF NOT EXISTS public.pablo_ready_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  exchange TEXT NOT NULL CHECK (exchange IN ('bybit', 'okx')),
  symbol TEXT NOT NULL,
  trading_type TEXT NOT NULL DEFAULT 'futures' CHECK (trading_type IN ('spot', 'futures')),
  leverage INTEGER DEFAULT 1,
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  strategy JSONB NOT NULL DEFAULT '{}',
  strategy_config JSONB NOT NULL DEFAULT '{}',
  trade_amount DECIMAL DEFAULT 100,
  stop_loss DECIMAL DEFAULT 2.0,
  take_profit DECIMAL DEFAULT 4.0,
  timeframe TEXT DEFAULT '1h',
  enabled BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for enabled bots
CREATE INDEX IF NOT EXISTS idx_pablo_ready_bots_enabled ON public.pablo_ready_bots(enabled, order_index);

-- Enable RLS
ALTER TABLE public.pablo_ready_bots ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read enabled bots
DROP POLICY IF EXISTS "Anyone can read enabled Pablo Ready bots" ON public.pablo_ready_bots;
CREATE POLICY "Anyone can read enabled Pablo Ready bots"
  ON public.pablo_ready_bots
  FOR SELECT
  USING (enabled = true);

-- Policy: Admins can read all bots
DROP POLICY IF EXISTS "Admins can read all Pablo Ready bots" ON public.pablo_ready_bots;
CREATE POLICY "Admins can read all Pablo Ready bots"
  ON public.pablo_ready_bots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: Only admins can insert/update/delete
DROP POLICY IF EXISTS "Admins can manage Pablo Ready bots" ON public.pablo_ready_bots;
CREATE POLICY "Admins can manage Pablo Ready bots"
  ON public.pablo_ready_bots
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_pablo_ready_bots_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pablo_ready_bots_updated ON public.pablo_ready_bots;
CREATE TRIGGER trg_pablo_ready_bots_updated
  BEFORE UPDATE ON public.pablo_ready_bots
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pablo_ready_bots_updated_at();

-- Grant permissions
GRANT SELECT ON public.pablo_ready_bots TO authenticated, anon;
GRANT ALL ON public.pablo_ready_bots TO authenticated;

-- Insert first bot: Trendline Breakout Strategy (SOLUSDT, Daily)
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
  'Trendline Breakout Strategy',
  'Advanced trendline breakout strategy using linear regression with volume confirmation. Optimized for SOLUSDT on Daily timeframe.',
  'bybit',
  'SOLUSDT',
  'futures',
  3,
  'medium',
  '{"type": "trendline_breakout", "name": "Trendline Breakout Strategy"}',
  '{
    "bias_mode": "both",
    "regime_mode": "auto",
    "trendline_length": 30,
    "volume_multiplier": 1.5,
    "trade_direction": "both",
    "enable_tp": false,
    "tp1_pct": 1.0,
    "tp2_pct": 2.0,
    "tp3_pct": 3.0,
    "enable_trail_sl": false,
    "trail_offset_pct": 5.8,
    "risk_per_trade_pct": 1.0,
    "max_trades_per_day": 10,
    "max_concurrent": 2,
    "sl_atr_mult": 2.0,
    "tp1_r": 1.0,
    "tp2_r": 2.0,
    "tp3_r": 3.0,
    "tp1_size": 0.33,
    "tp2_size": 0.33,
    "tp3_size": 0.34,
    "atr_period": 14
  }'::jsonb,
  100,
  2.0,
  3.0,
  '1d',
  true,
  true,
  1
) ON CONFLICT DO NOTHING;

-- Insert Trend Following Bot: Allows custom pair input, follows uptrend
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
  'Trend Following Strategy',
  'Follows uptrend pairs using EMA200 and ADX confirmation. Enter any trading pair you want to trade. Only trades long positions when trend is up.',
  'bybit',
  'CUSTOM', -- Placeholder - user will input their own pair
  'futures',
  3,
  'medium',
  '{"type": "trend_following", "name": "Trend Following Strategy", "allows_custom_pair": true}',
  '{
    "bias_mode": "long-only",
    "regime_mode": "trend",
    "htf_timeframe": "4h",
    "htf_trend_indicator": "EMA200",
    "ema_fast_period": 50,
    "require_price_vs_trend": "above",
    "adx_min_htf": 25,
    "require_adx_rising": true,
    "adx_trend_min": 25,
    "adx_meanrev_max": 19,
    "session_filter_enabled": false,
    "allowed_hours_utc": [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
    "cooldown_bars": 4,
    "atr_percentile_min": 20,
    "bb_width_min": 0.012,
    "bb_width_max": 0.05,
    "min_24h_volume_usd": 100000000,
    "max_spread_bps": 5,
    "risk_per_trade_pct": 1.0,
    "daily_loss_limit_pct": 3.0,
    "weekly_loss_limit_pct": 6.0,
    "max_trades_per_day": 5,
    "max_concurrent": 1,
    "max_consecutive_losses": 3,
    "sl_atr_mult": 2.0,
    "tp1_r": 2.0,
    "tp2_r": 4.0,
    "tp1_size": 0.5,
    "breakeven_at_r": 1.0,
    "trail_after_tp1_atr": 1.5,
    "time_stop_hours": 72,
    "rsi_period": 14,
    "rsi_oversold": 30,
    "rsi_overbought": 70,
    "atr_period": 14,
    "atr_tp_multiplier": 3,
    "use_ml_prediction": false
  }'::jsonb,
  100,
  2.0,
  4.0,
  '4h',
  true,
  true,
  2
) ON CONFLICT DO NOTHING;

-- Insert Hybrid Trend-Following + Mean Reversion Strategy Bot
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
  'Hybrid Trend + Mean Reversion Strategy',
  'Advanced hybrid strategy combining trend-following with mean reversion. Uses 4H HTF trend confirmation, EMA200 bias, ADX regime filtering, and ATR-based stops. Optimized for high win rate and strong profit factor.',
  'bybit',
  'CUSTOM',
  'futures',
  3,
  'medium',
  '{"type": "hybrid_trend_meanreversion", "name": "Hybrid Trend + Mean Reversion Strategy", "allows_custom_pair": true}',
  '{
    "bias_mode": "auto",
    "regime_mode": "trend",
    "htf_timeframe": "4h",
    "htf_trend_indicator": "EMA200",
    "ema_fast_period": 50,
    "require_price_vs_trend": "above",
    "adx_min_htf": 23,
    "require_adx_rising": true,
    "adx_trend_min": 25,
    "adx_meanrev_max": 19,
    "session_filter_enabled": false,
    "allowed_hours_utc": [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
    "cooldown_bars": 8,
    "atr_percentile_min": 20,
    "bb_width_min": 0.012,
    "bb_width_max": 0.05,
    "min_24h_volume_usd": 100000000,
    "max_spread_bps": 5,
    "risk_per_trade_pct": 1.0,
    "daily_loss_limit_pct": 3.0,
    "weekly_loss_limit_pct": 6.0,
    "max_trades_per_day": 5,
    "max_concurrent": 1,
    "max_consecutive_losses": 3,
    "sl_atr_mult": 1.3,
    "tp1_r": 1.5,
    "tp2_r": 3.0,
    "tp1_size": 0.5,
    "breakeven_at_r": 1.0,
    "trail_after_tp1_atr": 1.5,
    "time_stop_hours": 72,
    "rsi_period": 14,
    "rsi_oversold": 30,
    "rsi_overbought": 70,
    "atr_period": 14,
    "atr_tp_multiplier": 3,
    "momentum_threshold": 0.8,
    "vwap_distance": 1.2,
    "use_ml_prediction": false
  }'::jsonb,
  100,
  2.0,
  4.0,
  '4h',
  true,
  true,
  3
) ON CONFLICT DO NOTHING;


