-- Add related_articles column to crypto_news_articles table
-- This column stores an array of related article IDs for automatic cross-linking

-- Check if column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'crypto_news_articles' 
    AND column_name = 'related_articles'
  ) THEN
    ALTER TABLE crypto_news_articles 
    ADD COLUMN related_articles UUID[] DEFAULT '{}';
    
    -- Add index for better query performance
    CREATE INDEX IF NOT EXISTS idx_crypto_news_articles_related 
    ON crypto_news_articles USING GIN (related_articles);
    
    RAISE NOTICE 'Column related_articles added successfully';
  ELSE
    RAISE NOTICE 'Column related_articles already exists';
  END IF;
END $$;

