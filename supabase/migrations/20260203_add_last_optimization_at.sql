-- Add last_optimization_at for per-bot optimization pacing.
-- auto-optimize only optimizes bots where last_optimization_at is null or
-- last_optimization_at + optimization_interval_hours <= now().

ALTER TABLE public.trading_bots
ADD COLUMN IF NOT EXISTS last_optimization_at timestamptz;

COMMENT ON COLUMN public.trading_bots.last_optimization_at IS 'When this bot was last auto-optimized; used with optimization_interval_hours to skip bots that are not due.';

CREATE INDEX IF NOT EXISTS idx_trading_bots_last_optimization_at
ON public.trading_bots(last_optimization_at)
WHERE ai_ml_enabled = true;
