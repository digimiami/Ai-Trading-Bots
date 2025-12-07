-- ============================================================
-- VERIFY AND CLEANUP: Check bot status and remove duplicates
-- ============================================================
-- This script verifies bot fixes and ensures no duplicate issues
-- ============================================================

-- 1. Check for duplicate bot names (shouldn't exist, but verify)
SELECT 
  'DUPLICATE BOT NAMES CHECK' as category,
  name,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as bot_ids,
  STRING_AGG(status, ', ') as statuses
FROM public.trading_bots
WHERE name IN (
  'Scalping Strategy - Fast EMA Cloud - SOLUSDT',
  'Trend Following Strategy-Find Trading Pairs - ASTERUSDT',
  'TRUSTUSDT',
  'ETHUSDT'
)
GROUP BY name
HAVING COUNT(*) > 1;

-- 2. Show all bots with these names (to see if there are duplicates)
SELECT 
  'ALL BOTS WITH THESE NAMES' as category,
  id as bot_id,
  name as bot_name,
  status,
  exchange,
  symbol,
  next_execution_at,
  last_execution_at,
  created_at
FROM public.trading_bots
WHERE name IN (
  'Scalping Strategy - Fast EMA Cloud - SOLUSDT',
  'Trend Following Strategy-Find Trading Pairs - ASTERUSDT',
  'TRUSTUSDT',
  'ETHUSDT'
)
ORDER BY name, created_at DESC;

-- 3. Current health status (should show improvement)
SELECT 
  'CURRENT HEALTH STATUS' as category,
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

-- 4. Verify execution schedule (should show proper scheduling)
SELECT 
  'EXECUTION SCHEDULE VERIFICATION' as category,
  tb.name as bot_name,
  tb.status,
  tb.next_execution_at,
  tb.last_execution_at,
  CASE 
    WHEN tb.next_execution_at IS NULL THEN '❌ Not scheduled'
    WHEN tb.next_execution_at < NOW() THEN '⚠️ Overdue'
    WHEN tb.next_execution_at BETWEEN NOW() AND NOW() + INTERVAL '30 minutes' THEN '✅ Scheduled soon'
    ELSE '✅ Scheduled'
  END as schedule_status,
  CASE 
    WHEN tb.next_execution_at IS NOT NULL THEN 
      ROUND(EXTRACT(EPOCH FROM (tb.next_execution_at - NOW())) / 60) || ' minutes'
    ELSE 'N/A'
  END as time_until_execution
FROM public.trading_bots tb
WHERE tb.name IN (
  'Scalping Strategy - Fast EMA Cloud - SOLUSDT',
  'Trend Following Strategy-Find Trading Pairs - ASTERUSDT',
  'TRUSTUSDT',
  'ETHUSDT'
)
AND tb.status = 'running'
ORDER BY tb.next_execution_at NULLS LAST;

-- 5. Recent activity check (last hour)
SELECT 
  'RECENT ACTIVITY (LAST HOUR)' as category,
  tb.name as bot_name,
  bal.level,
  COUNT(*) as log_count,
  MAX(bal.timestamp) as last_log_at,
  STRING_AGG(DISTINCT 
    CASE 
      WHEN bal.message LIKE '%timeout%' THEN 'Timeout'
      WHEN bal.message LIKE '%Code: 2%' THEN 'Bitunix Code 2'
      WHEN bal.message LIKE '%Code: 10003%' THEN 'Bitunix Code 10003'
      WHEN bal.message LIKE '%success%' THEN 'Success'
      ELSE 'Other'
    END, 
    ', '
  ) as activity_types
FROM public.trading_bots tb
LEFT JOIN public.bot_activity_logs bal ON tb.id = bal.bot_id
  AND bal.timestamp >= NOW() - INTERVAL '1 hour'
WHERE tb.name IN (
  'Scalping Strategy - Fast EMA Cloud - SOLUSDT',
  'Trend Following Strategy-Find Trading Pairs - ASTERUSDT',
  'TRUSTUSDT',
  'ETHUSDT'
)
AND tb.status = 'running'
GROUP BY tb.name, bal.level
ORDER BY tb.name, bal.level DESC;

-- 6. Summary: Overall status
SELECT 
  'SUMMARY' as category,
  COUNT(*) as total_bots,
  COUNT(*) FILTER (WHERE next_execution_at IS NOT NULL AND next_execution_at > NOW()) as properly_scheduled,
  COUNT(*) FILTER (WHERE next_execution_at IS NULL OR next_execution_at < NOW() - INTERVAL '1 hour') as stuck_bots,
  COUNT(*) FILTER (WHERE status = 'running') as running_bots,
  COUNT(*) FILTER (WHERE status = 'paused') as paused_bots
FROM public.trading_bots
WHERE name IN (
  'Scalping Strategy - Fast EMA Cloud - SOLUSDT',
  'Trend Following Strategy-Find Trading Pairs - ASTERUSDT',
  'TRUSTUSDT',
  'ETHUSDT'
);

