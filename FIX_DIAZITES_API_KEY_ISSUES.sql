-- ============================================
-- FIX API KEY ISSUES FOR diazites1@gmail.com
-- User has 3 bots with API key errors despite recent update
-- ============================================

-- 1. Check specific bots with errors for this user
SELECT 
  '=== BOTS WITH API KEY ERRORS ===' as section,
  b.id,
  b.name,
  b.exchange,
  b.symbol,
  b.paper_trading,
  b.status,
  b.user_id,
  u.email,
  ak.id as api_key_id,
  ak.is_active as api_key_active,
  ak.is_testnet as api_key_testnet,
  ak.created_at as api_key_created,
  ak.updated_at as api_key_updated,
  EXTRACT(EPOCH FROM (NOW() - ak.updated_at)) / 3600 as hours_since_update,
  CASE 
    WHEN ak.id IS NULL THEN '❌ NO API KEYS'
    WHEN ak.is_active = false THEN '❌ API KEYS INACTIVE'
    WHEN ak.is_testnet IS NULL THEN '⚠️ TESTNET FLAG MISSING'
    ELSE '✅ API KEYS CONFIGURED'
  END as api_key_status
FROM trading_bots b
JOIN auth.users u ON b.user_id = u.id
LEFT JOIN api_keys ak ON ak.user_id = b.user_id 
  AND ak.exchange = b.exchange
WHERE u.email = 'diazites1@gmail.com'
  AND b.id IN (
    'ea3038cc-ff8e-41fd-a760-da9a8b599669',  -- Hybrid Trend + Mean Reversion Strategy - HMARUSDT
    '2ee7bf5a-0aea-4066-85c5-6c4bf8c79ead',  -- Trend Following Strategy-Find Trading Pairs - DOGEUSDT
    'cd3ed89b-e9f5-4056-9857-30a94d82764a'   -- Trendline Breakout Strategy - SOLUSDT
  )
ORDER BY b.name;

-- 2. Check all API keys for this user
SELECT 
  '=== ALL API KEYS FOR USER ===' as section,
  u.email,
  ak.exchange,
  ak.is_active,
  ak.is_testnet,
  ak.created_at,
  ak.updated_at,
  EXTRACT(EPOCH FROM (NOW() - ak.updated_at)) / 3600 as hours_since_update,
  COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'running' AND b.paper_trading = false) as real_trading_bots_using_key
FROM auth.users u
LEFT JOIN api_keys ak ON ak.user_id = u.id
LEFT JOIN trading_bots b ON b.user_id = u.id AND b.exchange = ak.exchange
WHERE u.email = 'diazites1@gmail.com'
GROUP BY u.email, ak.id, ak.exchange, ak.is_active, ak.is_testnet, ak.created_at, ak.updated_at
ORDER BY ak.updated_at DESC;

-- 3. Recent API key errors for this user's bots
SELECT 
  '=== RECENT API KEY ERRORS ===' as section,
  b.id,
  b.name,
  bal.level,
  bal.message,
  bal.timestamp,
  EXTRACT(EPOCH FROM (NOW() - bal.timestamp)) / 3600 as hours_ago
FROM bot_activity_logs bal
JOIN trading_bots b ON bal.bot_id = b.id
JOIN auth.users u ON b.user_id = u.id
WHERE u.email = 'diazites1@gmail.com'
  AND bal.level = 'error'
  AND (bal.message LIKE '%API key%' OR bal.message LIKE '%10003%')
  AND bal.timestamp > NOW() - INTERVAL '24 hours'
ORDER BY bal.timestamp DESC;

-- 4. Check if API keys are properly linked to bots
SELECT 
  '=== API KEY LINKAGE CHECK ===' as section,
  b.id as bot_id,
  b.name as bot_name,
  b.exchange as bot_exchange,
  b.user_id as bot_user_id,
  ak.id as api_key_id,
  ak.user_id as api_key_user_id,
  ak.exchange as api_key_exchange,
  ak.is_active,
  CASE 
    WHEN ak.id IS NULL THEN '❌ NO API KEY FOUND'
    WHEN ak.user_id != b.user_id THEN '❌ USER ID MISMATCH'
    WHEN ak.exchange != b.exchange THEN '❌ EXCHANGE MISMATCH'
    WHEN ak.is_active = false THEN '❌ API KEY INACTIVE'
    ELSE '✅ PROPERLY LINKED'
  END as linkage_status
FROM trading_bots b
LEFT JOIN api_keys ak ON ak.user_id = b.user_id AND ak.exchange = b.exchange AND ak.is_active = true
JOIN auth.users u ON b.user_id = u.id
WHERE u.email = 'diazites1@gmail.com'
  AND b.id IN (
    'ea3038cc-ff8e-41fd-a760-da9a8b599669',
    '2ee7bf5a-0aea-4066-85c5-6c4bf8c79ead',
    'cd3ed89b-e9f5-4056-9857-30a94d82764a'
  )
ORDER BY b.name;

-- 5. Check for duplicate or inactive API keys
SELECT 
  '=== DUPLICATE/INACTIVE API KEYS ===' as section,
  u.email,
  ak.exchange,
  ak.is_active,
  ak.is_testnet,
  COUNT(*) as key_count,
  MAX(ak.updated_at) as latest_update,
  STRING_AGG(ak.id::text, ', ') as api_key_ids
FROM auth.users u
JOIN api_keys ak ON ak.user_id = u.id
WHERE u.email = 'diazites1@gmail.com'
  AND ak.exchange = 'bybit'
GROUP BY u.email, ak.exchange, ak.is_active, ak.is_testnet
ORDER BY latest_update DESC;

