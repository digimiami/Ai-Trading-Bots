-- ============================================
-- CHECK ADMIN FUNCTION REQUIREMENTS
-- Verify all required tables exist for admin functionality
-- ============================================

-- Check if invitation_codes table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'invitation_codes'
) as invitation_codes_exists;

-- Check if alerts table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'alerts'
) as alerts_exists;

-- Check if bot_activity_logs table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'bot_activity_logs'
) as bot_activity_logs_exists;

-- Show all tables in public schema
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

