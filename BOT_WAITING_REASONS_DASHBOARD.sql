-- Bot Waiting Reasons Dashboard
-- Shows WHY each bot is not trading right now

-- ============================================================
-- PART 1: Current Market Conditions for Each Bot
-- ============================================================

WITH latest_activity AS (
  SELECT DISTINCT ON (bot_id)
    bot_id,
    message,
    details,
    created_at
  FROM bot_activity_logs
  WHERE category IN ('strategy', 'market')
    AND level = 'info'
    AND created_at > NOW() - INTERVAL '30 minutes'
  ORDER BY bot_id, created_at DESC
),
bot_status AS (
  SELECT 
    tb.id as bot_id,
    tb.name as bot_name,
    tb.symbol,
    tb.strategy,
    tb.status,
    tb.paper_trading,
    tb.trading_type,
    
    -- Extract strategy config
    (tb.strategy_config->>'rsi_oversold')::numeric as rsi_buy_threshold,
    (tb.strategy_config->>'rsi_overbought')::numeric as rsi_sell_threshold,
    (tb.strategy_config->>'adx_threshold')::numeric as adx_threshold,
    (tb.strategy_config->>'min_confidence')::numeric as ml_confidence_threshold,
    (tb.strategy_config->>'cooldown_bars')::int as cooldown_bars,
    (tb.strategy_config->>'htf_adx_check')::boolean as htf_check_enabled,
    
    -- Extract current market data from latest activity
    (la.details->>'rsi')::numeric as current_rsi,
    (la.details->>'adx')::numeric as current_adx,
    (la.details->>'price')::numeric as current_price,
    (la.details->>'ml_prediction')::text as ml_prediction,
    (la.details->>'ml_confidence')::numeric as ml_confidence,
    
    la.message as last_message,
    la.created_at as last_check_time,
    
    -- Get last trade time
    COALESCE(
      (SELECT MAX(created_at) FROM paper_trading_trades WHERE bot_id = tb.id),
      (SELECT MAX(created_at) FROM trades WHERE bot_id = tb.id),
      tb.created_at
    ) as last_trade_time
    
  FROM trading_bots tb
  LEFT JOIN latest_activity la ON la.bot_id = tb.id
  WHERE tb.status = 'running'
    AND tb.paper_trading = true
)
SELECT 
  bot_name,
  symbol,
  strategy,
  
  -- Current Market Conditions
  ROUND(current_rsi, 2) as current_rsi,
  ROUND(current_adx, 2) as current_adx,
  ROUND(current_price, 4) as price,
  ml_prediction,
  ROUND(ml_confidence * 100, 1) || '%' as ml_confidence_pct,
  
  -- Configured Thresholds
  rsi_buy_threshold || '/' || rsi_sell_threshold as rsi_thresholds,
  adx_threshold as adx_min,
  ROUND(ml_confidence_threshold * 100, 1) || '%' as ml_min_pct,
  cooldown_bars,
  
  -- Why NOT Trading (Decision Analysis)
  CASE 
    -- Check RSI conditions
    WHEN current_rsi IS NULL THEN '⚠️ No market data yet'
    WHEN current_rsi BETWEEN COALESCE(rsi_buy_threshold, 30) AND COALESCE(rsi_sell_threshold, 70) 
      THEN '📊 RSI neutral (' || ROUND(current_rsi, 1) || ' between ' || 
           COALESCE(rsi_buy_threshold, 30) || '-' || COALESCE(rsi_sell_threshold, 70) || ')'
    
    -- Check ADX conditions  
    WHEN current_adx < COALESCE(adx_threshold, 25)
      THEN '📉 Weak trend (ADX=' || ROUND(current_adx, 1) || ', need >' || COALESCE(adx_threshold, 25) || ')'
    
    -- Check ML confidence
    WHEN ml_confidence < COALESCE(ml_confidence_threshold, 0.6)
      THEN '🤖 Low ML confidence (' || ROUND(ml_confidence * 100, 1) || '%, need >' || 
           ROUND(COALESCE(ml_confidence_threshold, 0.6) * 100, 1) || '%)'
    
    -- Check cooldown
    WHEN (EXTRACT(EPOCH FROM (NOW() - last_trade_time)) / 300) < COALESCE(cooldown_bars, 8)
      THEN '⏸️ Cooldown active (' || 
           ROUND((EXTRACT(EPOCH FROM (NOW() - last_trade_time)) / 300)::numeric, 1) || '/' || 
           COALESCE(cooldown_bars, 8) || ' bars)'
    
    -- All conditions met but no signal
    ELSE '✅ Conditions met, waiting for signal'
  END as waiting_reason,
  
  -- Time since last check
  CASE 
    WHEN last_check_time IS NULL THEN 'Never checked'
    WHEN last_check_time < NOW() - INTERVAL '5 minutes' THEN '🔴 ' || 
      EXTRACT(EPOCH FROM (NOW() - last_check_time))::int / 60 || ' min ago (stale!)'
    ELSE '✅ ' || EXTRACT(EPOCH FROM (NOW() - last_check_time))::int || 's ago'
  END as last_check,
  
  -- Time since last trade
  CASE 
    WHEN last_trade_time < NOW() - INTERVAL '1 day' THEN 
      EXTRACT(EPOCH FROM (NOW() - last_trade_time))::int / 86400 || ' days ago'
    WHEN last_trade_time < NOW() - INTERVAL '1 hour' THEN 
      EXTRACT(EPOCH FROM (NOW() - last_trade_time))::int / 3600 || ' hours ago'
    ELSE 
      EXTRACT(EPOCH FROM (NOW() - last_trade_time))::int / 60 || ' min ago'
  END as last_trade,
  
  -- Action Recommendations
  CASE 
    WHEN current_rsi BETWEEN COALESCE(rsi_buy_threshold, 30) AND COALESCE(rsi_sell_threshold, 70)
      THEN '💡 Lower RSI thresholds to 45/55'
    WHEN current_adx < COALESCE(adx_threshold, 25)
      THEN '💡 Lower ADX threshold to ' || ROUND(current_adx + 2, 0)
    WHEN ml_confidence < COALESCE(ml_confidence_threshold, 0.6)
      THEN '💡 Lower ML confidence to 40%'
    WHEN (EXTRACT(EPOCH FROM (NOW() - last_trade_time)) / 300) < COALESCE(cooldown_bars, 8)
      THEN '💡 Reduce cooldown to 2-3 bars'
    ELSE '✅ Bot is ready to trade'
  END as recommendation

