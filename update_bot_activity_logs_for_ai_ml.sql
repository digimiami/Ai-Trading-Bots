-- Update bot_activity_logs table to support AI/ML category
-- Run this in Supabase SQL Editor

-- First, drop the check constraint
ALTER TABLE public.bot_activity_logs 
DROP CONSTRAINT IF EXISTS bot_activity_logs_category_check;

-- Recreate with ai_ml category
ALTER TABLE public.bot_activity_logs
ADD CONSTRAINT bot_activity_logs_category_check 
CHECK (category IN ('market', 'trade', 'strategy', 'system', 'error', 'ai_ml'));

-- Update existing AI/ML logs (if any) to have proper category
UPDATE public.bot_activity_logs
SET category = 'ai_ml'
WHERE details->>'type' = 'ai_ml_optimization'
  AND category = 'strategy';

