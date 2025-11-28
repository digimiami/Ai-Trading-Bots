-- Add highest_equity tracking to paper_trading_accounts for Dynamic Upward Trailing
-- This tracks the historical highest equity to enable dynamic exit point adjustment

ALTER TABLE paper_trading_accounts
ADD COLUMN IF NOT EXISTS highest_equity NUMERIC DEFAULT NULL;

-- Initialize highest_equity with initial_balance for existing accounts
UPDATE paper_trading_accounts
SET highest_equity = COALESCE(initial_balance, balance, 10000)
WHERE highest_equity IS NULL;

-- Add metadata column to paper_trading_positions for tracking price highs/lows
-- This enables Smart Exit Trigger and Trailing Take-Profit features
ALTER TABLE paper_trading_positions
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for faster queries on metadata
CREATE INDEX IF NOT EXISTS idx_paper_trading_positions_metadata 
ON paper_trading_positions USING GIN (metadata);

-- Add comment for documentation
COMMENT ON COLUMN paper_trading_accounts.highest_equity IS 'Historical highest equity value for Dynamic Upward Trailing feature';
COMMENT ON COLUMN paper_trading_positions.metadata IS 'JSONB metadata for tracking highest_price, lowest_price, and other advanced features';

