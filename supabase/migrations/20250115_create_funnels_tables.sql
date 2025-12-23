-- Create funnels table for managing sales funnels
CREATE TABLE IF NOT EXISTS funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create funnel_pages table for landing/sale pages
CREATE TABLE IF NOT EXISTS funnel_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  page_type TEXT NOT NULL CHECK (page_type IN ('landing', 'sale', 'thank_you', 'upsell', 'downsell')),
  html_content TEXT NOT NULL,
  meta_title TEXT,
  meta_description TEXT,
  custom_css TEXT,
  custom_js TEXT,
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  redirect_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(funnel_id, slug)
);

-- Create funnel_page_views table for tracking
CREATE TABLE IF NOT EXISTS funnel_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES funnel_pages(id) ON DELETE CASCADE,
  funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create funnel_page_events table for tracking clicks, conversions, etc.
CREATE TABLE IF NOT EXISTS funnel_page_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES funnel_pages(id) ON DELETE CASCADE,
  funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('click', 'form_submit', 'purchase', 'signup', 'custom')),
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_page_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for funnels
CREATE POLICY "Admins can manage all funnels" ON funnels
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Everyone can view active funnels" ON funnels
  FOR SELECT
  USING (is_active = true);

-- RLS Policies for funnel_pages
CREATE POLICY "Admins can manage all funnel pages" ON funnel_pages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Everyone can view active funnel pages" ON funnel_pages
  FOR SELECT
  USING (is_active = true);

-- RLS Policies for tracking tables (allow inserts for everyone, reads for admins)
CREATE POLICY "Anyone can track page views" ON funnel_page_views
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view page views" ON funnel_page_views
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Anyone can track events" ON funnel_page_events
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view events" ON funnel_page_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_funnels_slug ON funnels(slug);
CREATE INDEX IF NOT EXISTS idx_funnels_active ON funnels(is_active);
CREATE INDEX IF NOT EXISTS idx_funnel_pages_funnel_id ON funnel_pages(funnel_id);
CREATE INDEX IF NOT EXISTS idx_funnel_pages_slug ON funnel_pages(funnel_id, slug);
CREATE INDEX IF NOT EXISTS idx_funnel_pages_active ON funnel_pages(is_active);
CREATE INDEX IF NOT EXISTS idx_funnel_page_views_page_id ON funnel_page_views(page_id);
CREATE INDEX IF NOT EXISTS idx_funnel_page_views_funnel_id ON funnel_page_views(funnel_id);
CREATE INDEX IF NOT EXISTS idx_funnel_page_views_viewed_at ON funnel_page_views(viewed_at);
CREATE INDEX IF NOT EXISTS idx_funnel_page_events_page_id ON funnel_page_events(page_id);
CREATE INDEX IF NOT EXISTS idx_funnel_page_events_funnel_id ON funnel_page_events(funnel_id);
CREATE INDEX IF NOT EXISTS idx_funnel_page_events_event_type ON funnel_page_events(event_type);
CREATE INDEX IF NOT EXISTS idx_funnel_page_events_created_at ON funnel_page_events(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_funnels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_funnel_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_funnels_updated_at
  BEFORE UPDATE ON funnels
  FOR EACH ROW
  EXECUTE FUNCTION update_funnels_updated_at();

CREATE TRIGGER update_funnel_pages_updated_at
  BEFORE UPDATE ON funnel_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_funnel_pages_updated_at();






