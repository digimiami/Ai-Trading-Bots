-- ============================================
-- FIX: Make All Bots Trade More Frequently
-- ============================================
-- This script relaxes strategy parameters to allow more trading
-- ============================================

-- 1. RELAX STRATEGY PARAMETERS FOR ALL RUNNING BOTS
-- Lower ADX thresholds (to minimum allowed: 15), relax RSI, reduce momentum/VWAP requirements
-- NOTE: adx_min_htf must be between 15-35 (validation constraint), so we use 15 (minimum)
-- This updates ALL running bots, including those with NULL/empty strategy_config
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
    'adx_min_htf', 15,  -- Minimum allowed by validation (15-35)
    'adx_trend_min', 15,  -- Lowered to minimum
    'adx_min', 15,  -- Lowered to minimum
    'adx_min_reversal', 12,  -- Lowered for more lenient reversal trades
    'rsi_oversold', 40,  -- More lenient (was 30)
    'rsi_overbought', 60,  -- More lenient (was 70)
    'momentum_threshold', 0.3,  -- Lowered from 0.8% to 0.3%
    'vwap_distance', 0.5,  -- Lowered from 1.2% to 0.5%
    'bias_mode', 'both'  -- Enable both longs and shorts
)
WHERE status = 'running'
    AND (
        -- Update if strategy_config is NULL or empty
        strategy_config IS NULL
        OR strategy_config = '{}'::jsonb
        -- OR update if any key is missing (using ? operator)
        OR NOT (strategy_config ? 'adx_min_htf')
        OR NOT (strategy_config ? 'adx_trend_min')
        OR NOT (strategy_config ? 'rsi_oversold')
        OR NOT (strategy_config ? 'bias_mode')
        -- OR update if values are too strict
        OR (strategy_config ? 'adx_min_htf' AND COALESCE((strategy_config->>'adx_min_htf')::numeric, 99) > 15)
        OR (strategy_config ? 'adx_trend_min' AND COALESCE((strategy_config->>'adx_trend_min')::numeric, 99) > 15)
        OR (strategy_config ? 'adx_min' AND COALESCE((strategy_config->>'adx_min')::numeric, 99) > 15)
        OR (strategy_config ? 'rsi_oversold' AND COALESCE((strategy_config->>'rsi_oversold')::numeric, 0) < 40)
        OR (strategy_config ? 'rsi_overbought' AND COALESCE((strategy_config->>'rsi_overbought')::numeric, 100) > 60)
        OR (strategy_config ? 'momentum_threshold' AND COALESCE((strategy_config->>'momentum_threshold')::numeric, 99) > 0.3)
        OR (strategy_config ? 'vwap_distance' AND COALESCE((strategy_config->>'vwap_distance')::numeric, 99) > 0.5)
        OR (strategy_config ? 'bias_mode' AND COALESCE(NULLIF(strategy_config->>'bias_mode', ''), 'both') != 'both')
    );

-- 2. FIX SPECIFIC BOT: HYPEUSDT (ADX too high - set to minimum allowed: 15)
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
    'adx_min_htf', 15,
    'adx_trend_min', 15
)
WHERE name LIKE '%HYPEUSDT%' 
    AND status = 'running'
    AND COALESCE((strategy_config->>'adx_min_htf')::numeric, 99) > 15;

-- 3. FIX SPECIFIC BOT: TRUMPUSDT (Enable shorts)
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
    'bias_mode', 'both'
)
WHERE name LIKE '%TRUMPUSDT%' 
    AND status = 'running'
    AND COALESCE(NULLIF(strategy_config->>'bias_mode', ''), 'both') != 'both';

-- 4. OPTIONAL: Disable cooldown for immediate trading (COMMENT OUT IF YOU WANT COOLDOWN)
-- UPDATE trading_bots
-- SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
--     'cooldown_bars', 0
-- )
-- WHERE status = 'running'
--     AND (strategy_config->>'cooldown_bars')::numeric > 0;

-- 5. VERIFICATION: Show what was updated
SELECT 
    '=== UPDATED BOTS ===' as status,
    name,
    symbol,
    status,
    paper_trading,
    strategy_config->>'adx_min_htf' as adx_min_htf,
    strategy_config->>'adx_trend_min' as adx_trend_min,
    strategy_config->>'rsi_oversold' as rsi_oversold,
    strategy_config->>'rsi_overbought' as rsi_overbought,
    strategy_config->>'momentum_threshold' as momentum_threshold,
    strategy_config->>'vwap_distance' as vwap_distance,
    strategy_config->>'bias_mode' as bias_mode,
    strategy_config->>'cooldown_bars' as cooldown_bars
FROM trading_bots
WHERE status = 'running'
ORDER BY name;
