-- Add trading_type column to trading_bots table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'trading_bots' 
        AND column_name = 'trading_type'
    ) THEN
        ALTER TABLE trading_bots 
        ADD COLUMN trading_type VARCHAR(20) DEFAULT 'spot' NOT NULL;
        
        ALTER TABLE trading_bots 
        ADD CONSTRAINT trading_bots_trading_type_check 
        CHECK (trading_type IN ('spot', 'futures'));
        
        RAISE NOTICE 'Added trading_type column to trading_bots table';
    ELSE
        RAISE NOTICE 'trading_type column already exists in trading_bots table';
    END IF;
END $$;