-- ============================================
-- SWITCH BOTS FROM PAPER TRADING TO REAL TRADING
-- ============================================
-- This script helps you check and switch bots to real trading mode
-- Run this in Supabase SQL Editor

-- STEP 1: Check which bots are currently in paper trading mode
SELECT 
  id,
  name,
  symbol,
  paper_trading,
  status,
  exchange,
  trading_type,
  user_id
FROM trading_bots
WHERE status = 'running'
ORDER BY paper_trading DESC, name;

-- STEP 2: Check how many bots are in paper vs real trading
SELECT 
  paper_trading,
  COUNT(*) as bot_count,
  STRING_AGG(name, ', ') as bot_names
FROM trading_bots
WHERE status = 'running'
GROUP BY paper_trading;

-- STEP 3: Switch ALL running bots to REAL trading (uncomment to execute)
-- WARNING: This will switch ALL bots to real trading mode!
-- Make sure you have valid API keys configured before running this!
/*
UPDATE trading_bots
SET paper_trading = false
WHERE status = 'running' 
  AND paper_trading = true;
*/

-- STEP 4: Switch SPECIFIC bots to REAL trading (replace bot IDs)
-- Replace the UUIDs below with your actual bot IDs
/*
UPDATE trading_bots
SET paper_trading = false
WHERE id IN (
  'bot-id-1-here',
  'bot-id-2-here',
  'bot-id-3-here'
);
*/

-- STEP 5: Verify the changes
SELECT 
  id,
  name,
  symbol,
  paper_trading,
  status,
  updated_at
FROM trading_bots
WHERE status = 'running'
ORDER BY paper_trading DESC, name;

-- STEP 6: Check if bots have API keys configured (required for real trading)
SELECT 
  b.id,
  b.name,
  b.symbol,
  b.paper_trading,
  b.user_id,
  COUNT(ak.id) as api_key_count,
  STRING_AGG(ak.exchange, ', ') as exchanges_with_keys
FROM trading_bots b
LEFT JOIN api_keys ak ON ak.user_id = b.user_id 
  AND ak.is_testnet = false 
  AND ak.is_active = true
WHERE b.status = 'running'
GROUP BY b.id, b.name, b.symbol, b.paper_trading, b.user_id
ORDER BY b.paper_trading DESC, b.name;

