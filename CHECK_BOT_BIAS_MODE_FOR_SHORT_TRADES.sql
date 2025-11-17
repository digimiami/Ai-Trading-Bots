-- Check why bots are only trading long, not short for SOLUSDT and DOGEUSDT
-- This query checks the bias_mode configuration and recent trade history

-- 1. Check bot configuration for SOLUSDT and DOGEUSDT
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
WHERE tb.symbol IN ('SOLUSDT', 'DOGEUSDT')
  AND tb.status = 'active'
ORDER BY tb.symbol, tb.name;

-- 2. Check recent trades by side (long vs short) for these pairs
SELECT 
  tb.symbol,
  t.side,
  COUNT(*) as trade_count,
  MAX(t.created_at) as latest_trade,
  SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END) as closed_trades,
  SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END) as open_trades
FROM trades t
JOIN trading_bots tb ON tb.id = t.bot_id
WHERE tb.symbol IN ('SOLUSDT', 'DOGEUSDT')
  AND t.created_at >= NOW() - INTERVAL '7 days'
GROUP BY tb.symbol, t.side
ORDER BY tb.symbol, t.side;

-- 3. Check recent signals by side for these pairs
SELECT 
  tb.symbol,
  mts.side,
  mts.status,
  COUNT(*) as signal_count,
  MAX(mts.created_at) as latest_signal
FROM manual_trade_signals mts
JOIN trading_bots tb ON tb.id = mts.bot_id
WHERE tb.symbol IN ('SOLUSDT', 'DOGEUSDT')
  AND mts.created_at >= NOW() - INTERVAL '7 days'
GROUP BY tb.symbol, mts.side, mts.status
ORDER BY tb.symbol, mts.side, mts.status;

-- 4. Check bot activity logs for bias-related messages
SELECT 
  bal.bot_id,
  tb.symbol,
  bal.level,
  bal.message,
  bal.details->>'reason' as reason,
  bal.details->>'bias_mode' as bias_mode,
  bal.created_at
FROM bot_activity_logs bal
JOIN trading_bots tb ON tb.id = bal.bot_id
WHERE tb.symbol IN ('SOLUSDT', 'DOGEUSDT')
  AND (
    bal.message LIKE '%bias%' OR
    bal.message LIKE '%short%' OR
    bal.message LIKE '%HTF%' OR
    bal.message LIKE '%EMA200%' OR
    bal.details->>'reason' LIKE '%bias%' OR
    bal.details->>'reason' LIKE '%short%'
  )
  AND bal.created_at >= NOW() - INTERVAL '7 days'
ORDER BY bal.created_at DESC
LIMIT 50;

-- 5. Summary: Check if bias_mode is preventing short trades
SELECT 
  tb.symbol,
  tb.name,
  tb.strategy_config->>'bias_mode' as bias_mode,
  CASE 
    WHEN tb.strategy_config->>'bias_mode' = 'long-only' THEN '❌ SHORTS BLOCKED - bias_mode is long-only'
    WHEN tb.strategy_config->>'bias_mode' = 'short-only' THEN '❌ LONGS BLOCKED - bias_mode is short-only'
    WHEN tb.strategy_config->>'bias_mode' = 'both' THEN '✅ Both directions allowed'
    WHEN tb.strategy_config->>'bias_mode' = 'auto' THEN '✅ Auto mode (follows HTF trend)'
    WHEN tb.strategy_config->>'bias_mode' IS NULL THEN '⚠️ bias_mode not set (defaults to long-only behavior)'
    ELSE '⚠️ Unknown bias_mode: ' || tb.strategy_config->>'bias_mode'
  END as bias_status,
  COUNT(DISTINCT CASE WHEN t.side = 'long' THEN t.id END) as long_trades,
  COUNT(DISTINCT CASE WHEN t.side = 'short' THEN t.id END) as short_trades
FROM trading_bots tb
LEFT JOIN trades t ON t.bot_id = tb.id AND t.created_at >= NOW() - INTERVAL '7 days'
WHERE tb.symbol IN ('SOLUSDT', 'DOGEUSDT')
  AND tb.status = 'active'
GROUP BY tb.id, tb.symbol, tb.name, tb.strategy_config->>'bias_mode'
ORDER BY tb.symbol, tb.name;

