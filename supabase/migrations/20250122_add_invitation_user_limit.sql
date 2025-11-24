-- Add user_limit to invitation_codes table
ALTER TABLE invitation_codes 
ADD COLUMN IF NOT EXISTS user_limit INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS users_created INTEGER DEFAULT 0;

-- Add invitation_code_id to users table to track which invitation was used
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS invitation_code_id UUID REFERENCES invitation_codes(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_invitation_code ON users(invitation_code_id);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_user_limit ON invitation_codes(user_limit) WHERE user_limit IS NOT NULL;

-- Function to update users_created count when a user is created
CREATE OR REPLACE FUNCTION update_invitation_user_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invitation_code_id IS NOT NULL THEN
    UPDATE invitation_codes
    SET users_created = COALESCE(users_created, 0) + 1
    WHERE id = NEW.invitation_code_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update user count
DROP TRIGGER IF EXISTS trigger_update_invitation_user_count ON users;
CREATE TRIGGER trigger_update_invitation_user_count
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_invitation_user_count();

-- Function to check if invitation code has reached user limit
CREATE OR REPLACE FUNCTION check_invitation_user_limit(invitation_code_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  code_limit INTEGER;
  current_count INTEGER;
BEGIN
  SELECT user_limit, COALESCE(users_created, 0)
  INTO code_limit, current_count
  FROM invitation_codes
  WHERE id = invitation_code_id;
  
  -- If no limit set, allow unlimited users
  IF code_limit IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Check if limit reached
  RETURN current_count < code_limit;
END;
$$ LANGUAGE plpgsql;

-- Update existing invitation codes to have users_created count
UPDATE invitation_codes ic
SET users_created = (
  SELECT COUNT(*)
  FROM users u
  WHERE u.invitation_code_id = ic.id
);

