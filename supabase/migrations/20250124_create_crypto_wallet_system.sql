-- Crypto Wallet System
-- Enables users to buy and send BTC (and other cryptocurrencies)

-- =====================================================
-- 1. WALLETS TABLE
-- Stores user wallet addresses and metadata
-- =====================================================
CREATE TABLE IF NOT EXISTS crypto_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL DEFAULT 'BTC', -- 'BTC', 'ETH', 'USDT', etc.
    address TEXT NOT NULL, -- Wallet address (Bitcoin address, Ethereum address, etc.)
    label TEXT, -- User-friendly label for the wallet
    is_active BOOLEAN DEFAULT true,
    network VARCHAR(20) DEFAULT 'mainnet', -- 'mainnet', 'testnet', 'bitcoin', 'ethereum', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, currency, address)
);

-- =====================================================
-- 2. WALLET BALANCES TABLE
-- Tracks current balances per wallet
-- =====================================================
CREATE TABLE IF NOT EXISTS wallet_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES crypto_wallets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL DEFAULT 'BTC',
    balance DECIMAL(20,8) NOT NULL DEFAULT 0, -- Current balance
    available_balance DECIMAL(20,8) NOT NULL DEFAULT 0, -- Available for sending (balance - pending)
    pending_balance DECIMAL(20,8) NOT NULL DEFAULT 0, -- Pending transactions
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_id, currency)
);

-- =====================================================
-- 3. WALLET TRANSACTIONS TABLE
-- Tracks all wallet transactions (buy, send, receive)
-- =====================================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES crypto_wallets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('buy', 'send', 'receive', 'deposit', 'withdrawal')),
    currency VARCHAR(10) NOT NULL DEFAULT 'BTC',
    amount DECIMAL(20,8) NOT NULL,
    fee DECIMAL(20,8) DEFAULT 0, -- Transaction fee
    from_address TEXT, -- Source address (null for buys/deposits)
    to_address TEXT NOT NULL, -- Destination address
    transaction_hash TEXT, -- Blockchain transaction hash
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    network_fee DECIMAL(20,8) DEFAULT 0, -- Network/blockchain fee
    exchange_rate DECIMAL(20,8), -- Exchange rate if bought with fiat
    fiat_amount DECIMAL(10,2), -- Fiat amount if bought with fiat
    fiat_currency VARCHAR(10) DEFAULT 'USD', -- Fiat currency
    payment_provider VARCHAR(50), -- 'coinbase', 'moonpay', 'transak', 'btcpay', etc.
    payment_id TEXT, -- Payment provider transaction ID
    metadata JSONB DEFAULT '{}', -- Additional metadata
    confirmed_at TIMESTAMP WITH TIME ZONE, -- When transaction was confirmed on blockchain
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_user_id ON crypto_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_currency ON crypto_wallets(currency);
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_active ON crypto_wallets(is_active);

