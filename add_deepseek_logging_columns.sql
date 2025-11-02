-- Add DeepSeek/AI logging columns to strategy_optimizations table
-- Run this in Supabase SQL Editor

-- Add AI provider tracking columns
ALTER TABLE public.strategy_optimizations 
ADD COLUMN IF NOT EXISTS ai_provider TEXT;

ALTER TABLE public.strategy_optimizations 
ADD COLUMN IF NOT EXISTS ai_model TEXT;

ALTER TABLE public.strategy_optimizations 
ADD COLUMN IF NOT EXISTS api_call_duration_ms INTEGER;

ALTER TABLE public.strategy_optimizations 
ADD COLUMN IF NOT EXISTS confidence DECIMAL(5,2);

-- Verify columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'strategy_optimizations' 
  AND column_name IN ('ai_provider', 'ai_model', 'api_call_duration_ms', 'confidence')
ORDER BY column_name;

