-- ============================================
-- FIX: Update Specific Bots with NULL Config Values
-- ============================================
-- This script directly updates the bots that are showing NULL values
-- ============================================

-- Update each bot individually by name to ensure they get the config
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
    );

-- Verify the update worked
SELECT 
    name,
    symbol,
    strategy_config IS NULL as config_is_null,
    strategy_config = '{}'::jsonb as config_is_empty,
    strategy_config ? 'adx_min_htf' as has_adx_min_htf,
    strategy_config->>'adx_min_htf' as adx_min_htf,
    strategy_config->>'adx_trend_min' as adx_trend_min,
    strategy_config->>'rsi_oversold' as rsi_oversold,
    strategy_config->>'bias_mode' as bias_mode,
    strategy_config::text as full_config
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

