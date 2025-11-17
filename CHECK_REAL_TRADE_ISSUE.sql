-- ============================================
-- COMPREHENSIVE REAL TRADE DIAGNOSTIC
-- ============================================

-- 1. Check ALL bots and their paper_trading status
SELECT 
  id,
  name,
  symbol,
  status,
  paper_trading,
  exchange,
  trading_type,
  created_at,
  CASE 
    WHEN paper_trading = true THEN '📝 PAPER MODE'
    WHEN paper_trading = false THEN '💵 REAL MODE'
    ELSE '❓ UNKNOWN'
  END as trading_mode
FROM trading_bots
WHERE status = 'running'
ORDER BY paper_trading, created_at DESC;

-- 2. Check ALL manual trade signals (all modes)
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
  EXTRACT(EPOCH FROM (COALESCE(mts.processed_at, NOW()) - mts.created_at)) as seconds_to_process,
  CASE 
    WHEN mts.status = 'completed' AND mts.processed_at IS NOT NULL THEN '✅ Completed'
    WHEN mts.status = 'failed' THEN '❌ Failed: ' || COALESCE(mts.error, 'Unknown error')
    WHEN mts.status = 'pending' THEN '⏳ Still Pending (may be stuck)'
    WHEN mts.status = 'processing' THEN '🔄 Processing'
    ELSE '❓ Unknown Status: ' || mts.status
  END as signal_status
FROM manual_trade_signals mts
JOIN trading_bots b ON mts.bot_id = b.id
WHERE mts.created_at > NOW() - INTERVAL '7 days'
ORDER BY mts.created_at DESC
LIMIT 100;

-- 3. Check for STUCK pending real trade signals
SELECT 
  mts.id,
  mts.bot_id,
  b.name as bot_name,
  b.paper_trading as bot_paper_mode,
  mts.side,
  mts.mode,
  mts.status,
  mts.created_at,
  EXTRACT(EPOCH FROM (NOW() - mts.created_at)) / 60 as minutes_stuck,
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - mts.created_at)) / 60 > 60 THEN '🚨 STUCK > 1 hour'
    WHEN EXTRACT(EPOCH FROM (NOW() - mts.created_at)) / 60 > 30 THEN '⚠️ STUCK > 30 min'
    ELSE '⏳ Recently created'
  END as stuck_status
FROM manual_trade_signals mts
JOIN trading_bots b ON mts.bot_id = b.id
WHERE mts.mode = 'real'
  AND mts.status IN ('pending', 'processing')
  AND mts.created_at < NOW() - INTERVAL '5 minutes'
ORDER BY mts.created_at ASC;

-- 4. Check bot activity logs for REAL trade execution attempts
SELECT 
  bal.bot_id,
  b.name as bot_name,
  bal.level,
  bal.category,
  bal.message,
  bal.timestamp,
  bal.details->>'mode' as mode_from_details,
  bal.details->>'side' as side_from_details,
  bal.details->>'error' as error_from_details
FROM bot_activity_logs bal
JOIN trading_bots b ON bal.bot_id = b.id
WHERE (
    bal.message LIKE '%REAL%' 
    OR bal.message LIKE '%real trade%'
    OR bal.message LIKE '%Executing REAL%'
    OR bal.message LIKE '%EXECUTING REAL TRADE%'
    OR bal.message LIKE '%REAL trade executed%'
    OR bal.message LIKE '%REAL trade failed%'
    OR (bal.details->>'mode')::text = 'real'
  )
  AND bal.timestamp > NOW() - INTERVAL '7 days'
ORDER BY bal.timestamp DESC
LIMIT 100;

-- 5. Check for order placement errors
SELECT 
  bal.bot_id,
  b.name as bot_name,
  bal.level,
  bal.message,
  bal.timestamp,
  bal.details->>'error' as error_details,
  bal.details->>'symbol' as symbol_details
FROM bot_activity_logs bal
JOIN trading_bots b ON bal.bot_id = b.id
WHERE bal.level = 'error'
  AND (
    bal.message LIKE '%order%' 
    OR bal.message LIKE '%Bybit%'
    OR bal.message LIKE '%trade%'
    OR bal.message LIKE '%execution%'
    OR bal.message LIKE '%price%'
    OR bal.message LIKE '%API%'
  )
  AND bal.timestamp > NOW() - INTERVAL '24 hours'
ORDER BY bal.timestamp DESC
LIMIT 50;

-- 6. Check if ANY real trades exist (even failed ones)
SELECT 
  'Real Trades (All Status)' as category,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE status = 'filled') as filled,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE exchange_order_id IS NOT NULL) as has_order_id,
  MIN(created_at) as first_trade,
  MAX(created_at) as last_trade
FROM trades
WHERE created_at > NOW() - INTERVAL '30 days';

-- 7. Check admin test trade signals
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
  mts.reason,
  CASE 
    WHEN mts.reason LIKE '%admin%' OR mts.reason LIKE '%test%' THEN '✅ Admin Test'
    ELSE 'User Signal'
  END as signal_source
FROM manual_trade_signals mts
JOIN trading_bots b ON mts.bot_id = b.id
WHERE mts.created_at > NOW() - INTERVAL '7 days'
  AND (mts.reason LIKE '%admin%' OR mts.reason LIKE '%test%' OR mts.reason LIKE '%Admin%')
ORDER BY mts.created_at DESC;

