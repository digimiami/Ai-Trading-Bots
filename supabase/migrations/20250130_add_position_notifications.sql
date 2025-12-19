-- Add position_open and position_close to default Telegram notifications
-- Migration: 20250130_add_position_notifications.sql

-- Update default notifications to include position_open and position_close
-- This will only affect new users (existing users keep their current settings)
ALTER TABLE telegram_config 
ALTER COLUMN notifications SET DEFAULT '{
    "trade_executed": true,
    "position_open": true,
    "position_close": true,
    "bot_started": true,
    "bot_stopped": true,
    "error_occurred": true,
    "daily_summary": true,
    "profit_alert": true,
    "loss_alert": true,
    "paper_trade_notifications": true
}'::jsonb;

-- Update existing users to include position_open and position_close if not already set
-- This merges with existing notification preferences
UPDATE telegram_config
SET notifications = COALESCE(notifications, '{}'::jsonb) || '{
    "position_open": true,
    "position_close": true
}'::jsonb
WHERE notifications IS NULL 
   OR (notifications->>'position_open') IS NULL
   OR (notifications->>'position_close') IS NULL;

-- Ensure paper_trade_notifications is also set for existing users
UPDATE telegram_config
SET notifications = COALESCE(notifications, '{}'::jsonb) || '{
    "paper_trade_notifications": true
}'::jsonb
WHERE notifications IS NULL 
   OR (notifications->>'paper_trade_notifications') IS NULL;

SELECT 'Position notifications added to Telegram config!' as status;
