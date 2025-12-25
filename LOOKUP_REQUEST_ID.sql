-- Lookup Request ID: 4ba580be-f871-4a54-8db1-d709a9f478a9
-- This query searches for the UUID across all relevant tables

-- 1. Check if it's a webhook_call ID
SELECT 
  'webhook_calls' as table_name,
  wc.id,
  wc.bot_id,
  wc.status,
  wc.error_message,
  wc.response_status,
  wc.created_at,
  wc.processed_at,
  wc.signal_id,
  wc.raw_payload->>'raw' as raw_payload_preview
FROM webhook_calls wc
WHERE wc.id = '4ba580be-f871-4a54-8db1-d709a9f478a9';

-- 2. Check if it's a bot_activity_logs ID
SELECT 
  'bot_activity_logs' as table_name,
  bal.id,
  bal.bot_id,
  bal.level,
  bal.category,
  bal.message,
  bal.details,
  bal.created_at
FROM bot_activity_logs bal
WHERE bal.id = '4ba580be-f871-4a54-8db1-d709a9f478a9';

-- 3. Check if it's a manual_trade_signals ID
SELECT 
  'manual_trade_signals' as table_name,
  mts.id,
  mts.bot_id,
  mts.status,
  mts.side,
  mts.mode,
  mts.error,
  mts.reason,
  mts.created_at,
  mts.processed_at
FROM manual_trade_signals mts
WHERE mts.id = '4ba580be-f871-4a54-8db1-d709a9f478a9';

-- 4. Check if it's a trading_bots ID
SELECT 
  'trading_bots' as table_name,
  tb.id,
  tb.name,
  tb.status,
  tb.symbol,
  tb.exchange,
  tb.paper_trading,
  tb.created_at
FROM trading_bots tb
WHERE tb.id = '4ba580be-f871-4a54-8db1-d709a9f478a9';

-- 5. Check if it's a trades ID
SELECT 
  'trades' as table_name,
  t.id,
  t.bot_id,
  t.side,
  t.symbol,
  t.price,
  t.amount,
  t.status,
  t.created_at
FROM trades t
WHERE t.id = '4ba580be-f871-4a54-8db1-d709a9f478a9';

-- 6. Check if it's referenced in webhook_calls.signal_id
SELECT 
  'webhook_calls (signal_id)' as table_name,
  wc.id as webhook_call_id,
  wc.signal_id,
  wc.bot_id,
  wc.status,
  wc.created_at,
  mts.status as signal_status,
  mts.side,
  mts.mode
FROM webhook_calls wc
LEFT JOIN manual_trade_signals mts ON mts.id = wc.signal_id
WHERE wc.signal_id = '4ba580be-f871-4a54-8db1-d709a9f478a9';

-- 7. Check if it's referenced in bot_activity_logs details
SELECT 
  'bot_activity_logs (in details)' as table_name,
  bal.id,
  bal.bot_id,
  bal.message,
  bal.details->>'signal_id' as signal_id_from_details,
  bal.details->>'webhook_call_id' as webhook_call_id_from_details,
  bal.created_at
FROM bot_activity_logs bal
WHERE bal.details::text LIKE '%4ba580be-f871-4a54-8db1-d709a9f478a9%'
LIMIT 10;

-- 8. Check if it's referenced in webhook_calls raw_payload
SELECT 
  'webhook_calls (in payload)' as table_name,
  wc.id as webhook_call_id,
  wc.bot_id,
  wc.status,
  wc.created_at,
  wc.raw_payload->>'raw' as raw_payload_text
FROM webhook_calls wc
WHERE wc.raw_payload::text LIKE '%4ba580be-f871-4a54-8db1-d709a9f478a9%'
LIMIT 10;










