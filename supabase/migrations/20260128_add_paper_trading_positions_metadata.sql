-- Add metadata column to paper_trading_positions if missing
-- Fixes PGRST204: "Could not find the 'metadata' column of 'paper_trading_positions' in the schema cache"
-- Used by bot-executor for Smart Exit, Trailing TP, highest_price/lowest_price tracking

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'paper_trading_positions'
      AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.paper_trading_positions
      ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    CREATE INDEX IF NOT EXISTS idx_paper_trading_positions_metadata
      ON public.paper_trading_positions USING GIN (metadata);
    RAISE NOTICE 'Added metadata column to paper_trading_positions';
  ELSE
    RAISE NOTICE 'metadata column already exists on paper_trading_positions';
  END IF;
END $$;
