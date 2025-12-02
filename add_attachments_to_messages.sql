-- =====================================================
-- ADD ATTACHMENTS SUPPORT TO MESSAGES
-- =====================================================
-- Run this in your Supabase SQL Editor

-- Add attachments column to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Add index for attachments
CREATE INDEX IF NOT EXISTS idx_messages_attachments ON messages USING GIN (attachments);

-- Add RLS policy for deleting messages
DROP POLICY IF EXISTS "Users can delete their own sent messages" ON messages;
DROP POLICY IF EXISTS "Users can delete messages they received" ON messages;
DROP POLICY IF EXISTS "Admins can delete any message" ON messages;

-- Users can delete messages they sent
CREATE POLICY "Users can delete their own sent messages" ON messages
    FOR DELETE USING (auth.uid() = sender_id);

-- Users can delete messages they received
CREATE POLICY "Users can delete messages they received" ON messages
    FOR DELETE USING (auth.uid() = recipient_id);

-- Admins can delete any message
CREATE POLICY "Admins can delete any message" ON messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

