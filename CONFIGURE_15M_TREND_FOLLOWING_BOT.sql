-- Configure Bot for 15m Trend-Following Strategy
-- This script updates strategy_config for optimal 15-minute trend-following setup

-- IMPORTANT: Replace 'YOUR_BOT_ID' with your actual bot ID before running

-- To find your bot ID, run this first:
-- SELECT id, name, symbol, exchange FROM trading_bots WHERE name LIKE '%your-bot-name%';

UPDATE trading_bots
SET strategy_config = jsonb_build_object(
    -- ========================================
    -- DIRECTIONAL BIAS (HTF Trend Following)
    -- ========================================
    'bias_mode', 'auto',                          -- Auto: Follow HTF Trend
    'htf_timeframe', '4h',                        -- 4 Hours (Swing Standard)
    'htf_trend_indicator', 'EMA200',              -- EMA 200 (Long-term macro trend)
    'ema_fast_period', 50,
    'require_price_vs_trend', 'any',
    'adx_min_htf', 24,                            -- Adjusted to match ADX threshold
    'require_adx_rising', true,
    'disable_htf_adx_check', false,
    
    -- ========================================
    -- REGIME FILTER
    -- ========================================
    'regime_mode', 'auto',                        -- Auto Detect
    'adx_trend_min', 24,                          -- Matches ADX threshold
    'adx_meanrev_max', 19,
    
    -- ========================================
    -- SESSION/TIMING
    -- ========================================
    'session_filter_enabled', false,
    'allowed_hours_utc', ARRAY[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
    'cooldown_bars', 4,                           -- ON: Wait 4 bars (1 hour on 15m) between trades
    
    -- ========================================
    -- VOLATILITY/LIQUIDITY GATES
    -- ========================================
    'atr_percentile_min', 20,
    'bb_width_min', 0.018,                        -- BB Width Threshold: 0.018 (tighter = fewer trades)
    'bb_width_max', 0.05,
    'min_24h_volume_usd', 500000000,
    'max_spread_bps', 3,
    
    -- ========================================
    -- RISK MANAGEMENT
    -- ========================================
    'risk_per_trade_pct', 1.0,                    -- Risk per Trade: 1.0%
    'daily_loss_limit_pct', 2.5,                  -- Daily Loss Limit: 2.5%
    'weekly_loss_limit_pct', 5.0,                 -- Weekly Loss Limit: 5%
    'max_trades_per_day', 6,                      -- Max Trades/Day: 6
    'max_concurrent', 1,                          -- Max Concurrent Positions: 1
    'max_consecutive_losses', 3,                  -- Max Consecutive Losses: 3
    
    -- ========================================
    -- EXIT STRATEGY (Take Profit)
    -- ========================================
    'sl_atr_mult', 1.3,
    'tp1_r', 1.4,                                 -- TP1: 1.4% (1.4R)
    'tp2_r', 3.2,                                 -- TP2: 3.2% (3.2R)
    'tp1_size', 0.45,                             -- TP1 Size: 45%
    'breakeven_at_r', 0.8,
    'trail_after_tp1_atr', 1.0,                   -- Trailing Take-Profit: ON
    'time_stop_hours', 48,
    
    -- ========================================
    -- TECHNICAL INDICATORS
    -- ========================================
    'rsi_period', 14,
    'rsi_oversold', 30,
    'rsi_overbought', 65,                         -- RSI Threshold: 65 (was 70, more conservative)
    'rsi_threshold', 65,                          -- Also set in strategy object
    
    'adx_threshold', 24,                          -- ADX Threshold: 24
    
    -- Momentum & EMA Slope
    'momentum_threshold', 0.70,                   -- Momentum Threshold: 0.70
    'ema_slope', 0.35,                            -- EMA Slope: 0.35
    'vwap_distance', 1.1,                         -- VWAP Distance: 1.1
    
    'macd_fast', 12,
    'macd_slow', 26,
    'macd_signal', 9,
    'bb_period', 20,
    'bb_stddev', 2.0,
    'atr_period', 14,
    
    -- ========================================
    -- ML/AI SETTINGS
    -- ========================================
    'use_ml_prediction', false,                   -- Enable ML Prediction: OFF
    'ml_confidence_threshold', 0.6,
    'ml_min_samples', 200,                        -- Min Samples for ML: 200
    
    -- ========================================
    -- FLAGS & FEATURES
    -- ========================================
    'always_trade', false,                        -- Always Trade Mode: OFF
    'enable_trailing_take_profit', true,          -- Trailing Take-Profit: ON
    'trailing_take_profit_atr', 1.0,              -- Trailing TP ATR multiplier
    'smart_exit_enabled', true,                   -- Smart Exit Trigger: ON
    'smart_exit_retracement_pct', 2.0,            -- Smart exit retracement %
    'enable_dynamic_trailing', true,              -- Dynamic Upward Trailing: ON
    'enable_volatility_pause', true,              -- Volatility Pause: ON
    'enable_funding_rate_filter', true,           -- Funding Rate Filter: ON
    'enable_pair_win_rate', false,                -- Pair-Based Win Rate Calculation: OFF
    'pair_win_rate_update_frequency', 'periodic', -- Real-Time Pair Win Rate: OFF (use 'periodic' instead of 'realtime')
    'strategy_integration', ARRAY[]::text[],      -- Auto-Rebalancing (Combo): OFF (empty array)
    'enable_automatic_execution', false,          -- Automatic Execution: OFF
    
    -- Additional Strategy Parameters
    'momentum_threshold', 0.70,                   -- Momentum Threshold: 0.70
    'ema_slope', 0.35,                            -- EMA Slope: 0.35
    'vwap_distance', 1.1                          -- VWAP Distance: 1.1
)
WHERE id = 'YOUR_BOT_ID';  -- ⚠️ REPLACE WITH YOUR ACTUAL BOT ID

-- Also update the strategy object for backward compatibility
UPDATE trading_bots
SET strategy = jsonb_set(
    jsonb_set(
        COALESCE(strategy, '{}'::jsonb),
        '{rsiThreshold}', '65'::jsonb
    ),
    '{adxThreshold}', '24'::jsonb
)
WHERE id = 'YOUR_BOT_ID';  -- ⚠️ REPLACE WITH YOUR ACTUAL BOT ID

-- Verify the update
SELECT 
    id,
    name,
    symbol,
    strategy_config->>'bias_mode' as bias_mode,
    strategy_config->>'htf_timeframe' as htf_timeframe,
    strategy_config->>'htf_trend_indicator' as htf_indicator,
    strategy_config->>'risk_per_trade_pct' as risk_per_trade,
    strategy_config->>'daily_loss_limit_pct' as daily_loss_limit,
    strategy_config->>'max_trades_per_day' as max_trades,
    strategy_config->>'max_concurrent' as max_positions,
    strategy_config->>'rsi_overbought' as rsi_threshold,
    strategy_config->>'adx_threshold' as adx_threshold,
    strategy_config->>'tp1_r' as tp1,
    strategy_config->>'tp2_r' as tp2,
    strategy_config->>'tp1_size' as tp1_size
FROM trading_bots
WHERE id = 'YOUR_BOT_ID';  -- ⚠️ REPLACE WITH YOUR ACTUAL BOT ID

