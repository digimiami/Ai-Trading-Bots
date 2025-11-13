-- Migration: Create webhook_calls table to track all TradingView webhook requests
-- This allows us to see all webhook calls, including failed ones, for debugging

CREATE TABLE IF NOT EXISTS webhook_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES trading_bots(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_payload JSONB NOT NULL,
  parsed_payload JSONB,
  secret_provided TEXT,
  secret_valid BOOLEAN DEFAULT false,
  bot_found BOOLEAN DEFAULT false,
  side TEXT,
  mode TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'failed', 'rejected')),
  error_message TEXT,
  response_status INTEGER,
  response_body JSONB,
  signal_id UUID REFERENCES manual_trade_signals(id) ON DELETE SET NULL,
  trigger_executed BOOLEAN DEFAULT false,
  trigger_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_webhook_calls_bot_id ON webhook_calls(bot_id);
CREATE INDEX IF NOT EXISTS idx_webhook_calls_user_id ON webhook_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_calls_created_at ON webhook_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_calls_status ON webhook_calls(status);

ALTER TABLE webhook_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own webhook calls" ON webhook_calls;
DROP POLICY IF EXISTS "Users can insert own webhook calls" ON webhook_calls;

CREATE POLICY "Users can view own webhook calls"
  ON webhook_calls
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own webhook calls"
  ON webhook_calls
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

