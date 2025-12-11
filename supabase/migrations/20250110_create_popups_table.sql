-- Create popups table for managing popup announcements
CREATE TABLE IF NOT EXISTS popups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image', 'video', 'html')),
  content TEXT NOT NULL,
  link_url TEXT,
  size TEXT NOT NULL CHECK (size IN ('small', 'medium', 'large', 'fullscreen')) DEFAULT 'medium',
  target_audience TEXT NOT NULL CHECK (target_audience IN ('new_visitor', 'all_users', 'new_user', 'homepage', 'members_only', 'individual')),
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  show_on_pages TEXT[],
  priority INTEGER DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  dismissible BOOLEAN DEFAULT true,
  show_count INTEGER DEFAULT 0,
  dismiss_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE popups ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can do everything
CREATE POLICY "Admins can manage all popups" ON popups
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Everyone can read active popups
CREATE POLICY "Everyone can view active popups" ON popups
  FOR SELECT
  USING (is_active = true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_popups_active ON popups(is_active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_popups_target_audience ON popups(target_audience);
CREATE INDEX IF NOT EXISTS idx_popups_target_user ON popups(target_user_id) WHERE target_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_popups_dates ON popups(start_date, end_date) WHERE start_date IS NOT NULL OR end_date IS NOT NULL;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_popups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_popups_updated_at
  BEFORE UPDATE ON popups
  FOR EACH ROW
  EXECUTE FUNCTION update_popups_updated_at();

-- Function to increment show_count
CREATE OR REPLACE FUNCTION increment_popup_show_count(popup_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE popups
  SET show_count = show_count + 1
  WHERE id = popup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment dismiss_count
CREATE OR REPLACE FUNCTION increment_popup_dismiss_count(popup_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE popups
  SET dismiss_count = dismiss_count + 1
  WHERE id = popup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
