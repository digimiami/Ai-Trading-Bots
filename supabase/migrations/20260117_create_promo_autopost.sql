-- Promo Auto-Post System
-- Adds configuration, targets, and logs for promotional auto-posting

-- 1) Settings (single-row, admin managed)
CREATE TABLE IF NOT EXISTS promo_autopost_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN DEFAULT false,
  min_win_rate NUMERIC(5,2) DEFAULT 60.00,
  min_pnl NUMERIC(18,2) DEFAULT 100.00,
  lookback_days INTEGER DEFAULT 7,
  include_bot_settings BOOLEAN DEFAULT true,
  include_all_users BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Targets (Telegram groups/channels)
CREATE TABLE IF NOT EXISTS promo_autopost_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'telegram' CHECK (platform IN ('telegram')),
  bot_token TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) Logs
CREATE TABLE IF NOT EXISTS promo_autopost_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID REFERENCES promo_autopost_targets(id) ON DELETE SET NULL,
  bot_id UUID REFERENCES trading_bots(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  message TEXT,
  error_message TEXT,
  payload JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_promo_autopost_targets_enabled ON promo_autopost_targets(enabled);
CREATE INDEX IF NOT EXISTS idx_promo_autopost_logs_target_id ON promo_autopost_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_promo_autopost_logs_bot_id ON promo_autopost_logs(bot_id);
CREATE INDEX IF NOT EXISTS idx_promo_autopost_logs_created_at ON promo_autopost_logs(created_at DESC);

-- Enable RLS
ALTER TABLE promo_autopost_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_autopost_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_autopost_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can manage promo autopost settings"
  ON promo_autopost_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage promo autopost targets"
  ON promo_autopost_targets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can view promo autopost logs"
  ON promo_autopost_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert promo autopost logs"
  ON promo_autopost_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
