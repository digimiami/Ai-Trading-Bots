-- Fix paper trading bots not placing orders
-- This script makes strategy conditions more lenient for paper trading

-- 1. Fix ML Prediction to be more responsive
-- Update strategy configs to have better ML prediction thresholds
UPDATE trading_bots
SET strategy = jsonb_set(
    COALESCE(strategy::jsonb, '{}'::jsonb),
    '{useMLPrediction}',
    'true'::jsonb
)
WHERE paper_trading = true
  AND (strategy::json->>'useMLPrediction')::boolean IS NOT TRUE;

-- 2. Make RSI thresholds more lenient for paper trading
-- Set rsiThreshold to 50 if not set (this means: buy when RSI < 50, sell when RSI > 50)
UPDATE trading_bots
SET strategy = jsonb_set(
    COALESCE(strategy::jsonb, '{}'::jsonb),
    '{rsiThreshold}',
    COALESCE(
        (strategy::json->>'rsiThreshold')::text::jsonb,
        '50'::jsonb
    )
)
WHERE paper_trading = true
  AND (strategy::json->>'rsiThreshold') IS NULL;

-- 3. Make ADX thresholds more lenient (set to 0 or very low)
UPDATE trading_bots
SET strategy = jsonb_set(
    COALESCE(strategy::jsonb, '{}'::jsonb),
    '{adxThreshold}',
    CASE 
        WHEN (strategy::json->>'adxThreshold')::numeric > 10 THEN '5'::jsonb
        ELSE COALESCE(
            (strategy::json->>'adxThreshold')::text::jsonb,
            '0'::jsonb
        )
    END
)
WHERE paper_trading = true;

-- 4. Enable immediate execution for paper trading
UPDATE trading_bots
SET strategy = jsonb_set(
    COALESCE(strategy::jsonb, '{}'::jsonb),
    '{immediate_execution}',
    'true'::jsonb
)
WHERE paper_trading = true;

-- 5. Remove or reduce cooldown bars for paper trading
UPDATE trading_bots
SET strategy = jsonb_set(
    COALESCE(strategy::jsonb, '{}'::jsonb),
    '{cooldown_bars}',
    '0'::jsonb
)
WHERE paper_trading = true
  AND COALESCE((strategy::json->>'cooldown_bars')::int, 0) > 0;

-- 6. For scalping strategies, make them more lenient
UPDATE trading_bots
SET strategy = jsonb_set(
    jsonb_set(
        jsonb_set(
            COALESCE(strategy::jsonb, '{}'::jsonb),
            '{volume_multiplier}',
            '0'::jsonb
        ),
        '{min_volatility_atr}',
        '0'::jsonb
    ),
    '{rsi_oversold}',
    '0'::jsonb
)
WHERE paper_trading = true
  AND (
    strategy::json->>'type' = 'scalping'
    OR strategy::json->>'name' LIKE '%Scalping%'
  );

-- 7. Show what was updated
SELECT 
    id,
    name,
    symbol,
    strategy::json->>'rsiThreshold' as rsi_threshold,
    strategy::json->>'adxThreshold' as adx_threshold,
    strategy::json->>'immediate_execution' as immediate_execution,
    strategy::json->>'cooldown_bars' as cooldown_bars,
    strategy::json->>'useMLPrediction' as use_ml_prediction
FROM trading_bots
WHERE paper_trading = true
ORDER BY name;

