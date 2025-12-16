-- ============================================
-- FIX BOT COOLDOWN ISSUES
-- ============================================
-- Problem: Bots are stuck in cooldown because cooldown_bars is null (defaults to 8)
-- Solution: Explicitly set cooldown_bars to 0 (disabled) or 2 (reduced) in strategy_config
-- ============================================

-- STEP 1: Fix Cooldown for All Affected Bots
-- Set cooldown_bars to 0 (disabled) for paper trading bots, 2 for real trading bots
UPDATE trading_bots
SET strategy_config = 
  CASE 
    -- If strategy_config is NULL, create new object
    WHEN strategy_config IS NULL THEN 
      jsonb_build_object('cooldown_bars', CASE WHEN paper_trading = true THEN 0 ELSE 2 END)
    -- If strategy_config exists, merge with cooldown_bars
    ELSE 
      strategy_config || jsonb_build_object('cooldown_bars', CASE WHEN paper_trading = true THEN 0 ELSE 2 END)
  END,
  updated_at = NOW()
WHERE status = 'running'
  AND (
    -- Fix specific bots mentioned in diagnostics
    name IN (
      'AI Bot - BTCUSDT (SELL) (Copy)',
      'AI Bot - DOTUSDT (BUY)',
      'AI Bot - FLOKIUSDT (BUY)',
      'AI Bot - REZUSDT (BUY)',
      'MYXUSDT',
      'PIPPINUSD (Copy)',
      'SWARMSUSDT',
      'TNSRUSDT SMART CREATE (Copy)',
      'XRPUSDT Optimized'
    )
    -- OR fix any bot with null cooldown_bars or high cooldown
    OR strategy_config IS NULL
    OR NOT (strategy_config ? 'cooldown_bars')
    OR (strategy_config->>'cooldown_bars')::numeric > 2
  );

-- STEP 2: More Aggressive Fix - Disable Cooldown for Paper Trading Bots
-- Paper trading bots don't need cooldown since they're just simulations
UPDATE trading_bots
SET strategy_config = 
  CASE 
    WHEN strategy_config IS NULL THEN 
      jsonb_build_object('cooldown_bars', 0)
    ELSE 
      strategy_config || jsonb_build_object('cooldown_bars', 0)
  END,
  updated_at = NOW()
WHERE status = 'running'
  AND paper_trading = true
  AND (
    strategy_config IS NULL
    OR NOT (strategy_config ? 'cooldown_bars')
    OR (strategy_config->>'cooldown_bars')::numeric > 0
  );

-- STEP 3: Verify the Fix
SELECT 
  '=== COOLDOWN FIX VERIFICATION ===' as section,
  id,
  name,
  symbol,
  paper_trading,
  strategy_config->>'cooldown_bars' as cooldown_bars,
  CASE 
    WHEN strategy_config->>'cooldown_bars' = '0' AND paper_trading = true THEN '✅ Cooldown disabled (paper)'
    WHEN (strategy_config->>'cooldown_bars')::numeric <= 2 THEN '✅ Cooldown reduced'
    WHEN strategy_config->>'cooldown_bars' IS NULL THEN '❌ Still null (needs manual fix)'
    ELSE '⚠️ Cooldown still high'
  END as cooldown_status,
  updated_at
FROM trading_bots
WHERE status = 'running'
  AND name IN (
    'AI Bot - BTCUSDT (SELL) (Copy)',
    'AI Bot - DOTUSDT (BUY)',
    'AI Bot - FLOKIUSDT (BUY)',
    'AI Bot - REZUSDT (BUY)',
    'MYXUSDT',
    'PIPPINUSD (Copy)',
    'SWARMSUSDT',
    'TNSRUSDT SMART CREATE (Copy)',
    'XRPUSDT Optimized'
  )
ORDER BY name;

-- STEP 4: Summary
SELECT 
  '=== FIX SUMMARY ===' as section,
  COUNT(*) FILTER (WHERE strategy_config->>'cooldown_bars' = '0' AND paper_trading = true) as paper_cooldown_disabled,
  COUNT(*) FILTER (WHERE (strategy_config->>'cooldown_bars')::numeric <= 2 AND paper_trading = false) as real_cooldown_reduced,
  COUNT(*) FILTER (WHERE strategy_config->>'cooldown_bars' IS NULL) as still_null
FROM trading_bots
WHERE status = 'running'
  AND name IN (
    'AI Bot - BTCUSDT (SELL) (Copy)',
    'AI Bot - DOTUSDT (BUY)',
    'AI Bot - FLOKIUSDT (BUY)',
    'AI Bot - REZUSDT (BUY)',
    'MYXUSDT',
    'PIPPINUSD (Copy)',
    'SWARMSUSDT',
    'TNSRUSDT SMART CREATE (Copy)',
    'XRPUSDT Optimized'
  );
