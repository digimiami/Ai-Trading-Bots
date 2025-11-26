-- ============================================
-- APPLY CONSERVATIVE OPTIMIZATION
-- Bot ID: 91be4053-28a4-4a11-9738-7871a5387c71
-- ============================================

-- Apply the optimization
UPDATE trading_bots
SET strategy_config = COALESCE(strategy_config, '{}'::jsonb) || jsonb_build_object(
    'rsi_oversold', 35,              -- Stricter oversold (was 50)
    'rsi_overbought', 65,            -- Stricter overbought (was 50)
    'adx_threshold', 25,              -- Stronger trend required (was 10)
    'cooldownBars', 5,                -- 5 bar cooldown (was 0)
    'ml_confidence_threshold', 0.70,  -- Higher ML confidence (was 0.50)
    'min_volume_requirement', 1.5,    -- Require 1.5x average volume
    'max_trades_per_day', 25,         -- Reasonable daily limit
    'stop_loss', 1.5,                 -- Tighter stop loss (was 2.0)
    'take_profit', 3.0                -- Better take profit (was 4.0)
)
WHERE id = '91be4053-28a4-4a11-9738-7871a5387c71';

-- Verify the changes were applied
SELECT 
    id,
    name,
    symbol,
    status,
    trade_amount,
    leverage,
    COALESCE((strategy_config->>'rsi_oversold')::numeric, 50) as rsi_oversold,
    COALESCE((strategy_config->>'rsi_overbought')::numeric, 50) as rsi_overbought,
    COALESCE((strategy_config->>'adx_threshold')::numeric, 10) as adx_threshold,
    COALESCE((strategy_config->>'cooldownBars')::int, 0) as cooldown_bars,
    COALESCE((strategy_config->>'ml_confidence_threshold')::numeric, 0.5) as ml_confidence,
    COALESCE((strategy_config->>'min_volume_requirement')::numeric, 1.0) as min_volume,
    COALESCE((strategy_config->>'max_trades_per_day')::int, 8) as max_trades_per_day,
    COALESCE((strategy_config->>'stop_loss')::numeric, 2.0) as stop_loss,
    COALESCE((strategy_config->>'take_profit')::numeric, 4.0) as take_profit,
    updated_at
FROM trading_bots
WHERE id = '91be4053-28a4-4a11-9738-7871a5387c71';

