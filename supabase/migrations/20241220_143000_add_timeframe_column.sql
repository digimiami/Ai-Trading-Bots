-- Migration: Add timeframe column to trading_bots table
-- This migration adds timeframe column for chart intervals

-- Add timeframe column
ALTER TABLE trading_bots
ADD COLUMN IF NOT EXISTS timeframe VARCHAR(10) DEFAULT '1h';

-- Update existing bots to have default timeframe
UPDATE trading_bots
SET timeframe = '1h'
WHERE timeframe IS NULL;

-- Add comment
COMMENT ON COLUMN trading_bots.timeframe IS 'Chart timeframe for technical analysis (1m, 5m, 15m, 1h, 2h, 3h, 4h, 1d, 1w)';

