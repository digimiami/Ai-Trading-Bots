-- Check Paper Trading Status
-- This will show you what's happening with paper trades

-- PART 1: Check if ANY paper trades exist
SELECT 
  COUNT(*) as total_paper_trades,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as trades_last_hour,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '10 minutes' THEN 1 END) as trades_last_10min,
  MAX(created_at) as last_trade_time
FROM paper_trading_trades;

-- PART 2: Recent paper trades (last 30 minutes)
SELECT 
  ptt.created_at,
  tb.name as bot_name,
  ptt.symbol,
  ptt.side,
  ptt.entry_price,
  ptt.quantity,
  ptt.status,
  ptt.pnl,
  ptt.exit_price,
  ptt.closed_at
FROM paper_trading_trades ptt
LEFT JOIN trading_bots tb ON ptt.bot_id = tb.id
WHERE ptt.created_at > NOW() - INTERVAL '30 minutes'
ORDER BY ptt.created_at DESC
LIMIT 50;

-- PART 3: Check bot activity logs for trade attempts (last 10 minutes)
SELECT 
  bal.created_at,
  tb.name as bot_name,
  bal.category,
  bal.level,
  bal.message
FROM bot_activity_logs bal
LEFT JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.created_at > NOW() - INTERVAL '10 minutes'
  AND (
    bal.message LIKE '%Paper trade%'
    OR bal.message LIKE '%executePaperTrade%'
    OR bal.message LIKE '%BUY%'
    OR bal.message LIKE '%SELL%'
    OR bal.message LIKE '%shouldTrade%'
    OR bal.message LIKE '%Strategy conditions%'
  )
ORDER BY bal.created_at DESC
LIMIT 100;

-- PART 4: Check which bots are configured correctly
SELECT 
  tb.id,
  tb.name,
  tb.symbol,
  tb.paper_trading,
  tb.status,
  (tb.strategy::jsonb->>'rsiThreshold') as old_rsi_threshold,
  tb.strategy_config->>'rsi_oversold' as new_rsi_oversold,
  tb.strategy_config->>'immediate_execution' as immediate_execution,
  tb.strategy_config->>'super_aggressive' as super_aggressive,
  (SELECT COUNT(*) FROM paper_trading_trades WHERE bot_id = tb.id AND created_at > NOW() - INTERVAL '24 hours') as trades_24h
FROM trading_bots tb
WHERE tb.paper_trading = true
  AND tb.status = 'running'
ORDER BY tb.name;

-- PART 5: Check for errors in bot execution (last 10 minutes)
SELECT 
  bal.created_at,
  tb.name as bot_name,
  bal.level,
  bal.category,
  bal.message
FROM bot_activity_logs bal
LEFT JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.created_at > NOW() - INTERVAL '10 minutes'
  AND bal.level = 'error'
ORDER BY bal.created_at DESC
LIMIT 50;

