-- Setup AI Auto-Optimization Tables and Columns
-- Run this in Supabase SQL Editor

-- Ensure ai_ml_enabled column exists
ALTER TABLE trading_bots 
ADD COLUMN IF NOT EXISTS ai_ml_enabled BOOLEAN DEFAULT false;

-- Update existing bots to have AI/ML disabled by default
UPDATE trading_bots 
SET ai_ml_enabled = false 
WHERE ai_ml_enabled IS NULL;

-- Ensure strategy_config column exists
ALTER TABLE trading_bots 
ADD COLUMN IF NOT EXISTS strategy_config JSONB DEFAULT '{}'::jsonb;

-- Create AI learning tables (run create_ai_learning_tables.sql separately)
-- This is just to ensure the main columns exist

-- Add comment for clarity
COMMENT ON COLUMN trading_bots.ai_ml_enabled IS 'Whether AI/ML auto-optimization is enabled for this bot';
COMMENT ON COLUMN trading_bots.strategy_config IS 'Advanced strategy configuration for AI optimization';

-- Verify columns exist
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'trading_bots' 
    AND column_name IN ('ai_ml_enabled', 'strategy_config')
ORDER BY column_name;

-- Show current AI/ML enabled status
SELECT 
    COUNT(*) as total_bots,
    COUNT(*) FILTER (WHERE ai_ml_enabled = true) as ai_enabled_bots,
    COUNT(*) FILTER (WHERE ai_ml_enabled = false OR ai_ml_enabled IS NULL) as ai_disabled_bots
FROM trading_bots;

