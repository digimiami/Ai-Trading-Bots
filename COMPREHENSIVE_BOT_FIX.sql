-- ============================================================
-- COMPREHENSIVE FIX: Fix all bot issues (Timeout, Stuck, Bitunix)
-- ============================================================
-- This script fixes:
-- 1. Bots with TIMEOUT_ERRORS
-- 2. Bots that are STUCK (next_execution_at is NULL or old)
-- 3. Bots with BITUNIX_API_ERROR
-- ============================================================

-- 1. Fix STUCK bots first (these need immediate attention)
UPDATE public.trading_bots tb
SET 
  next_execution_at = NOW() + INTERVAL '5 minutes',
  last_execution_at = COALESCE(tb.last_execution_at, NOW()),
  updated_at = NOW()
WHERE tb.status = 'running'
  AND tb.name IN (
    'Scalping Strategy - Fast EMA Cloud - SOLUSDT',
    'TRUSTUSDT'
  )
  AND (
    tb.next_execution_at IS NULL 
    OR tb.next_execution_at < NOW() - INTERVAL '1 hour'
  )
RETURNING 
  id as bot_id,
  name as bot_name,
  next_execution_at,
  'Fixed: STUCK status' as action_taken;

-- 2. Fix TIMEOUT_ERRORS bots with longer cooldown
UPDATE public.trading_bots tb
SET 
  next_execution_at = NOW() + INTERVAL '20 minutes', -- Longer cooldown for timeout bots
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
  'Fixed: TIMEOUT_ERRORS (20 min cooldown)' as action_taken;

-- 3. Check Bitunix API key status in detail
SELECT 
  'BITUNIX API KEY STATUS' as category,
  tb.id as bot_id,
  tb.name as bot_name,
  tb.user_id,
  u.email as user_email,
  ak.id as api_key_id,
  ak.is_active,
  ak.created_at as api_key_created_at,
  CASE 
    WHEN ak.id IS NULL THEN '❌ MISSING API KEY'
    WHEN ak.is_active = false THEN '⚠️ API KEY INACTIVE'
    ELSE '✅ API KEY EXISTS AND ACTIVE'
  END as api_key_status
FROM public.trading_bots tb
LEFT JOIN public.users u ON tb.user_id = u.id
LEFT JOIN public.api_keys ak ON tb.user_id = ak.user_id 
  AND ak.exchange = 'bitunix'
  AND (ak.is_testnet = false OR ak.is_testnet IS NULL)
WHERE tb.exchange = 'bitunix'
  AND tb.name = 'ETHUSDT'
  AND tb.status = 'running';

-- 4. Fix Bitunix bot based on API key status
-- If API key exists and is active, reset execution
UPDATE public.trading_bots tb
SET 
  next_execution_at = NOW() + INTERVAL '15 minutes',
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
  'Fixed: Reset with 15 min cooldown (API key valid)' as action_taken;

-- 5. If no valid API key, pause the bot
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
  status,
  'Paused: No valid API key found' as action_taken;

-- 6. Final verification: Show updated health status
SELECT 
  'UPDATED HEALTH STATUS' as category,
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
    WHEN 'STUCK' THEN 2
    WHEN 'TIMEOUT_ERRORS' THEN 3
    WHEN 'BITUNIX_API_ERROR' THEN 4
    ELSE 5
  END;

-- 7. Show next execution times for all affected bots
SELECT 
  'NEXT EXECUTION SCHEDULE' as category,
  tb.name as bot_name,
  tb.status,
  tb.next_execution_at,
  tb.last_execution_at,
  CASE 
    WHEN tb.next_execution_at IS NULL THEN 'Not scheduled'
    WHEN tb.next_execution_at < NOW() THEN 'Overdue'
    ELSE TO_CHAR(tb.next_execution_at, 'HH24:MI:SS') || ' (' || 
         ROUND(EXTRACT(EPOCH FROM (tb.next_execution_at - NOW())) / 60) || ' min)'
  END as next_execution_info
FROM public.trading_bots tb
WHERE tb.name IN (
  'Scalping Strategy - Fast EMA Cloud - SOLUSDT',
  'Trend Following Strategy-Find Trading Pairs - ASTERUSDT',
  'TRUSTUSDT',
  'ETHUSDT'
)
ORDER BY tb.next_execution_at NULLS LAST;

