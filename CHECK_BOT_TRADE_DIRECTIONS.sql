-- Check if bots are trading both long and short directions
-- This query analyzes actual trades to see trade direction distribution

-- 1. Check Real Trades (from trades table)
SELECT 
  'REAL TRADES' as trade_type,
  bot_id,
  (SELECT name FROM trading_bots WHERE id = bot_id) as bot_name,
  symbol,
  COUNT(*) as total_trades,
  COUNT(CASE WHEN side = 'long' OR side = 'buy' THEN 1 END) as long_trades,
  COUNT(CASE WHEN side = 'short' OR side = 'sell' THEN 1 END) as short_trades,
  ROUND(COUNT(CASE WHEN side = 'long' OR side = 'buy' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as long_percentage,
  ROUND(COUNT(CASE WHEN side = 'short' OR side = 'sell' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as short_percentage,
  CASE 
    WHEN COUNT(CASE WHEN side = 'long' OR side = 'buy' THEN 1 END) > 0 
     AND COUNT(CASE WHEN side = 'short' OR side = 'sell' THEN 1 END) > 0 
    THEN '✅ BOTH'
    WHEN COUNT(CASE WHEN side = 'long' OR side = 'buy' THEN 1 END) > 0 
    THEN '⚠️ LONG ONLY'
    WHEN COUNT(CASE WHEN side = 'short' OR side = 'sell' THEN 1 END) > 0 
    THEN '⚠️ SHORT ONLY'
    ELSE '❌ NO TRADES'
  END as direction_status
FROM trades
WHERE status IN ('filled', 'closed', 'completed', 'open')
GROUP BY bot_id, symbol
HAVING COUNT(*) > 0
ORDER BY total_trades DESC;

-- 2. Check Paper Trades (from paper_trading_trades table)
SELECT 
  'PAPER TRADES' as trade_type,
  bot_id,
  (SELECT name FROM trading_bots WHERE id = bot_id) as bot_name,
  symbol,
  COUNT(*) as total_trades,
  COUNT(CASE WHEN side = 'long' OR side = 'buy' THEN 1 END) as long_trades,
  COUNT(CASE WHEN side = 'short' OR side = 'sell' THEN 1 END) as short_trades,
  ROUND(COUNT(CASE WHEN side = 'long' OR side = 'buy' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as long_percentage,
  ROUND(COUNT(CASE WHEN side = 'short' OR side = 'sell' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as short_percentage,
  CASE 
    WHEN COUNT(CASE WHEN side = 'long' OR side = 'buy' THEN 1 END) > 0 
     AND COUNT(CASE WHEN side = 'short' OR side = 'sell' THEN 1 END) > 0 
    THEN '✅ BOTH'
    WHEN COUNT(CASE WHEN side = 'long' OR side = 'buy' THEN 1 END) > 0 
    THEN '⚠️ LONG ONLY'
    WHEN COUNT(CASE WHEN side = 'short' OR side = 'sell' THEN 1 END) > 0 
    THEN '⚠️ SHORT ONLY'
    ELSE '❌ NO TRADES'
  END as direction_status
FROM paper_trading_trades
WHERE status IN ('filled', 'closed', 'completed', 'open')
GROUP BY bot_id, symbol
HAVING COUNT(*) > 0
ORDER BY total_trades DESC;

-- 3. Combined Summary (Real + Paper)
SELECT 
  COALESCE(r.bot_id, p.bot_id) as bot_id,
  COALESCE(r.bot_name, p.bot_name) as bot_name,
  COALESCE(r.symbol, p.symbol) as symbol,
  COALESCE(r.total_trades, 0) + COALESCE(p.total_trades, 0) as total_trades,
  COALESCE(r.long_trades, 0) + COALESCE(p.long_trades, 0) as total_long,
  COALESCE(r.short_trades, 0) + COALESCE(p.short_trades, 0) as total_short,
  CASE 
    WHEN (COALESCE(r.long_trades, 0) + COALESCE(p.long_trades, 0)) > 0 
     AND (COALESCE(r.short_trades, 0) + COALESCE(p.short_trades, 0)) > 0 
    THEN '✅ BOTH DIRECTIONS'
    WHEN (COALESCE(r.long_trades, 0) + COALESCE(p.long_trades, 0)) > 0 
    THEN '⚠️ LONG ONLY'
    WHEN (COALESCE(r.short_trades, 0) + COALESCE(p.short_trades, 0)) > 0 
    THEN '⚠️ SHORT ONLY'
    ELSE '❌ NO TRADES'
  END as direction_status
FROM (
  SELECT 
    bot_id,
    (SELECT name FROM trading_bots WHERE id = bot_id) as bot_name,
    symbol,
    COUNT(*) as total_trades,
    COUNT(CASE WHEN side = 'long' OR side = 'buy' THEN 1 END) as long_trades,
    COUNT(CASE WHEN side = 'short' OR side = 'sell' THEN 1 END) as short_trades
  FROM trades
  WHERE status IN ('filled', 'closed', 'completed', 'open')
  GROUP BY bot_id, symbol
) r
FULL OUTER JOIN (
  SELECT 
    bot_id,
    (SELECT name FROM trading_bots WHERE id = bot_id) as bot_name,
    symbol,
    COUNT(*) as total_trades,
    COUNT(CASE WHEN side = 'long' OR side = 'buy' THEN 1 END) as long_trades,
    COUNT(CASE WHEN side = 'short' OR side = 'sell' THEN 1 END) as short_trades
  FROM paper_trading_trades
  WHERE status IN ('filled', 'closed', 'completed', 'open')
  GROUP BY bot_id, symbol
) p ON r.bot_id = p.bot_id AND r.symbol = p.symbol
WHERE COALESCE(r.total_trades, 0) + COALESCE(p.total_trades, 0) > 0
ORDER BY total_trades DESC;

-- 4. Check Bot Configurations (bias_mode settings)
SELECT 
  id,
  name,
  symbol,
  CASE 
    WHEN strategy IS NULL OR strategy::text = '' THEN 'N/A'
    WHEN strategy::text LIKE '%trendline%' OR strategy::text LIKE '%breakout%' THEN 'Trendline Breakout'
    WHEN strategy::text LIKE '%hybrid%' OR strategy::text LIKE '%mean%reversion%' OR strategy::text LIKE '%mean_reversion%' THEN 'Hybrid Trend + Mean Reversion'
    WHEN strategy::text LIKE '%scalping%' AND (strategy::text LIKE '%advanced%' OR strategy::text LIKE '%dual%mode%') THEN 'Advanced Scalping'
    WHEN strategy::text LIKE '%scalping%' THEN 'Scalping'
    WHEN strategy::text LIKE '%trend%following%' OR strategy::text LIKE '%trend_following%' THEN 'Trend Following'
    ELSE 'Other'
  END as strategy_type,
  strategy_config->>'bias_mode' as bias_mode,
  strategy_config->>'trade_direction' as trade_direction,
  status,
  CASE 
    WHEN strategy_config->>'bias_mode' = 'long-only' THEN '⚠️ LONG ONLY (Config)'
    WHEN strategy_config->>'bias_mode' = 'short-only' THEN '⚠️ SHORT ONLY (Config)'
    WHEN strategy_config->>'bias_mode' IN ('both', 'auto') OR strategy_config->>'bias_mode' IS NULL THEN '✅ BOTH ALLOWED (Config)'
    WHEN strategy_config->>'trade_direction' = 'Long Only' THEN '⚠️ LONG ONLY (Config)'
    WHEN strategy_config->>'trade_direction' = 'Short Only' THEN '⚠️ SHORT ONLY (Config)'
    WHEN strategy_config->>'trade_direction' = 'Both' OR strategy_config->>'trade_direction' IS NULL THEN '✅ BOTH ALLOWED (Config)'
    ELSE '❓ UNKNOWN'
  END as config_status
FROM trading_bots
WHERE status = 'running'
ORDER BY name;

-- 5. Recent Trade Signals (from bot_activity_logs)
SELECT 
  bot_id,
  (SELECT name FROM trading_bots WHERE id = bot_id) as bot_name,
  COUNT(*) as total_signals,
  COUNT(CASE WHEN message ILIKE '%buy%' OR message ILIKE '%long%' OR (details->>'side')::text ILIKE '%buy%' OR (details->>'side')::text ILIKE '%long%' THEN 1 END) as long_signals,
  COUNT(CASE WHEN message ILIKE '%sell%' OR message ILIKE '%short%' OR (details->>'side')::text ILIKE '%sell%' OR (details->>'side')::text ILIKE '%short%' THEN 1 END) as short_signals,
  CASE 
    WHEN COUNT(CASE WHEN message ILIKE '%buy%' OR message ILIKE '%long%' OR (details->>'side')::text ILIKE '%buy%' OR (details->>'side')::text ILIKE '%long%' THEN 1 END) > 0 
     AND COUNT(CASE WHEN message ILIKE '%sell%' OR message ILIKE '%short%' OR (details->>'side')::text ILIKE '%sell%' OR (details->>'side')::text ILIKE '%short%' THEN 1 END) > 0 
    THEN '✅ BOTH'
    WHEN COUNT(CASE WHEN message ILIKE '%buy%' OR message ILIKE '%long%' OR (details->>'side')::text ILIKE '%buy%' OR (details->>'side')::text ILIKE '%long%' THEN 1 END) > 0 
    THEN '⚠️ LONG ONLY'
    WHEN COUNT(CASE WHEN message ILIKE '%sell%' OR message ILIKE '%short%' OR (details->>'side')::text ILIKE '%sell%' OR (details->>'side')::text ILIKE '%short%' THEN 1 END) > 0 
    THEN '⚠️ SHORT ONLY'
    ELSE '❌ NO SIGNALS'
  END as signal_status
FROM bot_activity_logs
WHERE category = 'trade'
  AND level IN ('success', 'info')
  AND timestamp >= NOW() - INTERVAL '7 days'
GROUP BY bot_id
HAVING COUNT(*) > 0
ORDER BY total_signals DESC;

