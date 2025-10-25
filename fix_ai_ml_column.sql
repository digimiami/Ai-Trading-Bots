-- Simple script to add AI/ML enabled field
-- Run this in your Supabase SQL Editor

-- Add the column
ALTER TABLE trading_bots ADD COLUMN ai_ml_enabled BOOLEAN DEFAULT false;

-- Update existing bots
UPDATE trading_bots SET ai_ml_enabled = false WHERE ai_ml_enabled IS NULL;
