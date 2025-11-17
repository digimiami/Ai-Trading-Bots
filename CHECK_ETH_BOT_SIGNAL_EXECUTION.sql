-- Check why ETH TRADINGVIEW bot signals completed but no trades created
-- Bot ID: 59f7165e-aff9-4107-b4a7-66a2ecfc5087

-- 1. Check the completed signals for this bot
SELECT 
  mts.id,
  mts.bot_id,
  mts.side,
  mts.mode,
  mts.status,
  mts.error,
  mts.reason,
  mts.size_multiplier,
  mts.created_at,
  mts.processed_at,
  EXTRACT(EPOCH FROM (mts.processed_at - mts.created_at)) as processing_time_seconds
FROM manual_trade_signals mts
WHERE mts.bot_id = '59f7165e-aff9-4107-b4a7-66a2ecfc5087'
  AND mts.status = 'completed'
  AND mts.created_at >= NOW() - INTERVAL '2 hours'
ORDER BY mts.created_at DESC;

-- 2. Check bot-executor logs for manual trade execution
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
  bal.details->>'orderId' as order_id,
  bal.details->>'paper_trading' as paper_trading,
  bal.created_at
FROM bot_activity_logs bal
WHERE bal.bot_id = '59f7165e-aff9-4107-b4a7-66a2ecfc5087'
  AND bal.created_at >= NOW() - INTERVAL '2 hours'
  AND (
    bal.message LIKE '%EXECUTING MANUAL TRADE%' OR
    bal.message LIKE '%Executing REAL trade%' OR
    bal.message LIKE '%Executing PAPER trade%' OR
    bal.message LIKE '%Manual trade signal%' OR
    bal.message LIKE '%Order placed%' OR
    bal.message LIKE '%Bybit order%' OR
    bal.message LIKE '%Order error%' OR
    bal.message LIKE '%RECEIVED: Processing TradingView%'
  )
ORDER BY bal.created_at DESC
LIMIT 50;

-- 3. Check for ALL errors for this bot
SELECT 
  bal.id,
  bal.level,
  bal.message,
  bal.details->>'error' as error,
  bal.details->>'errorType' as error_type,
  bal.created_at
FROM bot_activity_logs bal
WHERE bal.bot_id = '59f7165e-aff9-4107-b4a7-66a2ecfc5087'
  AND bal.level = 'error'
  AND bal.created_at >= NOW() - INTERVAL '2 hours'
ORDER BY bal.created_at DESC
LIMIT 30;

-- 4. Check if any trades were created for this bot
SELECT 
  t.id,
  t.side,
  t.symbol,
  t.price,
  t.amount,
  t.status,
  t.exchange_order_id,
  t.created_at
FROM trades t
WHERE t.bot_id = '59f7165e-aff9-4107-b4a7-66a2ecfc5087'
  AND t.created_at >= NOW() - INTERVAL '2 hours'
ORDER BY t.created_at DESC
LIMIT 10;

-- 5. Check bot configuration
SELECT 
  id,
  name,
  status,
  paper_trading,
  webhook_only,
  exchange,
  symbol,
  trading_type,
  trade_amount,
  user_id
FROM trading_bots
WHERE id = '59f7165e-aff9-4107-b4a7-66a2ecfc5087';

