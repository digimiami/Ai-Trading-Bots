-- TEST THE FIX BEFORE APPLYING
-- ===============================================
-- Run this to verify the fix will work without errors
-- This simulates what the fix will do without actually changing anything

-- Test 1: Verify validation function exists
SELECT '=== TEST 1: Validation Function ===' as test;
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_name = 'validate_strategy_config';

-- Expected: Should return one row showing the function exists

-- Test 2: Test the configuration we'll apply
SELECT '=== TEST 2: Test Configuration Validity ===' as test;
SELECT validate_strategy_config('{
  "bias_mode": "both",
  "immediate_execution": true,
  "super_aggressive": true,
  "scalping_mode": true,
  "fast_entry": true,
  "adx_min": 0,
  "adx_min_htf": 15,
  "adx_trend_min": 0,
  "adx_min_continuation": 0,
  "adx_min_reversal": 0,
  "disable_htf_adx_check": true,
  "min_volume_requirement": 0,
  "volume_multiplier": 0,
  "volume_multiplier_continuation": 0,
  "volume_multiplier_reversal": 0,
  "min_volatility_atr": 0,
  "time_filter_enabled": false,
  "cooldown_bars": 0,
  "rsi_oversold": 0,
  "rsi_overbought": 100,
  "momentum_threshold": 0,
  "vwap_distance": 0,
  "require_price_vs_trend": false,
  "max_trades_per_day": 100,
  "max_open_positions": 10
}'::jsonb) as config_is_valid;

-- Expected: Should return TRUE

-- Test 3: Count bots that will be affected
SELECT '=== TEST 3: Bots That Will Be Updated ===' as test;
SELECT 
  COUNT(*) as total_running_bots,
  COUNT(*) FILTER (WHERE paper_trading = true) as paper_bots,
  COUNT(*) FILTER (WHERE paper_trading = false) as real_bots
FROM trading_bots
WHERE status = 'running';

-- Test 4: Preview what will change (first 5 bots)
SELECT '=== TEST 4: Preview Changes (First 5 Bots) ===' as test;
SELECT 
  id,
  name,
  paper_trading,
  strategy_config->>'immediate_execution' as current_immediate_exec,
  strategy_config->>'adx_min' as current_adx_min,
  strategy_config->>'adx_min_htf' as current_adx_min_htf,
  strategy_config->>'cooldown_bars' as current_cooldown,
  -- After fix preview:
  'true' as after_immediate_exec,
  '0' as after_adx_min,
  '15' as after_adx_min_htf,
  '0' as after_cooldown
FROM trading_bots
WHERE status = 'running'
ORDER BY paper_trading DESC
LIMIT 5;

-- Test 5: Check if paper_trading_trades has correct columns
SELECT '=== TEST 5: Paper Trading Trades Table Structure ===' as test;
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'paper_trading_trades'
  AND column_name IN ('quantity', 'entry_price', 'amount', 'price')
ORDER BY column_name;

-- Expected: Should show 'quantity' and 'entry_price' exist, 'amount' and 'price' don't

-- Test 6: Verify no current validation constraint violations
SELECT '=== TEST 6: Check for Existing Invalid Configs ===' as test;
SELECT 
  id,
  name,
  CASE 
    WHEN strategy_config ? 'adx_min_htf' 
      AND ((strategy_config->>'adx_min_htf')::numeric < 15 OR (strategy_config->>'adx_min_htf')::numeric > 35)
    THEN 'INVALID adx_min_htf: ' || (strategy_config->>'adx_min_htf')
    WHEN strategy_config ? 'risk_per_trade_pct'
      AND ((strategy_config->>'risk_per_trade_pct')::numeric <= 0 OR (strategy_config->>'risk_per_trade_pct')::numeric > 5)
    THEN 'INVALID risk_per_trade_pct: ' || (strategy_config->>'risk_per_trade_pct')
    WHEN strategy_config ? 'bias_mode'
      AND NOT (strategy_config->>'bias_mode' IN ('long-only', 'short-only', 'both', 'auto'))
    THEN 'INVALID bias_mode: ' || (strategy_config->>'bias_mode')
    ELSE 'Valid'
  END as validation_status,
  strategy_config
FROM trading_bots
WHERE status = 'running'
  AND (
    (strategy_config ? 'adx_min_htf' AND ((strategy_config->>'adx_min_htf')::numeric < 15 OR (strategy_config->>'adx_min_htf')::numeric > 35))
    OR (strategy_config ? 'risk_per_trade_pct' AND ((strategy_config->>'risk_per_trade_pct')::numeric <= 0 OR (strategy_config->>'risk_per_trade_pct')::numeric > 5))
    OR (strategy_config ? 'bias_mode' AND NOT (strategy_config->>'bias_mode' IN ('long-only', 'short-only', 'both', 'auto')))
  );

-- Expected: Should return 0 rows (no invalid configs currently exist)
-- If any rows returned, those bots have invalid configs that need manual fix

-- ===============================================
-- SUMMARY
-- ===============================================
SELECT '=== SUMMARY ===' as section;
SELECT '
✅ ALL TESTS COMPLETE

If you see:
- Test 1: Function exists ✅
- Test 2: Returns TRUE ✅
- Test 3: Shows count of bots ✅
- Test 4: Shows preview of changes ✅
- Test 5: Shows quantity and entry_price columns ✅
- Test 6: No rows (or all "Valid") ✅

Then you are SAFE to run: FIX_ALL_BOTS_COMPREHENSIVE.sql

❌ If Test 2 returns FALSE or an error:
   - The configuration has a validation issue
   - Check the error message
   - May need to adjust values

❌ If Test 6 returns rows with "INVALID":
   - Some bots have invalid configs that need manual fix
   - Fix those bots individually before running the comprehensive fix

🚀 Ready to proceed?
   1. If all tests passed → Run FIX_ALL_BOTS_COMPREHENSIVE.sql
   2. Wait 5-10 minutes for next cron execution
   3. Run monitoring queries to verify bots are trading
' as next_steps;

