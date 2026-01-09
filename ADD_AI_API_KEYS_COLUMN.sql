-- =====================================================
-- ADD AI API KEYS COLUMN TO USER_SETTINGS TABLE
-- =====================================================
-- This migration adds a column to store AI API keys (OpenAI/DeepSeek)
-- in the database so they persist across devices/browsers
-- 
-- INSTRUCTIONS: Copy and paste this entire file into Supabase SQL Editor and run it

-- Add ai_api_keys column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_settings' 
        AND column_name = 'ai_api_keys'
    ) THEN
        ALTER TABLE user_settings 
        ADD COLUMN ai_api_keys JSONB DEFAULT '{
            "openai": null,
            "deepseek": null,
            "provider_preference": "deepseek"
        }'::jsonb;
        
        -- Create index for faster queries
        CREATE INDEX IF NOT EXISTS idx_user_settings_ai_api_keys 
        ON user_settings USING gin (ai_api_keys);
        
        RAISE NOTICE 'Added ai_api_keys column to user_settings table';
    ELSE
        RAISE NOTICE 'ai_api_keys column already exists in user_settings table';
    END IF;
END $$;
