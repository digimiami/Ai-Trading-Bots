-- ============================================
-- VERIFY AND FIX ADMIN ROLE FOR DIGIMIAMI@GMAIL.COM
-- ============================================

-- Step 1: Check current status
SELECT 
    au.email as "Auth Email",
    u.email as "Users Table Email",
    u.role as "Current Role",
    u.id as "User ID"
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
WHERE au.email = 'digimiami@gmail.com';

-- Step 2: If user exists in auth.users but not in users table, create the record
INSERT INTO users (id, email, name, role)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', au.email),
    'admin'
FROM auth.users au
WHERE au.email = 'digimiami@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = au.id
);

-- Step 3: Set admin role (updates existing or newly created record)
UPDATE users 
SET role = 'admin'
WHERE email = 'digimiami@gmail.com';

-- Step 4: Verify the fix
SELECT 
    id,
    email,
    name,
    role,
    created_at,
    updated_at
FROM users 
WHERE email = 'digimiami@gmail.com';

-- Step 5: Show all admin users for verification
SELECT 
    email,
    role,
    created_at
FROM users 
WHERE role = 'admin'
ORDER BY created_at;

