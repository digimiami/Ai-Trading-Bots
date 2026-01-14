-- Enhance ML Performance Tracking
-- Adds columns for trade outcomes and PnL tracking

-- Add trade_pnl and trade_result columns to ml_predictions if they don't exist
DO $$ 
BEGIN
    ALTER TABLE ml_predictions ADD COLUMN IF NOT EXISTS trade_pnl DECIMAL(20,8);
    ALTER TABLE ml_predictions ADD COLUMN IF NOT EXISTS trade_result VARCHAR(20) CHECK (trade_result IN ('profit', 'loss', 'breakeven', null));
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- Add index for performance queries
CREATE INDEX IF NOT EXISTS idx_ml_predictions_outcome ON ml_predictions(actual_outcome) WHERE actual_outcome IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ml_predictions_pnl ON ml_predictions(trade_pnl) WHERE trade_pnl IS NOT NULL;

-- Create view for ML performance summary
CREATE OR REPLACE VIEW ml_performance_summary AS
SELECT 
    user_id,
    bot_id,
    symbol,
    COUNT(*) as total_predictions,
    COUNT(actual_outcome) as predictions_with_outcome,
    COUNT(CASE WHEN prediction = actual_outcome THEN 1 END) as correct_predictions,
    ROUND(
        COUNT(CASE WHEN prediction = actual_outcome THEN 1 END)::numeric / 
        NULLIF(COUNT(actual_outcome), 0)::numeric * 100, 
        2
    ) as accuracy_percent,
    AVG(confidence) as avg_confidence,
    SUM(trade_pnl) as total_pnl,
    AVG(trade_pnl) as avg_pnl,
    COUNT(CASE WHEN trade_result = 'profit' THEN 1 END) as profitable_trades,
    COUNT(CASE WHEN trade_result = 'loss' THEN 1 END) as losing_trades,
    MAX(timestamp) as last_prediction
FROM ml_predictions
WHERE actual_outcome IS NOT NULL
GROUP BY user_id, bot_id, symbol;

-- Grant access to view
GRANT SELECT ON ml_performance_summary TO authenticated;

-- Add comment
COMMENT ON VIEW ml_performance_summary IS 'Summary of ML prediction performance by user, bot, and symbol';
