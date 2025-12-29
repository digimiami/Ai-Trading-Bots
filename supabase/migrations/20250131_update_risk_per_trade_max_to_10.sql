-- Update risk_per_trade_pct validation to allow up to 10% (matching UI slider max)
-- Migration: 20250131_update_risk_per_trade_max_to_10.sql

-- Update the validation function to allow risk_per_trade_pct up to 10%
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
        IF NOT (config->>'htf_timeframe' IN ('15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '1w')) THEN
            RAISE EXCEPTION 'Invalid htf_timeframe. Must be one of: 15m, 30m, 1h, 2h, 4h, 6h, 12h, 1d, 1w';
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
    
    -- Updated: Allow risk_per_trade_pct up to 10% (was 5%)
    IF config ? 'risk_per_trade_pct' THEN
        IF (config->>'risk_per_trade_pct')::numeric <= 0 OR (config->>'risk_per_trade_pct')::numeric > 10 THEN
            RAISE EXCEPTION 'risk_per_trade_pct must be between 0 and 10';
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION validate_strategy_config(JSONB) IS
'Validates strategy_config JSONB. Updated to allow risk_per_trade_pct up to 10% (matching UI slider max).';

