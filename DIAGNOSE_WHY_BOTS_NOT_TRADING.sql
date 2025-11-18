-- ============================================
-- DIAGNOSE WHY BOTS HAVEN'T MADE A SINGLE TRADE
-- ============================================

-- Step 1: Check bot configurations for trading restrictions
SELECT 
  id,
  name,
  symbol,
  status,
  strategy,
  strategy_config,
  CASE 
    WHEN strategy_config::text LIKE '%"bias_mode"%' THEN 
      COALESCE(
        (strategy_config::jsonb->>'bias_mode'),
        'NULL'
      )
    ELSE 'NULL'
  END as bias_mode,
  CASE 
    WHEN strategy_config::text LIKE '%"require_price_vs_trend"%' THEN 
      COALESCE(
        (strategy_config::jsonb->>'require_price_vs_trend'),
        'NULL'
      )
    ELSE 'NULL'
  END as require_price_vs_trend,
  CASE 
    WHEN strategy_config::text LIKE '%"min_volume_requirement"%' THEN 
      COALESCE(
        (strategy_config::jsonb->>'min_volume_requirement')::text,
        'NULL'
      )
    ELSE 'NULL'
  END as min_volume_requirement,
  CASE 
    WHEN strategy_config::text LIKE '%"adx_min_htf"%' THEN 
      COALESCE(
        (strategy_config::jsonb->>'adx_min_htf')::text,
        'NULL'
      )
    ELSE 'NULL'
  END as adx_min_htf,
  CASE 
    WHEN strategy_config::text LIKE '%"adx_trend_min"%' THEN 
      COALESCE(
        (strategy_config::jsonb->>'adx_trend_min')::text,
        'NULL'
      )
    ELSE 'NULL'
  END as adx_trend_min
FROM trading_bots
WHERE status = 'running'
ORDER BY name;

-- Step 2: Check recent activity logs to see what's blocking trades
SELECT 
  bal.bot_id,
  tb.name as bot_name,
  bal.message,
  bal.timestamp,
  bal.details
FROM bot_activity_logs bal
JOIN trading_bots tb ON tb.id = bal.bot_id
WHERE bal.category = 'strategy'
  AND bal.message LIKE '%Strategy signal%'
  AND bal.timestamp > NOW() - INTERVAL '1 hour'
ORDER BY bal.timestamp DESC
LIMIT 50;

-- Step 3: Check if bots have any trades at all
SELECT 
  tb.id,
  tb.name,
  tb.symbol,
  COUNT(t.id) as total_trades,
  MAX(t.executed_at) as last_trade_time
FROM trading_bots tb
LEFT JOIN trades t ON t.bot_id = tb.id
WHERE tb.status = 'running'
GROUP BY tb.id, tb.name, tb.symbol
ORDER BY total_trades ASC, tb.name;

-- Step 4: Check paper trading trades
SELECT 
  tb.id,
  tb.name,
  tb.symbol,
  COUNT(ptt.id) as total_paper_trades,
  MAX(ptt.executed_at) as last_paper_trade_time
FROM trading_bots tb
LEFT JOIN paper_trading_trades ptt ON ptt.bot_id = tb.id
WHERE tb.status = 'running'
GROUP BY tb.id, tb.name, tb.symbol
ORDER BY total_paper_trades ASC, tb.name;

-- Step 5: Summary of issues
SELECT 
  'Bots with no trades (real or paper)' as issue_type,
  COUNT(*) as count
FROM trading_bots tb
WHERE tb.status = 'running'
  AND NOT EXISTS (
    SELECT 1 FROM trades t WHERE t.bot_id = tb.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM paper_trading_trades ptt WHERE ptt.bot_id = tb.id
  )
UNION ALL
SELECT 
  'Bots with bias_mode = long-only (blocks shorts)' as issue_type,
  COUNT(*) as count
FROM trading_bots
WHERE status = 'running'
  AND strategy_config::text LIKE '%"bias_mode"%'
  AND COALESCE(strategy_config::jsonb->>'bias_mode', '') = 'long-only'
UNION ALL
SELECT 
  'Bots with require_price_vs_trend = above (blocks shorts)' as issue_type,
  COUNT(*) as count
FROM trading_bots
WHERE status = 'running'
  AND strategy_config::text LIKE '%"require_price_vs_trend"%'
  AND COALESCE(strategy_config::jsonb->>'require_price_vs_trend', '') = 'above';
