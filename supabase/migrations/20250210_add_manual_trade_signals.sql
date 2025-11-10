-- Migration: create manual_trade_signals table for TradingView webhook integration
-- Description: Stores external trade requests that are processed by bot-executor

CREATE TABLE IF NOT EXISTS manual_trade_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES trading_bots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'real' CHECK (mode IN ('real', 'paper')),
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell', 'long', 'short')),
  size_multiplier NUMERIC DEFAULT 1,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_manual_trade_signals_bot_status
  ON manual_trade_signals(bot_id, status);

CREATE INDEX IF NOT EXISTS idx_manual_trade_signals_created_at
  ON manual_trade_signals(created_at DESC);

ALTER TABLE manual_trade_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view manual signals" ON manual_trade_signals;
DROP POLICY IF EXISTS "Users can insert manual signals" ON manual_trade_signals;
DROP POLICY IF EXISTS "Users can update own manual signals" ON manual_trade_signals;

CREATE POLICY "Users can view manual signals"
  ON manual_trade_signals
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert manual signals"
  ON manual_trade_signals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own manual signals"
  ON manual_trade_signals
  FOR UPDATE
  USING (auth.uid() = user_id);

