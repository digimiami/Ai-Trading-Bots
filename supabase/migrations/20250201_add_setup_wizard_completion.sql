-- Add Setup Wizard Completion Tracking
-- Adds column to track if user has completed the setup wizard

-- Add setup_wizard_completed column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS setup_wizard_completed BOOLEAN DEFAULT false;

-- Optional: Add onboarding_responses JSONB column to store wizard answers
ALTER TABLE users
ADD COLUMN IF NOT EXISTS onboarding_responses JSONB DEFAULT '{}'::jsonb;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_setup_wizard_completed ON users(setup_wizard_completed);

-- Update existing users to have default values
UPDATE users 
SET 
  setup_wizard_completed = COALESCE(setup_wizard_completed, false),
  onboarding_responses = COALESCE(onboarding_responses, '{}'::jsonb)
WHERE setup_wizard_completed IS NULL OR onboarding_responses IS NULL;

