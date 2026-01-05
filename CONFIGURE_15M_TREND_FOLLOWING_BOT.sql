-- Configure Bot for 15m Trend-Following Strategy
-- This script updates strategy_config for optimal 15-minute trend-following setup

-- IMPORTANT: Replace 'YOUR_BOT_ID' with your actual bot ID before running

-- To find your bot ID, run this first:
-- SELECT id, name, symbol, exchange FROM trading_bots WHERE name LIKE '%your-bot-name%';

-- Build config in parts to avoid 100-argument limit
UPDATE trading_bots
SET strategy_config = 
    -- Part 1: Directional Bias & Regime
    jsonb_build_object(
        'bias_mode', 'auto',
        'htf_timeframe', '4h',
        'htf_trend_indicator', 'EMA200',
        'ema_fast_period', 50,
        'require_price_vs_trend', 'any',
        'adx_min_htf', 24,
        'require_adx_rising', true,
        'disable_htf_adx_check', false,
        'regime_mode', 'auto',
        'adx_trend_min', 24,
        'adx_meanrev_max', 19
    )
    -- Part 2: Session & Volatility
    || jsonb_build_object(
        'session_filter_enabled', false,
        'allowed_hours_utc', ARRAY[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
        'cooldown_bars', 4,
        'atr_percentile_min', 20,
        'bb_width_min', 0.02,                      -- BB Width: 0.02 (0.018-0.020 range, using 0.02 for fewer trades)
        'bb_width_max', 0.05,
        'min_24h_volume_usd', 500000000,
        'max_spread_bps', 3
    )
    -- Part 3: Risk Management
    || jsonb_build_object(
        'risk_per_trade_pct', 1.0,
        'daily_loss_limit_pct', 2.5,
        'weekly_loss_limit_pct', 5.0,
        'max_trades_per_day', 6,
        'max_concurrent', 1,
        'max_consecutive_losses', 3
    )
    -- Part 4: Exit Strategy (Trend-friendly: let the runner run)
    || jsonb_build_object(
        'sl_atr_mult', 1.3,
        'tp1_r', 1.4,                              -- TP1: 1.4% (in range 1.2-1.6)
        'tp2_r', 3.2,                              -- TP2: 3.2% (in range 2.8-3.8)
        'tp1_size', 0.45,                          -- TP1 Size: 45% (let trailing manage the rest)
        'breakeven_at_r', 0.8,
        'trail_after_tp1_atr', 1.0,
        'time_stop_hours', 48
    )
    -- Part 5: Technical Indicators
    || jsonb_build_object(
        'rsi_period', 14,
        'rsi_oversold', 30,
        'rsi_overbought', 65,
        'rsi_threshold', 65,
        'adx_threshold', 24,
        'momentum_threshold', 0.70,                -- Momentum: 0.70 (reduced from 0.8 for trend-following)
        'ema_slope', 0.35,                         -- EMA Slope: 0.35 (reduced from 0.5)
        'vwap_distance', 1.2,                      -- VWAP Distance: 1.2 (1.0-1.2 range, using 1.2)
        'macd_fast', 12,
        'macd_slow', 26,
        'macd_signal', 9,
        'bb_period', 20,
        'bb_stddev', 2.0,
        'atr_period', 14
    )
    -- Part 6: ML/AI & Features
    || jsonb_build_object(
        'use_ml_prediction', false,
        'ml_confidence_threshold', 0.6,
        'ml_min_samples', 200,
        'always_trade', false,
        'enable_trailing_take_profit', true,
        'trailing_take_profit_atr', 1.0,
        'smart_exit_enabled', true,
        'smart_exit_retracement_pct', 2.0,
        'enable_dynamic_trailing', true,
        'enable_volatility_pause', true,
        'enable_funding_rate_filter', true,
        'enable_pair_win_rate', false,
        'pair_win_rate_update_frequency', 'periodic',
        'strategy_integration', ARRAY[]::text[],
        'enable_automatic_execution', false
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

