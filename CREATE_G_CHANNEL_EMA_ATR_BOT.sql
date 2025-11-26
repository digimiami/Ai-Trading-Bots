-- ============================================
-- Create G-Channel EMA ATR Strategy Bot
-- Based on Pine Script: "G-Channel EMA ATR Strategy [NEW-G-Channel Strategy]"
-- ============================================

-- This script creates a bot with the following configuration:
-- Exchange: Bybit
-- Symbol: CUSTOM (will be set when creating)
-- Type: Futures
-- Leverage: 5x
-- Strategy: G-Channel EMA ATR

-- IMPORTANT: Replace 'YOUR_USER_ID' with your actual user ID
-- You can find your user ID by running: SELECT id FROM auth.users WHERE email = 'your-email@example.com';

-- Option 1: Create bot for a specific user (replace USER_ID)
INSERT INTO trading_bots (
    user_id,
    name,
    exchange,
    trading_type,
    symbol,
    timeframe,
    leverage,
    trade_amount,
    stop_loss,
    take_profit,
    risk_level,
    status,
    strategy,
    strategy_config,
    paper_trading,
    sound_notifications_enabled,
    created_at
)
SELECT 
    u.id as user_id,
    'G-Channel EMA ATR Strategy Bot' as name,
    'bybit' as exchange,
    'futures' as trading_type,
    'CUSTOM' as symbol,  -- Change this to your desired symbol (e.g., 'BTCUSDT')
    '15m' as timeframe,   -- Change this to your desired timeframe (1m, 3m, 5m, 15m, 30m, 45m, 1h, 2h, 3h, 4h, 5h, 6h, 7h, 8h, 9h, 10h, 12h, 1d, 1w, 1M)
    5 as leverage,
    100 as trade_amount,  -- Change this to your desired trade amount in USD
    2.0 as stop_loss,     -- Default stop loss percentage (will be overridden by ATR-based SL)
    4.0 as take_profit,   -- Default take profit percentage (will be overridden by ATR-based TP)
    'medium' as risk_level,
    'running' as status,
    jsonb_build_object(
        'type', 'scalping',  -- Use scalping strategy which supports EMA, ATR, RSI
        'rsiThreshold', 70,
        'adxThreshold', 20,
        'emaSlope', 0.5,
        'atrPercentage', 2.5,
        'useMLPrediction', false
    ) as strategy,
    jsonb_build_object(
        -- Technical Indicators (from Pine Script)
        'ema_length', 50,
        'atr_length', 14,
        'atr_period', 14,
        'rsi_period', 14,
        'rsi_oversold', 30,
        'rsi_overbought', 70,
        
        -- ATR-Based Exits (from Pine Script)
        'tp_atr_multiplier', 4.0,  -- TP Multiplier from Pine Script
        'sl_atr_multiplier', 2.0,  -- SL Multiplier from Pine Script
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
    ) as strategy_config,
    false as paper_trading,  -- Set to true for paper trading
    false as sound_notifications_enabled,
    NOW() as created_at
FROM auth.users u
WHERE u.email = 'digimiami@gmail.com'  -- Change to your email
LIMIT 1;

-- Option 2: Create bot with custom symbol and timeframe (uncomment and modify)
/*
INSERT INTO trading_bots (
    user_id,
    name,
    exchange,
    trading_type,
    symbol,
    timeframe,
    leverage,
    trade_amount,
    stop_loss,
    take_profit,
    risk_level,
    status,
    strategy,
    strategy_config,
    paper_trading,
    sound_notifications_enabled,
    created_at
)
SELECT 
    u.id as user_id,
    'G-Channel EMA ATR - BTCUSDT' as name,
    'bybit' as exchange,
    'futures' as trading_type,
    'BTCUSDT' as symbol,  -- Your custom symbol
    '15m' as timeframe,    -- Your custom timeframe
    5 as leverage,
    100 as trade_amount,   -- Your custom trade amount
    2.0 as stop_loss,      -- Default stop loss percentage
    4.0 as take_profit,    -- Default take profit percentage
    'medium' as risk_level,
    'running' as status,
    jsonb_build_object(
        'type', 'g_channel_ema_atr',
        'ema_length', 50,
        'atr_length', 14,
        'rsi_length', 14,
        'rsi_oversold', 30,
        'rsi_overbought', 70,
        'trade_mode', 'both'
    ) as strategy,
    jsonb_build_object(
        'ema_length', 50,
        'atr_length', 14,
        'atr_period', 14,
        'rsi_period', 14,
        'rsi_oversold', 30,
        'rsi_overbought', 70,
        'tp_atr_multiplier', 4.0,
        'sl_atr_multiplier', 2.0,
        'sl_atr_mult', 2.0,
        'tp1_r', 4.0,
        'bias_mode', 'both',
        'risk_per_trade_pct', 1.0,
        'max_trades_per_day', 20,
        'max_concurrent', 3,
        'cooldown_bars', 3,
        'use_ml_prediction', false,
        'immediate_trading', true,
        'super_aggressive', false,
        'require_price_vs_trend', 'any',
        'adx_threshold', 20,
        'min_volume_requirement', 1.0
    ) as strategy_config,
    false as paper_trading,
    false as sound_notifications_enabled,
    NOW() as created_at
FROM auth.users u
WHERE u.email = 'digimiami@gmail.com'
LIMIT 1;
*/

-- Verify the bot was created
SELECT 
    id,
    name,
    exchange,
    symbol,
    timeframe,
    leverage,
    trade_amount,
    status,
    strategy_config->>'ema_length' as ema_length,
    strategy_config->>'atr_length' as atr_length,
    strategy_config->>'rsi_oversold' as rsi_oversold,
    strategy_config->>'rsi_overbought' as rsi_overbought,
    strategy_config->>'tp_atr_multiplier' as tp_multiplier,
    strategy_config->>'sl_atr_multiplier' as sl_multiplier,
    strategy_config->>'bias_mode' as trade_mode,
    created_at
FROM trading_bots
WHERE name LIKE 'G-Channel EMA ATR%'
ORDER BY created_at DESC
LIMIT 1;

