-- ============================================
-- DIAGNOSE WHY BOTS ARE NOT TRADING
-- Check all possible reasons why bots aren't executing trades
-- ============================================

-- 1. Check bot status and configuration
SELECT 
  '=== BOT STATUS CHECK ===' as section,
  b.id,
  b.name,
  b.status,
  b.paper_trading,
  b.exchange,
  b.symbol,
  b.timeframe,
  b.trade_amount,
  b.leverage,
  b.stop_loss,
  b.take_profit,
  CASE 
    WHEN b.status != 'running' THEN '❌ BOT NOT RUNNING'
    WHEN b.paper_trading = true THEN '📝 PAPER MODE (OK)'
    WHEN b.paper_trading = false THEN '💵 REAL MODE (OK)'
    ELSE '❓ UNKNOWN'
  END as bot_status
FROM trading_bots b
WHERE b.status = 'running'
ORDER BY b.created_at DESC;

-- 2. Check recent bot activity logs for strategy evaluation results
SELECT 
  '=== RECENT STRATEGY EVALUATION LOGS ===' as section,
  bal.bot_id,
  b.name as bot_name,
  bal.level,
  bal.category,
  bal.message,
  bal.timestamp,
  EXTRACT(EPOCH FROM (NOW() - bal.timestamp)) / 60 as minutes_ago,
  bal.details->>'reason' as reason,
  bal.details->>'shouldTrade' as should_trade,
  bal.details->>'confidence' as confidence
FROM bot_activity_logs bal
JOIN trading_bots b ON bal.bot_id = b.id
WHERE bal.category IN ('strategy', 'system', 'market')
  AND bal.timestamp > NOW() - INTERVAL '2 hours'
  AND (
    bal.message LIKE '%Strategy conditions%' OR
    bal.message LIKE '%Cooldown%' OR
    bal.message LIKE '%trading hours%' OR
    bal.message LIKE '%Trading blocked%' OR
    bal.message LIKE '%Market data%' OR
    bal.message LIKE '%execution started%'
  )
ORDER BY bal.timestamp DESC
LIMIT 50;

-- 3. Check for cooldown issues
SELECT 
  '=== COOLDOWN CHECK ===' as section,
  b.id,
  b.name,
  b.symbol,
  MAX(t.created_at) as last_trade_time,
  EXTRACT(EPOCH FROM (NOW() - MAX(t.created_at))) / 3600 as hours_since_last_trade,
  b.strategy_config->>'cooldown_bars' as cooldown_bars_config,
  CASE 
    WHEN MAX(t.created_at) IS NULL THEN '✅ NO PREVIOUS TRADES (OK)'
    WHEN EXTRACT(EPOCH FROM (NOW() - MAX(t.created_at))) / 3600 < 1 THEN '⚠️ TRADED < 1 HOUR AGO (May be in cooldown)'
    ELSE '✅ LAST TRADE > 1 HOUR AGO (OK)'
  END as cooldown_status
FROM trading_bots b
LEFT JOIN trades t ON t.bot_id = b.id
WHERE b.status = 'running'
  AND b.paper_trading = false
GROUP BY b.id, b.name, b.symbol, b.strategy_config
ORDER BY hours_since_last_trade DESC NULLS LAST;

-- 4. Check for paper trading cooldown
SELECT 
  '=== PAPER TRADING COOLDOWN CHECK ===' as section,
  b.id,
  b.name,
  b.symbol,
  MAX(pt.created_at) as last_paper_trade_time,
  EXTRACT(EPOCH FROM (NOW() - MAX(pt.created_at))) / 3600 as hours_since_last_trade,
  b.strategy_config->>'cooldown_bars' as cooldown_bars_config,
  CASE 
    WHEN MAX(pt.created_at) IS NULL THEN '✅ NO PREVIOUS TRADES (OK)'
    WHEN EXTRACT(EPOCH FROM (NOW() - MAX(pt.created_at))) / 3600 < 1 THEN '⚠️ TRADED < 1 HOUR AGO (May be in cooldown)'
    ELSE '✅ LAST TRADE > 1 HOUR AGO (OK)'
  END as cooldown_status
