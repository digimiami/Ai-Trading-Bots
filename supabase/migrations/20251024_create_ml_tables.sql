-- AI/ML Dashboard Database Setup
-- This script creates all necessary tables for AI/ML functionality

-- Create ML predictions table
CREATE TABLE IF NOT EXISTS ml_predictions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bot_id UUID REFERENCES trading_bots(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    prediction VARCHAR(10) NOT NULL CHECK (prediction IN ('buy', 'sell', 'hold')),
    confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    features JSONB NOT NULL,
    actual_outcome VARCHAR(10) CHECK (actual_outcome IN ('buy', 'sell', 'hold')),
    outcome_confidence DECIMAL(5,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create AI performance tracking table
CREATE TABLE IF NOT EXISTS ai_performance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    strategy VARCHAR(50) NOT NULL,
    accuracy DECIMAL(5,4) NOT NULL,
    total_trades INTEGER NOT NULL DEFAULT 0,
    profitable_trades INTEGER NOT NULL DEFAULT 0,
    avg_profit DECIMAL(15,8) NOT NULL DEFAULT 0,
    sharpe_ratio DECIMAL(8,4) NOT NULL DEFAULT 0,
    max_drawdown DECIMAL(5,4) NOT NULL DEFAULT 0,
    win_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ML model configurations table
CREATE TABLE IF NOT EXISTS ml_model_configs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    model_name VARCHAR(100) NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    parameters JSONB NOT NULL,
    training_data_size INTEGER NOT NULL DEFAULT 0,
    last_trained TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    performance_metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add ML columns to trading_bots table if they don't exist
DO $$ 
BEGIN
    ALTER TABLE trading_bots ADD COLUMN IF NOT EXISTS use_ml BOOLEAN DEFAULT false;
    ALTER TABLE trading_bots ADD COLUMN IF NOT EXISTS ml_accuracy DECIMAL(5,4) DEFAULT 0.0;
    ALTER TABLE trading_bots ADD COLUMN IF NOT EXISTS ml_confidence_threshold DECIMAL(5,4) DEFAULT 0.6;
    ALTER TABLE trading_bots ADD COLUMN IF NOT EXISTS ml_features JSONB DEFAULT '{}';
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ml_predictions_user_id ON ml_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_symbol ON ml_predictions(symbol);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_timestamp ON ml_predictions(timestamp);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_bot_id ON ml_predictions(bot_id);
CREATE INDEX IF NOT EXISTS idx_ai_performance_user_id ON ai_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_performance_strategy ON ai_performance(strategy);
CREATE INDEX IF NOT EXISTS idx_ml_model_configs_user_id ON ml_model_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_ml_model_configs_active ON ml_model_configs(is_active);

-- Enable RLS
ALTER TABLE ml_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_model_configs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own ML predictions" ON ml_predictions;
DROP POLICY IF EXISTS "Users can insert their own ML predictions" ON ml_predictions;
DROP POLICY IF EXISTS "Users can update their own ML predictions" ON ml_predictions;
DROP POLICY IF EXISTS "Users can view their own AI performance" ON ai_performance;
DROP POLICY IF EXISTS "Users can insert their own AI performance" ON ai_performance;
DROP POLICY IF EXISTS "Users can update their own AI performance" ON ai_performance;
DROP POLICY IF EXISTS "Users can view their own ML model configs" ON ml_model_configs;
DROP POLICY IF EXISTS "Users can insert their own ML model configs" ON ml_model_configs;
DROP POLICY IF EXISTS "Users can update their own ML model configs" ON ml_model_configs;

-- Create RLS policies
CREATE POLICY "Users can view their own ML predictions" ON ml_predictions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ML predictions" ON ml_predictions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ML predictions" ON ml_predictions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own AI performance" ON ai_performance
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI performance" ON ai_performance
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI performance" ON ai_performance
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own ML model configs" ON ml_model_configs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ML model configs" ON ml_model_configs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ML model configs" ON ml_model_configs
    FOR UPDATE USING (auth.uid() = user_id);

-- Create view for ML dashboard summary
CREATE OR REPLACE VIEW ml_dashboard_summary AS
SELECT 
    u.id as user_id,
    COUNT(DISTINCT mp.id) as total_predictions,
    COUNT(DISTINCT mp.symbol) as symbols_tracked,
    AVG(mp.confidence) as avg_confidence,
    COUNT(DISTINCT ap.strategy) as active_strategies,
    AVG(ap.accuracy) as avg_strategy_accuracy,
    SUM(ap.total_trades) as total_ml_trades,
    SUM(ap.profitable_trades) as profitable_ml_trades,
    CASE 
        WHEN SUM(ap.total_trades) > 0 
        THEN SUM(ap.profitable_trades)::decimal / SUM(ap.total_trades)::decimal * 100
        ELSE 0 
    END as overall_success_rate
FROM auth.users u
LEFT JOIN ml_predictions mp ON u.id = mp.user_id
LEFT JOIN ai_performance ap ON u.id = ap.user_id
GROUP BY u.id;

-- Grant permissions
GRANT SELECT ON ml_dashboard_summary TO authenticated;

-- Create function to update ML accuracy
CREATE OR REPLACE FUNCTION update_ml_accuracy()
RETURNS TRIGGER AS $$
BEGIN
    -- Update bot ML accuracy when new prediction outcome is recorded
    IF NEW.actual_outcome IS NOT NULL AND OLD.actual_outcome IS NULL THEN
        UPDATE trading_bots 
        SET ml_accuracy = (
            SELECT 
                CASE 
                    WHEN COUNT(*) > 0 
                    THEN COUNT(CASE WHEN prediction = actual_outcome THEN 1 END)::decimal / COUNT(*)::decimal
                    ELSE COALESCE(ml_accuracy, 0)
                END
            FROM ml_predictions 
            WHERE bot_id = NEW.bot_id AND actual_outcome IS NOT NULL
        )
        WHERE id = NEW.bot_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_update_ml_accuracy ON ml_predictions;

-- Create trigger for ML accuracy updates
CREATE TRIGGER trigger_update_ml_accuracy
    AFTER UPDATE ON ml_predictions
    FOR EACH ROW
    EXECUTE FUNCTION update_ml_accuracy();

