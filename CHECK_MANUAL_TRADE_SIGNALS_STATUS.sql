-- Check manual trade signals status to see why TradingView alerts aren't trading
-- This is the most important query to run

-- 1. Check all manual trade signals for TradingView bots
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
    ELSE 'unknown'
  END as signal_source
FROM manual_trade_signals mts
JOIN trading_bots tb ON tb.id = mts.bot_id
WHERE mts.created_at >= NOW() - INTERVAL '24 hours'
  AND tb.id IN (
    '02511945-ef73-47df-822d-15608d1bac9e',
    '59f7165e-aff9-4107-b4a7-66a2ecfc5087',
    '7afa5036-1cd3-4ba8-8a44-88712716634a'
  )
ORDER BY mts.created_at DESC
LIMIT 30;

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
  AND bal.bot_id IN (
    '02511945-ef73-47df-822d-15608d1bac9e',
    '59f7165e-aff9-4107-b4a7-66a2ecfc5087',
    '7afa5036-1cd3-4ba8-8a44-88712716634a'
  )
  AND (
    bal.message LIKE '%EXECUTING MANUAL TRADE%' OR
    bal.message LIKE '%BUY ALERT%' OR
    bal.message LIKE '%SELL ALERT%' OR
    bal.message LIKE '%Executing REAL trade%' OR
    bal.message LIKE '%Executing PAPER trade%' OR
    bal.message LIKE '%MANUAL TRADE EXECUTION FAILED%' OR
    bal.message LIKE '%RECEIVED: Processing TradingView%'
  )
ORDER BY bal.created_at DESC
LIMIT 50;

-- 3. Check for any trades created (real trades only - paper trades excluded)
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
WHERE t.created_at >= NOW() - INTERVAL '24 hours'
  AND t.bot_id IN (
    '02511945-ef73-47df-822d-15608d1bac9e',
    '59f7165e-aff9-4107-b4a7-66a2ecfc5087',
    '7afa5036-1cd3-4ba8-8a44-88712716634a'
  )
ORDER BY t.created_at DESC
LIMIT 20;

-- 4. Summary: Count signals by status
SELECT 
  mts.status,
  mts.mode,
  COUNT(*) as count,
  MAX(mts.created_at) as latest_signal
FROM manual_trade_signals mts
WHERE mts.created_at >= NOW() - INTERVAL '24 hours'
  AND mts.bot_id IN (
    '02511945-ef73-47df-822d-15608d1bac9e',
    '59f7165e-aff9-4107-b4a7-66a2ecfc5087',
    '7afa5036-1cd3-4ba8-8a44-88712716634a'
  )
GROUP BY mts.status, mts.mode
ORDER BY latest_signal DESC;

