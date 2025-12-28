-- Fix exit_price and updated_at column errors in trades table updates
-- Migration: 20250131_fix_exit_price_column_error.sql
-- This ensures the trigger function doesn't try to update trades.exit_price which doesn't exist
-- The trades table doesn't have an exit_price column - only trading_positions has it
-- Also ensures updated_at column exists if it doesn't already

-- Add updated_at column if it doesn't exist (must be done before any triggers that use it)
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure the trigger function exists for updated_at (create if it doesn't exist)
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trades timestamp trigger to ensure it works correctly
DROP TRIGGER IF EXISTS trades_set_timestamp ON public.trades;
CREATE TRIGGER trades_set_timestamp
  BEFORE UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Drop and recreate the trigger function to ensure it's correct
CREATE OR REPLACE FUNCTION update_bot_metrics_on_position_close()
RETURNS TRIGGER AS $$
DECLARE
  v_bot_id UUID;
  v_user_id UUID;
  v_total_trades INTEGER;
  v_win_trades INTEGER;
  v_loss_trades INTEGER;
  v_total_pnl DECIMAL;
  v_total_fees DECIMAL;
  v_win_rate DECIMAL;
  v_max_drawdown DECIMAL;
  v_peak_pnl DECIMAL;
  v_pnl_percentage DECIMAL(5,2);
  v_trade_amount DECIMAL;
  v_raw_pnl_percentage DECIMAL;
BEGIN
  -- Only process when position is closed
  IF NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status = 'open') THEN
    v_bot_id := NEW.bot_id;
    v_user_id := NEW.user_id;
    
    -- Calculate metrics from all closed positions for this bot
    SELECT 
      COUNT(*)::INTEGER,
      COUNT(*) FILTER (WHERE realized_pnl > 0)::INTEGER,
      COUNT(*) FILTER (WHERE realized_pnl < 0)::INTEGER,
      COALESCE(SUM(realized_pnl), 0),
      COALESCE(SUM(fees), 0)
    INTO v_total_trades, v_win_trades, v_loss_trades, v_total_pnl, v_total_fees
    FROM trading_positions
    WHERE bot_id = v_bot_id AND status = 'closed';
    
    -- Calculate win rate (clamp to 0-100)
    IF v_total_trades > 0 THEN
      v_win_rate := (v_win_trades::DECIMAL / v_total_trades::DECIMAL) * 100;
    ELSE
      v_win_rate := 0;
    END IF;
    -- Clamp win_rate to 0-100
    v_win_rate := GREATEST(0, LEAST(100, v_win_rate));
    
    -- Calculate max drawdown from cumulative PnL
    WITH cumulative_pnl AS (
      SELECT 
        realized_pnl,
        SUM(realized_pnl) OVER (ORDER BY closed_at) as running_pnl
      FROM trading_positions
      WHERE bot_id = v_bot_id AND status = 'closed'
      ORDER BY closed_at
    ),
    peak_pnl AS (
      SELECT MAX(running_pnl) as peak
      FROM cumulative_pnl
    )
    SELECT 
      COALESCE(MAX(peak.peak - cp.running_pnl), 0),
      COALESCE(MAX(cp.running_pnl), 0)
    INTO v_max_drawdown, v_peak_pnl
    FROM cumulative_pnl cp
    CROSS JOIN peak_pnl peak
    WHERE peak.peak - cp.running_pnl > 0;
    
    -- Get trade_amount for pnl_percentage calculation
    SELECT COALESCE(trade_amount, 0) INTO v_trade_amount
    FROM trading_bots
    WHERE id = v_bot_id;
    
    -- Calculate pnl_percentage with clamping to prevent overflow
    -- Use proper rounding and clamping to ensure DECIMAL(5,2) bounds
    IF v_trade_amount > 0 AND v_trade_amount IS NOT NULL THEN
      v_raw_pnl_percentage := (v_total_pnl / v_trade_amount) * 100;
      -- Round to 2 decimal places, then clamp to DECIMAL(5,2) bounds: -999.99 to 999.99
      v_raw_pnl_percentage := ROUND(v_raw_pnl_percentage, 2);
      v_raw_pnl_percentage := GREATEST(-999.99, LEAST(999.99, v_raw_pnl_percentage));
      -- Cast to DECIMAL(5,2) to ensure it fits
      v_pnl_percentage := v_raw_pnl_percentage::DECIMAL(5,2);
    ELSE
      v_pnl_percentage := 0;
    END IF;
    
    -- Update bot metrics
    UPDATE trading_bots
    SET 
      total_trades = v_total_trades,
      pnl = v_total_pnl,
      pnl_percentage = v_pnl_percentage,
      win_rate = v_win_rate,
      updated_at = NOW()
    WHERE id = v_bot_id;
    
    -- Also update the trades table if trade_id exists
    -- CRITICAL: Do NOT include exit_price - it doesn't exist in trades table
    -- Only trading_positions table has exit_price column
    -- updated_at is handled by trigger if it exists
    IF NEW.trade_id IS NOT NULL THEN
      UPDATE trades
      SET 
        pnl = NEW.realized_pnl,
        fee = NEW.fees,
        status = 'closed'
      WHERE id = NEW.trade_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS trigger_update_bot_metrics_on_position_close ON trading_positions;
CREATE TRIGGER trigger_update_bot_metrics_on_position_close
  AFTER UPDATE OF status ON trading_positions
  FOR EACH ROW
  WHEN (NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status = 'open'))
  EXECUTE FUNCTION update_bot_metrics_on_position_close();

-- Add comment for documentation
COMMENT ON FUNCTION update_bot_metrics_on_position_close() IS 
'Updates bot metrics and trades table when a position is closed. Does NOT update trades.exit_price as that column does not exist in the trades table.';

