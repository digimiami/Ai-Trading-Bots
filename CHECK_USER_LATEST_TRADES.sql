-- ============================================
-- CHECK USER LATEST TRADES (MAINNET & PAPER)
-- Shows latest trades for all users or specific user
-- ============================================

-- ============================================
-- PART 1: LATEST REAL TRADES (MAINNET)
-- ============================================

-- 1. Latest real trades for all users
SELECT 
  '=== LATEST REAL TRADES (MAINNET) ===' as section,
  u.email,
  u.id as user_id,
  b.name as bot_name,
  b.symbol,
  b.exchange,
  t.side,
  t.amount,
  t.price,
  t.status,
  t.exchange_order_id,
  t.created_at as trade_time,
  EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600 as hours_ago,
  CASE 
    WHEN t.status = 'filled' THEN '✅ FILLED'
    WHEN t.status = 'pending' THEN '⏳ PENDING'
    WHEN t.status = 'failed' THEN '❌ FAILED'
    WHEN t.status = 'cancelled' THEN '🚫 CANCELLED'
    ELSE '❓ ' || UPPER(t.status)
  END as status_display
FROM trades t
JOIN trading_bots b ON t.bot_id = b.id
JOIN auth.users u ON b.user_id = u.id
WHERE t.created_at > NOW() - INTERVAL '30 days'
ORDER BY t.created_at DESC
LIMIT 50;

-- 2. Latest real trades by user (summary)
SELECT 
  '=== REAL TRADES SUMMARY BY USER ===' as section,
  u.email,
  u.id as user_id,
  COUNT(*) as total_trades,
  COUNT(*) FILTER (WHERE t.status = 'filled') as filled_trades,
  COUNT(*) FILTER (WHERE t.status = 'pending') as pending_trades,
  COUNT(*) FILTER (WHERE t.status = 'failed') as failed_trades,
  COUNT(*) FILTER (WHERE t.exchange_order_id IS NOT NULL) as trades_with_order_id,
  MAX(t.created_at) as last_trade_time,
  EXTRACT(EPOCH FROM (NOW() - MAX(t.created_at))) / 3600 as hours_since_last_trade,
  SUM(CASE WHEN t.status = 'filled' THEN t.amount * t.price ELSE 0 END) as total_volume_usd
FROM trades t
JOIN trading_bots b ON t.bot_id = b.id
JOIN auth.users u ON b.user_id = u.id
WHERE t.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.email, u.id
ORDER BY last_trade_time DESC;

-- 3. Latest real trades for specific user (replace email)
SELECT 
  '=== LATEST REAL TRADES FOR SPECIFIC USER ===' as section,
  u.email,
  b.name as bot_name,
  b.symbol,
  b.exchange,
  t.side,
  t.amount,
  t.price,
  (t.amount * t.price) as trade_value_usd,
  t.status,
  t.exchange_order_id,
  t.executed_at,
  t.created_at as trade_time,
  EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600 as hours_ago,
  CASE 
    WHEN t.status = 'filled' THEN '✅ FILLED'
    WHEN t.status = 'pending' THEN '⏳ PENDING'
    WHEN t.status = 'failed' THEN '❌ FAILED'
    ELSE '❓ ' || UPPER(t.status)
  END as status_display
FROM trades t
JOIN trading_bots b ON t.bot_id = b.id
JOIN auth.users u ON b.user_id = u.id
WHERE u.email = 'diazites1@gmail.com'  -- CHANGE THIS EMAIL
  AND t.created_at > NOW() - INTERVAL '30 days'
ORDER BY t.created_at DESC
LIMIT 20;

-- ============================================
-- PART 2: LATEST PAPER TRADES
-- ============================================

-- 4. Latest paper trades for all users
SELECT 
  '=== LATEST PAPER TRADES ===' as section,
  u.email,
  u.id as user_id,
  b.name as bot_name,
  b.symbol,
  b.exchange,
  pt.side,
  pt.quantity as amount,
  pt.entry_price as price,
  pt.status,
  pt.pnl,
  pt.pnl_percentage,
  pt.created_at as trade_time,
  EXTRACT(EPOCH FROM (NOW() - pt.created_at)) / 3600 as hours_ago,
  CASE 
    WHEN pt.status = 'open' THEN '🟢 OPEN'
    WHEN pt.status = 'closed' THEN '🔴 CLOSED'
    WHEN pt.status = 'filled' THEN '✅ FILLED'
    ELSE '❓ ' || UPPER(pt.status)
  END as status_display
FROM paper_trading_trades pt
JOIN trading_bots b ON pt.bot_id = b.id
JOIN auth.users u ON b.user_id = u.id
WHERE pt.created_at > NOW() - INTERVAL '30 days'
ORDER BY pt.created_at DESC
LIMIT 50;

