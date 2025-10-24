-- ============================================
-- SET ALEX.JOHNSON@EMAIL.COM AS ADMIN
-- Since this is the account you're actually using
-- ============================================

-- Check current status of alex.johnson@email.com
SELECT 
    id,
    email,
    name,
    role,
    created_at,
    updated_at
FROM users 
WHERE email = 'alex.johnson@email.com';

-- Update alex.johnson@email.com to admin role
UPDATE users 
SET role = 'admin',
    updated_at = NOW()
WHERE email = 'alex.johnson@email.com';

-- Verify the update worked
SELECT 
    id,
    email,
    name,
    role,
    created_at,
    updated_at
FROM users 
WHERE email = 'alex.johnson@email.com';

-- Show all admin users
SELECT 
    email,
    name,
    role,
    created_at
FROM users 
WHERE role = 'admin'
ORDER BY created_at DESC;

-- Show all users for reference
SELECT 
    email,
    name,
    role,
    created_at
FROM users 
ORDER BY role DESC, created_at DESC;

