-- Diagnose why DOGEUSDT bot is not opening short trades
-- Run this to see what's happening with DOGEUSDT trading

-- 1. Check DOGEUSDT bot configuration
SELECT 
  tb.id,
  tb.name,
  tb.symbol,
  tb.status,
  tb.exchange,
  tb.trading_type,
  tb.strategy_config->>'bias_mode' as bias_mode,
  tb.strategy_config->>'htf_timeframe' as htf_timeframe,
  tb.strategy_config->>'htf_trend_indicator' as htf_trend_indicator,
  tb.strategy_config->>'require_price_vs_trend' as require_price_vs_trend,
  tb.strategy_config->>'adx_min_htf' as adx_min_htf,
  tb.strategy_config->>'regime_mode' as regime_mode,
  tb.strategy_config->>'rsi_oversold' as rsi_oversold,
  tb.strategy_config->>'rsi_overbought' as rsi_overbought,
  tb.strategy_config as full_strategy_config
FROM trading_bots tb
WHERE tb.symbol = 'DOGEUSDT'
  AND tb.status = 'active'
ORDER BY tb.name;

-- 2. Check recent trades by side for DOGEUSDT
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
WHERE tb.symbol = 'DOGEUSDT'
  AND t.created_at >= NOW() - INTERVAL '7 days'
ORDER BY t.created_at DESC
LIMIT 50;

-- 3. Check recent signals by side for DOGEUSDT
SELECT 
  mts.id,
  mts.bot_id,
  tb.name as bot_name,
  mts.side,
  mts.status,
  mts.mode,
  mts.error,
  mts.reason,
  mts.created_at,
  mts.processed_at
FROM manual_trade_signals mts
JOIN trading_bots tb ON tb.id = mts.bot_id
WHERE tb.symbol = 'DOGEUSDT'
  AND mts.created_at >= NOW() - INTERVAL '7 days'
ORDER BY mts.created_at DESC
LIMIT 50;

-- 4. Check bot activity logs for DOGEUSDT - look for short trade attempts or blocks
SELECT 
  bal.id,
  bal.bot_id,
  bal.level,
  bal.category,
  bal.message,
  bal.details->>'side' as side,
  bal.details->>'reason' as reason,
  bal.details->>'bias_mode' as bias_mode,
  bal.details->>'shouldTrade' as should_trade,
  bal.created_at
FROM bot_activity_logs bal
JOIN trading_bots tb ON tb.id = bal.bot_id
WHERE tb.symbol = 'DOGEUSDT'
  AND (
    bal.message LIKE '%short%' OR
    bal.message LIKE '%SHORT%' OR
    bal.message LIKE '%sell%' OR
    bal.message LIKE '%bias%' OR
    bal.message LIKE '%HTF%' OR
    bal.message LIKE '%EMA200%' OR
    bal.message LIKE '%downtrend%' OR
    bal.details->>'side' = 'sell' OR
    bal.details->>'side' = 'short' OR
    bal.details->>'reason' LIKE '%short%' OR
    bal.details->>'reason' LIKE '%bias%'
  )
  AND bal.created_at >= NOW() - INTERVAL '7 days'
ORDER BY bal.created_at DESC
LIMIT 100;

-- 5. Summary: Count trades by side for DOGEUSDT
SELECT 
  tb.symbol,
  tb.name as bot_name,
  t.side,
  COUNT(*) as trade_count,
  COUNT(CASE WHEN t.status = 'open' THEN 1 END) as open_trades,
  COUNT(CASE WHEN t.status = 'closed' THEN 1 END) as closed_trades,
  MAX(t.created_at) as latest_trade
FROM trades t
JOIN trading_bots tb ON tb.id = t.bot_id
WHERE tb.symbol = 'DOGEUSDT'
  AND t.created_at >= NOW() - INTERVAL '7 days'
GROUP BY tb.symbol, tb.name, t.side
ORDER BY tb.name, t.side;

-- 6. Check strategy evaluation results for DOGEUSDT
SELECT 
  bal.id,
  bal.bot_id,
  bal.message,
  bal.details->>'side' as side,
  bal.details->>'shouldTrade' as should_trade,
  bal.details->>'reason' as reason,
  bal.details->>'confidence' as confidence,
  bal.created_at
FROM bot_activity_logs bal
JOIN trading_bots tb ON tb.id = bal.bot_id
WHERE tb.symbol = 'DOGEUSDT'
  AND (
    bal.message LIKE '%Strategy signal%' OR
    bal.message LIKE '%Strategy evaluation%' OR
    bal.category = 'strategy'
  )
  AND bal.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY bal.created_at DESC
LIMIT 50;

-- 7. Check if bias_mode is blocking shorts
SELECT 
  tb.id,
  tb.name,
  tb.symbol,
  tb.strategy_config->>'bias_mode' as bias_mode,
  CASE 
    WHEN tb.strategy_config->>'bias_mode' = 'long-only' THEN '❌ SHORTS BLOCKED - bias_mode is long-only'
    WHEN tb.strategy_config->>'bias_mode' = 'short-only' THEN '❌ LONGS BLOCKED - bias_mode is short-only'
    WHEN tb.strategy_config->>'bias_mode' = 'both' THEN '✅ Both directions allowed'
    WHEN tb.strategy_config->>'bias_mode' = 'auto' THEN '✅ Auto mode (follows HTF trend)'
    WHEN tb.strategy_config->>'bias_mode' IS NULL THEN '⚠️ bias_mode not set (may default to long-only behavior)'
    ELSE '⚠️ Unknown bias_mode: ' || tb.strategy_config->>'bias_mode'
  END as bias_status,
  COUNT(DISTINCT CASE WHEN t.side = 'long' THEN t.id END) as long_trades,
  COUNT(DISTINCT CASE WHEN t.side = 'short' THEN t.id END) as short_trades
FROM trading_bots tb
LEFT JOIN trades t ON t.bot_id = tb.id AND t.created_at >= NOW() - INTERVAL '7 days'
WHERE tb.symbol = 'DOGEUSDT'
  AND tb.status = 'active'
GROUP BY tb.id, tb.name, tb.symbol, tb.strategy_config->>'bias_mode'
ORDER BY tb.name;