FROM trading_bots b
LEFT JOIN paper_trading_trades pt ON pt.bot_id = b.id
WHERE b.status = 'running'
  AND b.paper_trading = true
GROUP BY b.id, b.name, b.symbol, b.strategy_config
ORDER BY hours_since_last_trade DESC NULLS LAST;

-- 5. Check trading hours configuration
SELECT 
  '=== TRADING HOURS CHECK ===' as section,
  b.id,
  b.name,
  b.symbol,
  b.strategy_config->>'allowed_hours_utc' as allowed_hours,
  b.strategy_config->>'session_filter_enabled' as session_filter_enabled,
  EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC') as current_hour_utc,
  CASE 
    WHEN b.strategy_config->>'session_filter_enabled' = 'true' THEN '⚠️ SESSION FILTER ENABLED'
    WHEN b.strategy_config->>'allowed_hours_utc' IS NOT NULL THEN '✅ CUSTOM HOURS CONFIGURED'
    ELSE '✅ NO RESTRICTIONS (24/7)'
  END as trading_hours_status
FROM trading_bots b
WHERE b.status = 'running'
ORDER BY b.name;

-- 6. Check safety limits that might block trading
SELECT 
  '=== SAFETY LIMITS CHECK ===' as section,
  b.id,
  b.name,
  b.symbol,
  COUNT(*) FILTER (WHERE t.status = 'filled' AND t.created_at::date = CURRENT_DATE) as trades_today,
  COUNT(*) FILTER (WHERE t.status = 'filled' AND t.created_at > NOW() - INTERVAL '7 days') as trades_this_week,
  SUM(CASE WHEN t.status = 'filled' THEN (t.amount * t.price) ELSE 0 END) FILTER (WHERE t.created_at::date = CURRENT_DATE) as volume_today,
  b.strategy_config->>'max_trades_per_day' as max_trades_per_day,
  b.strategy_config->>'daily_loss_limit_pct' as daily_loss_limit,
  b.strategy_config->>'weekly_loss_limit_pct' as weekly_loss_limit,
  CASE 
    WHEN b.strategy_config->>'max_trades_per_day' IS NOT NULL 
      AND COUNT(*) FILTER (WHERE t.status = 'filled' AND t.created_at::date = CURRENT_DATE) >= 
          CAST(b.strategy_config->>'max_trades_per_day' AS INTEGER) THEN '⚠️ MAX TRADES PER DAY REACHED'
    ELSE '✅ WITHIN LIMITS'
  END as safety_status
FROM trading_bots b
LEFT JOIN trades t ON t.bot_id = b.id
WHERE b.status = 'running'
  AND b.paper_trading = false
GROUP BY b.id, b.name, b.symbol, b.strategy_config
ORDER BY trades_today DESC;

-- 7. Check for errors in recent bot execution
SELECT 
  '=== RECENT EXECUTION ERRORS ===' as section,
  bal.bot_id,
  b.name as bot_name,
  bal.level,
  bal.message,
  bal.timestamp,
  EXTRACT(EPOCH FROM (NOW() - bal.timestamp)) / 60 as minutes_ago,
  bal.details->>'error' as error_details
FROM bot_activity_logs bal
JOIN trading_bots b ON bal.bot_id = b.id
WHERE bal.level = 'error'
  AND bal.timestamp > NOW() - INTERVAL '2 hours'
ORDER BY bal.timestamp DESC
LIMIT 30;

-- 8. Check if strategy evaluation is happening (look for market data logs)
SELECT 
  '=== MARKET DATA FETCHING CHECK ===' as section,
  bal.bot_id,
  b.name as bot_name,
  bal.message,
  bal.timestamp,
  EXTRACT(EPOCH FROM (NOW() - bal.timestamp)) / 60 as minutes_ago,
  bal.details->>'price' as price,
  bal.details->>'rsi' as rsi,
  bal.details->>'adx' as adx
FROM bot_activity_logs bal
JOIN trading_bots b ON bal.bot_id = b.id
WHERE bal.category = 'market'
  AND bal.message LIKE '%Market data%'
  AND bal.timestamp > NOW() - INTERVAL '2 hours'
