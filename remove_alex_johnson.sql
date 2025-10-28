-- ============================================
-- REMOVE ALEX.JOHNSON@EMAIL.COM USER
-- Safely delete user and all related data
-- ============================================

-- Step 1: Find the user ID
DO $$
DECLARE
    user_id_to_delete UUID;
BEGIN
    -- Get the user ID
    SELECT id INTO user_id_to_delete
    FROM auth.users
    WHERE email = 'alex.johnson@email.com';

    IF user_id_to_delete IS NOT NULL THEN
        RAISE NOTICE 'Found user with ID: %', user_id_to_delete;
        
        -- Step 2: Delete related data (in order of dependencies)
        
        -- Delete trades
        DELETE FROM trades WHERE user_id = user_id_to_delete;
        RAISE NOTICE 'Deleted trades';
        
        -- Delete trading bots (CASCADE will delete bot_activity_logs automatically)
        DELETE FROM trading_bots WHERE user_id = user_id_to_delete;
        RAISE NOTICE 'Deleted trading_bots and bot_activity_logs (CASCADE)';
        
        -- Delete API keys
        DELETE FROM api_keys WHERE user_id = user_id_to_delete;
        RAISE NOTICE 'Deleted api_keys';
        
        -- Delete profiles
        DELETE FROM profiles WHERE id = user_id_to_delete;
        RAISE NOTICE 'Deleted profiles';
        
        -- Delete ML predictions (if exists)
        DELETE FROM ml_predictions WHERE user_id = user_id_to_delete;
        RAISE NOTICE 'Deleted ml_predictions';
        
        -- Delete ML training data (if exists)
        DELETE FROM ml_training_data WHERE user_id = user_id_to_delete;
        RAISE NOTICE 'Deleted ml_training_data';
        
        -- Delete telegram settings (if exists)
        DELETE FROM telegram_settings WHERE user_id = user_id_to_delete;
        RAISE NOTICE 'Deleted telegram_settings';
        
        -- Delete from users table
        DELETE FROM users WHERE id = user_id_to_delete;
        RAISE NOTICE 'Deleted from users table';
        
        -- Step 3: Delete from auth.users (Supabase authentication)
        DELETE FROM auth.users WHERE id = user_id_to_delete;
        RAISE NOTICE 'Deleted from auth.users';
        
        RAISE NOTICE 'Successfully deleted user: alex.johnson@email.com';
    ELSE
        RAISE NOTICE 'User alex.johnson@email.com not found';
    END IF;
END $$;

-- Step 4: Verify deletion
SELECT 
    'auth.users' as table_name,
    COUNT(*) as count
FROM auth.users 
WHERE email = 'alex.johnson@email.com'
UNION ALL
SELECT 
    'users' as table_name,
    COUNT(*) as count
FROM users 
WHERE email = 'alex.johnson@email.com'
UNION ALL
SELECT 
    'All users remaining' as table_name,
    COUNT(*) as count
FROM users;

-- Step 5: Show remaining users
SELECT 
    email,
    role,
    created_at
FROM users 
ORDER BY created_at DESC;

