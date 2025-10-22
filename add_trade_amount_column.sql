-- Add trade_amount column to trading_bots table
-- This allows each bot to have a configurable trade amount

ALTER TABLE trading_bots
ADD COLUMN IF NOT EXISTS trade_amount DECIMAL(15,2) DEFAULT 100.00;

COMMENT ON COLUMN trading_bots.trade_amount IS 'Base trade amount in USD per trade (before leverage and risk multipliers)';

-- Update existing bots to have default trade amount
UPDATE trading_bots
SET trade_amount = 100.00
WHERE trade_amount IS NULL;

