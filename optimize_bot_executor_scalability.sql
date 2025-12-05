-- =====================================================
-- BOT EXECUTOR SCALABILITY OPTIMIZATIONS
-- =====================================================
-- This script adds indexes and columns to optimize
-- bot execution for 100+ concurrent users
-- =====================================================

-- 1. Add next_execution_at column if it doesn't exist
ALTER TABLE trading_bots 
ADD COLUMN IF NOT EXISTS next_execution_at TIMESTAMP WITH TIME ZONE;

-- 2. Add last_execution_at column if it doesn't exist (for smart filtering)
ALTER TABLE trading_bots 
ADD COLUMN IF NOT EXISTS last_execution_at TIMESTAMP WITH TIME ZONE;

-- 3. Create index for faster bot queries (status + next_execution_at)
CREATE INDEX IF NOT EXISTS idx_trading_bots_status_next_execution 
ON trading_bots(status, next_execution_at) 
WHERE status = 'running';

-- 4. Create index for faster bot queries (status + updated_at)
CREATE INDEX IF NOT EXISTS idx_trading_bots_status_updated 
ON trading_bots(status, updated_at) 
WHERE status = 'running';

-- 5. Create index for user-specific bot queries
CREATE INDEX IF NOT EXISTS idx_trading_bots_user_status 
ON trading_bots(user_id, status) 
WHERE status = 'running';

-- 6. Create index for paper trading positions (for smart filtering)
CREATE INDEX IF NOT EXISTS idx_paper_trading_positions_bot_status 
ON paper_trading_positions(bot_id, status) 
WHERE status = 'open';

-- 7. Create index for real positions (for smart filtering)
-- Note: Only create if positions table exists (some systems may not have this table)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'positions') THEN
    CREATE INDEX IF NOT EXISTS idx_positions_bot_status 
    ON positions(bot_id, status) 
    WHERE status = 'open';
  ELSE
    RAISE NOTICE 'positions table does not exist, skipping index creation';
  END IF;
END $$;

-- 8. Create index for trades (for performance stats)
CREATE INDEX IF NOT EXISTS idx_trades_bot_executed 
ON trades(bot_id, executed_at) 
WHERE executed_at IS NOT NULL;

-- 9. Create index for paper trading trades (for performance stats)
CREATE INDEX IF NOT EXISTS idx_paper_trading_trades_bot_executed 
ON paper_trading_trades(bot_id, executed_at) 
WHERE executed_at IS NOT NULL;

-- 10. Initialize next_execution_at for existing bots (set to now so they get processed)
UPDATE trading_bots 
SET next_execution_at = NOW()
WHERE status = 'running' AND next_execution_at IS NULL;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify indexes were created:

-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'trading_bots' 
-- ORDER BY indexname;

-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'trading_bots' 
-- AND column_name IN ('next_execution_at', 'last_execution_at');

