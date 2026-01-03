-- Check bots not trading - Show recent manual trades for each bot
-- Bot IDs provided by user

-- 1. Check manual trade signals for each bot
SELECT 
  mts.id,
  mts.bot_id,
  tb.name as bot_name,
  tb.status as bot_status,
  tb.paper_trading,
  mts.side,
  mts.mode,
  mts.status as signal_status,
  mts.error,
  mts.reason,
  mts.size_multiplier,
  mts.created_at,
  mts.processed_at,
  CASE 
    WHEN mts.reason LIKE '%Test webhook%' THEN 'webhook_test'
    WHEN mts.reason LIKE '%TradingView alert%' THEN 'tradingview_alert'
    ELSE 'manual'
  END as signal_source,
  EXTRACT(EPOCH FROM (NOW() - mts.created_at))/60 as minutes_ago
FROM manual_trade_signals mts
JOIN trading_bots tb ON tb.id = mts.bot_id
WHERE tb.id IN (
  '6722d72e-8a4d-406e-8eab-7c2811988a1f', -- Winner Bot - DOGEUSDT
  '0a952716-073e-4839-9a40-43fdf9bcd4bc', -- XRPUSDT Optimized
  '59e331f1-70fa-4e0c-8a24-46de3e3efd25', -- MYXUSDT
  'cbe3d5af-dbba-423a-aa29-42e76e0b5a87', -- RAVEUSDT
  '80f5299f-d280-43fe-bf7c-40729ff47ec4', -- NIGHTUSDT
  'd2e95cb7-3422-4896-8ae7-ca7b3ec0c7e1', -- BEATUSDT
  '089f0947-41da-4199-bcef-2cde85e4771d', -- TNSRUSDT SMART CREATE (Copy)
  '7d379c3e-aca6-4a62-86a3-3c105b10f044', -- PIPPINUSD (Copy)
  'b1fa2356-d030-4637-a622-c6685ca7065c'  -- AI Bot - BTCUSDT (SELL) (Copy)
)
  AND mts.created_at >= NOW() - INTERVAL '7 days'
ORDER BY mts.created_at DESC
LIMIT 100;

-- 2. Check bot status and configuration
SELECT 
  id,
  name,
  status,
  paper_trading,
  webhook_only,
  symbol,
  exchange,
  trade_amount,
  stop_loss,
  take_profit,
  leverage,
  updated_at,
  last_trade_at,
  CASE 
    WHEN status = 'running' THEN '✅ Active'
    WHEN status = 'paused' THEN '⏸️ Paused'
    ELSE '❌ Stopped'
  END as status_indicator,
  EXTRACT(EPOCH FROM (NOW() - COALESCE(last_trade_at, created_at)))/3600 as hours_since_last_trade
FROM trading_bots
WHERE id IN (
  '6722d72e-8a4d-406e-8eab-7c2811988a1f', -- Winner Bot - DOGEUSDT
  '0a952716-073e-4839-9a40-43fdf9bcd4bc', -- XRPUSDT Optimized
  '59e331f1-70fa-4e0c-8a24-46de3e3efd25', -- MYXUSDT
  'cbe3d5af-dbba-423a-aa29-42e76e0b5a87', -- RAVEUSDT
  '80f5299f-d280-43fe-bf7c-40729ff47ec4', -- NIGHTUSDT
  'd2e95cb7-3422-4896-8ae7-ca7b3ec0c7e1', -- BEATUSDT
  '089f0947-41da-4199-bcef-2cde85e4771d', -- TNSRUSDT SMART CREATE (Copy)
  '7d379c3e-aca6-4a62-86a3-3c105b10f044', -- PIPPINUSD (Copy)
  'b1fa2356-d030-4637-a622-c6685ca7065c'  -- AI Bot - BTCUSDT (SELL) (Copy)
)
ORDER BY last_trade_at DESC NULLS LAST;

-- 3. Check recent bot activity logs for manual trade execution
SELECT 
  bal.id,
  bal.bot_id,
  tb.name as bot_name,
  bal.level,
  bal.category,
  bal.message,
  bal.details->>'mode' as mode,
  bal.details->>'source' as source,
  bal.details->>'side' as side,
  bal.details->>'error' as error,
  bal.timestamp,
  EXTRACT(EPOCH FROM (NOW() - bal.timestamp))/60 as minutes_ago
