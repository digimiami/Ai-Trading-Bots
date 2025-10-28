-- ============================================
-- FIX PROFILE EMAIL MISMATCH
-- Update profile to match correct user email
-- ============================================

-- Show current profile state
SELECT 
    id,
    email as "Current Email in Profile",
    name,
    created_at
FROM profiles
WHERE id = '25fe0687-cc9c-4734-838e-a76113a19f9d';

-- Show actual user email from auth
SELECT 
    au.id,
    au.email as "Actual Email (auth.users)",
    u.email as "Email in users table"
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
WHERE au.id = '25fe0687-cc9c-4734-838e-a76113a19f9d';

-- Fix profile email to match actual user
UPDATE profiles
SET email = 'digimiami@gmail.com'
WHERE id = '25fe0687-cc9c-4734-838e-a76113a19f9d';

-- Verify the fix
SELECT 
    id,
    email as "Updated Email",
    name,
    updated_at
FROM profiles
WHERE id = '25fe0687-cc9c-4734-838e-a76113a19f9d';

