-- Add status tracking to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'disabled'));

ALTER TABLE users
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure existing rows have valid status
UPDATE users
SET status = 'active'
WHERE status IS NULL;

-- Optional index for status lookups
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

