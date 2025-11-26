-- Create crypto_news_articles table
CREATE TABLE IF NOT EXISTS crypto_news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  keywords TEXT[] DEFAULT '{}',
  author_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  
  -- SEO Meta Tags
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT[] DEFAULT '{}',
  og_title TEXT,
  og_description TEXT,
  og_image_url TEXT,
  twitter_card TEXT DEFAULT 'summary_large_image',
  twitter_title TEXT,
  twitter_description TEXT,
  canonical_url TEXT,
  
  -- Article metadata
  featured_image_url TEXT,
  category TEXT DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  reading_time INTEGER, -- in minutes
  view_count INTEGER DEFAULT 0,
  
  -- Timestamps
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_crypto_news_status ON crypto_news_articles(status);
CREATE INDEX IF NOT EXISTS idx_crypto_news_published_at ON crypto_news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_crypto_news_slug ON crypto_news_articles(slug);
CREATE INDEX IF NOT EXISTS idx_crypto_news_category ON crypto_news_articles(category);
CREATE INDEX IF NOT EXISTS idx_crypto_news_author ON crypto_news_articles(author_id);

-- Enable RLS
ALTER TABLE crypto_news_articles ENABLE ROW LEVEL SECURITY;

-- Policy: Public can read published articles (no authentication required)
CREATE POLICY "Public can view published articles"
  ON crypto_news_articles
  FOR SELECT
  USING (status = 'published');

-- Ensure the policy allows anonymous access
-- This policy works for both authenticated and unauthenticated users

-- Policy: Admins can manage all articles
CREATE POLICY "Admins can manage articles"
  ON crypto_news_articles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Function to generate slug from title
CREATE OR REPLACE FUNCTION generate_article_slug(title_text TEXT)
RETURNS TEXT AS $$
DECLARE
  slug_text TEXT;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  slug_text := lower(title_text);
  slug_text := regexp_replace(slug_text, '[^a-z0-9]+', '-', 'g');
  slug_text := trim(both '-' from slug_text);
  
  -- Ensure uniqueness by appending number if needed
  WHILE EXISTS (SELECT 1 FROM crypto_news_articles WHERE slug = slug_text) LOOP
    slug_text := slug_text || '-' || floor(random() * 1000)::text;
  END LOOP;
  
  RETURN slug_text;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_crypto_news_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_crypto_news_updated_at
  BEFORE UPDATE ON crypto_news_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_crypto_news_updated_at();

-- Function to calculate reading time (estimate: 200 words per minute)
CREATE OR REPLACE FUNCTION calculate_reading_time(content_text TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN GREATEST(1, (array_length(string_to_array(content_text, ' '), 1) / 200)::INTEGER);
END;
$$ LANGUAGE plpgsql;

-- Function to increment article view count
CREATE OR REPLACE FUNCTION increment_article_views(article_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE crypto_news_articles
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = article_id;
END;
$$ LANGUAGE plpgsql;

