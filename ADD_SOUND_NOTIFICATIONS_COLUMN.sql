-- Add sound_notifications_enabled column to trading_bots table
-- This allows each bot to have individual sound notification settings

ALTER TABLE trading_bots 
ADD COLUMN IF NOT EXISTS sound_notifications_enabled BOOLEAN DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN trading_bots.sound_notifications_enabled IS 'Enable/disable sound notifications for real trades executed by this bot';

-- Update existing bots to have sound notifications disabled by default (users can enable per bot)
UPDATE trading_bots 
SET sound_notifications_enabled = false 
WHERE sound_notifications_enabled IS NULL;

