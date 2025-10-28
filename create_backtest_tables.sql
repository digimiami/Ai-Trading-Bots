-- Create backtesting tables for multiple pairs testing
-- Run this in Supabase SQL Editor

-- Table for storing backtest requests and results
CREATE TABLE IF NOT EXISTS backtests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bot_id UUID REFERENCES trading_bots(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    strategy JSONB NOT NULL,
    strategy_config JSONB,
    
    -- Trading pairs being tested
    symbols JSONB NOT NULL DEFAULT '[]'::jsonb,
    custom_pairs TEXT,
    
    -- Configuration
    exchange TEXT NOT NULL CHECK (exchange IN ('bybit', 'okx')),
    trading_type TEXT NOT NULL DEFAULT 'spot' CHECK (trading_type IN ('spot', 'futures')),
    timeframe TEXT NOT NULL DEFAULT '1h',
    leverage INTEGER DEFAULT 1,
    risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
    trade_amount DECIMAL(15,2) DEFAULT 100,
    stop_loss DECIMAL(5,2) DEFAULT 2.0,
    take_profit DECIMAL(5,2) DEFAULT 4.0,
    
    -- Date range for backtesting
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Results summary (aggregated across all pairs)
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0,
    total_pnl DECIMAL(15,2) DEFAULT 0,
    total_pnl_percentage DECIMAL(5,2) DEFAULT 0,
    max_drawdown DECIMAL(5,2) DEFAULT 0,
    sharpe_ratio DECIMAL(5,2) DEFAULT 0,
    profit_factor DECIMAL(5,2) DEFAULT 0,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    progress INTEGER DEFAULT 0, -- 0-100
    
    -- Results per pair (detailed breakdown)
    results_per_pair JSONB,
    
    -- Error information
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE backtests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own backtests" ON backtests;
DROP POLICY IF EXISTS "Users can insert their own backtests" ON backtests;
DROP POLICY IF EXISTS "Users can update their own backtests" ON backtests;
DROP POLICY IF EXISTS "Users can delete their own backtests" ON backtests;

-- RLS Policies for backtests table
CREATE POLICY "Users can view their own backtests" ON backtests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own backtests" ON backtests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own backtests" ON backtests
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own backtests" ON backtests
    FOR DELETE USING (auth.uid() = user_id);

-- Table for storing individual backtest trades
CREATE TABLE IF NOT EXISTS backtest_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backtest_id UUID NOT NULL REFERENCES backtests(id) ON DELETE CASCADE,
    
    -- Trade details
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell', 'long', 'short')),
    entry_price DECIMAL(15,8) NOT NULL,
    exit_price DECIMAL(15,8),
    size DECIMAL(15,8) NOT NULL,
    pnl DECIMAL(15,2),
    pnl_percentage DECIMAL(5,2),
    fee DECIMAL(15,2),
    
    -- Time details
    entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
    exit_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'stopped')),
    
    -- Indicators at entry
    entry_rsi DECIMAL(5,2),
    entry_adx DECIMAL(5,2),
    entry_bb_width DECIMAL(10,6),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE backtest_trades ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can view their own backtest trades" ON backtest_trades;

-- RLS Policies for backtest_trades
CREATE POLICY "Users can view their own backtest trades" ON backtest_trades
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM backtests 
            WHERE backtests.id = backtest_trades.backtest_id 
            AND backtests.user_id = auth.uid()
        )
    );

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_backtests_user_id ON backtests(user_id);
CREATE INDEX IF NOT EXISTS idx_backtests_status ON backtests(status);
CREATE INDEX IF NOT EXISTS idx_backtests_created_at ON backtests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_backtest_trades_backtest_id ON backtest_trades(backtest_id);
CREATE INDEX IF NOT EXISTS idx_backtest_trades_symbol ON backtest_trades(symbol);
CREATE INDEX IF NOT EXISTS idx_backtest_trades_entry_time ON backtest_trades(entry_time);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_backtests_updated_at ON backtests;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_backtests_updated_at BEFORE UPDATE ON backtests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

