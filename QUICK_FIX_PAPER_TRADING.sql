-- ⚠️ URGENT: Run this SQL in Supabase Dashboard to fix paper_trading error
-- Go to: Supabase Dashboard → SQL Editor → New Query → Paste this → Run

-- Add paper_trading column to trading_bots table
ALTER TABLE trading_bots 
ADD COLUMN IF NOT EXISTS paper_trading BOOLEAN DEFAULT false;

ALTER TABLE trading_bots
ADD COLUMN IF NOT EXISTS paper_balance DECIMAL DEFAULT 10000;

-- Refresh PostgREST schema cache (important!)
NOTIFY pgrst, 'reload schema';

-- Wait a moment for cache refresh
SELECT pg_sleep(1);

-- Success message
SELECT 'paper_trading columns added successfully! Schema cache refreshed.' as status;

