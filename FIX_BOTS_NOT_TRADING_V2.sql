-- ============================================
-- FIX: Make All Bots Trade More Frequently (V2)
-- ============================================
-- This script updates ALL running bots, including those with NULL/empty strategy_config
-- ============================================

-- Update ALL running bots with relaxed parameters
-- Using JSONB merge (||) so it only adds/updates the keys we specify
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
WHERE status = 'running';

-- Verify the update
SELECT 
    '=== ALL RUNNING BOTS ===' as status,
    name,
    symbol,
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

