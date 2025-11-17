-- Check why completed signals didn't create trades
-- Run this to see what happened with the completed signals

-- 1. Check the completed signals in detail
SELECT 
  mts.id,
  mts.bot_id,
  tb.name as bot_name,
  tb.status as bot_status,
  tb.paper_trading,
  tb.webhook_only,
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
JOIN trading_bots tb ON tb.id = mts.bot_id
WHERE mts.status = 'completed'
  AND mts.mode = 'real'
  AND mts.created_at >= NOW() - INTERVAL '2 hours'
ORDER BY mts.created_at DESC
LIMIT 10;

-- 2. Check if any trades were created for these signals
SELECT 
  t.id,
  t.bot_id,
  tb.name as bot_name,
  t.side,
  t.symbol,
  t.price,
  t.amount,
  t.status,
  t.created_at,
  CASE 
    WHEN t.created_at >= (SELECT MAX(mts.created_at) FROM manual_trade_signals mts WHERE mts.bot_id = t.bot_id AND mts.status = 'completed') - INTERVAL '5 minutes'
      AND t.created_at <= (SELECT MAX(mts.processed_at) FROM manual_trade_signals mts WHERE mts.bot_id = t.bot_id AND mts.status = 'completed') + INTERVAL '5 minutes'
    THEN 'likely_from_signal'
    ELSE 'unrelated'
  END as likely_source
FROM trades t
JOIN trading_bots tb ON tb.id = t.bot_id
WHERE t.created_at >= NOW() - INTERVAL '2 hours'
ORDER BY t.created_at DESC
LIMIT 20;

-- 3. Check bot-executor logs for these signals
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
  bal.details->>'exchangeResponse' as exchange_response,
  bal.created_at
FROM bot_activity_logs bal
WHERE bal.created_at >= NOW() - INTERVAL '2 hours'
  AND (
    bal.message LIKE '%EXECUTING MANUAL TRADE%' OR
    bal.message LIKE '%Executing REAL trade%' OR
    bal.message LIKE '%Executing PAPER trade%' OR
    bal.message LIKE '%Manual trade signal%' OR
    bal.message LIKE '%Order placed%' OR
    bal.message LIKE '%Bybit order%' OR
    bal.message LIKE '%Order error%'
  )
ORDER BY bal.created_at DESC
LIMIT 30;

-- 4. Check for errors in bot-executor logs
SELECT 
  bal.id,
  bal.bot_id,
  bal.level,
  bal.message,
  bal.details->>'error' as error,
  bal.details->>'errorType' as error_type,
  bal.created_at
FROM bot_activity_logs bal
WHERE bal.level = 'error'
  AND bal.created_at >= NOW() - INTERVAL '2 hours'
ORDER BY bal.created_at DESC
LIMIT 20;

-- 5. Check bot configuration for the signals
SELECT 
  tb.id,
  tb.name,
  tb.status,
  tb.paper_trading,
  tb.webhook_only,
  tb.exchange,
  tb.symbol,
  tb.trading_type,
  COUNT(mts.id) as completed_signals,
  MAX(mts.created_at) as latest_signal
FROM trading_bots tb
LEFT JOIN manual_trade_signals mts ON mts.bot_id = tb.id 
  AND mts.status = 'completed' 
  AND mts.created_at >= NOW() - INTERVAL '2 hours'
WHERE tb.id IN (
  SELECT DISTINCT bot_id 
  FROM manual_trade_signals 
  WHERE status = 'completed' 
    AND mode = 'real'
    AND created_at >= NOW() - INTERVAL '2 hours'
)
GROUP BY tb.id, tb.name, tb.status, tb.paper_trading, tb.webhook_only, tb.exchange, tb.symbol, tb.trading_type;

