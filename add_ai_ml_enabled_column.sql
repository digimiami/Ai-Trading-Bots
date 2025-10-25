-- Add AI/ML enabled field to trading_bots table
-- This allows each bot to have AI/ML enabled or disabled individually

ALTER TABLE trading_bots 
ADD COLUMN IF NOT EXISTS ai_ml_enabled BOOLEAN DEFAULT false;

-- Update existing bots to have AI/ML disabled by default
UPDATE trading_bots 
SET ai_ml_enabled = false 
WHERE ai_ml_enabled IS NULL;

-- Add comment for clarity
COMMENT ON COLUMN trading_bots.ai_ml_enabled IS 'Whether AI/ML system is enabled for this bot';
