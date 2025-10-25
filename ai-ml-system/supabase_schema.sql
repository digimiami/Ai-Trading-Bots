-- ============================================
-- AI/ML SYSTEM DATABASE SCHEMA
-- Creates tables for AI/ML trading system
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. AI_ML_TRADES TABLE
-- Stores trade data for model training
-- ============================================

CREATE TABLE IF NOT EXISTS ai_ml_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
    ts TIMESTAMP WITH TIME ZONE NOT NULL,
    rsi DECIMAL(5,2) NOT NULL CHECK (rsi >= 0 AND rsi <= 100),
    ema_fast DECIMAL(20,8) NOT NULL CHECK (ema_fast > 0),
    ema_slow DECIMAL(20,8) NOT NULL CHECK (ema_slow > 0),
    atr DECIMAL(20,8) NOT NULL CHECK (atr >= 0),
    volume DECIMAL(20,8) NOT NULL CHECK (volume >= 0),
    pnl DECIMAL(20,8) NOT NULL,
    label BOOLEAN NOT NULL, -- true if profitable trade
    meta JSONB DEFAULT '{}',
    inserted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_ai_ml_trades_user_id ON ai_ml_trades(user_id),
    INDEX idx_ai_ml_trades_symbol ON ai_ml_trades(symbol),
    INDEX idx_ai_ml_trades_ts ON ai_ml_trades(ts),
    INDEX idx_ai_ml_trades_inserted_at ON ai_ml_trades(inserted_at),
    INDEX idx_ai_ml_trades_label ON ai_ml_trades(label)
);

-- ============================================
-- 2. AI_ML_MODELS TABLE
-- Stores model metadata and performance metrics
-- ============================================

CREATE TABLE IF NOT EXISTS ai_ml_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag VARCHAR(50) NOT NULL DEFAULT 'AI_ML_TS_MODEL_V1',
    version VARCHAR(20) NOT NULL,
    storage_path TEXT NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Indexes for performance
    INDEX idx_ai_ml_models_tag ON ai_ml_models(tag),
    INDEX idx_ai_ml_models_version ON ai_ml_models(version),
    INDEX idx_ai_ml_models_created_at ON ai_ml_models(created_at),
    INDEX idx_ai_ml_models_created_by ON ai_ml_models(created_by),
    
    -- Unique constraint for tag + version
    UNIQUE(tag, version)
);

-- ============================================
-- 3. AI_ML_PREDICTIONS TABLE
-- Stores model predictions and outcomes
-- ============================================

CREATE TABLE IF NOT EXISTS ai_ml_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES ai_ml_models(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    ts TIMESTAMP WITH TIME ZONE NOT NULL,
    features JSONB NOT NULL DEFAULT '{}',
    signal VARCHAR(10) NOT NULL CHECK (signal IN ('BUY', 'SELL', 'HOLD')),
    confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    outcome BOOLEAN, -- filled after trade completion
    pnl DECIMAL(20,8), -- filled after trade completion
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_ai_ml_predictions_model_id ON ai_ml_predictions(model_id),
    INDEX idx_ai_ml_predictions_symbol ON ai_ml_predictions(symbol),
    INDEX idx_ai_ml_predictions_ts ON ai_ml_predictions(ts),
    INDEX idx_ai_ml_predictions_signal ON ai_ml_predictions(signal),
    INDEX idx_ai_ml_predictions_confidence ON ai_ml_predictions(confidence),
    INDEX idx_ai_ml_predictions_outcome ON ai_ml_predictions(outcome),
    INDEX idx_ai_ml_predictions_created_at ON ai_ml_predictions(created_at)
);

-- ============================================
-- 4. AI_ML_METRICS TABLE
-- Stores detailed metrics over time
-- ============================================

CREATE TABLE IF NOT EXISTS ai_ml_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES ai_ml_models(id) ON DELETE CASCADE,
    metric_name VARCHAR(50) NOT NULL,
    metric_value DECIMAL(20,8) NOT NULL,
    ts TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_ai_ml_metrics_model_id ON ai_ml_metrics(model_id),
    INDEX idx_ai_ml_metrics_name ON ai_ml_metrics(metric_name),
    INDEX idx_ai_ml_metrics_ts ON ai_ml_metrics(ts),
    INDEX idx_ai_ml_metrics_value ON ai_ml_metrics(metric_value)
);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE ai_ml_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ml_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ml_metrics ENABLE ROW LEVEL SECURITY;

-- AI_ML_TRADES policies
CREATE POLICY "Users can read their own trade data" ON ai_ml_trades
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trade data" ON ai_ml_trades
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all trade data" ON ai_ml_trades
    FOR ALL USING (auth.role() = 'service_role');

