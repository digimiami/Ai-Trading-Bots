-- =====================================================
-- PABLO AI TRADING - DATABASE SETUP SCRIPT
-- =====================================================
-- This script creates all necessary tables for the trading bot platform
-- Run this in your Supabase SQL Editor

-- =====================================================
-- 1. USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'disabled')),
    status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update all users" ON users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- 2. API KEYS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exchange TEXT NOT NULL CHECK (exchange IN ('bybit', 'okx')),
    api_key TEXT NOT NULL,
    api_secret TEXT NOT NULL,
    passphrase TEXT,
    is_testnet BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for api_keys table
CREATE POLICY "Users can view their own API keys" ON api_keys
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own API keys" ON api_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys" ON api_keys
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys" ON api_keys
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 3. TRADING BOTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS trading_bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    exchange TEXT NOT NULL CHECK (exchange IN ('bybit', 'okx')),
    symbol TEXT NOT NULL,
    leverage INTEGER NOT NULL DEFAULT 1,
    risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
    strategy JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'stopped' CHECK (status IN ('running', 'paused', 'stopped')),
    pnl DECIMAL(15,2) DEFAULT 0,
    pnl_percentage DECIMAL(5,2) DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0,
    last_trade_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE trading_bots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trading_bots table
CREATE POLICY "Users can view their own bots" ON trading_bots
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bots" ON trading_bots
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bots" ON trading_bots
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bots" ON trading_bots
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 4. TRADES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES trading_bots(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('long', 'short')),
    size DECIMAL(15,8) NOT NULL,
    entry_price DECIMAL(15,8) NOT NULL,
    exit_price DECIMAL(15,8),
    pnl DECIMAL(15,2),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    exchange TEXT NOT NULL CHECK (exchange IN ('bybit', 'okx')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trades table
CREATE POLICY "Users can view their own trades" ON trades
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trades" ON trades
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trades" ON trades
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trades" ON trades
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 5. EXCHANGE BALANCES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS exchange_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exchange TEXT NOT NULL CHECK (exchange IN ('bybit', 'okx')),
    total_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    available_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    locked_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    assets JSONB DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
    error_message TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE exchange_balances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exchange_balances table
CREATE POLICY "Users can view their own balances" ON exchange_balances
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own balances" ON exchange_balances
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own balances" ON exchange_balances
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own balances" ON exchange_balances
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 6. INVITATION CODES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS invitation_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    used_by UUID REFERENCES users(id),
    used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invitation_codes table
CREATE POLICY "Anyone can view invitation codes" ON invitation_codes
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage invitation codes" ON invitation_codes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- 7. INDEXES FOR PERFORMANCE
-- =====================================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- API keys table indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_exchange ON api_keys(exchange);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);

-- Trading bots table indexes
CREATE INDEX IF NOT EXISTS idx_trading_bots_user_id ON trading_bots(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_bots_exchange ON trading_bots(exchange);
CREATE INDEX IF NOT EXISTS idx_trading_bots_status ON trading_bots(status);
CREATE INDEX IF NOT EXISTS idx_trading_bots_symbol ON trading_bots(symbol);

-- Trades table indexes
CREATE INDEX IF NOT EXISTS idx_trades_bot_id ON trades(bot_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);

-- Exchange balances table indexes
CREATE INDEX IF NOT EXISTS idx_exchange_balances_user_id ON exchange_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_exchange_balances_exchange ON exchange_balances(exchange);
CREATE INDEX IF NOT EXISTS idx_exchange_balances_status ON exchange_balances(status);

-- Invitation codes table indexes
CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON invitation_codes(code);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_email ON invitation_codes(email);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_expires_at ON invitation_codes(expires_at);

-- =====================================================
-- 8. FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trading_bots_updated_at BEFORE UPDATE ON trading_bots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exchange_balances_updated_at BEFORE UPDATE ON exchange_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. SAMPLE DATA (OPTIONAL)
-- =====================================================

-- Insert a default admin user (replace with your actual admin email)
-- This will be created when the user signs up, but you can manually insert if needed
-- INSERT INTO users (id, email, name, role) 
-- VALUES ('your-admin-uuid', 'admin@example.com', 'Admin User', 'admin')
-- ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 10. VERIFICATION QUERIES
-- =====================================================

-- Check if all tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'api_keys', 'trading_bots', 'trades', 'exchange_balances', 'invitation_codes')
ORDER BY table_name;

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================================
-- SCRIPT COMPLETED
-- =====================================================
-- Run this script in your Supabase SQL Editor
-- All tables, policies, indexes, and triggers will be created
-- The system will be ready for the exchange balance functionality