ORDER BY bal.timestamp DESC
LIMIT 30;

-- 9. Check for missing strategy evaluation logs
SELECT 
  '=== MISSING STRATEGY EVALUATION LOGS ===' as section,
  b.id,
  b.name,
  b.symbol,
  MAX(bal_market.timestamp) as last_market_data_log,
  MAX(bal_strategy.timestamp) as last_strategy_log,
  CASE 
    WHEN MAX(bal_market.timestamp) IS NOT NULL AND MAX(bal_strategy.timestamp) IS NULL THEN '❌ MARKET DATA FETCHED BUT NO STRATEGY EVALUATION'
    WHEN MAX(bal_market.timestamp) IS NULL THEN '❌ NO MARKET DATA LOGS'
    WHEN MAX(bal_strategy.timestamp) IS NOT NULL THEN '✅ STRATEGY EVALUATION HAPPENING'
    ELSE '❓ UNKNOWN'
  END as evaluation_status
FROM trading_bots b
LEFT JOIN bot_activity_logs bal_market ON bal_market.bot_id = b.id 
  AND bal_market.category = 'market'
  AND bal_market.timestamp > NOW() - INTERVAL '2 hours'
LEFT JOIN bot_activity_logs bal_strategy ON bal_strategy.bot_id = b.id 
  AND bal_strategy.category = 'strategy'
  AND bal_strategy.timestamp > NOW() - INTERVAL '2 hours'
WHERE b.status = 'running'
GROUP BY b.id, b.name, b.symbol
HAVING MAX(bal_market.timestamp) IS NOT NULL
ORDER BY last_market_data_log DESC;

-- 10. Summary: Why bots might not be trading
SELECT 
  '=== SUMMARY: WHY BOTS NOT TRADING ===' as section,
  b.id,
  b.name,
  b.status,
  b.paper_trading,
  CASE 
    WHEN b.status != 'running' THEN '❌ Bot not running'
    WHEN NOT EXISTS (SELECT 1 FROM bot_activity_logs WHERE bot_id = b.id AND timestamp > NOW() - INTERVAL '2 hours') THEN '❌ No recent activity logs'
    WHEN EXISTS (
      SELECT 1 FROM bot_activity_logs 
      WHERE bot_id = b.id 
        AND category = 'strategy' 
        AND message LIKE '%conditions not met%'
        AND timestamp > NOW() - INTERVAL '2 hours'
    ) THEN '⏸️ Strategy conditions not met'
    WHEN EXISTS (
      SELECT 1 FROM bot_activity_logs 
      WHERE bot_id = b.id 
        AND message LIKE '%Cooldown active%'
        AND timestamp > NOW() - INTERVAL '2 hours'
    ) THEN '⏸️ Cooldown active'
    WHEN EXISTS (
      SELECT 1 FROM bot_activity_logs 
      WHERE bot_id = b.id 
        AND message LIKE '%Outside trading hours%'
        AND timestamp > NOW() - INTERVAL '2 hours'
    ) THEN '⏸️ Outside trading hours'
    WHEN EXISTS (
      SELECT 1 FROM bot_activity_logs 
      WHERE bot_id = b.id 
        AND message LIKE '%Trading blocked%'
        AND timestamp > NOW() - INTERVAL '2 hours'
    ) THEN '🚫 Trading blocked by safety limits'
    WHEN EXISTS (
      SELECT 1 FROM bot_activity_logs 
      WHERE bot_id = b.id 
        AND category = 'market'
        AND timestamp > NOW() - INTERVAL '2 hours'
    ) AND NOT EXISTS (
      SELECT 1 FROM bot_activity_logs 
      WHERE bot_id = b.id 
        AND category = 'strategy'
        AND timestamp > NOW() - INTERVAL '2 hours'
    ) THEN '⚠️ Market data fetched but no strategy evaluation'
    ELSE '✅ Bot appears to be running normally'
  END as likely_reason
FROM trading_bots b
WHERE b.status = 'running'
ORDER BY b.name;

