-- Create test period settings table
CREATE TABLE IF NOT EXISTS test_period_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN DEFAULT false,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  message TEXT DEFAULT 'The website is currently in test mode. Some features may be limited.',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(id) -- Only one test period setting at a time
);

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_test_period_enabled ON test_period_settings(enabled) WHERE enabled = true;

-- Enable RLS
ALTER TABLE test_period_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can read/write
CREATE POLICY "Admins can manage test period settings"
  ON test_period_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_test_period_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_test_period_updated_at
  BEFORE UPDATE ON test_period_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_test_period_updated_at();

-- Insert default disabled test period
INSERT INTO test_period_settings (enabled, created_by)
SELECT false, id FROM users WHERE role = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

