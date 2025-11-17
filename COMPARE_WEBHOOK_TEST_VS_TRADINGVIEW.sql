-- Compare webhook tests vs TradingView alerts to find the difference
-- Run this after testing both to see what's different

-- 1. Check all manual trade signals (webhook tests and TradingView alerts)
SELECT 
  mts.id,
  mts.bot_id,
  tb.name as bot_name,
  mts.side,
  mts.mode,
  mts.status,
  mts.error,
  mts.reason,
  mts.created_at,
  mts.processed_at,
  mts.metadata->>'sourcePayloadId' as source_payload_id,
  CASE 
    WHEN mts.reason LIKE '%Test webhook%' THEN 'webhook_test'
    WHEN mts.reason LIKE '%TradingView alert%' THEN 'tradingview_alert'
    ELSE 'unknown'
  END as signal_source
FROM manual_trade_signals mts
JOIN trading_bots tb ON tb.id = mts.bot_id
WHERE mts.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY mts.created_at DESC
LIMIT 20;

-- 2. Check bot-executor logs for manual trade execution
SELECT 
  bal.id,
  bal.bot_id,
  bal.level,
  bal.category,
  bal.message,
  bal.details->>'mode' as mode,
  bal.details->>'source' as source,
  bal.details->>'side' as side,
  bal.details->>'error' as error,
  bal.created_at
FROM bot_activity_logs bal
WHERE bal.created_at >= NOW() - INTERVAL '24 hours'
  AND (
    bal.message LIKE '%EXECUTING MANUAL TRADE%' OR
    bal.message LIKE '%BUY ALERT EXECUTING%' OR
    bal.message LIKE '%SELL ALERT EXECUTING%' OR
    bal.message LIKE '%Executing REAL trade%' OR
    bal.message LIKE '%Executing PAPER trade%' OR
    bal.message LIKE '%MANUAL TRADE EXECUTION FAILED%'
  )
ORDER BY bal.created_at DESC
LIMIT 30;

-- 3. Check for any trades created (real or paper)
SELECT 
  'real' as trade_type,
  t.id,
  t.bot_id,
  t.side,
  t.symbol,
  t.price,
  t.amount as quantity,
  t.status,
  t.created_at
FROM trades t
WHERE t.created_at >= NOW() - INTERVAL '24 hours'
  AND t.bot_id IN (
    SELECT id FROM trading_bots 
    WHERE name LIKE '%TRADINGVIEW%' OR name LIKE '%BTC%' OR name LIKE '%ETH%'
  )

UNION ALL

SELECT 
  'paper' as trade_type,
  pt.id,
  pt.bot_id,
  pt.side,
  pt.symbol,
  pt.entry_price as price,
  pt.quantity,
  pt.status,
  pt.created_at
FROM paper_trading_trades pt
WHERE pt.created_at >= NOW() - INTERVAL '24 hours'
  AND pt.bot_id IN (
    SELECT id FROM trading_bots 
    WHERE name LIKE '%TRADINGVIEW%' OR name LIKE '%BTC%' OR name LIKE '%ETH%'
  )
ORDER BY created_at DESC
LIMIT 20;

-- 4. Check bot configuration for TradingView bots
SELECT 
  id,
  name,
  status,
  paper_trading,
  webhook_trigger_immediate,
  symbol,
  exchange,
  trading_type,
  trade_amount
FROM trading_bots
WHERE name LIKE '%TRADINGVIEW%' 
   OR id IN ('59f7165e-aff9-4107-b4a7-66a2ecfc5087', '02511945-ef73-47df-822d-15608d1bac9e', '7afa5036-1cd3-4ba8-8a44-88712716634a')
ORDER BY name;

-- 5. Check webhook calls to see payload differences
-- Note: raw_payload.raw contains the JSON string, need to parse it
SELECT 
  wc.id,
  wc.status,
  wc.error_message,
  wc.response_status,
  wc.created_at,
  (wc.raw_payload->'raw')::text as raw_json_string,
  CASE 
    WHEN (wc.raw_payload->'raw')::text LIKE '%Test webhook%' THEN 'webhook_test'
    WHEN (wc.raw_payload->'raw')::text LIKE '%TradingView alert%' THEN 'tradingview_alert'
    WHEN (wc.raw_payload->'raw')::text LIKE '%"action"%' THEN 'has_action'
    ELSE 'unknown'
  END as call_source
FROM webhook_calls wc
WHERE wc.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY wc.created_at DESC
LIMIT 20;

