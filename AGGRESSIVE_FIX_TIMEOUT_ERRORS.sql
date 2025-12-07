-- ============================================================
-- AGGRESSIVE FIX: Resolve persistent timeout errors
-- ============================================================
-- This script provides more aggressive fixes for bots with timeout errors
-- ============================================================

-- 1. Analyze timeout patterns in detail
SELECT 
  'TIMEOUT PATTERN ANALYSIS' as category,
  tb.id as bot_id,
  tb.name as bot_name,
  tb.exchange,
  tb.symbol,
  tb.status,
  COUNT(*) as total_timeouts,
  COUNT(*) FILTER (WHERE bal.timestamp >= NOW() - INTERVAL '1 hour') as timeouts_last_hour,
  COUNT(*) FILTER (WHERE bal.timestamp >= NOW() - INTERVAL '6 hours') as timeouts_last_6h,
  MAX(bal.timestamp) as last_timeout_at,
  MIN(bal.timestamp) as first_timeout_at,
  EXTRACT(EPOCH FROM (MAX(bal.timestamp) - MIN(bal.timestamp))) / 3600 as hours_span
FROM public.trading_bots tb
INNER JOIN public.bot_activity_logs bal ON tb.id = bal.bot_id
WHERE bal.level = 'error'
  AND bal.message LIKE '%timeout%'
  AND bal.timestamp >= NOW() - INTERVAL '24 hours'
  AND tb.status = 'running'
  AND tb.name IN (
    'Scalping Strategy - Fast EMA Cloud - SOLUSDT',
    'Trend Following Strategy-Find Trading Pairs - ASTERUSDT',
    'TRUSTUSDT'
  )
GROUP BY tb.id, tb.name, tb.exchange, tb.symbol, tb.status
ORDER BY total_timeouts DESC;

-- 2. Check if bots are stuck in a loop (executing too frequently)
SELECT 
  'EXECUTION FREQUENCY CHECK' as category,
  tb.id as bot_id,
  tb.name as bot_name,
  tb.next_execution_at,
  tb.last_execution_at,
  EXTRACT(EPOCH FROM (NOW() - tb.last_execution_at)) / 60 as minutes_since_last_execution,
  CASE 
    WHEN tb.next_execution_at IS NULL THEN 'No next execution scheduled'
    WHEN tb.next_execution_at < NOW() THEN 'Overdue for execution'
    WHEN (EXTRACT(EPOCH FROM (tb.next_execution_at - NOW())) / 60) < 1 THEN 'Executing too frequently'
    ELSE 'Normal schedule'
  END as execution_status
FROM public.trading_bots tb
WHERE tb.status = 'running'
  AND tb.name IN (
    'Scalping Strategy - Fast EMA Cloud - SOLUSDT',
    'Trend Following Strategy-Find Trading Pairs - ASTERUSDT',
    'TRUSTUSDT'
  );

-- 3. AGGRESSIVE FIX: Reset execution schedule with longer cooldown
UPDATE public.trading_bots tb
SET 
  next_execution_at = NOW() + INTERVAL '15 minutes', -- Longer cooldown to prevent immediate retry
  last_execution_at = NOW(),
  updated_at = NOW()
WHERE tb.status = 'running'
  AND tb.name IN (
    'Scalping Strategy - Fast EMA Cloud - SOLUSDT',
    'Trend Following Strategy-Find Trading Pairs - ASTERUSDT',
    'TRUSTUSDT'
  )
  AND EXISTS (
    SELECT 1 FROM public.bot_activity_logs bal 
    WHERE bal.bot_id = tb.id 
      AND bal.level = 'error' 
      AND bal.timestamp >= NOW() - INTERVAL '6 hours'
      AND bal.message LIKE '%timeout%'
  )
RETURNING 
  id as bot_id,
  name as bot_name,
  next_execution_at,
  'Reset with 15-minute cooldown' as action_taken;

