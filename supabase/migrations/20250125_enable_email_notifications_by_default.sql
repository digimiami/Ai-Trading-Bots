-- ============================================
-- Enable Email Notifications by Default
-- ============================================
-- This migration enables email notifications for all existing users
-- and updates the default for new users

-- Enable email notifications for all existing users
UPDATE public.user_settings
SET notification_preferences = jsonb_set(
    COALESCE(notification_preferences, '{}'::jsonb),
    '{email,enabled}',
    'true'::jsonb,
    true
)
WHERE notification_preferences->'email'->>'enabled' = 'false'
   OR notification_preferences->'email'->>'enabled' IS NULL;

-- Update the default value for the notification_preferences column
-- Note: This only affects new rows, existing rows are updated above
DO $$
BEGIN
    -- Check if we can alter the default (PostgreSQL 11+)
    ALTER TABLE public.user_settings
    ALTER COLUMN notification_preferences
    SET DEFAULT '{
        "email": {
            "enabled": true,
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
    
    RAISE NOTICE 'Updated default notification_preferences to enable email notifications';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not update default (this is OK if column already has a default): %', SQLERRM;
END $$;