-- 5. Latest paper trades by user (summary)
SELECT 
  '=== PAPER TRADES SUMMARY BY USER ===' as section,
  u.email,
  u.id as user_id,
  COUNT(*) as total_paper_trades,
  COUNT(*) FILTER (WHERE pt.status = 'open') as open_trades,
  COUNT(*) FILTER (WHERE pt.status = 'closed') as closed_trades,
  COUNT(*) FILTER (WHERE pt.status = 'filled') as filled_trades,
  SUM(pt.pnl) as total_pnl,
  AVG(pt.pnl_percentage) FILTER (WHERE pt.status = 'closed') as avg_pnl_percentage,
  MAX(pt.created_at) as last_paper_trade_time,
  EXTRACT(EPOCH FROM (NOW() - MAX(pt.created_at))) / 3600 as hours_since_last_trade
FROM paper_trading_trades pt
JOIN trading_bots b ON pt.bot_id = b.id
JOIN auth.users u ON b.user_id = u.id
WHERE pt.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.email, u.id
ORDER BY last_paper_trade_time DESC;

-- 6. Latest paper trades for specific user (replace email)
SELECT 
  '=== LATEST PAPER TRADES FOR SPECIFIC USER ===' as section,
  u.email,
  b.name as bot_name,
  b.symbol,
  b.exchange,
  pt.side,
  pt.quantity as amount,
  pt.entry_price as price,
  (pt.quantity * pt.entry_price) as trade_value_usd,
  pt.status,
  pt.pnl,
  pt.pnl_percentage,
  pt.exit_price,
  pt.created_at as trade_time,
  pt.closed_at,
  EXTRACT(EPOCH FROM (NOW() - pt.created_at)) / 3600 as hours_ago,
  CASE 
    WHEN pt.status = 'open' THEN '🟢 OPEN'
    WHEN pt.status = 'closed' THEN '🔴 CLOSED'
    WHEN pt.pnl > 0 THEN '💰 PROFIT'
    WHEN pt.pnl < 0 THEN '📉 LOSS'
    ELSE '➖ BREAKEVEN'
  END as trade_result
FROM paper_trading_trades pt
JOIN trading_bots b ON pt.bot_id = b.id
JOIN auth.users u ON b.user_id = u.id
WHERE u.email = 'diazites1@gmail.com'  -- CHANGE THIS EMAIL
  AND pt.created_at > NOW() - INTERVAL '30 days'
ORDER BY pt.created_at DESC
LIMIT 20;

-- ============================================
-- PART 3: COMBINED VIEW (REAL + PAPER)
-- ============================================

-- 7. Combined latest trades (real + paper) for all users
SELECT 
  '=== COMBINED LATEST TRADES (REAL + PAPER) ===' as section,
  u.email,
  u.id as user_id,
  b.name as bot_name,
  b.symbol,
  b.exchange,
  'REAL' as trade_type,
  t.side,
  t.amount,
  t.price,
  t.status,
  t.created_at as trade_time,
  EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600 as hours_ago
FROM trades t
JOIN trading_bots b ON t.bot_id = b.id
JOIN auth.users u ON b.user_id = u.id
WHERE t.created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT 
  '=== COMBINED LATEST TRADES (REAL + PAPER) ===' as section,
  u.email,
  u.id as user_id,
  b.name as bot_name,
  b.symbol,
  b.exchange,
  'PAPER' as trade_type,
  pt.side,
  pt.quantity as amount,
  pt.entry_price as price,
  pt.status,
  pt.created_at as trade_time,
  EXTRACT(EPOCH FROM (NOW() - pt.created_at)) / 3600 as hours_ago
FROM paper_trading_trades pt
JOIN trading_bots b ON pt.bot_id = b.id
JOIN auth.users u ON b.user_id = u.id
WHERE pt.created_at > NOW() - INTERVAL '7 days'

ORDER BY trade_time DESC
LIMIT 50;

-- 8. User trading activity summary (real + paper)
SELECT 
  '=== USER TRADING ACTIVITY SUMMARY ===' as section,
  u.email,
  u.id as user_id,
  COUNT(DISTINCT t.id) as real_trades_count,
  COUNT(DISTINCT pt.id) as paper_trades_count,
  COUNT(DISTINCT t.id) + COUNT(DISTINCT pt.id) as total_trades_count,
  MAX(t.created_at) as last_real_trade,
  MAX(pt.created_at) as last_paper_trade,
  GREATEST(MAX(t.created_at), MAX(pt.created_at)) as last_trade_overall,
  EXTRACT(EPOCH FROM (NOW() - GREATEST(MAX(t.created_at), MAX(pt.created_at)))) / 3600 as hours_since_last_trade,
  COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'filled' AND t.created_at > NOW() - INTERVAL '7 days') as real_trades_last_7d,
  COUNT(DISTINCT pt.id) FILTER (WHERE pt.status = 'closed' AND pt.created_at > NOW() - INTERVAL '7 days') as paper_trades_last_7d