FROM bot_status
WHERE paper_trading = true
ORDER BY 
  CASE 
    WHEN current_rsi IS NULL THEN 0
    WHEN last_check_time < NOW() - INTERVAL '10 minutes' THEN 1
    ELSE 2
  END,
  bot_name;


-- ============================================================
-- PART 2: Summary Statistics
-- ============================================================

WITH bot_analysis AS (
  SELECT 
    tb.id,
    tb.name,
    tb.paper_trading,
    (tb.strategy_config->>'rsi_oversold')::numeric as rsi_buy,
    (tb.strategy_config->>'adx_threshold')::numeric as adx_min,
    (SELECT COUNT(*) FROM paper_trading_trades ptt WHERE ptt.bot_id = tb.id AND ptt.created_at > NOW() - INTERVAL '24 hours') as trades_24h,
    (SELECT COUNT(*) FROM paper_trading_trades ptt WHERE ptt.bot_id = tb.id AND ptt.created_at > NOW() - INTERVAL '7 days') as trades_7d
  FROM trading_bots tb
  WHERE tb.status = 'running'
    AND tb.paper_trading = true
)
SELECT 
  '📊 SUMMARY STATISTICS' as title,
  'Total Active Paper Bots' as metric,
  COUNT(*)::text as value
FROM bot_analysis

UNION ALL

SELECT 
  '',
  'Bots that Traded (24h)',
  COUNT(CASE WHEN trades_24h > 0 THEN 1 END)::text || ' / ' || COUNT(*)::text
FROM bot_analysis

UNION ALL

SELECT 
  '',
  'Bots that Traded (7d)',
  COUNT(CASE WHEN trades_7d > 0 THEN 1 END)::text || ' / ' || COUNT(*)::text
