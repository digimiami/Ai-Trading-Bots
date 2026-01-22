-- Migration: Fix strategy_config trigger to handle string values from JSON.stringify
-- This fixes the "cannot set path in scalar" error when creating bots

-- Create or replace function to set default strategy_config
CREATE OR REPLACE FUNCTION set_default_strategy_config()
RETURNS TRIGGER AS $$
DECLARE
  config_jsonb JSONB;
BEGIN
  -- Handle case where strategy_config might be a string (from JSON.stringify)
  -- or might not be a valid JSONB object
  IF NEW.strategy_config IS NULL THEN
    config_jsonb := '{}'::jsonb;
  ELSE
    -- Try to cast to JSONB (handles both JSONB and TEXT/string inputs)
    BEGIN
      config_jsonb := NEW.strategy_config::jsonb;
      
      -- Verify it's actually a JSONB object, not a scalar
      IF jsonb_typeof(config_jsonb) IS NULL OR jsonb_typeof(config_jsonb) != 'object' THEN
        config_jsonb := '{}'::jsonb;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- If casting fails (invalid JSON), treat as empty object
      config_jsonb := '{}'::jsonb;
    END;
  END IF;

  -- If strategy_config is NULL or empty, set defaults that allow shorts
  IF config_jsonb IS NULL OR config_jsonb = '{}'::jsonb OR jsonb_typeof(config_jsonb) != 'object' THEN
    NEW.strategy_config := jsonb_build_object(
      -- CRITICAL: Allow both long and short trading
      'bias_mode', 'auto',
      'require_price_vs_trend', 'any',
      
      -- HTF Settings
      'htf_timeframe', '4h',
      'htf_trend_indicator', 'EMA200',
      'ema_fast_period', 50,
      'adx_min_htf', 23,
      'require_adx_rising', true,
      
      -- Regime Filter
      'regime_mode', 'auto',
      'adx_trend_min', 25,
      'adx_meanrev_max', 19,
      
      -- Session/Timing
      'session_filter_enabled', false,
      'allowed_hours_utc', ARRAY[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
      'cooldown_bars', 5,
      
      -- Volatility/Liquidity Gates
      'atr_percentile_min', 20,
      'bb_width_min', 0.012,
      'bb_width_max', 0.03,
      'min_24h_volume_usd', 500000000,
      'max_spread_bps', 3,
      
      -- Risk & Exits
      'risk_per_trade_pct', 1.5,
      'daily_loss_limit_pct', 3.0,
      'weekly_loss_limit_pct', 6.0,
      'max_trades_per_day', 8,
      'max_concurrent', 2,
      'max_consecutive_losses', 5,
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
      'atr_period', 14,
      'atr_tp_multiplier', 3,
      
      -- ML/AI Settings
      'use_ml_prediction', true,
      'ml_confidence_threshold', 0.6,
      'ml_min_samples', 100
    );
  ELSE
    -- If strategy_config exists but is missing critical fields, merge them in
    IF NOT (config_jsonb ? 'bias_mode') THEN
      config_jsonb := jsonb_set(config_jsonb, '{bias_mode}', '"auto"');
    END IF;
    
    IF NOT (config_jsonb ? 'require_price_vs_trend') THEN
      config_jsonb := jsonb_set(config_jsonb, '{require_price_vs_trend}', '"any"');
    END IF;
    
    -- Ensure bias_mode allows shorts if it's set to something restrictive
    IF config_jsonb->>'bias_mode' = 'long-only' THEN
      config_jsonb := jsonb_set(config_jsonb, '{bias_mode}', '"auto"');
    END IF;
    
    -- Ensure require_price_vs_trend allows shorts if it's set to 'above'
    IF config_jsonb->>'require_price_vs_trend' = 'above' THEN
      config_jsonb := jsonb_set(config_jsonb, '{require_price_vs_trend}', '"any"');
    END IF;
    
    -- Update NEW.strategy_config with the processed config
    NEW.strategy_config := config_jsonb;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION set_default_strategy_config() IS 'Sets default strategy_config for new bots to allow both long and short trading. Handles string values from JSON.stringify and ensures bias_mode=auto and require_price_vs_trend=any for all new bots.';
