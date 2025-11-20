-- Comprehensive diagnostic query to find why bots aren't trading after 24+ hours
-- Run this in Supabase SQL Editor

WITH bot_status AS (
  SELECT 
    tb.id,
    tb.name,
    tb.symbol,
    tb.status,
    tb.paper_trading,
    tb.strategy_config,
    tb.created_at,
    -- Check if bot has API key
    CASE 
      WHEN ak.id IS NULL THEN '❌ NO API KEY'
      WHEN ak.is_active = false THEN '❌ API KEY INACTIVE'
      ELSE '✅ API KEY OK'
    END as api_key_status,
    -- Get cooldown_bars setting
    COALESCE((tb.strategy_config->>'cooldown_bars')::int, 8) as cooldown_bars,
    -- Get trading hours setting
    CASE 
      WHEN (tb.strategy_config->>'session_filter_enabled')::boolean = true THEN 'ENABLED'
      ELSE 'DISABLED'
    END as trading_hours_filter,
    -- Get strategy type
    CASE 
      WHEN tb.strategy::text LIKE '%hybrid_trend_meanreversion%' THEN 'hybrid_trend_meanreversion'
      WHEN tb.strategy::text LIKE '%scalping%' THEN 'scalping'
      WHEN tb.strategy::text LIKE '%advanced_scalping%' THEN 'advanced_scalping'
      WHEN tb.strategy::text LIKE '%trendline_breakout%' THEN 'trendline_breakout'
      ELSE 'unknown'
    END as strategy_type
  FROM trading_bots tb
  LEFT JOIN api_keys ak ON ak.user_id = tb.user_id AND ak.exchange = tb.exchange AND ak.is_active = true
  WHERE tb.status = 'running'
),
recent_activity AS (
  SELECT 
    bal.bot_id,
    MAX(bal.created_at) as last_activity,
    COUNT(*) FILTER (WHERE bal.level = 'error') as error_count,
    COUNT(*) FILTER (WHERE bal.message LIKE '%Cooldown%' OR bal.message LIKE '%cooldown%') as cooldown_logs,
    COUNT(*) FILTER (WHERE bal.message LIKE '%Outside trading hours%' OR bal.message LIKE '%trading hours%') as trading_hours_logs,
    COUNT(*) FILTER (WHERE bal.message LIKE '%No trading signals%' OR bal.message LIKE '%Strategy conditions not met%') as no_signals_logs,
    COUNT(*) FILTER (WHERE bal.message LIKE '%Strategy signal%') as strategy_eval_logs,
    COUNT(*) FILTER (WHERE bal.category = 'trade' AND bal.message LIKE '%EXECUTING%') as trade_executions,
    -- Get most recent error message
    (SELECT bal2.message 
     FROM bot_activity_logs bal2 
     WHERE bal2.bot_id = bal.bot_id 
       AND bal2.level = 'error' 
     ORDER BY bal2.created_at DESC 
     LIMIT 1) as last_error_message,
    -- Get most recent cooldown message
    (SELECT bal2.message 
     FROM bot_activity_logs bal2 
     WHERE bal2.bot_id = bal.bot_id 
       AND (bal2.message LIKE '%Cooldown%' OR bal2.message LIKE '%cooldown%')
     ORDER BY bal2.created_at DESC 
     LIMIT 1) as last_cooldown_message,
    -- Get most recent strategy evaluation
    (SELECT bal2.message 
     FROM bot_activity_logs bal2 
     WHERE bal2.bot_id = bal.bot_id 
       AND bal2.category = 'strategy'
     ORDER BY bal2.created_at DESC 
     LIMIT 1) as last_strategy_message
  FROM bot_activity_logs bal
  WHERE bal.created_at > NOW() - INTERVAL '24 hours'
  GROUP BY bal.bot_id
),
last_trades AS (
  SELECT 
    bot_id,
    MAX(created_at) as last_trade_time,
    COUNT(*) as total_trades_24h
  FROM trades
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY bot_id
),
last_paper_trades AS (
  SELECT 
    bot_id,
    MAX(created_at) as last_trade_time,
    COUNT(*) as total_trades_24h
  FROM paper_trading_trades
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY bot_id
)
SELECT 
  bs.id,
  bs.name,
  bs.symbol,
  bs.status,
  bs.paper_trading,
  bs.api_key_status,
  bs.strategy_type,
  bs.cooldown_bars,
  bs.trading_hours_filter,
  COALESCE(ra.last_activity, bs.created_at) as last_activity,
  EXTRACT(EPOCH FROM (NOW() - COALESCE(ra.last_activity, bs.created_at))) / 3600 as hours_since_last_activity,
  COALESCE(lt.last_trade_time, lpt.last_trade_time) as last_trade_time,
  EXTRACT(EPOCH FROM (NOW() - COALESCE(lt.last_trade_time, lpt.last_trade_time))) / 3600 as hours_since_last_trade,
  COALESCE(lt.total_trades_24h, 0) + COALESCE(lpt.total_trades_24h, 0) as total_trades_24h,
  COALESCE(ra.error_count, 0) as error_count_24h,
  COALESCE(ra.cooldown_logs, 0) as cooldown_logs_24h,
  COALESCE(ra.trading_hours_logs, 0) as trading_hours_logs_24h,
  COALESCE(ra.no_signals_logs, 0) as no_signals_logs_24h,
  COALESCE(ra.strategy_eval_logs, 0) as strategy_eval_logs_24h,
  COALESCE(ra.trade_executions, 0) as trade_executions_24h,
  ra.last_error_message,
  ra.last_cooldown_message,
  ra.last_strategy_message,
  -- Diagnostic flags
  CASE 
    WHEN bs.api_key_status LIKE '❌%' THEN '⚠️ NO API KEY'
    WHEN COALESCE(ra.last_activity, bs.created_at) < NOW() - INTERVAL '2 hours' THEN '⚠️ NO RECENT ACTIVITY'
    WHEN COALESCE(ra.cooldown_logs, 0) > 10 THEN '⚠️ FREQUENT COOLDOWN BLOCKS'
    WHEN COALESCE(ra.trading_hours_logs, 0) > 10 THEN '⚠️ FREQUENT TRADING HOURS BLOCKS'
    WHEN COALESCE(ra.no_signals_logs, 0) > 20 THEN '⚠️ FREQUENT NO SIGNALS'
    WHEN COALESCE(ra.error_count, 0) > 5 THEN '⚠️ MULTIPLE ERRORS'
    WHEN COALESCE(ra.trade_executions, 0) = 0 AND COALESCE(ra.strategy_eval_logs, 0) > 0 THEN '⚠️ STRATEGY EVALUATING BUT NO TRADES'
    ELSE '✅ APPEARS NORMAL'
  END as diagnostic_status
FROM bot_status bs
LEFT JOIN recent_activity ra ON ra.bot_id = bs.id
LEFT JOIN last_trades lt ON lt.bot_id = bs.id
LEFT JOIN last_paper_trades lpt ON lpt.bot_id = bs.id AND bs.paper_trading = true
ORDER BY 
  CASE 
    WHEN bs.api_key_status LIKE '❌%' THEN 1
    WHEN COALESCE(ra.trade_executions, 0) = 0 THEN 2
    ELSE 3
  END,
  hours_since_last_activity DESC;

