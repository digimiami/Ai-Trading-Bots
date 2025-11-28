-- Pair-Based Win Rate Tracking
-- Tracks win rate per trading pair in real-time for each bot

CREATE TABLE IF NOT EXISTS bot_pair_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES trading_bots(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL,
    exchange VARCHAR(20) NOT NULL,
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0.00,
    total_pnl DECIMAL(15,8) DEFAULT 0,
    avg_pnl_per_trade DECIMAL(15,8) DEFAULT 0,
    best_trade_pnl DECIMAL(15,8) DEFAULT 0,
    worst_trade_pnl DECIMAL(15,8) DEFAULT 0,
    last_trade_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(bot_id, symbol, exchange)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bot_pair_stats_bot_id ON bot_pair_statistics(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_pair_stats_user_id ON bot_pair_statistics(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_pair_stats_symbol ON bot_pair_statistics(symbol);
CREATE INDEX IF NOT EXISTS idx_bot_pair_stats_updated ON bot_pair_statistics(updated_at DESC);

-- Enable RLS
ALTER TABLE bot_pair_statistics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own pair statistics" ON bot_pair_statistics;
CREATE POLICY "Users can view own pair statistics"
    ON bot_pair_statistics FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own pair statistics" ON bot_pair_statistics;
CREATE POLICY "Users can insert own pair statistics"
    ON bot_pair_statistics FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own pair statistics" ON bot_pair_statistics;
CREATE POLICY "Users can update own pair statistics"
    ON bot_pair_statistics FOR UPDATE
    USING (auth.uid() = user_id);

-- Function to update pair statistics when a trade closes
CREATE OR REPLACE FUNCTION update_pair_statistics()
RETURNS TRIGGER AS $$
DECLARE
    v_bot_id UUID;
    v_user_id UUID;
    v_symbol VARCHAR(50);
    v_exchange VARCHAR(20);
    v_pnl DECIMAL(15,8);
    v_is_win BOOLEAN;
BEGIN
    -- Only process closed/completed trades
    IF NEW.status NOT IN ('closed', 'completed') OR OLD.status IN ('closed', 'completed') THEN
        RETURN NEW;
    END IF;
    
    -- Get trade details
    v_bot_id := NEW.bot_id;
    v_user_id := NEW.user_id;
    v_symbol := NEW.symbol;
    v_exchange := NEW.exchange;
    v_pnl := COALESCE(NEW.pnl, 0);
    v_is_win := v_pnl > 0;
    
    -- Update or insert pair statistics
    INSERT INTO bot_pair_statistics (
        bot_id, user_id, symbol, exchange,
        total_trades, winning_trades, losing_trades,
        win_rate, total_pnl, avg_pnl_per_trade,
        best_trade_pnl, worst_trade_pnl, last_trade_at
    )
    VALUES (
        v_bot_id, v_user_id, v_symbol, v_exchange,
        1,
        CASE WHEN v_is_win THEN 1 ELSE 0 END,
        CASE WHEN NOT v_is_win THEN 1 ELSE 0 END,
        CASE WHEN v_is_win THEN 100.00 ELSE 0.00 END,
        v_pnl, v_pnl,
        CASE WHEN v_is_win THEN v_pnl ELSE 0 END,
        CASE WHEN NOT v_is_win THEN v_pnl ELSE 0 END,
        COALESCE(NEW.executed_at, NEW.closed_at, NOW())
    )
    ON CONFLICT (bot_id, symbol, exchange) 
    DO UPDATE SET
        total_trades = bot_pair_statistics.total_trades + 1,
        winning_trades = bot_pair_statistics.winning_trades + CASE WHEN v_is_win THEN 1 ELSE 0 END,
        losing_trades = bot_pair_statistics.losing_trades + CASE WHEN NOT v_is_win THEN 1 ELSE 0 END,
        win_rate = CASE 
            WHEN bot_pair_statistics.total_trades + 1 > 0 
            THEN ROUND((bot_pair_statistics.winning_trades + CASE WHEN v_is_win THEN 1 ELSE 0 END)::numeric / (bot_pair_statistics.total_trades + 1) * 100, 2)
            ELSE 0.00
        END,
        total_pnl = bot_pair_statistics.total_pnl + v_pnl,
        avg_pnl_per_trade = (bot_pair_statistics.total_pnl + v_pnl) / (bot_pair_statistics.total_trades + 1),
        best_trade_pnl = GREATEST(bot_pair_statistics.best_trade_pnl, CASE WHEN v_is_win THEN v_pnl ELSE bot_pair_statistics.best_trade_pnl END),
        worst_trade_pnl = LEAST(bot_pair_statistics.worst_trade_pnl, CASE WHEN NOT v_is_win THEN v_pnl ELSE bot_pair_statistics.worst_trade_pnl END),
        last_trade_at = COALESCE(NEW.executed_at, NEW.closed_at, NOW()),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for real trades
DROP TRIGGER IF EXISTS trigger_update_pair_statistics ON trades;
CREATE TRIGGER trigger_update_pair_statistics
    AFTER INSERT OR UPDATE ON trades
    FOR EACH ROW
    WHEN (NEW.status IN ('closed', 'completed'))
    EXECUTE FUNCTION update_pair_statistics();

-- Create trigger for paper trades
DROP TRIGGER IF EXISTS trigger_update_pair_statistics_paper ON paper_trading_trades;
CREATE TRIGGER trigger_update_pair_statistics_paper
    AFTER INSERT OR UPDATE ON paper_trading_trades
    FOR EACH ROW
    WHEN (NEW.status = 'closed')
    EXECUTE FUNCTION update_pair_statistics();

-- Add comment
COMMENT ON TABLE bot_pair_statistics IS 'Real-time win rate and statistics per trading pair for each bot';
COMMENT ON FUNCTION update_pair_statistics() IS 'Automatically updates pair statistics when trades close';

