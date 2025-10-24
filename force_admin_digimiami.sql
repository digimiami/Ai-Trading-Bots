-- ============================================
-- FORCE UPDATE DIGIMIAMI@GMAIL.COM TO ADMIN
-- This will definitely set the admin role
-- ============================================

-- First, let's see what's in the database
SELECT 
    id,
    email,
    name,
    role,
    created_at
FROM users 
WHERE email = 'digimiami@gmail.com';

-- Force update the role to admin (this will work even if the record exists)
UPDATE users 
SET role = 'admin'
WHERE email = 'digimiami@gmail.com';

-- If the above doesn't work, let's try inserting/updating with ON CONFLICT
INSERT INTO users (id, email, name, role)
SELECT 
    au.id,
    'digimiami@gmail.com',
    'Digi Miami',
    'admin'
FROM auth.users au
WHERE au.email = 'digimiami@gmail.com'
ON CONFLICT (id) DO UPDATE SET 
    role = 'admin',
    email = 'digimiami@gmail.com',
    name = 'Digi Miami',
    updated_at = NOW();

-- Verify the update worked
SELECT 
    id,
    email,
    name,
    role,
    created_at,
    updated_at
FROM users 
WHERE email = 'digimiami@gmail.com';

-- Show all users to confirm
SELECT 
    email,
    name,
    role,
    created_at
FROM users 
ORDER BY role DESC, created_at DESC;