FROM auth.users u
LEFT JOIN trading_bots b ON b.user_id = u.id
LEFT JOIN trades t ON t.bot_id = b.id AND t.created_at > NOW() - INTERVAL '30 days'
LEFT JOIN paper_trading_trades pt ON pt.bot_id = b.id AND pt.created_at > NOW() - INTERVAL '30 days'
WHERE EXISTS (
  SELECT 1 FROM trading_bots WHERE user_id = u.id AND status = 'running'
)
GROUP BY u.email, u.id
HAVING COUNT(DISTINCT t.id) > 0 OR COUNT(DISTINCT pt.id) > 0
ORDER BY last_trade_overall DESC;

-- 9. Latest trades for specific user (real + paper combined)
SELECT 
  '=== LATEST TRADES FOR SPECIFIC USER (REAL + PAPER) ===' as section,
  u.email,
  b.name as bot_name,
  b.symbol,
  b.exchange,
  'REAL' as trade_type,
  t.side,
  t.amount,
  t.price,
  (t.amount * t.price) as trade_value_usd,
  t.status,
  t.exchange_order_id,
  t.created_at as trade_time,
  EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600 as hours_ago
FROM trades t
JOIN trading_bots b ON t.bot_id = b.id
JOIN auth.users u ON b.user_id = u.id
WHERE u.email = 'diazites1@gmail.com'  -- CHANGE THIS EMAIL
  AND t.created_at > NOW() - INTERVAL '30 days'

UNION ALL

SELECT 
  '=== LATEST TRADES FOR SPECIFIC USER (REAL + PAPER) ===' as section,
  u.email,
  b.name as bot_name,
  b.symbol,
  b.exchange,
  'PAPER' as trade_type,
  pt.side,
  pt.quantity as amount,
  pt.entry_price as price,
  (pt.quantity * pt.entry_price) as trade_value_usd,
  pt.status,
  NULL as exchange_order_id,
  pt.created_at as trade_time,
  EXTRACT(EPOCH FROM (NOW() - pt.created_at)) / 3600 as hours_ago
FROM paper_trading_trades pt
JOIN trading_bots b ON pt.bot_id = b.id
JOIN auth.users u ON b.user_id = u.id
WHERE u.email = 'diazites1@gmail.com'  -- CHANGE THIS EMAIL
  AND pt.created_at > NOW() - INTERVAL '30 days'

ORDER BY trade_time DESC
LIMIT 30;

-- ============================================
-- PART 4: TRADE STATISTICS
-- ============================================

-- 10. Trade statistics by user (last 7 days)
SELECT 
  '=== TRADE STATISTICS BY USER (LAST 7 DAYS) ===' as section,
  u.email,
  u.id as user_id,
  -- Real trades
  COUNT(DISTINCT t.id) FILTER (WHERE t.created_at > NOW() - INTERVAL '7 days') as real_trades_7d,
  COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'filled' AND t.created_at > NOW() - INTERVAL '7 days') as real_filled_7d,
  SUM(t.amount * t.price) FILTER (WHERE t.status = 'filled' AND t.created_at > NOW() - INTERVAL '7 days') as real_volume_usd_7d,
  -- Paper trades
  COUNT(DISTINCT pt.id) FILTER (WHERE pt.created_at > NOW() - INTERVAL '7 days') as paper_trades_7d,
  COUNT(DISTINCT pt.id) FILTER (WHERE pt.status = 'closed' AND pt.created_at > NOW() - INTERVAL '7 days') as paper_closed_7d,
  SUM(pt.pnl) FILTER (WHERE pt.status = 'closed' AND pt.created_at > NOW() - INTERVAL '7 days') as paper_pnl_7d,
  AVG(pt.pnl_percentage) FILTER (WHERE pt.status = 'closed' AND pt.created_at > NOW() - INTERVAL '7 days') as paper_avg_pnl_pct_7d
FROM auth.users u
LEFT JOIN trading_bots b ON b.user_id = u.id
LEFT JOIN trades t ON t.bot_id = b.id
LEFT JOIN paper_trading_trades pt ON pt.bot_id = b.id
WHERE EXISTS (
  SELECT 1 FROM trading_bots WHERE user_id = u.id AND status = 'running'
)
GROUP BY u.email, u.id
HAVING 
  COUNT(DISTINCT t.id) FILTER (WHERE t.created_at > NOW() - INTERVAL '7 days') > 0 OR
  COUNT(DISTINCT pt.id) FILTER (WHERE pt.created_at > NOW() - INTERVAL '7 days') > 0
ORDER BY real_trades_7d DESC, paper_trades_7d DESC;

-- ============================================
-- USAGE INSTRUCTIONS
-- ============================================

-- To check trades for a specific user:
-- 1. Replace 'diazites1@gmail.com' with the user's email in queries 3, 6, and 9
-- 2. Run the specific query you need

-- To check all users:
-- 1. Run queries 1, 2, 4, 5, 7, 8, or 10
-- 2. Results will show all users with trading activity

-- Time ranges:
-- - Queries default to last 30 days for detailed views
-- - Queries default to last 7 days for summary views
-- - Adjust INTERVAL values as needed (e.g., '7 days', '30 days', '90 days')

