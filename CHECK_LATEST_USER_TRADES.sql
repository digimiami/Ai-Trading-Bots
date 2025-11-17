-- =====================================================
-- CHECK LATEST USER TRADES (REAL & PAPER)
-- =====================================================
-- This script shows the latest trades for all users,
-- including both real trades and paper trades.
-- =====================================================

-- Option 1: Combined view of latest trades (Real + Paper)
-- Shows the 50 most recent trades across all users
SELECT 
  'REAL' as trade_type,
  t.id as trade_id,
  u.email as user_email,
  u.id as user_id,
  tb.name as bot_name,
  t.symbol,
  t.side,
  t.amount::numeric as amount,
  t.price::numeric as price,
  t.status,
  t.pnl::numeric as pnl,
  t.fee::numeric as fee,
  t.executed_at,
  t.created_at
FROM trades t
LEFT JOIN users u ON t.user_id = u.id
LEFT JOIN trading_bots tb ON t.bot_id = tb.id
WHERE t.executed_at IS NOT NULL

UNION ALL

SELECT 
  'PAPER' as trade_type,
  pt.id as trade_id,
  u.email as user_email,
  u.id as user_id,
  tb.name as bot_name,
  pt.symbol,
  pt.side,
  pt.quantity::numeric as amount,
  COALESCE(pt.exit_price, pt.entry_price)::numeric as price,
  pt.status,
  pt.pnl::numeric as pnl,
  pt.fees::numeric as fee,
  pt.executed_at,
  pt.created_at
FROM paper_trading_trades pt
LEFT JOIN users u ON pt.user_id = u.id
LEFT JOIN trading_bots tb ON pt.bot_id = tb.id
WHERE pt.executed_at IS NOT NULL

ORDER BY executed_at DESC
LIMIT 50;

-- =====================================================
-- Option 2: Latest trades per user (Real + Paper combined)
-- Shows the 5 most recent trades for each user
-- =====================================================
WITH all_trades AS (
  SELECT 
    'REAL' as trade_type,
    t.id as trade_id,
    u.email as user_email,
    u.id as user_id,
    tb.name as bot_name,
    t.symbol,
    t.side,
    t.amount::numeric as amount,
    t.price::numeric as price,
    t.status,
    t.pnl::numeric as pnl,
    t.fee::numeric as fee,
    t.executed_at,
    t.created_at,
    ROW_NUMBER() OVER (PARTITION BY u.id ORDER BY t.executed_at DESC) as rn
  FROM trades t
  LEFT JOIN users u ON t.user_id = u.id
  LEFT JOIN trading_bots tb ON t.bot_id = tb.id
  WHERE t.executed_at IS NOT NULL

  UNION ALL

  SELECT 
    'PAPER' as trade_type,
    pt.id as trade_id,
    u.email as user_email,
    u.id as user_id,
    tb.name as bot_name,
    pt.symbol,
    pt.side,
    pt.quantity::numeric as amount,
    COALESCE(pt.exit_price, pt.entry_price)::numeric as price,
    pt.status,
    pt.pnl::numeric as pnl,
    pt.fees::numeric as fee,
    pt.executed_at,
    pt.created_at,
    ROW_NUMBER() OVER (PARTITION BY u.id ORDER BY pt.executed_at DESC) as rn
  FROM paper_trading_trades pt
  LEFT JOIN users u ON pt.user_id = u.id
  LEFT JOIN trading_bots tb ON pt.bot_id = tb.id
  WHERE pt.executed_at IS NOT NULL
)
SELECT 
  trade_type,
  trade_id,
  user_email,
  user_id,
  bot_name,
  symbol,
  side,
  amount,
  price,
  status,
  pnl,
  fee,
  executed_at,
  created_at
FROM all_trades
WHERE rn <= 5
ORDER BY user_email, executed_at DESC;

-- =====================================================
-- Option 3: Summary by user (Real vs Paper)
-- Shows trade counts and totals per user
-- =====================================================
SELECT 
  u.email as user_email,
  u.id as user_id,
  COUNT(DISTINCT CASE WHEN t.id IS NOT NULL THEN t.id END) as real_trade_count,
  COUNT(DISTINCT CASE WHEN pt.id IS NOT NULL THEN pt.id END) as paper_trade_count,
  COALESCE(SUM(CASE WHEN t.id IS NOT NULL THEN t.pnl::numeric END), 0) as real_total_pnl,
  COALESCE(SUM(CASE WHEN pt.id IS NOT NULL THEN pt.pnl::numeric END), 0) as paper_total_pnl,
  MAX(CASE WHEN t.id IS NOT NULL THEN t.executed_at END) as last_real_trade,
  MAX(CASE WHEN pt.id IS NOT NULL THEN pt.executed_at END) as last_paper_trade
FROM users u
LEFT JOIN trades t ON u.id = t.user_id AND t.executed_at IS NOT NULL
LEFT JOIN paper_trading_trades pt ON u.id = pt.user_id AND pt.executed_at IS NOT NULL
GROUP BY u.id, u.email
HAVING COUNT(DISTINCT CASE WHEN t.id IS NOT NULL THEN t.id END) > 0
   OR COUNT(DISTINCT CASE WHEN pt.id IS NOT NULL THEN pt.id END) > 0
