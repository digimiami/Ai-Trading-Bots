-- Fix strategy_config validation to only validate fields that exist
-- This allows partial updates (e.g., just updating max_trades_per_day)

-- Drop existing constraint
ALTER TABLE trading_bots 
DROP CONSTRAINT IF EXISTS check_valid_strategy_config;

-- Recreate validation function with NULL checks
CREATE OR REPLACE FUNCTION validate_strategy_config(config JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- Only validate bias_mode if it exists
    IF config ? 'bias_mode' THEN
        IF NOT (config->>'bias_mode' IN ('long-only', 'short-only', 'both', 'auto')) THEN
            RAISE EXCEPTION 'Invalid bias_mode. Must be: long-only, short-only, both, or auto';
        END IF;
    END IF;
    
    -- Only validate htf_timeframe if it exists
    IF config ? 'htf_timeframe' THEN
        IF NOT (config->>'htf_timeframe' IN ('4h', '1d', '1h', '15m')) THEN
            RAISE EXCEPTION 'Invalid htf_timeframe. Must be: 4h, 1d, 1h, or 15m';
        END IF;
    END IF;
    
    -- Only validate regime_mode if it exists
    IF config ? 'regime_mode' THEN
        IF NOT (config->>'regime_mode' IN ('trend', 'mean-reversion', 'auto')) THEN
            RAISE EXCEPTION 'Invalid regime_mode. Must be: trend, mean-reversion, or auto';
        END IF;
    END IF;
    
    -- Only validate numeric ranges if they exist
    IF config ? 'adx_min_htf' THEN
        IF (config->>'adx_min_htf')::numeric < 15 OR (config->>'adx_min_htf')::numeric > 35 THEN
            RAISE EXCEPTION 'adx_min_htf must be between 15 and 35';
        END IF;
    END IF;
    
    IF config ? 'risk_per_trade_pct' THEN
        IF (config->>'risk_per_trade_pct')::numeric <= 0 OR (config->>'risk_per_trade_pct')::numeric > 5 THEN
            RAISE EXCEPTION 'risk_per_trade_pct must be between 0 and 5';
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Re-add constraint with updated validation
ALTER TABLE trading_bots
ADD CONSTRAINT check_valid_strategy_config
CHECK (strategy_config IS NULL OR strategy_config = '{}'::jsonb OR validate_strategy_config(strategy_config));

