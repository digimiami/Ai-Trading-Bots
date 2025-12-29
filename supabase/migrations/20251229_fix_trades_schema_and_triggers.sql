-- Migration: 20251229_fix_trades_schema_and_triggers.sql
-- Description: Fixes missing updated_at column in trades table and corrects trigger reference bugs

BEGIN;

-- 1. Ensure updated_at column exists in trades table
-- This was identified as a cause for "column updated_at does not exist" errors during position sync
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'trades' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.trades ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 2. Ensure other critical columns exist in trades table for sync operations
-- amount, price, fee, executed_at are used by the sync process and transaction log view
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS amount NUMERIC(18,8),
  ADD COLUMN IF NOT EXISTS price NUMERIC(18,8),
  ADD COLUMN IF NOT EXISTS fee NUMERIC(18,8),
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS exchange_order_id TEXT,
  ADD COLUMN IF NOT EXISTS order_type TEXT;

-- 3. Ensure the universal timestamp update function exists
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the column exists on the record before attempting to set it
  -- This prevents errors if the function is accidentally attached to a table without updated_at
  BEGIN
    NEW.updated_at = NOW();
  EXCEPTION WHEN undefined_column THEN
    -- If column doesn't exist, just return NEW without modification
    RETURN NEW;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Re-attach trigger to trades table
DROP TRIGGER IF EXISTS trades_set_timestamp ON public.trades;
CREATE TRIGGER trades_set_timestamp
BEFORE UPDATE ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 5. Fix the known "peak.running_pnl" bug in the trading_positions trigger
-- This bug prevents closing positions when drawdown calculation fails due to a bad column reference
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
    v_win_rate := GREATEST(0, LEAST(100, v_win_rate));
    
    -- Calculate max drawdown from cumulative PnL
    -- This section fixed a bug where it previously referenced peak.running_pnl instead of peak.peak
    BEGIN
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
    EXCEPTION WHEN OTHERS THEN
      -- If drawdown calculation fails, don't block the whole position closure
      v_max_drawdown := 0;
      v_peak_pnl := 0;
    END;
    
    -- Get trade_amount for pnl_percentage calculation
    SELECT COALESCE(trade_amount, 0) INTO v_trade_amount
    FROM trading_bots
    WHERE id = v_bot_id;
    
    -- Calculate pnl_percentage with clamping
    IF v_trade_amount > 0 AND v_trade_amount IS NOT NULL THEN
      v_raw_pnl_percentage := (v_total_pnl / v_trade_amount) * 100;
      v_raw_pnl_percentage := ROUND(v_raw_pnl_percentage, 2);
      v_raw_pnl_percentage := GREATEST(-999.99, LEAST(999.99, v_raw_pnl_percentage));
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
    IF NEW.trade_id IS NOT NULL THEN
      UPDATE trades
      SET 
        pnl = NEW.realized_pnl,
        fee = NEW.fees,
        status = 'closed',
        updated_at = NOW()
      WHERE id = NEW.trade_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;

