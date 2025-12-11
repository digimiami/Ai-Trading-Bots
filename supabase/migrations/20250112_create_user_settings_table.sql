-- =====================================================
-- USER SETTINGS TABLE FOR NOTIFICATIONS
-- =====================================================
-- This script creates the user_settings table to store
-- user preferences for notifications, alerts, and other settings

-- Create user_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    notification_preferences JSONB DEFAULT '{
        "email": {
            "enabled": false,
            "trade_executed": true,
            "bot_started": true,
            "bot_stopped": true,
            "error_occurred": true,
            "daily_summary": true,
            "profit_alert": true,
            "loss_alert": true,
            "position_opened": true,
            "position_closed": true,
            "stop_loss_triggered": true,
            "take_profit_triggered": true
        },
        "push": {
            "enabled": true,
            "trade_executed": true,
            "bot_started": true,
            "bot_stopped": true,
            "error_occurred": true
        }
    }'::jsonb,
    alert_settings JSONB DEFAULT '{
        "emailAlerts": true,
        "pushAlerts": true,
        "webhookAlerts": false,
        "newTradeAlert": true,
        "closePositionAlert": true,
        "profitAlert": true,
        "profitThreshold": 5,
        "lossAlert": true,
        "lossThreshold": 5,
        "lowBalanceAlert": true,
        "lowBalanceThreshold": 100,
        "liquidationAlert": true,
        "liquidationThreshold": 80,
        "dailyPnlAlert": true,
        "weeklyPnlAlert": false,
        "monthlyPnlAlert": true
    }'::jsonb,
    risk_settings JSONB DEFAULT '{
        "maxDailyLoss": 500,
        "maxPositionSize": 1000,
        "stopLossPercentage": 5,
        "takeProfitPercentage": 10,
        "maxOpenPositions": 5,
        "riskPerTrade": 2,
        "autoStopTrading": true,
        "emergencyStopLoss": 20
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
DROP POLICY IF EXISTS "Admins can view all settings" ON user_settings;

-- Create RLS policies
CREATE POLICY "Users can view their own settings" ON user_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" ON user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON user_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all settings" ON user_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_user_settings_updated_at ON user_settings;
CREATE TRIGGER trigger_update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_user_settings_updated_at();

-- Grant permissions
GRANT ALL ON user_settings TO authenticated;
