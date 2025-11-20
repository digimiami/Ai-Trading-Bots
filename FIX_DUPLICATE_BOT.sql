-- Fix Duplicate Bot: Scalping Strategy - Fast EMA Cloud - SOLUSDT
-- Two bots with same name found:
-- 1. a9e67b08-0f07-4fb5-ae6b-f52322d0f737
-- 2. 31d0c8a6-d3cd-4a2c-a1cc-b620d4ef839d

-- Step 1: Compare both bots to see which one to keep
SELECT 
  id,
  name,
  symbol,
  timeframe,
  status,
  created_at,
  updated_at,
  strategy_config->>'cooldown_bars' as cooldown_bars,
  strategy_config->>'rsi_oversold' as rsi_oversold,
  strategy_config->>'rsi_overbought' as rsi_overbought,
  paper_trading,
  webhook_only,
  (SELECT MAX(executed_at) FROM trades WHERE bot_id = trading_bots.id) as last_trade,
  (SELECT COUNT(*) FROM trades WHERE bot_id = trading_bots.id) as total_trades,
  (SELECT COUNT(*) FROM bot_activity_logs WHERE bot_id = trading_bots.id) as log_count
FROM trading_bots
WHERE id IN (
  'a9e67b08-0f07-4fb5-ae6b-f52322d0f737',
  '31d0c8a6-d3cd-4a2c-a1cc-b620d4ef839d'
)
ORDER BY created_at;

-- Step 2: Check recent activity for both bots
SELECT 
  b.id,
  b.name,
  bal.current_action,
  bal.last_activity,
  bal.error_count,
  bal.success_count
FROM trading_bots b
LEFT JOIN bot_activity_logs bal ON bal.bot_id = b.id
WHERE b.id IN (
  'a9e67b08-0f07-4fb5-ae6b-f52322d0f737',
  '31d0c8a6-d3cd-4a2c-a1cc-b620d4ef839d'
)
ORDER BY bal.last_activity DESC NULLS LAST
LIMIT 10;

-- Step 3: Check trades for both bots
SELECT 
  b.id,
  b.name,
  t.symbol,
  t.side,
  t.status,
  t.executed_at,
  t.pnl
FROM trading_bots b
LEFT JOIN trades t ON t.bot_id = b.id
WHERE b.id IN (
  'a9e67b08-0f07-4fb5-ae6b-f52322d0f737',
  '31d0c8a6-d3cd-4a2c-a1cc-b620d4ef839d'
)
ORDER BY t.executed_at DESC NULLS LAST
LIMIT 20;

-- Step 4: DECISION - Based on analysis:
-- Bot 31d0c8a6-d3cd-4a2c-a1cc-b620d4ef839d has:
--   - Last trade: 2025-11-19T15:02:15 (recent activity)
--   - Cooldown: 1 bar (more active)
--   - This appears to be the ACTIVE bot
--
-- Bot a9e67b08-0f07-4fb5-ae6b-f52322d0f737 has:
--   - Last trade: null (never traded)
--   - Cooldown: null (defaults to 8 bars)
--   - This appears to be the DUPLICATE/INACTIVE bot

-- Step 5: DELETE THE DUPLICATE (UNCOMMENT AFTER REVIEWING ABOVE QUERIES)
-- WARNING: This will delete bot a9e67b08-0f07-4fb5-ae6b-f52322d0f737
-- Make sure to review the queries above first!

-- Option A: Delete the duplicate bot (if it has no trades)
/*
DELETE FROM trading_bots
WHERE id = 'a9e67b08-0f07-4fb5-ae6b-f52322d0f737'
AND (SELECT COUNT(*) FROM trades WHERE bot_id = 'a9e67b08-0f07-4fb5-ae6b-f52322d0f737') = 0;
*/

-- Option B: Stop the duplicate bot instead of deleting (safer)
/*
UPDATE trading_bots
SET status = 'stopped',
    updated_at = NOW()
WHERE id = 'a9e67b08-0f07-4fb5-ae6b-f52322d0f737';
*/

-- Option C: Rename the duplicate bot (if you want to keep both)
/*
UPDATE trading_bots
SET name = 'Scalping Strategy - Fast EMA Cloud - SOLUSDT (Duplicate)',
    updated_at = NOW()
WHERE id = 'a9e67b08-0f07-4fb5-ae6b-f52322d0f737';
*/

-- Step 6: Verify deletion/update
SELECT 
  id,
  name,
  status,
  updated_at
FROM trading_bots
WHERE name = 'Scalping Strategy - Fast EMA Cloud - SOLUSDT'
ORDER BY created_at;