FROM bot_analysis

UNION ALL

SELECT 
  '',
  'Average RSI Buy Threshold',
  COALESCE(ROUND(AVG(rsi_buy), 1)::text, 'N/A')
FROM bot_analysis
WHERE rsi_buy IS NOT NULL

UNION ALL

SELECT 
  '',
  'Average ADX Threshold',
  COALESCE(ROUND(AVG(adx_min), 1)::text, 'N/A')
FROM bot_analysis
WHERE adx_min IS NOT NULL

UNION ALL

SELECT 
  '',
  'Bots with Aggressive Settings',
  COUNT(CASE WHEN rsi_buy > 40 AND adx_min < 15 THEN 1 END)::text || ' / ' || COUNT(*)::text
FROM bot_analysis
WHERE rsi_buy IS NOT NULL AND adx_min IS NOT NULL;


-- ============================================================
-- PART 3: Bots by Waiting Reason
-- ============================================================

WITH latest_activity AS (
  SELECT DISTINCT ON (bot_id)
    bot_id,
    details,
    created_at
  FROM bot_activity_logs
  WHERE category IN ('strategy', 'market')
    AND level = 'info'
    AND created_at > NOW() - INTERVAL '30 minutes'
  ORDER BY bot_id, created_at DESC
),
categorized_bots AS (
  SELECT 
    tb.name,
    tb.symbol,
    (tb.strategy_config->>'rsi_oversold')::numeric as rsi_buy,
    (tb.strategy_config->>'rsi_overbought')::numeric as rsi_sell,
    (tb.strategy_config->>'adx_threshold')::numeric as adx_min,
    (la.details->>'rsi')::numeric as current_rsi,
    (la.details->>'adx')::numeric as current_adx,
    
    CASE 
      WHEN la.details IS NULL THEN 'No Data'
      WHEN (la.details->>'rsi')::numeric BETWEEN COALESCE((tb.strategy_config->>'rsi_oversold')::numeric, 30) 
           AND COALESCE((tb.strategy_config->>'rsi_overbought')::numeric, 70)
        THEN 'RSI Neutral'
      WHEN (la.details->>'adx')::numeric < COALESCE((tb.strategy_config->>'adx_threshold')::numeric, 25)
        THEN 'Weak Trend (ADX)'
      ELSE 'Other'
    END as reason
    
  FROM trading_bots tb
  LEFT JOIN latest_activity la ON la.bot_id = tb.id
  WHERE tb.status = 'running'
    AND tb.paper_trading = true
)
SELECT 
  '📋 BOTS GROUPED BY REASON' as title,
  reason,
  COUNT(*)::text as count,
  STRING_AGG(name || ' (' || symbol || ')', ', ' ORDER BY name) as bots
FROM (
  SELECT 'Header' as reason, '' as name, '' as symbol
  UNION ALL
  SELECT reason, name, symbol FROM categorized_bots
) sub
GROUP BY reason
ORDER BY 
  CASE WHEN reason = 'Header' THEN 0 ELSE 1 END,
  COUNT(*) DESC;


-- ============================================================
-- PART 4: Quick Fix Recommendations
-- ============================================================

SELECT '💡 QUICK FIX RECOMMENDATIONS' as recommendation
UNION ALL
SELECT ''
UNION ALL
SELECT 'To make ALL bots more aggressive:'
UNION ALL
SELECT 'Run: CREATE_AGGRESSIVE_BOT_CONFIGS.sql (Option 1)'
UNION ALL
SELECT ''
UNION ALL
SELECT 'To make SPECIFIC bot aggressive:'
UNION ALL
SELECT 'Edit bot → Strategy Config → Adjust sliders'
UNION ALL
SELECT ''
UNION ALL
SELECT 'Recommended changes:'
UNION ALL
SELECT '  • RSI Oversold: 30 → 45'
UNION ALL
SELECT '  • RSI Overbought: 70 → 55'
UNION ALL
SELECT '  • ADX Threshold: 25 → 12'
UNION ALL
SELECT '  • Cooldown Bars: 8 → 2'
UNION ALL
SELECT '  • HTF ADX Check: ON → OFF';

