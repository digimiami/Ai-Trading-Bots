-- ============================================
-- Add G-Channel EMA ATR Strategy to Pablo Ready Bots
-- This makes it available in the Admin "Ready Bot" section
-- ============================================

-- Insert into pablo_ready_bots table
-- First, delete existing entry if it exists (to avoid conflicts)
DELETE FROM pablo_ready_bots WHERE name = 'G-Channel EMA ATR Strategy';

-- Insert the new bot
INSERT INTO pablo_ready_bots (
    name,
    description,
    exchange,
    trading_type,
    symbol,
    timeframe,
    leverage,
    trade_amount,
    risk_level,
    strategy,
    strategy_config,
    enabled,
    created_at
)
VALUES (
    'G-Channel EMA ATR Strategy',
    'Advanced EMA + ATR strategy with RSI-based G-Channel signals. Uses EMA(50) for trend, ATR(14) for dynamic stops/targets, and RSI crossovers for entry signals. Supports both long and short trades.',
    'bybit',
    'futures',
    'CUSTOM',  -- Users can change this when creating
    '15m',     -- Users can change this when creating (1m, 3m, 5m, 15m, 30m, 45m, 1h, 2h, 3h, 4h, 5h, 6h, 7h, 8h, 9h, 10h, 12h, 1d, 1w, 1M)
    5,         -- 5x leverage
    100,       -- Default trade amount (users can change)
    'medium',
    jsonb_build_object(
        'type', 'scalping',  -- Use scalping strategy which supports EMA, ATR, RSI
        'rsiThreshold', 70,
        'adxThreshold', 20,
        'emaSlope', 0.5,
        'atrPercentage', 2.5,
        'useMLPrediction', false
    ),
    jsonb_build_object(
        -- Technical Indicators (from Pine Script)
        'ema_length', 50,
        'atr_length', 14,
        'atr_period', 14,
        'rsi_period', 14,
        'rsi_oversold', 30,
        'rsi_overbought', 70,
        
        -- ATR-Based Exits (from Pine Script)
        'tp_atr_multiplier', 4.0,  -- TP Multiplier: 4.0 ATR
        'sl_atr_multiplier', 2.0,  -- SL Multiplier: 2.0 ATR
        'sl_atr_mult', 2.0,         -- Also set sl_atr_mult for compatibility
        'tp1_r', 4.0,               -- Take Profit 1 (ATR multiplier)
        
        -- Trade Mode
        'bias_mode', 'both',  -- 'both', 'long_only', 'short_only'
        
        -- Risk Management
        'risk_per_trade_pct', 1.0,
        'max_trades_per_day', 20,
        'max_concurrent', 3,
        'cooldown_bars', 3,
        
        -- Strategy Settings
        'use_ml_prediction', false,
        'immediate_trading', true,
        'super_aggressive', false,
        
        -- Entry Conditions
        'require_price_vs_trend', 'any',
        'adx_threshold', 20,
        'min_volume_requirement', 1.0
    ),
    true,  -- Enabled by default
    NOW()
);

-- Verify the bot was added
SELECT 
    id,
    name,
    description,
    exchange,
    trading_type,
    symbol,
    timeframe,
    leverage,
    trade_amount,
    enabled,
    strategy_config->>'ema_length' as ema_length,
    strategy_config->>'atr_length' as atr_length,
    strategy_config->>'rsi_oversold' as rsi_oversold,
    strategy_config->>'rsi_overbought' as rsi_overbought,
    strategy_config->>'tp_atr_multiplier' as tp_multiplier,
    strategy_config->>'sl_atr_multiplier' as sl_multiplier,
    strategy_config->>'bias_mode' as trade_mode,
    created_at
FROM pablo_ready_bots
WHERE name = 'G-Channel EMA ATR Strategy';

