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

-- Insert first bot: Trendline Breakout Strategy
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
  'Advanced trendline breakout strategy using linear regression with volume confirmation. Features multiple take profits and trailing stop loss.',
  'bybit',
  'BTCUSDT',
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
    "enable_tp": true,
    "tp1_pct": 1.0,
    "tp2_pct": 2.0,
    "tp3_pct": 3.0,
    "enable_trail_sl": true,
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
  '1h',
  true,
  true,
  1
) ON CONFLICT DO NOTHING;

-- Insert SOL bot: Trendline Breakout Strategy (Daily timeframe)
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
  'Trendline Breakout Strategy - SOL',
  'Trendline breakout strategy optimized for SOLUSDT on Daily timeframe. Uses linear regression with volume confirmation, multiple take profits, and trailing stop loss.',
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
    "enable_tp": true,
    "tp1_pct": 1.0,
    "tp2_pct": 2.0,
    "tp3_pct": 3.0,
    "enable_trail_sl": true,
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
  2
) ON CONFLICT DO NOTHING;

