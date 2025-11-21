-- COMPREHENSIVE FIX: Make ALL Bots Start Trading (Paper & Real)
-- ================================================================
-- This script will:
-- 1. Start all stopped bots
-- 2. Make strategy conditions extremely lenient
-- 3. Enable immediate execution
-- 4. Remove all trading restrictions
-- 5. Verify the changes

-- ================================
-- STEP 1: START ALL STOPPED BOTS
-- ================================
SELECT '=== STEP 1: Starting All Stopped Bots ===' as step;

UPDATE trading_bots
SET 
  status = 'running',
  updated_at = NOW()
WHERE status != 'running'
RETURNING id, name, status, paper_trading;

-- ================================
-- STEP 2: MAKE ALL STRATEGIES SUPER LENIENT
-- ================================
SELECT '=== STEP 2: Making All Strategy Conditions Super Lenient ===' as step;

UPDATE trading_bots
SET 
  strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
    -- Trading mode
    'bias_mode', 'both',
    'immediate_execution', true,
    'super_aggressive', true,
    'scalping_mode', true,
    'fast_entry', true,
    
    -- Remove all ADX restrictions (adx_min_htf must be 15-35 per validation)
    'adx_min', 0,
    'adx_min_htf', 15,
    'adx_trend_min', 0,
    'adx_min_continuation', 0,
    'adx_min_reversal', 0,
    'disable_htf_adx_check', true,
    
    -- Remove volume restrictions
    'min_volume_requirement', 0,
    'volume_multiplier', 0,
    'volume_multiplier_continuation', 0,
    'volume_multiplier_reversal', 0,
    
    -- Remove volatility restrictions
    'min_volatility_atr', 0,
    
    -- Remove time restrictions
    'time_filter_enabled', false,
    'cooldown_bars', 0,
    
    -- Make RSI very lenient (will always trigger)
    'rsi_oversold', 0,
    'rsi_overbought', 100,
    
    -- Remove momentum restrictions
    'momentum_threshold', 0,
    'vwap_distance', 0,
    'require_price_vs_trend', false,
    
    -- Max trades - increase limits
    'max_trades_per_day', 100,
    'max_open_positions', 10
  ),
  updated_at = NOW()
WHERE status = 'running';

-- ================================
-- STEP 3: UPDATE STRATEGY TYPE FOR COMPATIBILITY
-- ================================
SELECT '=== STEP 3: Ensuring Strategy Type is Set ===' as step;

-- For bots with no strategy or unknown type, set to scalping
UPDATE trading_bots
SET 
  strategy = CASE 
    WHEN strategy IS NULL OR strategy = '' THEN 
      '{"type": "scalping", "immediate_trading": true, "super_aggressive": true}'
    ELSE 
      (
        COALESCE(NULLIF(strategy, '')::jsonb, '{}'::jsonb) || 
        '{"immediate_trading": true, "super_aggressive": true}'::jsonb
      )::text
  END,
  updated_at = NOW()
WHERE status = 'running'
  AND (
    strategy IS NULL 
    OR strategy = '' 
    OR (strategy::jsonb->>'type' IS NULL)
    OR (strategy::jsonb->>'type' = 'unknown')
    OR (strategy::jsonb->>'immediate_trading' IS NULL)
  );

-- ================================
-- STEP 4: CLEAR ANY COOLDOWN PERIODS
-- ================================
SELECT '=== STEP 4: Clearing Cooldown Periods ===' as step;

-- Reset last_trade_at to allow immediate trading
UPDATE trading_bots
SET 
  last_trade_at = NULL,
  updated_at = NOW()
WHERE status = 'running'
  AND last_trade_at IS NOT NULL;

-- ================================
-- STEP 5: VERIFY CONFIGURATION
-- ================================
SELECT '=== STEP 5: Verification - All Running Bots Configuration ===' as step;

SELECT 
  id,
  name,
  status,
  paper_trading,
  symbol,
  exchange,
  strategy::jsonb->>'type' as strategy_type,
  strategy::jsonb->>'immediate_trading' as immediate_trading,
  strategy_config->>'immediate_execution' as immediate_execution,
  strategy_config->>'super_aggressive' as super_aggressive,
  strategy_config->>'adx_min' as adx_min,
  strategy_config->>'cooldown_bars' as cooldown_bars,
  strategy_config->>'rsi_oversold' as rsi_oversold,
  strategy_config->>'rsi_overbought' as rsi_overbought,
  strategy_config->>'max_trades_per_day' as max_trades_per_day,
  last_trade_at,
  updated_at
FROM trading_bots
WHERE status = 'running'
ORDER BY paper_trading DESC, created_at DESC;

-- ================================
-- STEP 6: BOT COUNT SUMMARY
-- ================================
SELECT '=== STEP 6: Summary of Bots ===' as step;

SELECT 
  status,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE paper_trading = true) as paper_bots,
  COUNT(*) FILTER (WHERE paper_trading = false) as real_bots
FROM trading_bots
GROUP BY status
ORDER BY total DESC;

-- ================================
-- STEP 7: NEXT STEPS
-- ================================
SELECT '=== NEXT STEPS ===' as step;
SELECT '
✅ CONFIGURATION COMPLETE!

All bots are now configured with:
- Status: running
- Strategy conditions: Super lenient (will generate signals on almost any market condition)
- Cooldown: 0 (can trade immediately)
- ADX requirement: 0 (no trend strength requirement)
- RSI range: 0-100 (will always trigger)
- Immediate execution: Enabled

WHAT TO WATCH FOR:

1. Paper Trading Bots:
   - Should start generating signals within 1-5 minutes
   - Check bot_activity_logs for "✅ Strategy signal: BUY/SELL" messages
   - Paper trades will be recorded in paper_trading_trades table

2. Real Trading Bots:
   - MUST have valid API keys configured
   - Check api_keys table to ensure keys are active
   - Real trades will be recorded in trades table
   - IMPORTANT: These are now VERY AGGRESSIVE - monitor closely!

3. Monitor Activity:
   - Run: SELECT * FROM bot_activity_logs WHERE created_at > NOW() - INTERVAL ''5 minutes'' ORDER BY created_at DESC;
   - Look for strategy signals and trade executions
   - If you see "⏸️ Strategy signal:" with reasons, that means conditions still not met

4. If Bots Still Not Trading:
   - Run COMPREHENSIVE_BOT_TRADING_DIAGNOSIS.sql to see detailed diagnostics
   - Check if bot executor cron job is running
   - Verify Bybit API connectivity
   - Check for any error messages in bot_activity_logs

CAUTION:
⚠️ Real trading bots are now EXTREMELY AGGRESSIVE!
⚠️ They will trade on almost any signal
⚠️ Monitor positions and set appropriate stop losses
⚠️ Consider reducing position sizes until you verify behavior

To make bots MORE conservative:
- Increase adx_min (e.g., to 15-20)
- Add cooldown_bars (e.g., 5-10)
- Set bias_mode to ''long-only'' or ''short-only''
- Reduce max_trades_per_day
' as next_steps;

