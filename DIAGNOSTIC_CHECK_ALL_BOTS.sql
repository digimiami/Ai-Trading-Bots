-- ============================================
-- COMPREHENSIVE DIAGNOSTIC FOR ALL BOTS
-- Run this to check bot status, API keys, and recent errors
-- ============================================

-- 1. COMPREHENSIVE BOT STATUS WITH API KEY STATUS
SELECT 
  b.id,
  b.name,
  b.status,
  b.paper_trading,
  b.exchange,
  b.symbol,
  b.user_id,
  u.email as owner_email,
  ak.is_active as has_active_api_keys,
  ak.is_testnet as api_testnet,
  CASE 
    WHEN b.paper_trading = true THEN '📝 PAPER MODE'
    WHEN b.paper_trading = false AND ak.is_active = true THEN '💵 REAL MODE (API Keys OK)'
    WHEN b.paper_trading = false AND (ak.is_active = false OR ak.id IS NULL) THEN '❌ REAL MODE (NO API KEYS)'
    ELSE '❓ UNKNOWN'
  END as trading_status,
  b.created_at,
  b.updated_at
FROM trading_bots b
LEFT JOIN auth.users u ON b.user_id = u.id
LEFT JOIN api_keys ak ON ak.user_id = b.user_id 
  AND ak.exchange = b.exchange 
  AND ak.is_active = true
WHERE b.status = 'running'
ORDER BY 
  CASE 
    WHEN b.paper_trading = false AND (ak.is_active = false OR ak.id IS NULL) THEN 1  -- Issues first
    WHEN b.paper_trading = false AND ak.is_active = true THEN 2
    WHEN b.paper_trading = true THEN 3
    ELSE 4
  END,
  b.created_at DESC;

-- 2. BOTS WITH SPECIFIC ERROR ISSUES (from your error list)
SELECT 
  b.id,
  b.name,
  b.exchange,
  b.symbol,
  b.paper_trading,
  u.email as owner_email,
  ak.is_active as has_api_keys,
  ak.is_testnet as api_testnet,
  CASE 
    WHEN ak.id IS NULL THEN '❌ NO API KEYS - Fix: Add API keys in account settings'
    WHEN ak.is_active = false THEN '❌ API KEYS INACTIVE - Fix: Activate API keys'
    WHEN ak.is_testnet IS NULL THEN '⚠️ TESTNET FLAG MISSING - Fix: Set testnet flag'
    ELSE '✅ API KEYS CONFIGURED'
  END as api_key_status
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
ORDER BY b.name;

-- 3. RECENT ERRORS BY BOT
SELECT 
  b.id,
  b.name,
  b.exchange,
  b.symbol,
  COUNT(*) as error_count,
  MAX(bal.timestamp) as last_error,
  STRING_AGG(DISTINCT 
    CASE 
      WHEN bal.message LIKE '%API key%' OR bal.message LIKE '%10003%' THEN 'API Key Invalid'
      WHEN bal.message LIKE '%403%' OR bal.message LIKE '%Forbidden%' THEN 'HTTP 403'
      WHEN bal.message LIKE '%price%' OR bal.message LIKE '%unavailable%' THEN 'Price Fetch Error'
      ELSE 'Other Error'
    END, 
    ', '
  ) as error_types
FROM trading_bots b
JOIN bot_activity_logs bal ON bal.bot_id = b.id
WHERE bal.level = 'error'
  AND bal.timestamp > NOW() - INTERVAL '24 hours'
GROUP BY b.id, b.name, b.exchange, b.symbol
ORDER BY error_count DESC, last_error DESC;

-- 4. MANUAL TRADE SIGNALS STATUS
SELECT 
  mts.id,
  mts.bot_id,
  b.name as bot_name,
  mts.side,
  mts.mode,
  mts.status,
  mts.error,
  mts.created_at,
  EXTRACT(EPOCH FROM (NOW() - mts.created_at)) / 60 as minutes_old,
  b.paper_trading as bot_paper_mode,
  CASE 
    WHEN mts.status = 'pending' AND EXTRACT(EPOCH FROM (NOW() - mts.created_at)) / 60 > 60 THEN '🚨 STUCK > 1 hour'
    WHEN mts.status = 'pending' AND EXTRACT(EPOCH FROM (NOW() - mts.created_at)) / 60 > 30 THEN '⚠️ STUCK > 30 min'
    WHEN mts.status = 'pending' AND EXTRACT(EPOCH FROM (NOW() - mts.created_at)) / 60 > 5 THEN '⏳ STUCK > 5 min'
    WHEN mts.status = 'processing' THEN '🔄 PROCESSING'
    WHEN mts.status = 'completed' THEN '✅ COMPLETED'
    WHEN mts.status = 'failed' THEN '❌ FAILED'
    ELSE '❓ UNKNOWN'
  END as signal_status
FROM manual_trade_signals mts
JOIN trading_bots b ON mts.bot_id = b.id
WHERE mts.created_at > NOW() - INTERVAL '7 days'
ORDER BY mts.created_at DESC
LIMIT 50;

-- 5. API KEYS SUMMARY BY USER
SELECT 
  u.email,
  u.id as user_id,
  COUNT(DISTINCT ak.id) FILTER (WHERE ak.exchange = 'bybit' AND ak.is_active = true) as bybit_keys,
  COUNT(DISTINCT ak.id) FILTER (WHERE ak.exchange = 'okx' AND ak.is_active = true) as okx_keys,
  COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'running' AND b.paper_trading = false) as real_trading_bots,
  MAX(ak.updated_at) as last_api_key_update
FROM auth.users u
LEFT JOIN api_keys ak ON ak.user_id = u.id
LEFT JOIN trading_bots b ON b.user_id = u.id
WHERE EXISTS (
  SELECT 1 FROM trading_bots 
  WHERE user_id = u.id AND status = 'running'
)
GROUP BY u.email, u.id
ORDER BY real_trading_bots DESC, last_api_key_update DESC;

