-- ============================================
-- COMPLETE ADMIN SETUP FOR DIGIMIAMI@GMAIL.COM
-- This will definitely work - step by step
-- ============================================

-- Step 1: Check if digimiami@gmail.com exists in auth.users
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at
FROM auth.users 
WHERE email = 'digimiami@gmail.com';

-- Step 2: Check if digimiami@gmail.com exists in users table
SELECT 
    id,
    email,
    name,
    role,
    created_at
FROM users 
WHERE email = 'digimiami@gmail.com';

-- Step 3: If user doesn't exist in users table, create them
INSERT INTO users (id, email, name, role)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', 'Digi Miami'),
    'admin'
FROM auth.users au
WHERE au.email = 'digimiami@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = au.id
);

-- Step 4: Force update the role to admin (this will work)
UPDATE users 
SET role = 'admin',
    updated_at = NOW()
WHERE email = 'digimiami@gmail.com';

-- Step 5: Verify the update worked
SELECT 
    id,
    email,
    name,
    role,
    created_at,
    updated_at
FROM users 
WHERE email = 'digimiami@gmail.com';

-- Step 6: Show all users to confirm
SELECT 
    email,
    name,
    role,
    created_at
FROM users 
ORDER BY role DESC, created_at DESC;

-- Step 7: Check if there are any RLS policies blocking the update
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'users';

