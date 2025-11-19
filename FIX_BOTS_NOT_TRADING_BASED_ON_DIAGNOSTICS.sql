-- =============================================
-- FIX BOTS NOT TRADING - Based on Diagnostic Results
-- 7 bots have "conditions not met" - making configs more lenient
-- 1 bot has no API key - will need manual fix
-- 3 bots have errors - will check logs
-- =============================================

-- STEP 1: Fix bots with "conditions not met" by making strategy configs more lenient
-- This applies to all running bots to ensure they can find trading opportunities

-- 1.1: Hybrid Trend + Mean Reversion Strategy bots
-- Make ADX thresholds lower and enable both directions
UPDATE trading_bots
SET strategy_config = jsonb_build_object(
    'bias_mode', 'both',
    'adx_min_htf', 15,
    'adx_trend_min', 15,
    'adx_meanrev_max', 30,
    'require_price_vs_trend', NULL,
    'htf_timeframe', '4h',
    'htf_trend_indicator', 'EMA200',
    'rsi_oversold', 30,
    'rsi_overbought', 70,
    'momentum_threshold', 0.5,
    'vwap_distance', 0.8,
    'cooldown_bars', 2,
    'min_24h_volume_usd', 100000000
  )
WHERE status = 'running'
  AND (strategy::jsonb)->>'type' = 'hybrid_trend_meanreversion'
  AND (
    strategy_config->>'bias_mode' = 'long-only'
    OR (strategy_config->>'adx_min_htf')::numeric > 20
    OR (strategy_config->>'adx_trend_min')::numeric > 20
    OR strategy_config->>'require_price_vs_trend' = 'above'
  );

-- 1.2: Scalping Strategy bots
-- Lower volume and ADX requirements
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || jsonb_build_object(
    'adx_min', 12,
    'min_volume_requirement', 0.3,
    'volume_multiplier', 0.5,
    'min_volatility_atr', 0.1,
    'rsi_oversold', 35,
    'rsi_overbought', 65,
    'ema_fast', 9,
    'ema_slow', 21,
    'atr_period', 14,
    'atr_stop_multiplier', 1.5,
    'atr_tp_multiplier', 2.0,
    'time_filter_enabled', false,
    'cooldown_bars', 1,
    'bias_mode', 'both'
  )::jsonb
WHERE status = 'running'
  AND (strategy::jsonb)->>'type' = 'scalping'
  AND (
    (strategy_config->>'min_volume_requirement')::numeric > 0.5
    OR (strategy_config->>'adx_min')::numeric > 15
    OR strategy_config->>'bias_mode' = 'long-only'
  );

-- 1.3: Advanced Scalping Strategy bots
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || jsonb_build_object(
    'scalping_mode', 'auto',
    'adx_min_continuation', 12,
    'adx_min_reversal', 10,
    'volume_multiplier_continuation', 0.3,
    'volume_multiplier_reversal', 0.4,
    'supertrend_period', 10,
    'supertrend_multiplier', 3.0,
    'ema_fast', 8,
    'ema_slow', 34,
    'rsi_period', 14,
    'rsi_oversold', 35,
    'rsi_overbought', 65,
    'bb_period', 20,
    'bb_std_dev', 2.0,
    'atr_period', 14,
    'atr_stop_multiplier', 1.2,
    'atr_tp1_multiplier', 1.5,
    'atr_tp2_multiplier', 2.5,
    'time_filter_enabled', false,
    'cooldown_bars', 1,
    'bias_mode', 'both'
  )::jsonb
WHERE status = 'running'
  AND (strategy::jsonb)->>'type' = 'advanced_scalping'
  AND (
    (strategy_config->>'adx_min_continuation')::numeric > 15
    OR (strategy_config->>'adx_min_reversal')::numeric > 12
  );

-- 1.4: Trendline Breakout Strategy bots
-- Lower volume multiplier
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb)::jsonb || jsonb_build_object(
    'trendline_length', 30,
    'volume_multiplier', 1.0,
    'bias_mode', 'both',
    'enable_tp', false,
    'enable_trail_sl', false
  )::jsonb
WHERE status = 'running'
  AND (strategy::jsonb)->>'type' = 'trendline_breakout'
  AND (
    (strategy_config->>'volume_multiplier')::numeric > 1.2
    OR strategy_config->>'bias_mode' = 'long-only'
  );

-- 1.5: Trend Following Strategy bots
-- Convert to hybrid strategy with lenient settings
UPDATE trading_bots
SET 
  strategy = jsonb_build_object('type', 'hybrid_trend_meanreversion')::text,
  strategy_config = jsonb_build_object(
    'bias_mode', 'both',
    'adx_min_htf', 15,
    'adx_trend_min', 15,
    'adx_meanrev_max', 30,
    'rsi_oversold', 30,
    'rsi_overbought', 70,
    'momentum_threshold', 0.5,
    'vwap_distance', 0.8,
    'require_price_vs_trend', NULL,
    'htf_timeframe', '4h',
    'htf_trend_indicator', 'EMA200',
    'cooldown_bars', 2,
    'min_24h_volume_usd', 100000000
  )
