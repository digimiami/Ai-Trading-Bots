-- ============================================
-- FIX: Convert Array strategy_config to Object and Apply Updates
-- ============================================
-- The strategy_config column is stored as an array instead of an object
-- This script extracts the actual config and applies our relaxed parameters
-- ============================================

-- First, let's see the structure
SELECT 
    name,
    jsonb_typeof(strategy_config) as config_type,
    strategy_config
FROM trading_bots
WHERE status = 'running'
    AND name IN (
        'BTC TRADINGVIEW ALERT TEST',
        'ETH TRADINGVIEW ALERT TEST'
    )
LIMIT 2;

-- Fix: Extract config from array and merge with our relaxed parameters
-- If strategy_config is an array, the first element contains the actual config (as a JSON string)
-- We need to parse it and merge with our updates
UPDATE trading_bots
SET strategy_config = (
    CASE 
        -- If it's an array, extract first element (which is a JSON string), parse it, then merge
        WHEN jsonb_typeof(strategy_config) = 'array' AND jsonb_array_length(strategy_config) > 0 THEN
            -- First element is a JSON string, need to parse it
            CASE 
                WHEN jsonb_typeof(strategy_config->0) = 'string' THEN
                    -- It's a string, parse it as JSON
                    (strategy_config->>0)::jsonb || jsonb_build_object(
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
                ELSE
                    -- It's already an object, use it directly
                    (strategy_config->0) || jsonb_build_object(
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
            END
        -- If it's an object, just merge
        WHEN jsonb_typeof(strategy_config) = 'object' THEN
            strategy_config || jsonb_build_object(
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
        -- If it's null or empty, create new object
        ELSE
            jsonb_build_object(
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
    END
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

-- Verify the fix
SELECT 
    name,
    symbol,
    jsonb_typeof(strategy_config) as config_type,
    strategy_config ? 'adx_min_htf' as has_adx_min_htf,
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