-- AI_ML_MODELS policies
CREATE POLICY "Users can read all models" ON ai_ml_models
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage all models" ON ai_ml_models
    FOR ALL USING (auth.role() = 'service_role');

-- AI_ML_PREDICTIONS policies
CREATE POLICY "Users can read all predictions" ON ai_ml_predictions
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage all predictions" ON ai_ml_predictions
    FOR ALL USING (auth.role() = 'service_role');

-- AI_ML_METRICS policies
CREATE POLICY "Users can read all metrics" ON ai_ml_metrics
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage all metrics" ON ai_ml_metrics
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- STORAGE BUCKET CREATION
-- ============================================

-- Create storage bucket for AI/ML models
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-ml-models', 'ai-ml-models', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for ai-ml-models bucket
CREATE POLICY "Service role can manage AI/ML models" ON storage.objects
    FOR ALL USING (
        bucket_id = 'ai-ml-models' AND 
        auth.role() = 'service_role'
    );

CREATE POLICY "Users can read AI/ML models" ON storage.objects
    FOR SELECT USING (bucket_id = 'ai-ml-models');

-- ============================================
-- HELPFUL VIEWS
-- ============================================

-- View for latest model metrics
CREATE OR REPLACE VIEW latest_model_metrics AS
SELECT 
    m.id,
    m.tag,
    m.version,
    m.created_at,
    m.metrics->>'accuracy' as accuracy,
    m.metrics->>'precision' as precision,
    m.metrics->>'recall' as recall,
    m.metrics->>'f1Score' as f1_score,
    m.metrics->>'auc' as auc
FROM ai_ml_models m
WHERE m.created_at = (
    SELECT MAX(created_at) 
    FROM ai_ml_models 
    WHERE tag = m.tag
);

-- View for recent predictions with outcomes
CREATE OR REPLACE VIEW recent_predictions_with_outcomes AS
SELECT 
    p.id,
    p.symbol,
    p.signal,
    p.confidence,
    p.ts,
    p.outcome,
    p.pnl,
    p.created_at,
    m.version as model_version
FROM ai_ml_predictions p
JOIN ai_ml_models m ON p.model_id = m.id
WHERE p.created_at >= NOW() - INTERVAL '7 days'
ORDER BY p.created_at DESC;

-- View for model performance summary
CREATE OR REPLACE VIEW model_performance_summary AS
SELECT 
    m.id as model_id,
    m.tag,
    m.version,
    m.created_at,
    COUNT(p.id) as total_predictions,
    COUNT(CASE WHEN p.outcome = true THEN 1 END) as profitable_predictions,
    COUNT(CASE WHEN p.outcome = false THEN 1 END) as losing_predictions,
    AVG(p.confidence) as avg_confidence,
    AVG(CASE WHEN p.pnl IS NOT NULL THEN p.pnl END) as avg_pnl,
    SUM(CASE WHEN p.pnl IS NOT NULL THEN p.pnl END) as total_pnl
FROM ai_ml_models m
LEFT JOIN ai_ml_predictions p ON m.id = p.model_id
GROUP BY m.id, m.tag, m.version, m.created_at
ORDER BY m.created_at DESC;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE ai_ml_trades IS 'Stores trade data with technical indicators for ML model training';
COMMENT ON TABLE ai_ml_models IS 'Stores AI/ML model metadata and performance metrics';
COMMENT ON TABLE ai_ml_predictions IS 'Stores model predictions and their outcomes';
COMMENT ON TABLE ai_ml_metrics IS 'Stores detailed metrics over time for model monitoring';

COMMENT ON COLUMN ai_ml_trades.label IS 'Boolean indicating if the trade was profitable (true) or not (false)';
COMMENT ON COLUMN ai_ml_trades.meta IS 'Additional metadata about the trade';
COMMENT ON COLUMN ai_ml_models.metrics IS 'JSON object containing accuracy, precision, recall, F1 score, AUC, and confusion matrix';
COMMENT ON COLUMN ai_ml_predictions.features IS 'JSON object containing RSI, EMA fast/slow, ATR, volume, and EMA diff';
COMMENT ON COLUMN ai_ml_predictions.outcome IS 'Boolean indicating if the prediction was correct (filled after trade completion)';
COMMENT ON COLUMN ai_ml_metrics.metric_name IS 'Name of the metric (e.g., accuracy, precision, live_win_rate, avg_pnl)';
COMMENT ON COLUMN ai_ml_metrics.metric_value IS 'Value of the metric at the given timestamp';
