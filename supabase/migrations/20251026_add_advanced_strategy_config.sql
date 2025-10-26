-- Advanced Trading Strategy Configuration
-- Adds Directional Bias, Regime Filter, Session Timing, and Risk Management

-- Add advanced strategy columns to trading_bots table
ALTER TABLE trading_bots 
ADD COLUMN IF NOT EXISTS strategy_config JSONB DEFAULT '{}'::jsonb;

-- Update strategy_config structure for all bots
UPDATE trading_bots
SET strategy_config = jsonb_build_object(
    -- Directional Bias
    'bias_mode', 'auto',
    'htf_timeframe', '4h',
    'htf_trend_indicator', 'EMA200',
    'ema_fast_period', 50,
    'require_price_vs_trend', 'any',
    'adx_min_htf', 23,
    'require_adx_rising', true,
    
    -- Regime Filter
    'regime_mode', 'auto',
    'adx_trend_min', 25,
    'adx_meanrev_max', 19,
    
    -- Session/Timing
    'session_filter_enabled', false,
    'allowed_hours_utc', ARRAY[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
    'cooldown_bars', 8,
    
    -- Volatility/Liquidity Gates
    'atr_percentile_min', 20,
    'bb_width_min', 0.012,
    'bb_width_max', 0.03,
    'min_24h_volume_usd', 500000000,
    'max_spread_bps', 3,
    
    -- Risk & Exits
    'risk_per_trade_pct', 0.75,
    'daily_loss_limit_pct', 3.0,
    'weekly_loss_limit_pct', 6.0,
    'max_trades_per_day', 8,
    'max_concurrent', 2,
    'sl_atr_mult', 1.3,
    'tp1_r', 1.0,
    'tp2_r', 2.0,
    'tp1_size', 0.5,
    'breakeven_at_r', 0.8,
    'trail_after_tp1_atr', 1.0,
    'time_stop_hours', 48,
    
    -- Technical Indicators
    'rsi_period', 14,
    'rsi_oversold', 30,
    'rsi_overbought', 70,
    'macd_fast', 12,
    'macd_slow', 26,
    'macd_signal', 9,
    'bb_period', 20,
    'bb_stddev', 2.0,
    'atr_period', 14,
    
    -- ML/AI Settings
    'use_ml_prediction', COALESCE((strategy::jsonb->>'useMLPrediction')::boolean, false),
    'ml_confidence_threshold', 0.6,
    'ml_min_samples', 100
)
WHERE strategy_config = '{}'::jsonb OR strategy_config IS NULL;

-- Create index for faster strategy_config queries
CREATE INDEX IF NOT EXISTS idx_trading_bots_strategy_config ON trading_bots USING GIN (strategy_config);

-- Create function to validate strategy configuration
CREATE OR REPLACE FUNCTION validate_strategy_config(config JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- Validate bias_mode
    IF NOT (config->>'bias_mode' IN ('long-only', 'short-only', 'both', 'auto')) THEN
        RAISE EXCEPTION 'Invalid bias_mode. Must be: long-only, short-only, both, or auto';
    END IF;
    
    -- Validate htf_timeframe
    IF NOT (config->>'htf_timeframe' IN ('4h', '1d', '1h', '15m')) THEN
        RAISE EXCEPTION 'Invalid htf_timeframe. Must be: 4h or 1d';
    END IF;
    
    -- Validate regime_mode
    IF NOT (config->>'regime_mode' IN ('trend', 'mean-reversion', 'auto')) THEN
        RAISE EXCEPTION 'Invalid regime_mode. Must be: trend, mean-reversion, or auto';
    END IF;
    
    -- Validate numeric ranges
    IF (config->>'adx_min_htf')::numeric < 15 OR (config->>'adx_min_htf')::numeric > 35 THEN
        RAISE EXCEPTION 'adx_min_htf must be between 15 and 35';
    END IF;
    
    IF (config->>'risk_per_trade_pct')::numeric <= 0 OR (config->>'risk_per_trade_pct')::numeric > 5 THEN
        RAISE EXCEPTION 'risk_per_trade_pct must be between 0 and 5';
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add constraint to validate strategy_config on insert/update
ALTER TABLE trading_bots 
DROP CONSTRAINT IF EXISTS check_valid_strategy_config;

ALTER TABLE trading_bots
ADD CONSTRAINT check_valid_strategy_config
CHECK (strategy_config IS NULL OR validate_strategy_config(strategy_config));

-- Create view for bot strategy summary
CREATE OR REPLACE VIEW bot_strategy_summary AS
SELECT 
    id,
    name,
    symbol,
    exchange,
    status,
    trading_type,
    leverage,
    trade_amount,
    strategy_config->>'bias_mode' as bias_mode,
    strategy_config->>'regime_mode' as regime_mode,
    strategy_config->>'htf_timeframe' as htf_timeframe,
    (strategy_config->>'risk_per_trade_pct')::numeric as risk_pct,
    (strategy_config->>'max_trades_per_day')::integer as max_daily_trades,
    (strategy_config->>'use_ml_prediction')::boolean as ml_enabled,
    pnl,
    win_rate,
    total_trades,
    created_at,
    user_id
FROM trading_bots
ORDER BY status DESC, created_at DESC;

-- Grant permissions
GRANT SELECT ON bot_strategy_summary TO authenticated;

-- Create sample advanced strategy configurations
INSERT INTO trading_bots (
    user_id, 
    name, 
    exchange, 
    symbol, 
    trading_type, 
    leverage, 
    trade_amount,
    stop_loss,
    take_profit,
    status,
    risk_level,
    strategy,
    strategy_config
)
SELECT 
    u.id,
    'PABLO BTC TREND FOLLOWER',
    'bybit',
    'BTCUSDT',
    'futures',
    3,
    15,
    1.3,
    2.0,
    'running',
    'medium',
    '{"type": "trend_following"}'::jsonb,
    jsonb_build_object(
        'bias_mode', 'auto',
        'htf_timeframe', '4h',
        'htf_trend_indicator', 'EMA200',
        'ema_fast_period', 50,
        'require_price_vs_trend', 'above',
        'adx_min_htf', 23,
        'require_adx_rising', true,
        'regime_mode', 'trend',
        'adx_trend_min', 25,
        'risk_per_trade_pct', 0.75,
        'max_trades_per_day', 8,
        'max_concurrent', 2,
        'sl_atr_mult', 1.3,
        'tp1_r', 1.0,
        'tp2_r', 2.0,
        'tp1_size', 0.5,
        'use_ml_prediction', true,
        'ml_confidence_threshold', 0.7
    )
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM trading_bots 
    WHERE user_id = u.id AND name = 'PABLO BTC TREND FOLLOWER'
)
LIMIT 1;

-- Success message
SELECT 'Advanced strategy configuration completed!' as status,
       COUNT(*) as bots_updated
FROM trading_bots
WHERE strategy_config IS NOT NULL AND strategy_config != '{}'::jsonb;

