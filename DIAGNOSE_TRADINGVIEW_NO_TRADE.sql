-- Diagnose why TradingView alerts are not creating real trades
-- Run this after sending a TradingView alert

-- 1. Check recent manual trade signals (last 1 hour)
SELECT 
  mts.id,
  mts.bot_id,
  tb.name as bot_name,
  tb.status as bot_status,
  mts.side,
  mts.mode,
  mts.status as signal_status,
  mts.error,
  mts.reason,
  mts.size_multiplier,
  mts.created_at,
  mts.processed_at,
  mts.metadata->>'action' as action,
  mts.metadata->>'source' as source
FROM manual_trade_signals mts
JOIN trading_bots tb ON tb.id = mts.bot_id
WHERE mts.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY mts.created_at DESC
LIMIT 20;

-- 2. Check bot-executor logs for manual signal processing
SELECT 
  bal.id,
  bal.bot_id,
  bal.level,
  bal.category,
  bal.message,
  bal.details->>'signal_id' as signal_id,
  bal.details->>'side' as side,
  bal.details->>'mode' as mode,
  bal.details->>'error' as error,
  bal.created_at
FROM bot_activity_logs bal
WHERE bal.created_at >= NOW() - INTERVAL '1 hour'
  AND (
    bal.message LIKE '%RECEIVED: Processing TradingView%' OR
    bal.message LIKE '%Processing % ALERT signal%' OR
    bal.message LIKE '%Executing manual trade%' OR
    bal.message LIKE '%Manual trade signal failed%' OR
    bal.message LIKE '%EXECUTING MANUAL TRADE%'
  )
ORDER BY bal.created_at DESC
LIMIT 30;

-- 3. Check for any trades created (real trades only)
SELECT 
  t.id,
  t.bot_id,
  tb.name as bot_name,
  t.side,
  t.symbol,
  t.price,
  t.amount,
  t.status,
  t.created_at
FROM trades t
JOIN trading_bots tb ON tb.id = t.bot_id
WHERE t.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY t.created_at DESC
LIMIT 20;

-- 4. Check webhook calls to see if they're reaching bot-executor
SELECT 
  wc.id,
  wc.status,
  wc.error_message,
  wc.response_status,
  wc.created_at,
  (wc.raw_payload->'raw')::text as raw_json_preview
FROM webhook_calls wc
WHERE wc.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY wc.created_at DESC
LIMIT 10;

-- 5. Summary: Count signals by status
SELECT 
  mts.status,
  mts.mode,
  COUNT(*) as count,
  MAX(mts.created_at) as latest_signal,
  COUNT(CASE WHEN mts.error IS NOT NULL THEN 1 END) as error_count
FROM manual_trade_signals mts
WHERE mts.created_at >= NOW() - INTERVAL '1 hour'
GROUP BY mts.status, mts.mode
ORDER BY latest_signal DESC;

