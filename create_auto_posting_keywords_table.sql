-- =====================================================
-- CREATE auto_posting_keywords TABLE
-- Run this in Supabase SQL Editor
-- =====================================================

-- Create auto_posting_keywords table for managing keyword lists
CREATE TABLE IF NOT EXISTS auto_posting_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- Name/description of the keyword list
  keywords TEXT[] NOT NULL DEFAULT '{}', -- Array of keywords to generate articles for
  category TEXT DEFAULT 'general', -- Default category for generated articles
  enabled BOOLEAN DEFAULT true, -- Whether this keyword list is active
  frequency_hours INTEGER DEFAULT 24, -- How often to generate articles (in hours)
  last_generated_at TIMESTAMPTZ, -- When articles were last generated from this list
  auto_publish BOOLEAN DEFAULT false, -- Whether to auto-publish generated articles
  max_articles_per_run INTEGER DEFAULT 1, -- Max articles to generate per run
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_auto_posting_enabled ON auto_posting_keywords(enabled);
CREATE INDEX IF NOT EXISTS idx_auto_posting_last_generated ON auto_posting_keywords(last_generated_at);
CREATE INDEX IF NOT EXISTS idx_auto_posting_category ON auto_posting_keywords(category);

-- Enable RLS
ALTER TABLE auto_posting_keywords ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Admins can manage keyword lists" ON auto_posting_keywords;
DROP POLICY IF EXISTS "Service role can read keyword lists" ON auto_posting_keywords;

-- Policy: Only admins can manage keyword lists
CREATE POLICY "Admins can manage keyword lists"
  ON auto_posting_keywords
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: Service role can read all (for scheduled functions)
-- Note: This policy allows service role to bypass RLS
CREATE POLICY "Service role can read keyword lists"
  ON auto_posting_keywords
  FOR SELECT
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_auto_posting_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS update_auto_posting_updated_at ON auto_posting_keywords;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_auto_posting_updated_at
  BEFORE UPDATE ON auto_posting_keywords
  FOR EACH ROW
  EXECUTE FUNCTION update_auto_posting_updated_at();

-- Verify table was created
SELECT 
  table_name, 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'auto_posting_keywords'
ORDER BY ordinal_position;