CREATE INDEX IF NOT EXISTS idx_wallet_balances_wallet_id ON wallet_balances(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_balances_user_id ON wallet_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_balances_currency ON wallet_balances(currency);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_hash ON wallet_transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(created_at DESC);

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================
ALTER TABLE crypto_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Crypto Wallets: Users can view/manage their own
DROP POLICY IF EXISTS "Users can view own wallets" ON crypto_wallets;
CREATE POLICY "Users can view own wallets"
    ON crypto_wallets FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own wallets" ON crypto_wallets;
CREATE POLICY "Users can insert own wallets"
    ON crypto_wallets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own wallets" ON crypto_wallets;
CREATE POLICY "Users can update own wallets"
    ON crypto_wallets FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own wallets" ON crypto_wallets;
CREATE POLICY "Users can delete own wallets"
    ON crypto_wallets FOR DELETE
    USING (auth.uid() = user_id);

-- Wallet Balances: Users can view their own
DROP POLICY IF EXISTS "Users can view own balances" ON wallet_balances;
CREATE POLICY "Users can view own balances"
    ON wallet_balances FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own balances" ON wallet_balances;
CREATE POLICY "Users can insert own balances"
    ON wallet_balances FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own balances" ON wallet_balances;
CREATE POLICY "Users can update own balances"
    ON wallet_balances FOR UPDATE
    USING (auth.uid() = user_id);

-- Wallet Transactions: Users can view their own
DROP POLICY IF EXISTS "Users can view own transactions" ON wallet_transactions;
CREATE POLICY "Users can view own transactions"
    ON wallet_transactions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own transactions" ON wallet_transactions;
CREATE POLICY "Users can insert own transactions"
    ON wallet_transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own transactions" ON wallet_transactions;
CREATE POLICY "Users can update own transactions"
    ON wallet_transactions FOR UPDATE
    USING (auth.uid() = user_id);

-- =====================================================
-- 6. FUNCTIONS FOR WALLET MANAGEMENT
-- =====================================================

-- Function to get user's total balance for a currency
CREATE OR REPLACE FUNCTION get_user_wallet_balance(p_user_id UUID, p_currency VARCHAR DEFAULT 'BTC')
RETURNS DECIMAL(20,8) AS $$
DECLARE
    v_total_balance DECIMAL(20,8) := 0;
BEGIN
    SELECT COALESCE(SUM(available_balance), 0) INTO v_total_balance
    FROM wallet_balances
    WHERE user_id = p_user_id
      AND currency = p_currency;
    
    RETURN v_total_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update wallet balance after transaction
CREATE OR REPLACE FUNCTION update_wallet_balance_after_transaction()
RETURNS TRIGGER AS $$
DECLARE
    v_wallet_currency VARCHAR(10);
    v_current_balance DECIMAL(20,8);
    v_pending_balance DECIMAL(20,8);
BEGIN
    -- Get wallet currency
    SELECT currency INTO v_wallet_currency
    FROM crypto_wallets
    WHERE id = NEW.wallet_id;
    
    -- Calculate new balance based on transaction type
    IF NEW.transaction_type IN ('buy', 'receive', 'deposit') THEN
        -- Increase balance
        INSERT INTO wallet_balances (wallet_id, user_id, currency, balance, available_balance, pending_balance)
        VALUES (NEW.wallet_id, NEW.user_id, COALESCE(v_wallet_currency, NEW.currency), NEW.amount, NEW.amount, 0)
        ON CONFLICT (wallet_id, currency) 
        DO UPDATE SET
            balance = wallet_balances.balance + NEW.amount,
            available_balance = wallet_balances.available_balance + NEW.amount,
            updated_at = NOW();
            
    ELSIF NEW.transaction_type IN ('send', 'withdrawal') THEN
        -- Decrease balance
        INSERT INTO wallet_balances (wallet_id, user_id, currency, balance, available_balance, pending_balance)
        VALUES (NEW.wallet_id, NEW.user_id, COALESCE(v_wallet_currency, NEW.currency), -NEW.amount - COALESCE(NEW.fee, 0), -NEW.amount - COALESCE(NEW.fee, 0), 0)
        ON CONFLICT (wallet_id, currency)
        DO UPDATE SET
            balance = wallet_balances.balance - NEW.amount - COALESCE(NEW.fee, 0),
            available_balance = wallet_balances.available_balance - NEW.amount - COALESCE(NEW.fee, 0),
            updated_at = NOW();
    END IF;
    
    -- Update pending balance based on status
    IF NEW.status = 'pending' OR NEW.status = 'processing' THEN
        UPDATE wallet_balances
        SET pending_balance = pending_balance + NEW.amount + COALESCE(NEW.fee, 0),
            available_balance = available_balance - NEW.amount - COALESCE(NEW.fee, 0)
        WHERE wallet_id = NEW.wallet_id
          AND currency = COALESCE(v_wallet_currency, NEW.currency);
    ELSIF NEW.status = 'completed' THEN
        UPDATE wallet_balances
        SET pending_balance = pending_balance - NEW.amount - COALESCE(NEW.fee, 0)
        WHERE wallet_id = NEW.wallet_id
          AND currency = COALESCE(v_wallet_currency, NEW.currency);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update balances automatically
DROP TRIGGER IF EXISTS trigger_update_wallet_balance ON wallet_transactions;
CREATE TRIGGER trigger_update_wallet_balance
    AFTER INSERT OR UPDATE ON wallet_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_wallet_balance_after_transaction();

-- =====================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE crypto_wallets IS 'User cryptocurrency wallet addresses';
COMMENT ON TABLE wallet_balances IS 'Current balances for each wallet';
COMMENT ON TABLE wallet_transactions IS 'All wallet transactions (buy, send, receive)';
COMMENT ON FUNCTION get_user_wallet_balance IS 'Get total balance for a user and currency';
COMMENT ON FUNCTION update_wallet_balance_after_transaction IS 'Automatically update wallet balance when transactions are created/updated';