FROM bot_activity_logs bal
JOIN trading_bots tb ON tb.id = bal.bot_id
WHERE bal.bot_id IN (
  '6722d72e-8a4d-406e-8eab-7c2811988a1f', -- Winner Bot - DOGEUSDT
  '0a952716-073e-4839-9a40-43fdf9bcd4bc', -- XRPUSDT Optimized
  '59e331f1-70fa-4e0c-8a24-46de3e3efd25', -- MYXUSDT
  'cbe3d5af-dbba-423a-aa29-42e76e0b5a87', -- RAVEUSDT
  '80f5299f-d280-43fe-bf7c-40729ff47ec4', -- NIGHTUSDT
  'd2e95cb7-3422-4896-8ae7-ca7b3ec0c7e1', -- BEATUSDT
  '089f0947-41da-4199-bcef-2cde85e4771d', -- TNSRUSDT SMART CREATE (Copy)
  '7d379c3e-aca6-4a62-86a3-3c105b10f044', -- PIPPINUSD (Copy)
  'b1fa2356-d030-4637-a622-c6685ca7065c'  -- AI Bot - BTCUSDT (SELL) (Copy)
)
  AND bal.timestamp >= NOW() - INTERVAL '7 days'
  AND (
    bal.message LIKE '%EXECUTING MANUAL TRADE%' OR
    bal.message LIKE '%BUY ALERT%' OR
    bal.message LIKE '%SELL ALERT%' OR
    bal.message LIKE '%Executing REAL trade%' OR
    bal.message LIKE '%Executing PAPER trade%' OR
    bal.message LIKE '%MANUAL TRADE EXECUTION FAILED%' OR
    bal.message LIKE '%RECEIVED: Processing TradingView%' OR
    bal.message LIKE '%Manual trade signal%'
  )
ORDER BY bal.timestamp DESC
LIMIT 50;

-- 4. Summary: Count manual trade signals by status per bot (FIXED)
SELECT 
  tb.id as bot_id,
  tb.name as bot_name,
  tb.status as bot_status,
  COUNT(mts.id) as total_signal_count,
  COUNT(CASE WHEN mts.status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN mts.status = 'processing' THEN 1 END) as processing_count,
  COUNT(CASE WHEN mts.status = 'completed' THEN 1 END) as completed_count,
  COUNT(CASE WHEN mts.status = 'failed' THEN 1 END) as failed_count,
  MAX(mts.created_at) as latest_signal,
  CASE 
    WHEN MAX(mts.created_at) IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM (NOW() - MAX(mts.created_at)))/60
  END as minutes_since_latest
FROM trading_bots tb
LEFT JOIN manual_trade_signals mts ON mts.bot_id = tb.id 
  AND mts.created_at >= NOW() - INTERVAL '7 days'
WHERE tb.id IN (
  '6722d72e-8a4d-406e-8eab-7c2811988a1f', -- Winner Bot - DOGEUSDT
  '0a952716-073e-4839-9a40-43fdf9bcd4bc', -- XRPUSDT Optimized
  '59e331f1-70fa-4e0c-8a24-46de3e3efd25', -- MYXUSDT
  'cbe3d5af-dbba-423a-aa29-42e76e0b5a87', -- RAVEUSDT
  '80f5299f-d280-43fe-bf7c-40729ff47ec4', -- NIGHTUSDT
  'd2e95cb7-3422-4896-8ae7-ca7b3ec0c7e1', -- BEATUSDT
  '089f0947-41da-4199-bcef-2cde85e4771d', -- TNSRUSDT SMART CREATE (Copy)
  '7d379c3e-aca6-4a62-86a3-3c105b10f044', -- PIPPINUSD (Copy)
  'b1fa2356-d030-4637-a622-c6685ca7065c'  -- AI Bot - BTCUSDT (SELL) (Copy)
)
GROUP BY tb.id, tb.name, tb.status
ORDER BY latest_signal DESC NULLS LAST, tb.name;














