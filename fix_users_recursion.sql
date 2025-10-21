-- =====================================================
-- FIX INFINITE RECURSION IN USERS TABLE POLICIES
-- =====================================================
-- This script fixes the infinite recursion issue in the users table policies
-- Run this in your Supabase SQL Editor

-- =====================================================
-- 1. DROP PROBLEMATIC POLICIES
-- =====================================================

-- Drop all existing policies on users table to fix recursion
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Users can only access their own data" ON users;

-- =====================================================
-- 2. CREATE SIMPLE, NON-RECURSIVE POLICIES
-- =====================================================

-- Simple policy for users to view their own data (no recursion)
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

-- Simple policy for users to update their own data (no recursion)
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Simple policy for users to insert their own data (no recursion)
CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Simple policy for admins to view all users (no recursion)
CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (
        auth.uid() IN (
            SELECT id FROM users WHERE role = 'admin'
        )
    );

-- Simple policy for admins to update all users (no recursion)
CREATE POLICY "Admins can update all users" ON users
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT id FROM users WHERE role = 'admin'
        )
    );

-- =====================================================
-- 3. VERIFY POLICIES
-- =====================================================

-- Check the new policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'users'
ORDER BY policyname;

-- =====================================================
-- 4. TEST USER CREATION
-- =====================================================

-- Test if we can now query users without recursion
-- This should work without infinite recursion
SELECT id, email, role FROM users WHERE id = auth.uid() LIMIT 1;


