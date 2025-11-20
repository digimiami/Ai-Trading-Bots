-- ============================================
-- FIX: Force Update Bots with NULL strategy_config Values
-- ============================================
-- This script directly sets strategy_config for bots that still have NULL values
-- ============================================

-- First, let's see what these bots actually have
SELECT 
    id,
    name,
    symbol,
    strategy,
    strategy_config,
    strategy_config IS NULL as is_null,
    strategy_config = '{}'::jsonb as is_empty,
    strategy_config::text
FROM trading_bots
WHERE status = 'running'
    AND (
        strategy_config IS NULL
        OR strategy_config = '{}'::jsonb
        OR NOT (strategy_config ? 'adx_min_htf')
    )
ORDER BY name;

-- Now force update these bots by directly setting the entire strategy_config
-- This ensures the values are actually set
-- We merge existing config first, then override with our values
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
    'adx_min_htf', 15,
    'adx_trend_min', 15,
    'adx_min', 15,
    'adx_min_reversal', 12,
    'rsi_oversold', 40,
    'rsi_overbought', 60,
    'momentum_threshold', 0.3,
    'vwap_distance', 0.5,
    'bias_mode', 'both'
)
WHERE status = 'running'
    AND (
        strategy_config IS NULL
        OR strategy_config = '{}'::jsonb
        OR NOT (strategy_config ? 'adx_min_htf')
        OR (strategy_config->>'adx_min_htf') IS NULL
    );

-- Verify the fix
SELECT 
    '=== FIXED BOTS ===' as status,
    name,
    symbol,
    strategy_config->>'adx_min_htf' as adx_min_htf,
    strategy_config->>'adx_trend_min' as adx_trend_min,
    strategy_config->>'rsi_oversold' as rsi_oversold,
    strategy_config->>'bias_mode' as bias_mode
FROM trading_bots
WHERE status = 'running'
    AND name IN (
        'BTC TRADINGVIEW ALERT TEST',
        'ETH TRADINGVIEW ALERT TEST',
        'Hybrid Trend + Mean Reversion Strategy - STRKUSDT',
        'Hybrid Trend + Mean Reversion Strategy - TRUMPUSDT',
        'Immediate Trading Bot - Custom Pairs - VIRTUALUSDT',
        'LTCUSDT AS',
        'MYXUSDT',
        'Trend Following Strategy-Find Trading Pairs - ONDOUSDT',
        'Trend Following Strategy-Find Trading Pairs - XANUSDT',
        'XMLUSDT AS',
        'ZENUSDT'
    )
ORDER BY name;

