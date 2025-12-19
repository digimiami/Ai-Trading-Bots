-- Trading Positions Tracking Migration
-- Migration: 20250128_add_trading_positions_tracking.sql
-- Tracks all open/close positions for real trading and updates metrics

-- Create trading_positions table for real trading positions
CREATE TABLE IF NOT EXISTS trading_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES trading_bots(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  exchange TEXT NOT NULL,
  trading_type TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long', 'short', 'buy', 'sell')),
  entry_price DECIMAL NOT NULL,
  exit_price DECIMAL,
  quantity DECIMAL NOT NULL,
  leverage INTEGER DEFAULT 1,
  stop_loss_price DECIMAL,
  take_profit_price DECIMAL,
  current_price DECIMAL,
  unrealized_pnl DECIMAL DEFAULT 0,
  realized_pnl DECIMAL DEFAULT 0,
  margin_used DECIMAL,
  fees DECIMAL DEFAULT 0,
  entry_fees DECIMAL DEFAULT 0,
  exit_fees DECIMAL DEFAULT 0,
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'stopped', 'taken_profit', 'manual_close', 'liquidated')),
  close_reason TEXT,
  exchange_position_id TEXT, -- Exchange's position ID for syncing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trading_positions_bot ON trading_positions(bot_id);
CREATE INDEX IF NOT EXISTS idx_trading_positions_user ON trading_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_positions_status ON trading_positions(status);
CREATE INDEX IF NOT EXISTS idx_trading_positions_symbol ON trading_positions(symbol);
CREATE INDEX IF NOT EXISTS idx_trading_positions_exchange ON trading_positions(exchange);
CREATE INDEX IF NOT EXISTS idx_trading_positions_trade ON trading_positions(trade_id);
CREATE INDEX IF NOT EXISTS idx_trading_positions_exchange_id ON trading_positions(exchange_position_id);

-- Function to update bot metrics when position closes
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
    -- FIX: Changed peak.running_pnl to peak.peak
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
    IF v_trade_amount > 0 THEN
      v_pnl_percentage := (v_total_pnl / v_trade_amount) * 100;
      -- Clamp to DECIMAL(5,2) bounds: -999.99 to 999.99
      v_pnl_percentage := GREATEST(-999.99, LEAST(999.99, v_pnl_percentage));
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
    -- FIX: Changed fees to fee (singular)
    IF NEW.trade_id IS NOT NULL THEN
      UPDATE trades
      SET 
        pnl = NEW.realized_pnl,
        fee = NEW.fees,
        exit_price = NEW.exit_price,
        status = 'closed',
        updated_at = NOW()
      WHERE id = NEW.trade_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update metrics on position close
DROP TRIGGER IF EXISTS trigger_update_bot_metrics_on_position_close ON trading_positions;
CREATE TRIGGER trigger_update_bot_metrics_on_position_close
  AFTER UPDATE OF status ON trading_positions
  FOR EACH ROW
  WHEN (NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status = 'open'))
  EXECUTE FUNCTION update_bot_metrics_on_position_close();

-- Function to sync positions from exchange
CREATE OR REPLACE FUNCTION sync_positions_from_exchange(
  p_bot_id UUID,
  p_exchange TEXT,
  p_symbol TEXT,
  p_trading_type TEXT
)
RETURNS TABLE (
  position_id UUID,
  symbol TEXT,
  side TEXT,
  size DECIMAL,
  entry_price DECIMAL,
  current_price DECIMAL,
  unrealized_pnl DECIMAL,
  status TEXT
) AS $$
BEGIN
  -- This function will be called by the bot-executor to sync positions
  -- Returns positions that need to be created or updated
  RETURN QUERY
  SELECT 
    tp.id as position_id,
    tp.symbol,
    tp.side,
    tp.quantity as size,
    tp.entry_price,
    tp.current_price,
    tp.unrealized_pnl,
    tp.status
  FROM trading_positions tp
  WHERE tp.bot_id = p_bot_id
    AND tp.exchange = p_exchange
    AND tp.symbol = p_symbol
    AND tp.trading_type = p_trading_type
    AND tp.status = 'open';
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies
ALTER TABLE trading_positions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Users can view their own positions" ON trading_positions;
DROP POLICY IF EXISTS "Users can insert their own positions" ON trading_positions;
DROP POLICY IF EXISTS "Users can update their own positions" ON trading_positions;

CREATE POLICY "Users can view their own positions"
  ON trading_positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own positions"
  ON trading_positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own positions"
  ON trading_positions FOR UPDATE
  USING (auth.uid() = user_id);
