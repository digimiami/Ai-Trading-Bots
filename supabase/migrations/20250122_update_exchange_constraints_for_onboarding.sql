-- Migration: Update exchange constraints to support BYBIT, MEXC, BITUNIX and remove OKX
-- This updates the CHECK constraints in api_keys, trading_bots, and exchange_balances tables

-- 1. Update api_keys table constraint
ALTER TABLE api_keys 
DROP CONSTRAINT IF EXISTS api_keys_exchange_check;

ALTER TABLE api_keys 
ADD CONSTRAINT api_keys_exchange_check 
CHECK (exchange IN ('bybit', 'mexc', 'bitunix'));

-- 2. Update trading_bots table constraint (if it exists)
DO $$
BEGIN
  -- Check if constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'trading_bots_exchange_check'
  ) THEN
    ALTER TABLE trading_bots DROP CONSTRAINT trading_bots_exchange_check;
  END IF;
  
  -- Add new constraint
  ALTER TABLE trading_bots 
  ADD CONSTRAINT trading_bots_exchange_check 
  CHECK (exchange IN ('bybit', 'mexc', 'bitunix', 'okx'));
  -- Note: Keeping 'okx' for existing bots, but onboarding won't offer it
END $$;

-- 3. Update exchange_balances table constraint (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'exchange_balances_exchange_check'
  ) THEN
    ALTER TABLE exchange_balances DROP CONSTRAINT exchange_balances_exchange_check;
  END IF;
  
  ALTER TABLE exchange_balances 
  ADD CONSTRAINT exchange_balances_exchange_check 
  CHECK (exchange IN ('bybit', 'mexc', 'bitunix', 'okx'));
  -- Note: Keeping 'okx' for existing data, but onboarding won't offer it
END $$;

-- Add comment
COMMENT ON CONSTRAINT api_keys_exchange_check ON api_keys IS 'Updated to support BYBIT, MEXC, BITUNIX. OKX removed from onboarding but kept for existing data.';