-- 4. Check Bitunix API key and recent errors in detail
SELECT 
  'BITUNIX DETAILED ANALYSIS' as category,
  tb.id as bot_id,
  tb.name as bot_name,
  tb.user_id,
  ak.id as api_key_id,
  ak.is_active,
  ak.created_at as api_key_created_at,
  COUNT(*) as error_count,
  MAX(bal.timestamp) as last_error_at,
  STRING_AGG(DISTINCT 
    CASE 
      WHEN bal.message LIKE '%Code: 2%' THEN 'System error (Code: 2)'
      WHEN bal.message LIKE '%Code: 10003%' THEN 'Invalid API key (Code: 10003)'
      WHEN bal.message LIKE '%Invalid price data%' THEN 'Price fetch failed'
      WHEN bal.message LIKE '%404%' THEN 'Endpoint not found (404)'
      ELSE SUBSTRING(bal.message, 1, 80)
    END, 
    ' | '
  ) as error_types
FROM public.trading_bots tb
LEFT JOIN public.api_keys ak ON tb.user_id = ak.user_id 
  AND ak.exchange = 'bitunix'
  AND (ak.is_testnet = false OR ak.is_testnet IS NULL)
INNER JOIN public.bot_activity_logs bal ON tb.id = bal.bot_id
WHERE tb.exchange = 'bitunix'
  AND bal.level = 'error'
  AND bal.timestamp >= NOW() - INTERVAL '24 hours'
  AND tb.status = 'running'
  AND tb.name = 'ETHUSDT'
GROUP BY tb.id, tb.name, tb.user_id, ak.id, ak.is_active, ak.created_at
ORDER BY error_count DESC;

-- 5. Reset Bitunix bot with longer cooldown if API key exists
UPDATE public.trading_bots tb
SET 
  next_execution_at = NOW() + INTERVAL '10 minutes', -- Longer cooldown for Bitunix
  last_execution_at = NOW(),
  updated_at = NOW()
WHERE tb.exchange = 'bitunix'
  AND tb.name = 'ETHUSDT'
  AND tb.status = 'running'
  AND EXISTS (
    SELECT 1 FROM public.api_keys ak 
    WHERE ak.user_id = tb.user_id 
      AND ak.exchange = 'bitunix'
      AND ak.is_active = true
      AND (ak.is_testnet = false OR ak.is_testnet IS NULL)
  )
RETURNING 
  id as bot_id,
  name as bot_name,
  next_execution_at,
  'Reset with 10-minute cooldown' as action_taken;

-- 6. If no API key found, pause the bot
UPDATE public.trading_bots tb
SET 
  status = 'paused',
  updated_at = NOW()
WHERE tb.exchange = 'bitunix'
  AND tb.name = 'ETHUSDT'
  AND tb.status = 'running'
  AND NOT EXISTS (
    SELECT 1 FROM public.api_keys ak 
    WHERE ak.user_id = tb.user_id 
      AND ak.exchange = 'bitunix'
      AND ak.is_active = true
      AND (ak.is_testnet = false OR ak.is_testnet IS NULL)
  )
RETURNING 
  id as bot_id,
  name as bot_name,
  'Paused: No active API key found' as action_taken;

-- 7. Final health check summary
SELECT 
  'FINAL HEALTH STATUS' as category,
  health_status,
  COUNT(*) as bot_count,
  STRING_AGG(name, ', ' ORDER BY name) as bot_names
FROM bot_health_status
WHERE name IN (
  'Scalping Strategy - Fast EMA Cloud - SOLUSDT',
  'Trend Following Strategy-Find Trading Pairs - ASTERUSDT',
  'TRUSTUSDT',
  'ETHUSDT'
)
GROUP BY health_status
ORDER BY 
  CASE health_status
    WHEN 'HEALTHY' THEN 1
    WHEN 'TIMEOUT_ERRORS' THEN 2
    WHEN 'BITUNIX_API_ERROR' THEN 3
    ELSE 4
  END;

