-- ============================================
-- DIAGNOSTIC QUERIES FOR REAL TRADES
-- ============================================

-- 1. Check if ANY real trades exist in the trades table
SELECT 
  COUNT(*) as total_real_trades,
  COUNT(*) FILTER (WHERE status = 'filled') as filled_real_trades,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_real_trades,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_real_trades,
  MIN(created_at) as first_real_trade,
  MAX(created_at) as last_real_trade
FROM trades
WHERE created_at > NOW() - INTERVAL '7 days';

-- 2. Check recent real trades (if any)
SELECT 
  t.id,
  t.bot_id,
  b.name as bot_name,
  t.symbol,
  t.side,
  t.amount,
  t.price,
  t.status,
  t.exchange_order_id,
  t.executed_at,
  t.created_at,
  CASE 
    WHEN t.exchange_order_id IS NOT NULL THEN '✅ Has Order ID'
    ELSE '❌ No Order ID'
  END as order_status
FROM trades t
JOIN trading_bots b ON t.bot_id = b.id
WHERE t.created_at > NOW() - INTERVAL '7 days'
ORDER BY t.created_at DESC
LIMIT 20;

-- 3. Check bots that should be trading in REAL mode
SELECT 
  b.id,
  b.name,
  b.symbol,
  b.status,
  b.paper_trading,
  b.exchange,
  b.trading_type,
  COUNT(t.id) as total_trades,
  COUNT(t.id) FILTER (WHERE t.created_at > NOW() - INTERVAL '24 hours') as trades_last_24h
FROM trading_bots b
LEFT JOIN trades t ON t.bot_id = b.id
WHERE b.status = 'running'
  AND b.paper_trading = false  -- Real trading bots
GROUP BY b.id, b.name, b.symbol, b.status, b.paper_trading, b.exchange, b.trading_type
ORDER BY trades_last_24h DESC;

-- 4. Check manual trade signals with mode='real'
SELECT 
  mts.id,
  mts.bot_id,
  b.name as bot_name,
  mts.side,
  mts.mode,
  mts.status,
  mts.error,
  mts.created_at,
  mts.processed_at,
  CASE 
    WHEN mts.status = 'completed' AND mts.processed_at IS NOT NULL THEN '✅ Completed'
    WHEN mts.status = 'failed' THEN '❌ Failed: ' || COALESCE(mts.error, 'Unknown error')
    WHEN mts.status = 'pending' THEN '⏳ Still Pending'
    WHEN mts.status = 'processing' THEN '🔄 Processing'
    ELSE '❓ Unknown Status'
  END as signal_status
FROM manual_trade_signals mts
JOIN trading_bots b ON mts.bot_id = b.id
WHERE mts.mode = 'real'
  AND mts.created_at > NOW() - INTERVAL '7 days'
ORDER BY mts.created_at DESC
LIMIT 50;

-- 5. Check bot activity logs for real trade attempts
SELECT 
  bal.bot_id,
  b.name as bot_name,
  bal.level,
  bal.category,
  bal.message,
  bal.timestamp,
  bal.details->>'mode' as mode_from_log,
  bal.details->>'side' as side_from_log
FROM bot_activity_logs bal
JOIN trading_bots b ON bal.bot_id = b.id
WHERE bal.message LIKE '%REAL%' 
   OR bal.message LIKE '%real trade%'
   OR bal.message LIKE '%Executing REAL%'
   OR (bal.details->>'mode' = 'real')
ORDER BY bal.timestamp DESC
LIMIT 50;

-- 6. Check for order placement errors in logs
SELECT 
  bal.bot_id,
  b.name as bot_name,
  bal.level,
  bal.message,
  bal.timestamp,
  bal.details
FROM bot_activity_logs bal
JOIN trading_bots b ON bal.bot_id = b.id
WHERE bal.level = 'error'
  AND (
    bal.message LIKE '%order%' 
    OR bal.message LIKE '%Bybit%'
    OR bal.message LIKE '%trade%'
    OR bal.message LIKE '%execution%'
  )
  AND bal.timestamp > NOW() - INTERVAL '24 hours'
ORDER BY bal.timestamp DESC
LIMIT 30;

-- 7. Compare paper vs real trade counts
SELECT 
  'Paper Trades' as trade_type,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE status = 'filled') as filled_count
FROM paper_trading_trades
WHERE created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 
  'Real Trades' as trade_type,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE status = 'filled') as filled_count
FROM trades
WHERE created_at > NOW() - INTERVAL '7 days';

