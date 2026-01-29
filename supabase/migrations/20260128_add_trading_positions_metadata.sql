-- Add metadata column to trading_positions for advanced exit/trailing features on REAL exchanges.
-- Mirrors paper_trading_positions.metadata usage (highest_price, lowest_price, tp1_hit, etc.)

ALTER TABLE IF EXISTS public.trading_positions
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.trading_positions.metadata IS 'JSONB metadata for advanced exit/trailing features (highest_price, lowest_price, tp1_hit, etc.)';

