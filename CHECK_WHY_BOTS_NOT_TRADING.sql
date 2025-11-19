-- =============================================
-- COMPREHENSIVE BOT TRADING DIAGNOSTIC SCRIPT
-- Checks all reasons why bots might not be trading
-- =============================================

-- 1. CHECK BOT STATUS AND BASIC CONFIGURATION
SELECT 
  '=== BOT STATUS & CONFIGURATION ===' as section;

SELECT 
  id,
  name,
  symbol,
  exchange,
  timeframe,
  status,
  trading_type,
  leverage,
  trade_amount,
  paper_trading,
  CASE 
    WHEN status != 'running' THEN '❌ NOT RUNNING'
    WHEN symbol IS NULL OR symbol = '' THEN '❌ NO SYMBOL'
    WHEN exchange IS NULL OR exchange = '' THEN '❌ NO EXCHANGE'
    WHEN timeframe IS NULL OR timeframe = '' THEN '❌ NO TIMEFRAME'
    ELSE '✅ CONFIG OK'
  END as config_status,
  created_at,
  updated_at
FROM trading_bots
WHERE status = 'running'
ORDER BY name;

-- 2. CHECK STRATEGY CONFIGURATION
SELECT 
  '=== STRATEGY CONFIGURATION ===' as section;

SELECT 
  id,
  name,
  symbol,
  (strategy::jsonb)->>'type' as strategy_type,
  strategy_config->>'bias_mode' as bias_mode,
  strategy_config->>'adx_min' as adx_min,
  strategy_config->>'adx_min_htf' as adx_min_htf,
  strategy_config->>'adx_trend_min' as adx_trend_min,
  strategy_config->>'adx_meanrev_max' as adx_meanrev_max,
  strategy_config->>'min_volume_requirement' as min_volume_requirement,
  strategy_config->>'volume_multiplier' as volume_multiplier,
  strategy_config->>'rsi_oversold' as rsi_oversold,
  strategy_config->>'rsi_overbought' as rsi_overbought,
  strategy_config->>'momentum_threshold' as momentum_threshold,
  strategy_config->>'vwap_distance' as vwap_distance,
  strategy_config->>'require_price_vs_trend' as require_price_vs_trend,
  CASE 
    WHEN strategy_config IS NULL THEN '❌ NULL CONFIG'
    WHEN strategy_config = '{}'::jsonb THEN '❌ EMPTY CONFIG'
    ELSE '✅ HAS CONFIG'
  END as config_status
FROM trading_bots
WHERE status = 'running'
ORDER BY name;

-- 3. CHECK RECENT ACTIVITY LOGS FOR ERROR MESSAGES
SELECT 
  '=== RECENT ACTIVITY LOGS (LAST 24H) ===' as section;

SELECT 
  bal.bot_id,
  tb.name as bot_name,
  tb.symbol,
  bal.level,
  bal.message,
  bal.category,
  bal.created_at,
  CASE 
    WHEN bal.level = 'error' THEN '❌ ERROR'
    WHEN bal.level = 'warning' THEN '⚠️ WARNING'
    WHEN bal.message LIKE '%Strategy conditions not met%' THEN '⏸️ NO SIGNALS'
    WHEN bal.message LIKE '%Volume not confirmed%' THEN '⏸️ VOLUME ISSUE'
    WHEN bal.message LIKE '%HTF price%not above%' THEN '⏸️ HTF TREND ISSUE'
    WHEN bal.message LIKE '%ADX%too low%' THEN '⏸️ ADX TOO LOW'
    WHEN bal.message LIKE '%API key%invalid%' THEN '❌ API KEY ISSUE'
    WHEN bal.message LIKE '%Failed to fetch price%' THEN '❌ PRICE FETCH FAILED'
    WHEN bal.message LIKE '%No trading signals%' THEN '⏸️ NO SIGNALS'
    ELSE 'ℹ️ INFO'
  END as issue_type
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.created_at > NOW() - INTERVAL '24 hours'
  AND tb.status = 'running'
  AND (
    bal.level IN ('error', 'warning') 
    OR bal.message LIKE '%Strategy conditions not met%'
    OR bal.message LIKE '%No trading signals%'
    OR bal.message LIKE '%Volume not confirmed%'
    OR bal.message LIKE '%HTF%'
    OR bal.message LIKE '%ADX%'
    OR bal.message LIKE '%API key%'
    OR bal.message LIKE '%Failed to fetch%'
  )
ORDER BY bal.created_at DESC
LIMIT 50;

-- 4. CHECK API KEYS STATUS
SELECT 
  '=== API KEYS STATUS ===' as section;

SELECT 
  tb.id as bot_id,
  tb.name,
  tb.exchange,
  tb.symbol,
  CASE 
    WHEN ak.id IS NULL THEN '❌ NO API KEY'
    WHEN ak.is_active = false THEN '❌ API KEY INACTIVE'
    ELSE '✅ API KEY OK'
  END as api_key_status,
  ak.is_active,
  ak.created_at as key_created_at
FROM trading_bots tb
LEFT JOIN api_keys ak ON tb.user_id = ak.user_id 
  AND ak.exchange = tb.exchange
  AND ak.is_active = true
WHERE tb.status = 'running'
ORDER BY tb.name;

-- 5. CHECK RECENT EXECUTION TIMES
SELECT 
  '=== RECENT EXECUTION TIMES ===' as section;

SELECT 
  bot_id,
  tb.name as bot_name,
  tb.symbol,
  MAX(created_at) as last_execution,
  COUNT(*) FILTER (WHERE level = 'error') as error_count_24h,
  COUNT(*) FILTER (WHERE level = 'warning') as warning_count_24h,
  COUNT(*) FILTER (WHERE level = 'success') as success_count_24h,
  COUNT(*) FILTER (WHERE message LIKE '%Strategy conditions not met%') as no_signals_count_24h,
  EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) / 60 as minutes_since_last_execution
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.created_at > NOW() - INTERVAL '24 hours'
  AND tb.status = 'running'
