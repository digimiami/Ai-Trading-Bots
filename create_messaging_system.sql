-- =====================================================
-- MESSAGING SYSTEM - DATABASE SCHEMA
-- =====================================================
-- This script creates the messaging system tables
-- Run this in your Supabase SQL Editor

-- =====================================================
-- 1. MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    -- If recipient_id is NULL, it's a broadcast message to all users
    subject TEXT,
    body TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    is_broadcast BOOLEAN DEFAULT FALSE, -- True if sent to all users
    parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL, -- For replies
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_parent_message_id ON messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_broadcast ON messages(is_broadcast);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. RLS POLICIES FOR MESSAGES
-- =====================================================

-- Users can view messages they sent
CREATE POLICY "Users can view messages they sent" ON messages
    FOR SELECT USING (auth.uid() = sender_id);

-- Users can view messages they received
CREATE POLICY "Users can view messages they received" ON messages
    FOR SELECT USING (auth.uid() = recipient_id);

-- Users can view broadcast messages
CREATE POLICY "Users can view broadcast messages" ON messages
    FOR SELECT USING (is_broadcast = TRUE);

-- Users can view messages in conversations (parent/child relationship)
CREATE POLICY "Users can view conversation messages" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM messages m2 
            WHERE m2.id = messages.parent_message_id 
            AND (m2.sender_id = auth.uid() OR m2.recipient_id = auth.uid())
        )
    );

-- Users can insert messages they send
CREATE POLICY "Users can send messages" ON messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Users can update messages they received (mark as read)
CREATE POLICY "Users can mark messages as read" ON messages
    FOR UPDATE USING (auth.uid() = recipient_id)
    WITH CHECK (auth.uid() = recipient_id);

-- Admins can view all messages
CREATE POLICY "Admins can view all messages" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Admins can send broadcast messages
CREATE POLICY "Admins can send broadcast messages" ON messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        ) AND is_broadcast = TRUE
    );

-- =====================================================
-- 3. MESSAGE NOTIFICATIONS TABLE (for tracking unread counts)
-- =====================================================
-- This is a materialized view-like approach using a function
-- We'll use a function to get unread counts efficiently

CREATE OR REPLACE FUNCTION get_unread_message_count(user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    direct_unread INTEGER;
    broadcast_unread INTEGER;
BEGIN
    -- Count direct messages
    SELECT COUNT(*)::INTEGER INTO direct_unread
    FROM messages
    WHERE recipient_id = user_id
    AND is_read = FALSE
    AND is_broadcast = FALSE;

    -- Count unread broadcast messages (messages created after user's last read broadcast)
    SELECT COUNT(*)::INTEGER INTO broadcast_unread
    FROM messages
    WHERE is_broadcast = TRUE
    AND created_at > COALESCE((
        SELECT MAX(read_at)
        FROM messages
        WHERE recipient_id = user_id
        AND is_broadcast = TRUE
        AND is_read = TRUE
    ), '1970-01-01'::timestamp);

    RETURN COALESCE(direct_unread, 0) + COALESCE(broadcast_unread, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. TRIGGER TO UPDATE updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_messages_updated_at ON messages;
CREATE TRIGGER trigger_update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_messages_updated_at();

-- =====================================================
-- 5. FUNCTION TO GET USER BY USERNAME/EMAIL
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_by_username(username TEXT)
RETURNS TABLE(id UUID, email TEXT, name TEXT, role TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.email, u.name, u.role
    FROM users u
    WHERE LOWER(u.name) = LOWER(username)
       OR LOWER(u.email) = LOWER(username)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Check if table was created successfully
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'messages';

