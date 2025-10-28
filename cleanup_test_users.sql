-- ============================================
-- CLEANUP ALL TEST USERS
-- Remove alex.johnson@email.com and test accounts
-- Keep only: digimiami@gmail.com and diazites1@gmail.com
-- ============================================

-- Step 1: Show users BEFORE cleanup
SELECT 
    '=== BEFORE CLEANUP ===' as status,
    email,
    role,
    created_at
FROM users 
ORDER BY created_at DESC;

-- Step 2: Delete test users and all their related data
DO $$
DECLARE
    user_record RECORD;
    users_to_delete TEXT[] := ARRAY[
        'alex.johnson@email.com',
        'digimiami+2@gmail.com',
        'digimiami+3@gmail.com'
    ];
    user_email TEXT;
BEGIN
    FOREACH user_email IN ARRAY users_to_delete
    LOOP
        -- Find the user
        SELECT id, email INTO user_record
        FROM auth.users
        WHERE email = user_email;

        IF user_record.id IS NOT NULL THEN
            RAISE NOTICE '🗑️ Deleting user: %', user_record.email;
            
            -- Delete all related data (bot_activity_logs will cascade from trading_bots)
            DELETE FROM trades WHERE user_id = user_record.id;
            DELETE FROM trading_bots WHERE user_id = user_record.id; -- CASCADE deletes bot_activity_logs
            DELETE FROM api_keys WHERE user_id = user_record.id;
            DELETE FROM profiles WHERE id = user_record.id;
            
            -- Delete ML-related data (if tables exist)
            BEGIN
                DELETE FROM ml_predictions WHERE user_id = user_record.id;
                DELETE FROM ml_training_data WHERE user_id = user_record.id;
            EXCEPTION
                WHEN undefined_table THEN
                    RAISE NOTICE '  ML tables not found, skipping...';
            END;
            
            -- Delete telegram settings (if exists)
            BEGIN
                DELETE FROM telegram_settings WHERE user_id = user_record.id;
            EXCEPTION
                WHEN undefined_table THEN
                    RAISE NOTICE '  Telegram settings table not found, skipping...';
            END;
            
            -- Delete from users table
            DELETE FROM users WHERE id = user_record.id;
            
            -- Delete from auth.users
            DELETE FROM auth.users WHERE id = user_record.id;
            
            RAISE NOTICE '✅ Successfully deleted: %', user_record.email;
        ELSE
            RAISE NOTICE '⚠️ User not found: %', user_email;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Cleanup completed!';
END $$;

-- Step 3: Show users AFTER cleanup
SELECT 
    '=== AFTER CLEANUP ===' as status,
    email,
    role,
    created_at
FROM users 
ORDER BY created_at DESC;

-- Step 4: Verify only admin users remain
SELECT 
    '=== FINAL VERIFICATION ===' as status,
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE role = 'admin') as admin_users,
    COUNT(*) FILTER (WHERE role = 'user') as regular_users
FROM users;

-- Step 5: Show detailed admin accounts
SELECT 
    '=== ADMIN ACCOUNTS ===' as status,
    email,
    role,
    created_at,
    updated_at
FROM users 
WHERE role = 'admin'
ORDER BY created_at;

