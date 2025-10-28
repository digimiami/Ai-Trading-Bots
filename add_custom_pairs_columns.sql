-- Add custom pairs and symbols columns to trading_bots table
-- Run this in Supabase SQL Editor

-- Add symbols column to store array of trading pairs
ALTER TABLE public.trading_bots 
ADD COLUMN IF NOT EXISTS symbols JSONB;

-- Add custom_pairs column to store the raw user input
ALTER TABLE public.trading_bots 
ADD COLUMN IF NOT EXISTS custom_pairs TEXT;

-- Set default for symbols if it doesn't exist (store as JSON array)
UPDATE public.trading_bots 
SET symbols = jsonb_build_array(symbol) 
WHERE symbols IS NULL;

