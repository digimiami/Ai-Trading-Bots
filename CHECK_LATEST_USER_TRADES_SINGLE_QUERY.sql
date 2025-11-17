-- =====================================================
-- CHECK LATEST USER TRADES (REAL & PAPER) - SINGLE QUERY
-- =====================================================
-- This single query shows the latest trades for all users,
-- including both real trades and paper trades.
-- =====================================================

-- Combined view of latest trades (Real + Paper)
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
  t.created_at,
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
  EXTRACT(EPOCH FROM (NOW() - pt.executed_at)) / 60 as minutes_ago
FROM paper_trading_trades pt
LEFT JOIN users u ON pt.user_id = u.id
LEFT JOIN trading_bots tb ON pt.bot_id = tb.id
WHERE pt.executed_at IS NOT NULL

ORDER BY executed_at DESC
LIMIT 50;

