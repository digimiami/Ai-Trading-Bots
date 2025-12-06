-- ============================================================
-- FIX SCRIPT: Fix bots with timeout and Bitunix API errors
-- ============================================================
-- This script addresses:
-- 1. Bots with timeout errors (TIMEOUT_ERRORS)
-- 2. Bots with Bitunix API errors (BITUNIX_API_ERROR)
-- ============================================================

-- 1. Find and analyze bots with timeout errors
SELECT 
  'TIMEOUT_ERRORS ANALYSIS' as category,
  tb.id as bot_id,
  tb.name as bot_name,
  tb.exchange,
  tb.symbol,
  tb.status,
  COUNT(*) as timeout_count,
  MAX(bal.timestamp) as last_timeout_at,
  STRING_AGG(DISTINCT SUBSTRING(bal.message, 1, 100), ' | ') as error_samples
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
ORDER BY timeout_count DESC;

-- 2. Find and analyze Bitunix API errors
SELECT 
  'BITUNIX_API_ERROR ANALYSIS' as category,
  tb.id as bot_id,
  tb.name as bot_name,
  tb.symbol,
  tb.status,
  COUNT(*) as error_count,
  MAX(bal.timestamp) as last_error_at,
  STRING_AGG(DISTINCT 
    CASE 
      WHEN bal.message LIKE '%Code: 2%' THEN 'System error (Code: 2)'
      WHEN bal.message LIKE '%Code: 10003%' THEN 'Invalid API key (Code: 10003)'
      WHEN bal.message LIKE '%Invalid price data%' THEN 'Price fetch failed'
      ELSE SUBSTRING(bal.message, 1, 100)
    END, 
    ' | '
  ) as error_types
FROM public.trading_bots tb
INNER JOIN public.bot_activity_logs bal ON tb.id = bal.bot_id
WHERE tb.exchange = 'bitunix'
  AND bal.level = 'error'
  AND bal.timestamp >= NOW() - INTERVAL '24 hours'
  AND tb.status = 'running'
  AND tb.name = 'ETHUSDT'
GROUP BY tb.id, tb.name, tb.symbol, tb.status
ORDER BY error_count DESC;

-- 3. Reset next_execution_at for timeout bots (give them a fresh start)
UPDATE public.trading_bots tb
SET 
  next_execution_at = NOW() + INTERVAL '5 minutes', -- Give 5 min cooldown
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
      AND bal.timestamp >= NOW() - INTERVAL '24 hours'
      AND bal.message LIKE '%timeout%'
  )
RETURNING 
  id as bot_id,
  name as bot_name,
  'Reset next_execution_at (5 min cooldown)' as action_taken;

-- 4. Check API keys for Bitunix bot
SELECT 
  'BITUNIX API KEY CHECK' as category,
  tb.id as bot_id,
  tb.name as bot_name,
  tb.user_id,
  ak.id as api_key_id,
  ak.is_active,
  ak.exchange,
  CASE 
    WHEN ak.id IS NULL THEN 'MISSING API KEY'
    WHEN ak.is_active = false THEN 'API KEY INACTIVE'
    ELSE 'API KEY EXISTS AND ACTIVE'
  END as api_key_status
FROM public.trading_bots tb
LEFT JOIN public.api_keys ak ON tb.user_id = ak.user_id 
  AND ak.exchange = 'bitunix'
  AND (ak.is_testnet = false OR ak.is_testnet IS NULL)
WHERE tb.exchange = 'bitunix'
  AND tb.name = 'ETHUSDT'
  AND tb.status = 'running';

-- 5. Reset Bitunix bot execution (if API key is valid)
UPDATE public.trading_bots tb
SET 
  next_execution_at = NOW() + INTERVAL '2 minutes', -- Give 2 min cooldown
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
  'Reset next_execution_at for Bitunix bot' as action_taken;

-- 6. Summary: Show current health status after fixes
SELECT 
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
ORDER BY bot_count DESC;