WHERE status = 'running'
  AND (strategy::jsonb)->>'type' = 'trend_following';

-- STEP 2: Identify the bot with no API key (for manual fix)
SELECT 
  '=== BOT WITH NO API KEY (NEEDS MANUAL FIX) ===' as section;

SELECT 
  tb.id,
  tb.name,
  tb.symbol,
  tb.exchange,
  tb.user_id,
  u.email as user_email,
  '⚠️ This bot needs an API key configured in account settings' as action_required
FROM trading_bots tb
LEFT JOIN api_keys ak ON tb.user_id = ak.user_id 
  AND ak.exchange = tb.exchange
  AND ak.is_active = true
LEFT JOIN auth.users u ON tb.user_id = u.id
WHERE tb.status = 'running'
  AND ak.id IS NULL;

-- STEP 3: Check recent errors to identify specific issues
SELECT 
  '=== RECENT ERRORS (LAST 24H) ===' as section;

SELECT 
  bal.bot_id,
  tb.name as bot_name,
  tb.symbol,
  bal.level,
  bal.message,
  bal.category,
  bal.created_at,
  CASE 
    WHEN bal.message LIKE '%API key%invalid%' THEN '❌ API KEY ISSUE - Check API key validity'
    WHEN bal.message LIKE '%Failed to fetch price%' THEN '❌ PRICE FETCH FAILED - May be temporary API issue'
    WHEN bal.message LIKE '%Invalid price data%' THEN '❌ PRICE DATA ISSUE - Check symbol format'
    WHEN bal.message LIKE '%RLS%' THEN '❌ PERMISSION ISSUE - Check RLS policies'
    ELSE '❌ OTHER ERROR'
  END as error_type
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.created_at > NOW() - INTERVAL '24 hours'
  AND tb.status = 'running'
  AND bal.level = 'error'
ORDER BY bal.created_at DESC
LIMIT 20;

-- STEP 4: Verify the fixes
SELECT 
  '=== VERIFICATION: BOT CONFIGURATIONS AFTER FIX ===' as section;

SELECT 
  id,
  name,
  symbol,
  (strategy::jsonb)->>'type' as strategy_type,
  strategy_config->>'bias_mode' as bias_mode,
  strategy_config->>'adx_min' as adx_min,
  strategy_config->>'adx_min_htf' as adx_min_htf,
  strategy_config->>'adx_trend_min' as adx_trend_min,
  strategy_config->>'min_volume_requirement' as min_volume_requirement,
  strategy_config->>'volume_multiplier' as volume_multiplier,
  strategy_config->>'require_price_vs_trend' as require_price_vs_trend,
  CASE 
    WHEN strategy_config->>'bias_mode' = 'both' THEN '✅'
    WHEN strategy_config->>'bias_mode' = 'long-only' THEN '⚠️ LONG-ONLY'
    ELSE '❌'
  END as bias_status,
  CASE 
    WHEN (strategy_config->>'adx_min_htf')::numeric <= 15 THEN '✅'
    WHEN (strategy_config->>'adx_min_htf')::numeric > 20 THEN '⚠️ TOO HIGH'
    ELSE 'ℹ️'
  END as adx_status
FROM trading_bots
WHERE status = 'running'
ORDER BY name;

-- STEP 5: Summary of fixes applied
SELECT 
  '=== SUMMARY OF FIXES APPLIED ===' as section;

SELECT 
  'Hybrid bots updated' as fix_type,
  COUNT(*)::text as count
FROM trading_bots
WHERE status = 'running'
  AND (strategy::jsonb)->>'type' = 'hybrid_trend_meanreversion'
  AND strategy_config->>'bias_mode' = 'both'
  AND (strategy_config->>'adx_min_htf')::numeric <= 15

UNION ALL

SELECT 
  'Scalping bots updated' as fix_type,
  COUNT(*)::text as count
FROM trading_bots
WHERE status = 'running'
  AND (strategy::jsonb)->>'type' = 'scalping'
  AND (strategy_config->>'adx_min')::numeric <= 15
  AND (strategy_config->>'min_volume_requirement')::numeric <= 0.5

UNION ALL

SELECT 
  'Bots with bias_mode = both' as fix_type,
  COUNT(*)::text as count
FROM trading_bots
WHERE status = 'running'
  AND strategy_config->>'bias_mode' = 'both'

UNION ALL

SELECT 
  'Bots still needing API key' as fix_type,
  COUNT(*)::text as count
FROM trading_bots tb
LEFT JOIN api_keys ak ON tb.user_id = ak.user_id 
  AND ak.exchange = tb.exchange
  AND ak.is_active = true
WHERE tb.status = 'running'
  AND ak.id IS NULL;

