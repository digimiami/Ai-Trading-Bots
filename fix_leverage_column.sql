-- Fix missing columns in trading_bots table
-- Run this in Supabase SQL Editor

-- Add all required columns if they don't exist
ALTER TABLE public.trading_bots 
ADD COLUMN IF NOT EXISTS leverage INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.trading_bots 
ADD COLUMN IF NOT EXISTS pnl DECIMAL(15,2) DEFAULT 0;

ALTER TABLE public.trading_bots 
ADD COLUMN IF NOT EXISTS pnl_percentage DECIMAL(5,2) DEFAULT 0;

ALTER TABLE public.trading_bots 
ADD COLUMN IF NOT EXISTS total_trades INTEGER DEFAULT 0;

ALTER TABLE public.trading_bots 
ADD COLUMN IF NOT EXISTS win_rate DECIMAL(5,2) DEFAULT 0;

ALTER TABLE public.trading_bots 
ADD COLUMN IF NOT EXISTS last_trade_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.trading_bots 
ADD COLUMN IF NOT EXISTS risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high'));

ALTER TABLE public.trading_bots 
ADD COLUMN IF NOT EXISTS strategy JSONB NOT NULL DEFAULT '{}';

ALTER TABLE public.trading_bots 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'stopped' CHECK (status IN ('running', 'paused', 'stopped'));

ALTER TABLE public.trading_bots 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Verify all columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'trading_bots' 
ORDER BY ordinal_position;
