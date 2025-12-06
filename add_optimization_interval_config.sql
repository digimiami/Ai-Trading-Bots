-- Add optimization interval configuration to trading_bots table
-- This allows users to configure how often auto-optimization runs

ALTER TABLE trading_bots
ADD COLUMN IF NOT EXISTS optimization_interval_hours INTEGER DEFAULT 6;

-- Add comment
COMMENT ON COLUMN trading_bots.optimization_interval_hours IS 'Hours between auto-optimization runs (default: 6 hours). Options: 1, 2, 4, 6, 12, 24';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_bots_optimization_interval ON trading_bots(optimization_interval_hours) WHERE ai_ml_enabled = true;

