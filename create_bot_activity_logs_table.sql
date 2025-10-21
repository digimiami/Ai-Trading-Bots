-- Create bot_activity_logs table for storing bot execution logs
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.bot_activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES public.trading_bots(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error', 'success')),
  category TEXT NOT NULL CHECK (category IN ('market', 'trade', 'strategy', 'system', 'error')),
  message TEXT NOT NULL,
  details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bot_activity_logs_bot_id ON public.bot_activity_logs(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_activity_logs_timestamp ON public.bot_activity_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bot_activity_logs_level ON public.bot_activity_logs(level);
CREATE INDEX IF NOT EXISTS idx_bot_activity_logs_category ON public.bot_activity_logs(category);

-- Enable RLS
ALTER TABLE public.bot_activity_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view their own bot logs" ON public.bot_activity_logs;
CREATE POLICY "Users can view their own bot logs" ON public.bot_activity_logs
  FOR SELECT USING (
    bot_id IN (
      SELECT id FROM public.trading_bots WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own bot logs" ON public.bot_activity_logs;
CREATE POLICY "Users can insert their own bot logs" ON public.bot_activity_logs
  FOR INSERT WITH CHECK (
    bot_id IN (
      SELECT id FROM public.trading_bots WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own bot logs" ON public.bot_activity_logs;
CREATE POLICY "Users can update their own bot logs" ON public.bot_activity_logs
  FOR UPDATE USING (
    bot_id IN (
      SELECT id FROM public.trading_bots WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own bot logs" ON public.bot_activity_logs;
CREATE POLICY "Users can delete their own bot logs" ON public.bot_activity_logs
  FOR DELETE USING (
    bot_id IN (
      SELECT id FROM public.trading_bots WHERE user_id = auth.uid()
    )
  );

-- Add cleanup function to remove old logs (keep last 1000 per bot)
CREATE OR REPLACE FUNCTION cleanup_old_bot_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.bot_activity_logs 
  WHERE id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY bot_id ORDER BY timestamp DESC) as rn
      FROM public.bot_activity_logs
    ) ranked
    WHERE rn <= 1000
  );
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically clean up old logs
CREATE OR REPLACE FUNCTION trigger_cleanup_bot_logs()
RETURNS trigger AS $$
BEGIN
  -- Only run cleanup occasionally to avoid performance issues
  IF random() < 0.01 THEN -- 1% chance
    PERFORM cleanup_old_bot_logs();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bot_logs_cleanup_trigger ON public.bot_activity_logs;
CREATE TRIGGER bot_logs_cleanup_trigger
  AFTER INSERT ON public.bot_activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_cleanup_bot_logs();
