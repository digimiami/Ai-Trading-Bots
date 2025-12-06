-- Contact Messages Table
-- Stores contact form submissions from users

CREATE TABLE IF NOT EXISTS contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
    admin_notes TEXT,
    replied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_contact_messages_user_id ON contact_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages(email);

-- Enable RLS
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own messages
CREATE POLICY "Users can view their own contact messages"
    ON contact_messages
    FOR SELECT
    USING (auth.uid() = user_id OR auth.uid() IS NULL);

-- Anyone can insert contact messages (for public contact form)
CREATE POLICY "Anyone can insert contact messages"
    ON contact_messages
    FOR INSERT
    WITH CHECK (true);

-- Only admins can update contact messages
CREATE POLICY "Admins can update contact messages"
    ON contact_messages
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Only admins can view all contact messages
CREATE POLICY "Admins can view all contact messages"
    ON contact_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Add comment
COMMENT ON TABLE contact_messages IS 'Stores contact form submissions from users';
COMMENT ON COLUMN contact_messages.user_id IS 'User ID if logged in, NULL for anonymous submissions';
COMMENT ON COLUMN contact_messages.status IS 'Status: new, read, replied, archived';

