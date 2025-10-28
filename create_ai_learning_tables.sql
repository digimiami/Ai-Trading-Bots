-- Create AI learning and optimization tables
-- Run this in Supabase SQL Editor

-- Table for storing AI analysis and recommendations
CREATE TABLE IF NOT EXISTS bot_ai_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES trading_bots(id) ON DELETE CASCADE,
    analysis_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Performance snapshot at time of analysis
    performance_data JSONB NOT NULL,
    
    -- AI Recommendations
    recommendations JSONB,
    
    -- Optimization suggestions
    suggested_parameters JSONB,
    
    -- AI Quality Metrics
    ai_confidence DECIMAL(5,2) DEFAULT 0,
    expected_improvement TEXT,
    risk_assessment TEXT,
    
    -- Status
    applied BOOLEAN DEFAULT false,
    applied_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing AI learning from trades
CREATE TABLE IF NOT EXISTS ai_learning_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID REFERENCES trading_bots(id) ON DELETE CASCADE,
    
    -- Trade context
    trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    
    -- Market conditions at trade entry
    market_conditions JSONB NOT NULL,
    
    -- Trade outcome
    outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss')),
    pnl DECIMAL(15,2),
    
    -- What the AI predicted vs actual
    ai_prediction JSONB,
    prediction_accuracy DECIMAL(5,2),
    
    -- Learning insights
    lessons_learned TEXT,
    improvement_suggestions JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for tracking strategy optimizations
CREATE TABLE IF NOT EXISTS strategy_optimizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID REFERENCES trading_bots(id) ON DELETE CASCADE,
    
    -- Original strategy
    original_strategy JSONB NOT NULL,
    
    -- AI-suggested changes
    suggested_changes JSONB NOT NULL,
    
    -- Optimization reasons
    reasoning TEXT,
    expected_improvement DECIMAL(5,2),
    
    -- Performance before optimization
    performance_before JSONB,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected', 'testing')),
    
    -- If applied, track results
    applied_at TIMESTAMP WITH TIME ZONE,
    performance_after JSONB,
    improvement_realized DECIMAL(5,2),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE bot_ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_learning_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_optimizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own AI analysis" ON bot_ai_analysis;
DROP POLICY IF EXISTS "Users can insert their own AI analysis" ON bot_ai_analysis;
DROP POLICY IF EXISTS "Users can update their own AI analysis" ON bot_ai_analysis;

DROP POLICY IF EXISTS "Users can view their own learning data" ON ai_learning_data;
DROP POLICY IF EXISTS "Users can insert their own learning data" ON ai_learning_data;

DROP POLICY IF EXISTS "Users can view their own optimizations" ON strategy_optimizations;
DROP POLICY IF EXISTS "Users can insert their own optimizations" ON strategy_optimizations;
DROP POLICY IF EXISTS "Users can update their own optimizations" ON strategy_optimizations;

-- RLS Policies for bot_ai_analysis
CREATE POLICY "Users can view their own AI analysis" ON bot_ai_analysis
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM trading_bots 
            WHERE trading_bots.id = bot_ai_analysis.bot_id 
            AND trading_bots.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own AI analysis" ON bot_ai_analysis
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM trading_bots 
            WHERE trading_bots.id = bot_ai_analysis.bot_id 
            AND trading_bots.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own AI analysis" ON bot_ai_analysis
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM trading_bots 
            WHERE trading_bots.id = bot_ai_analysis.bot_id 
            AND trading_bots.user_id = auth.uid()
        )
    );

-- RLS Policies for ai_learning_data
CREATE POLICY "Users can view their own learning data" ON ai_learning_data
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM trading_bots 
            WHERE trading_bots.id = ai_learning_data.bot_id 
            AND trading_bots.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own learning data" ON ai_learning_data
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM trading_bots 
            WHERE trading_bots.id = ai_learning_data.bot_id 
            AND trading_bots.user_id = auth.uid()
        )
    );

-- RLS Policies for strategy_optimizations
CREATE POLICY "Users can view their own optimizations" ON strategy_optimizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM trading_bots 
            WHERE trading_bots.id = strategy_optimizations.bot_id 
            AND trading_bots.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own optimizations" ON strategy_optimizations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM trading_bots 
            WHERE trading_bots.id = strategy_optimizations.bot_id 
            AND trading_bots.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own optimizations" ON strategy_optimizations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM trading_bots 
            WHERE trading_bots.id = strategy_optimizations.bot_id 
            AND trading_bots.user_id = auth.uid()
        )
    );

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bot_ai_analysis_bot_id ON bot_ai_analysis(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_ai_analysis_applied ON bot_ai_analysis(applied);
CREATE INDEX IF NOT EXISTS idx_bot_ai_analysis_created_at ON bot_ai_analysis(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_learning_bot_id ON ai_learning_data(bot_id);
CREATE INDEX IF NOT EXISTS idx_ai_learning_trade_id ON ai_learning_data(trade_id);
CREATE INDEX IF NOT EXISTS idx_ai_learning_created_at ON ai_learning_data(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_optimizations_bot_id ON strategy_optimizations(bot_id);
CREATE INDEX IF NOT EXISTS idx_optimizations_status ON strategy_optimizations(status);
CREATE INDEX IF NOT EXISTS idx_optimizations_created_at ON strategy_optimizations(created_at DESC);

-- Function to auto-update updated_at
CREATE TRIGGER update_optimizations_updated_at BEFORE UPDATE ON strategy_optimizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

