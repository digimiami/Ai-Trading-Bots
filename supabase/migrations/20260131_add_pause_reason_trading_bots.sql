-- Add pause_reason column to trading_bots if missing
-- Fixes PGRST204: "Could not find the 'pause_reason' column of 'trading_bots' in the schema cache"
-- Used by bot-executor when pausing for safety (e.g. max consecutive losses, daily loss limit)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trading_bots'
      AND column_name = 'pause_reason'
  ) THEN
    ALTER TABLE public.trading_bots
      ADD COLUMN pause_reason TEXT;
    RAISE NOTICE 'Added pause_reason column to trading_bots';
  ELSE
    RAISE NOTICE 'pause_reason column already exists on trading_bots';
  END IF;
END $$;

COMMENT ON COLUMN public.trading_bots.pause_reason IS 'Reason the bot was paused (e.g. max consecutive losses, daily loss limit). NULL when not paused.';
