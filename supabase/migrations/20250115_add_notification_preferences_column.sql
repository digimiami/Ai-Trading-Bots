-- Add notification_preferences column to user_settings if it doesn't exist
-- This migration ensures the column exists even if the table was created without it

-- Add notification_preferences column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_settings' 
        AND column_name = 'notification_preferences'
    ) THEN
        ALTER TABLE user_settings 
        ADD COLUMN notification_preferences JSONB DEFAULT '{
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
        }'::jsonb;
        
        -- Update existing rows to have the default value if they don't have it
        UPDATE user_settings 
        SET notification_preferences = '{
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
        }'::jsonb
        WHERE notification_preferences IS NULL;
        
        RAISE NOTICE 'Added notification_preferences column to user_settings table';
    ELSE
        RAISE NOTICE 'notification_preferences column already exists in user_settings table';
    END IF;
END $$;














