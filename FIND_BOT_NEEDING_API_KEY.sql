-- =============================================
-- FIND BOT THAT NEEDS API KEY
-- =============================================

SELECT 
  '=== BOT NEEDING API KEY ===' as section;

SELECT 
  tb.id as bot_id,
  tb.name as bot_name,
  tb.symbol,
  tb.exchange,
  tb.trading_type,
  tb.timeframe,
  tb.status,
  tb.user_id,
  u.email as user_email,
  tb.created_at as bot_created_at,
  '⚠️ This bot needs an API key configured in account settings' as action_required,
  'Go to Account Settings > API Keys > Add ' || tb.exchange || ' API Key' as instructions
FROM trading_bots tb
LEFT JOIN api_keys ak ON tb.user_id = ak.user_id 
  AND ak.exchange = tb.exchange
  AND ak.is_active = true
LEFT JOIN auth.users u ON tb.user_id = u.id
WHERE tb.status = 'running'
  AND ak.id IS NULL
ORDER BY tb.name;

-- Also show if there are any API keys for this user/exchange combination
SELECT 
  '=== EXISTING API KEYS FOR THIS USER/EXCHANGE ===' as section;

SELECT 
  tb.id as bot_id,
  tb.name as bot_name,
  tb.user_id,
  tb.exchange,
  ak.id as api_key_id,
  ak.exchange as api_key_exchange,
  ak.is_active as api_key_active,
  ak.created_at as api_key_created_at,
  CASE 
    WHEN ak.id IS NULL THEN '❌ NO API KEY'
    WHEN ak.is_active = false THEN '⚠️ API KEY EXISTS BUT INACTIVE'
    WHEN ak.exchange != tb.exchange THEN '⚠️ API KEY EXISTS BUT FOR DIFFERENT EXCHANGE'
    ELSE '✅ API KEY OK'
  END as api_key_status
FROM trading_bots tb
LEFT JOIN api_keys ak ON tb.user_id = ak.user_id
WHERE tb.status = 'running'
  AND NOT EXISTS (
    SELECT 1 FROM api_keys ak2 
    WHERE ak2.user_id = tb.user_id 
      AND ak2.exchange = tb.exchange 
      AND ak2.is_active = true
  )
ORDER BY tb.name, ak.exchange;

