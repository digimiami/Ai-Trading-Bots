-- ============================================
-- Check if Bot is Using Trailing TP
-- Bot ID: e1a167f4-e7c8-4b60-9b42-86e6e5bb4874
-- ============================================

-- PART 1: Bot Basic Info
SELECT
    id,
    name,
    symbol,
    status,
    exchange,
    trading_type,
    timeframe,
    leverage,
    trade_amount,
    stop_loss,
    take_profit,
    paper_trading,
    created_at,
    updated_at
FROM trading_bots
WHERE id = 'e1a167f4-e7c8-4b60-9b42-86e6e5bb4874';

-- PART 2: Strategy Config - Trailing TP Settings
SELECT
    id,
    name,
    -- Trailing TP Configuration
    strategy_config->>'trail_after_tp1_atr' as trail_after_tp1_atr,
    strategy_config->>'tp1_r' as tp1_r,
    strategy_config->>'tp2_r' as tp2_r,
    strategy_config->>'tp1_size' as tp1_size,
    strategy_config->>'breakeven_at_r' as breakeven_at_r,
    strategy_config->>'sl_atr_mult' as sl_atr_mult,
    -- Other relevant settings
    strategy_config->>'max_trades_per_day' as max_trades_per_day,
    strategy_config->>'risk_per_trade_pct' as risk_per_trade_pct,
    -- Full strategy_config for reference
    strategy_config
FROM trading_bots
WHERE id = 'e1a167f4-e7c8-4b60-9b42-86e6e5bb4874';

-- PART 3: Trailing TP Analysis
SELECT
    id,
    name,
    CASE
        WHEN (strategy_config->>'trail_after_tp1_atr')::numeric > 0 THEN 'YES - Trailing TP Enabled'
        WHEN (strategy_config->>'trail_after_tp1_atr')::numeric = 0 THEN 'NO - Trailing TP Disabled (value is 0)'
        WHEN strategy_config->>'trail_after_tp1_atr' IS NULL THEN 'NO - Trailing TP Not Configured (NULL)'
        ELSE 'UNKNOWN - Check value'
    END as trailing_tp_status,
    COALESCE((strategy_config->>'trail_after_tp1_atr')::numeric, 0) as trail_after_tp1_atr_value,
    COALESCE((strategy_config->>'tp1_r')::numeric, 0) as tp1_r_value,
    COALESCE((strategy_config->>'tp2_r')::numeric, 0) as tp2_r_value,
    COALESCE((strategy_config->>'tp1_size')::numeric, 0) as tp1_size_value,
    CASE
        WHEN (strategy_config->>'trail_after_tp1_atr')::numeric > 0 THEN 
            'Trailing TP will activate after TP1 is hit at ' || 
            (strategy_config->>'tp1_r')::numeric || 'R, trailing by ' || 
            (strategy_config->>'trail_after_tp1_atr')::numeric || ' ATR'
        ELSE 'Trailing TP is not enabled'
    END as trailing_tp_explanation
FROM trading_bots
WHERE id = 'e1a167f4-e7c8-4b60-9b42-86e6e5bb4874';