ORDER BY 
  GREATEST(
    MAX(CASE WHEN t.id IS NOT NULL THEN t.executed_at END),
    MAX(CASE WHEN pt.id IS NOT NULL THEN pt.executed_at END)
  ) DESC NULLS LAST;

-- =====================================================
-- Option 4: Latest trades for a specific user
-- Replace 'USER_EMAIL_HERE' with the actual email
-- =====================================================
-- Example: Check latest trades for a specific user
/*
SELECT 
  'REAL' as trade_type,
  t.id as trade_id,
  u.email as user_email,
  tb.name as bot_name,
  t.symbol,
  t.side,
  t.amount::numeric as amount,
  t.price::numeric as price,
  t.status,
  t.pnl::numeric as pnl,
  t.fee::numeric as fee,
  t.executed_at
FROM trades t
LEFT JOIN users u ON t.user_id = u.id
LEFT JOIN trading_bots tb ON t.bot_id = tb.id
WHERE u.email = 'USER_EMAIL_HERE'
  AND t.executed_at IS NOT NULL

UNION ALL

SELECT 
  'PAPER' as trade_type,
  pt.id as trade_id,
  u.email as user_email,
  tb.name as bot_name,
  pt.symbol,
  pt.side,
  pt.quantity::numeric as amount,
  COALESCE(pt.exit_price, pt.entry_price)::numeric as price,
  pt.status,
  pt.pnl::numeric as pnl,
  pt.fees::numeric as fee,
  pt.executed_at
FROM paper_trading_trades pt
LEFT JOIN users u ON pt.user_id = u.id
LEFT JOIN trading_bots tb ON pt.bot_id = tb.id
WHERE u.email = 'USER_EMAIL_HERE'
  AND pt.executed_at IS NOT NULL

ORDER BY executed_at DESC
LIMIT 20;
*/

-- =====================================================
-- Option 5: Latest trades with bot details
-- Shows more detailed information including bot strategy
-- =====================================================
SELECT 
  'REAL' as trade_type,
  t.id as trade_id,
  u.email as user_email,
  tb.name as bot_name,
  CASE 
    WHEN tb.strategy IS NULL THEN NULL
    WHEN tb.strategy::text = '' THEN NULL
    ELSE (tb.strategy::jsonb->>'type')
  END as strategy_type,
  t.symbol,
  t.side,
  t.amount::numeric as amount,
  t.price::numeric as price,
  t.status,
  t.pnl::numeric as pnl,
  t.fee::numeric as fee,
  t.executed_at,
  EXTRACT(EPOCH FROM (NOW() - t.executed_at)) / 60 as minutes_ago
FROM trades t
LEFT JOIN users u ON t.user_id = u.id
LEFT JOIN trading_bots tb ON t.bot_id = tb.id
WHERE t.executed_at IS NOT NULL

UNION ALL

SELECT 
  'PAPER' as trade_type,
  pt.id as trade_id,
  u.email as user_email,
  tb.name as bot_name,
  CASE 
    WHEN tb.strategy IS NULL THEN NULL
    WHEN tb.strategy::text = '' THEN NULL
    ELSE (tb.strategy::jsonb->>'type')
  END as strategy_type,
  pt.symbol,
  pt.side,
  pt.quantity::numeric as amount,
  COALESCE(pt.exit_price, pt.entry_price)::numeric as price,
  pt.status,
  pt.pnl::numeric as pnl,
  pt.fees::numeric as fee,
  pt.executed_at,
  EXTRACT(EPOCH FROM (NOW() - pt.executed_at)) / 60 as minutes_ago
FROM paper_trading_trades pt
LEFT JOIN users u ON pt.user_id = u.id
LEFT JOIN trading_bots tb ON pt.bot_id = tb.id
WHERE pt.executed_at IS NOT NULL

ORDER BY executed_at DESC
LIMIT 50;

-- =====================================================
-- Option 6: Failed/Pending trades
-- Shows trades that didn't execute successfully
-- =====================================================
SELECT 
  'REAL' as trade_type,
  t.id as trade_id,
  u.email as user_email,
  tb.name as bot_name,
  t.symbol,
  t.side,
  t.amount::numeric as amount,
  t.price::numeric as price,
  t.status,
  NULL as error_message,
  t.created_at,
  t.executed_at
FROM trades t
LEFT JOIN users u ON t.user_id = u.id
LEFT JOIN trading_bots tb ON t.bot_id = tb.id
WHERE t.status IN ('pending', 'failed', 'cancelled')

UNION ALL

SELECT 
  'PAPER' as trade_type,
  pt.id as trade_id,
  u.email as user_email,
  tb.name as bot_name,
  pt.symbol,
  pt.side,
  pt.quantity::numeric as amount,
  COALESCE(pt.exit_price, pt.entry_price)::numeric as price,
  pt.status,
  NULL as error_message,
  pt.created_at,
  pt.executed_at
FROM paper_trading_trades pt
LEFT JOIN users u ON pt.user_id = u.id
LEFT JOIN trading_bots tb ON pt.bot_id = tb.id
WHERE pt.status IN ('pending', 'failed', 'cancelled')

ORDER BY created_at DESC
LIMIT 50;

-- =====================================================
-- Success message
-- =====================================================
SELECT 'Latest user trades query completed. Check results above.' as status;

