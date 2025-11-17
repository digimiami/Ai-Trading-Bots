-- ============================================
-- CHECK API KEYS FOR BOTS WITH ERRORS
-- This query identifies which bots need API key updates
-- ============================================

-- 1. Check specific bots that had API key errors (Code: 10003)
SELECT 
  '=== BOTS WITH API KEY ERRORS ===' as section,
  b.id,
  b.name,
  b.exchange,
  b.symbol,
  b.user_id,
  u.email as owner_email,
  b.paper_trading,
  b.status,
  ak.is_active as has_active_api_keys,
  ak.is_testnet as api_testnet,
  ak.updated_at as api_key_last_updated,
  EXTRACT(EPOCH FROM (NOW() - ak.updated_at)) / 86400 as days_since_api_key_update,
  CASE 
    WHEN ak.id IS NULL THEN '❌ NO API KEYS - ACTION REQUIRED: Add API keys'
    WHEN ak.is_active = false THEN '❌ API KEYS INACTIVE - ACTION REQUIRED: Activate API keys'
    WHEN EXTRACT(EPOCH FROM (NOW() - ak.updated_at)) / 86400 > 30 THEN '⚠️ API KEYS OLD (>30 days) - RECOMMENDED: Update API keys'
    WHEN EXTRACT(EPOCH FROM (NOW() - ak.updated_at)) / 86400 > 14 THEN '⚠️ API KEYS OLD (>14 days) - CHECK: Verify API keys are still valid'
    WHEN ak.is_testnet IS NULL THEN '⚠️ TESTNET FLAG MISSING - CHECK: Verify testnet setting'
    ELSE '✅ API KEYS CONFIGURED'
  END as api_key_status,
  CASE 
    WHEN ak.id IS NULL THEN 'Go to Account Settings → API Keys → Add Bybit API keys'
    WHEN ak.is_active = false THEN 'Go to Account Settings → API Keys → Activate Bybit API keys'
    WHEN EXTRACT(EPOCH FROM (NOW() - ak.updated_at)) / 86400 > 30 THEN 'Go to Bybit → API Management → Verify key is active → Update in Account Settings'
    ELSE 'Verify API key is active on Bybit and has trading permissions'
  END as action_required
FROM trading_bots b
LEFT JOIN auth.users u ON b.user_id = u.id
LEFT JOIN api_keys ak ON ak.user_id = b.user_id 
  AND ak.exchange = b.exchange 
  AND ak.is_active = true
WHERE b.id IN (
  'cd3ed89b-e9f5-4056-9857-30a94d82764a',  -- Trendline Breakout Strategy - SOLUSDT
  '2ee7bf5a-0aea-4066-85c5-6c4bf8c79ead',  -- Trend Following Strategy - DOGEUSDT
  'ea3038cc-ff8e-41fd-a760-da9a8b599669',  -- Hybrid Trend + Mean Reversion Strategy - HMARUSDT
  '59f7165e-aff9-4107-b4a7-66a2ecfc5087',  -- ETH TRADINGVIEW
  '02511945-ef73-47df-822d-15608d1bac9e'   -- BTC TRADIGVEW
)
ORDER BY 
  CASE 
    WHEN ak.id IS NULL THEN 1
    WHEN ak.is_active = false THEN 2
    WHEN EXTRACT(EPOCH FROM (NOW() - ak.updated_at)) / 86400 > 30 THEN 3
    ELSE 4
  END,
  b.name;

-- 2. Check all real trading bots and their API key status
SELECT 
  '=== ALL REAL TRADING BOTS API KEY STATUS ===' as section,
  b.id,
  b.name,
  b.exchange,
  b.symbol,
  u.email as owner_email,
  ak.is_active as has_active_api_keys,
  ak.is_testnet as api_testnet,
  ak.updated_at as api_key_last_updated,
  EXTRACT(EPOCH FROM (NOW() - ak.updated_at)) / 86400 as days_since_update,
  CASE 
    WHEN ak.id IS NULL THEN '❌ NO API KEYS'
    WHEN ak.is_active = false THEN '❌ INACTIVE'
    WHEN EXTRACT(EPOCH FROM (NOW() - ak.updated_at)) / 86400 > 30 THEN '⚠️ OLD (>30 days)'
    WHEN EXTRACT(EPOCH FROM (NOW() - ak.updated_at)) / 86400 > 14 THEN '⚠️ OLD (>14 days)'
    ELSE '✅ OK'
  END as status
FROM trading_bots b
LEFT JOIN auth.users u ON b.user_id = u.id
LEFT JOIN api_keys ak ON ak.user_id = b.user_id 
  AND ak.exchange = b.exchange 
  AND ak.is_active = true
WHERE b.status = 'running'
  AND b.paper_trading = false
ORDER BY 
  CASE 
    WHEN ak.id IS NULL THEN 1
    WHEN ak.is_active = false THEN 2
    WHEN EXTRACT(EPOCH FROM (NOW() - ak.updated_at)) / 86400 > 30 THEN 3
    ELSE 4
  END,
  u.email,
  b.name;

-- 3. Users with old API keys (>14 days)
SELECT 
  '=== USERS WITH OLD API KEYS (>14 days) ===' as section,
  u.email,
  u.id as user_id,
  ak.exchange,
  ak.is_active,
  ak.is_testnet,
  ak.updated_at as api_key_last_updated,
  EXTRACT(EPOCH FROM (NOW() - ak.updated_at)) / 86400 as days_old,
  COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'running' AND b.paper_trading = false) as real_trading_bots,
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - ak.updated_at)) / 86400 > 30 THEN '⚠️ VERY OLD - RECOMMENDED: Update API keys'
    WHEN EXTRACT(EPOCH FROM (NOW() - ak.updated_at)) / 86400 > 14 THEN '⚠️ OLD - CHECK: Verify API keys are still valid'
    ELSE '✅ RECENT'
  END as recommendation
FROM auth.users u
JOIN api_keys ak ON ak.user_id = u.id
LEFT JOIN trading_bots b ON b.user_id = u.id
WHERE ak.exchange = 'bybit'
  AND ak.is_active = true
  AND EXTRACT(EPOCH FROM (NOW() - ak.updated_at)) / 86400 > 14
GROUP BY u.email, u.id, ak.exchange, ak.is_active, ak.is_testnet, ak.updated_at
ORDER BY days_old DESC;

-- 4. Recent API key errors by user
SELECT 
  '=== RECENT API KEY ERRORS BY USER ===' as section,
  u.email,
  u.id as user_id,
  COUNT(DISTINCT b.id) as bots_with_errors,
  COUNT(*) as total_errors,
  MAX(bal.timestamp) as last_error,
  STRING_AGG(DISTINCT b.name, ', ') as affected_bots
FROM auth.users u
JOIN trading_bots b ON b.user_id = u.id
JOIN bot_activity_logs bal ON bal.bot_id = b.id
WHERE bal.level = 'error'
  AND (bal.message LIKE '%API key%' OR bal.message LIKE '%10003%')
  AND bal.timestamp > NOW() - INTERVAL '7 days'
GROUP BY u.email, u.id
ORDER BY total_errors DESC, last_error DESC;

