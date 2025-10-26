-- Telegram Notifications System
-- Adds Telegram configuration and notification tracking

-- Create telegram_config table
CREATE TABLE IF NOT EXISTS telegram_config (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    bot_token VARCHAR(255) NOT NULL,
    chat_id VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    notifications JSONB DEFAULT '{
        "trade_executed": true,
        "bot_started": true,
        "bot_stopped": true,
        "error_occurred": true,
        "daily_summary": true,
        "profit_alert": true,
        "loss_alert": true
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification_logs table
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    telegram_response JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_telegram_config_user_id ON telegram_config(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_config_enabled ON telegram_config(enabled);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);

-- Enable RLS
ALTER TABLE telegram_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own telegram config" ON telegram_config;
DROP POLICY IF EXISTS "Users can insert their own telegram config" ON telegram_config;
DROP POLICY IF EXISTS "Users can update their own telegram config" ON telegram_config;
DROP POLICY IF EXISTS "Users can view their own notification logs" ON notification_logs;
DROP POLICY IF EXISTS "Users can insert their own notification logs" ON notification_logs;

-- Create RLS policies
CREATE POLICY "Users can view their own telegram config" ON telegram_config
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own telegram config" ON telegram_config
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own telegram config" ON telegram_config
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own notification logs" ON notification_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification logs" ON notification_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON telegram_config TO authenticated;
GRANT ALL ON notification_logs TO authenticated;

-- Create function to send notification
CREATE OR REPLACE FUNCTION queue_telegram_notification(
    p_user_id UUID,
    p_type VARCHAR,
    p_message TEXT
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    -- Check if user has Telegram enabled
    IF EXISTS (
        SELECT 1 FROM telegram_config 
        WHERE user_id = p_user_id 
        AND enabled = true
        AND (notifications->p_type)::boolean = true
    ) THEN
        -- Insert notification log
        INSERT INTO notification_logs (user_id, notification_type, message, status)
        VALUES (p_user_id, p_type, p_message, 'pending')
        RETURNING id INTO v_notification_id;
        
        RETURN v_notification_id;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create view for notification stats
CREATE OR REPLACE VIEW notification_stats AS
SELECT 
    user_id,
    COUNT(*) as total_notifications,
    COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
    MAX(sent_at) as last_notification_sent
FROM notification_logs
GROUP BY user_id;

GRANT SELECT ON notification_stats TO authenticated;

SELECT 'Telegram notifications system created successfully!' as status;

