-- Fix incorrect timestamps in database
-- Run this in Supabase SQL Editor to fix timestamps set in the future

-- ============================================
-- 1. Find and list all problematic timestamps
-- ============================================
-- Check trades with future dates (more than 1 year in future)
SELECT 
  id,
  bot_id,
  executed_at,
  NOW() - executed_at as time_difference,
  CASE 
    WHEN executed_at > NOW() + INTERVAL '1 year' THEN 'Future (>1 year)'
    WHEN executed_at < NOW() - INTERVAL '10 years' THEN 'Past (>10 years)'
    ELSE 'OK'
  END as status
FROM trades
WHERE executed_at > NOW() + INTERVAL '1 year'
   OR executed_at < NOW() - INTERVAL '10 years'
ORDER BY executed_at DESC;

-- Check bots with future last_trade_at dates
SELECT 
  id,
  name,
  last_trade_at,
  NOW() - last_trade_at as time_difference,
  CASE 
    WHEN last_trade_at > NOW() + INTERVAL '1 year' THEN 'Future (>1 year)'
    WHEN last_trade_at < NOW() - INTERVAL '10 years' THEN 'Past (>10 years)'
    ELSE 'OK'
  END as status
FROM trading_bots
WHERE last_trade_at > NOW() + INTERVAL '1 year'
   OR (last_trade_at < NOW() - INTERVAL '10 years' AND last_trade_at IS NOT NULL)
ORDER BY last_trade_at DESC;

-- ============================================
-- 2. Fix trades with wrong timestamps
-- ============================================
-- Option A: Set to NULL if date is clearly wrong (in distant future/past)
UPDATE trades
SET executed_at = NULL
WHERE executed_at > NOW() + INTERVAL '1 year'
   OR executed_at < NOW() - INTERVAL '10 years';

-- Option B: Set to current time for trades with future dates (if you want to keep the trade record)
-- UPDATE trades
-- SET executed_at = NOW()
-- WHERE executed_at > NOW() + INTERVAL '1 year';

-- ============================================
-- 3. Fix bots with wrong last_trade_at
-- ============================================
-- Option A: Set to NULL if date is clearly wrong
UPDATE trading_bots
SET last_trade_at = NULL
WHERE last_trade_at > NOW() + INTERVAL '1 year'
   OR (last_trade_at < NOW() - INTERVAL '10 years' AND last_trade_at IS NOT NULL);

-- Option B: Set to most recent actual trade time
-- UPDATE trading_bots b
-- SET last_trade_at = (
--   SELECT MAX(executed_at)
--   FROM trades t
--   WHERE t.bot_id = b.id
--     AND t.executed_at IS NOT NULL
--     AND t.executed_at < NOW() + INTERVAL '1 year'
--     AND t.executed_at > NOW() - INTERVAL '10 years'
-- )
-- WHERE b.last_trade_at > NOW() + INTERVAL '1 year'
--    OR (b.last_trade_at < NOW() - INTERVAL '10 years' AND b.last_trade_at IS NOT NULL);

-- ============================================
-- 4. Verify the fixes
-- ============================================
-- Check remaining problematic timestamps
SELECT COUNT(*) as remaining_future_trades
FROM trades
WHERE executed_at > NOW() + INTERVAL '1 year';

SELECT COUNT(*) as remaining_future_bots
FROM trading_bots
WHERE last_trade_at > NOW() + INTERVAL '1 year';

-- Show fixed timestamps
SELECT 
  id,
  name,
  last_trade_at,
  CASE 
    WHEN last_trade_at IS NULL THEN 'NULL (fixed)'
    WHEN last_trade_at > NOW() THEN 'Still in future'
    ELSE 'OK'
  END as status
FROM trading_bots
WHERE status = 'running'
ORDER BY last_trade_at DESC NULLS LAST;