GROUP BY bot_id, tb.name, tb.symbol
ORDER BY last_execution DESC;

-- 6. CHECK FOR BOTS WITH NO RECENT ACTIVITY
SELECT 
  '=== BOTS WITH NO RECENT ACTIVITY (LAST 1 HOUR) ===' as section;

SELECT 
  tb.id,
  tb.name,
  tb.symbol,
  tb.timeframe,
  tb.status,
  COALESCE(MAX(bal.created_at), tb.created_at) as last_activity,
  EXTRACT(EPOCH FROM (NOW() - COALESCE(MAX(bal.created_at), tb.created_at))) / 60 as minutes_since_activity,
  CASE 
    WHEN MAX(bal.created_at) IS NULL THEN '❌ NEVER EXECUTED'
    WHEN MAX(bal.created_at) < NOW() - INTERVAL '1 hour' THEN '⚠️ NO ACTIVITY > 1H'
    ELSE '✅ RECENT ACTIVITY'
  END as activity_status
FROM trading_bots tb
LEFT JOIN bot_activity_logs bal ON tb.id = bal.bot_id
  AND bal.created_at > NOW() - INTERVAL '7 days'
WHERE tb.status = 'running'
GROUP BY tb.id, tb.name, tb.symbol, tb.timeframe, tb.status, tb.created_at
HAVING MAX(bal.created_at) IS NULL 
   OR MAX(bal.created_at) < NOW() - INTERVAL '1 hour'
ORDER BY last_activity DESC NULLS LAST;

-- 7. CHECK STRATEGY-SPECIFIC ISSUES
SELECT 
  '=== STRATEGY-SPECIFIC DIAGNOSTICS ===' as section;

SELECT 
  tb.id,
  tb.name,
  tb.symbol,
  (tb.strategy::jsonb)->>'type' as strategy_type,
  CASE 
    WHEN (tb.strategy::jsonb)->>'type' = 'hybrid_trend_meanreversion' THEN
      CASE 
        WHEN tb.strategy_config->>'bias_mode' = 'long-only' THEN '⚠️ LONG-ONLY (may miss short opportunities)'
        WHEN tb.strategy_config->>'bias_mode' IS NULL THEN '⚠️ NO BIAS MODE SET'
        ELSE '✅ BIAS MODE OK'
      END
    WHEN (tb.strategy::jsonb)->>'type' = 'scalping' THEN
      CASE 
        WHEN (tb.strategy_config->>'min_volume_requirement')::numeric > 0.8 THEN '⚠️ HIGH VOLUME REQUIREMENT'
        WHEN (tb.strategy_config->>'adx_min')::numeric > 20 THEN '⚠️ HIGH ADX REQUIREMENT'
        ELSE '✅ SCALPING CONFIG OK'
      END
    WHEN (tb.strategy::jsonb)->>'type' = 'trendline_breakout' THEN
      CASE 
        WHEN (tb.strategy_config->>'volume_multiplier')::numeric > 1.5 THEN '⚠️ HIGH VOLUME MULTIPLIER'
        ELSE '✅ BREAKOUT CONFIG OK'
      END
    ELSE 'ℹ️ OTHER STRATEGY'
  END as strategy_issue,
  tb.strategy_config
FROM trading_bots tb
WHERE tb.status = 'running'
ORDER BY tb.name;

-- 8. SUMMARY OF ISSUES
SELECT 
  '=== SUMMARY OF ISSUES ===' as section;

SELECT 
  'Total Running Bots' as metric,
  COUNT(*)::text as value
FROM trading_bots
WHERE status = 'running'

UNION ALL

SELECT 
  'Bots with NULL strategy_config' as metric,
  COUNT(*)::text as value
FROM trading_bots
WHERE status = 'running' 
  AND (strategy_config IS NULL OR strategy_config = '{}'::jsonb)

UNION ALL

SELECT 
  'Bots with no API key' as metric,
  COUNT(DISTINCT tb.id)::text as value
FROM trading_bots tb
LEFT JOIN api_keys ak ON tb.user_id = ak.user_id 
  AND ak.exchange = tb.exchange
  AND ak.is_active = true
WHERE tb.status = 'running'
  AND ak.id IS NULL

UNION ALL

SELECT 
  'Bots with errors in last 24h' as metric,
  COUNT(DISTINCT bot_id)::text as value
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.created_at > NOW() - INTERVAL '24 hours'
  AND tb.status = 'running'
  AND bal.level = 'error'

UNION ALL

SELECT 
  'Bots with "no signals" in last 24h' as metric,
  COUNT(DISTINCT bot_id)::text as value
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.created_at > NOW() - INTERVAL '24 hours'
  AND tb.status = 'running'
  AND bal.message LIKE '%No trading signals%'

UNION ALL

SELECT 
  'Bots with "conditions not met" in last 24h' as metric,
  COUNT(DISTINCT bot_id)::text as value
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.created_at > NOW() - INTERVAL '24 hours'
  AND tb.status = 'running'
  AND bal.message LIKE '%Strategy conditions not met%'

UNION ALL

SELECT 
  'Bots with no activity in last hour' as metric,
  COUNT(*)::text as value
FROM trading_bots tb
LEFT JOIN bot_activity_logs bal ON tb.id = bal.bot_id
  AND bal.created_at > NOW() - INTERVAL '1 hour'
WHERE tb.status = 'running'
  AND bal.id IS NULL;

