-- Add emergency_stop column to user_settings for per-user kill switch
-- Used by bot-executor to skip trading when user has enabled emergency stop

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'emergency_stop'
  ) THEN
    ALTER TABLE public.user_settings
      ADD COLUMN emergency_stop BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'Added emergency_stop column to user_settings';
  ELSE
    RAISE NOTICE 'emergency_stop column already exists on user_settings';
  END IF;
END $$;
