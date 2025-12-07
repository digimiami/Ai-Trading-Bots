-- =====================================================
-- SUBSCRIPTION SYSTEM FOR TRADING BOTS
-- =====================================================
-- This schema enables monthly crypto payments via BTCPay Server
-- Customers can pay from their own wallets for spot trading bot access

-- =====================================================
-- 1. SUBSCRIPTION PLANS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- 'Free', 'Basic', 'Pro', 'Enterprise'
  display_name TEXT NOT NULL,
  description TEXT,
  price_monthly_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_crypto JSONB, -- { "BTC": "0.001", "USDT": "50", "ETH": "0.02" }
  max_bots INTEGER NOT NULL DEFAULT 1,
  max_trades_per_day INTEGER, -- NULL = unlimited
  max_exchanges INTEGER DEFAULT 1, -- How many exchange API keys allowed
  features JSONB DEFAULT '{}', -- { "ai_optimization": true, "paper_trading": true, "real_trading": false }
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. USER SUBSCRIPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'cancelled', 'past_due')),
  payment_method TEXT, -- 'btcpay', 'coinbase', etc.
  invoice_id TEXT, -- BTCPay invoice ID
  invoice_url TEXT, -- BTCPay payment URL
  payment_address TEXT, -- Crypto address for payment
  amount_paid DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  crypto_amount TEXT, -- Amount in crypto (e.g., "0.001 BTC")
  transaction_hash TEXT, -- Blockchain transaction hash
  started_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. PAYMENT HISTORY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  crypto_amount TEXT,
  crypto_currency TEXT, -- 'BTC', 'USDT', 'ETH', etc.
  payment_address TEXT,
  transaction_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'expired', 'invalid', 'refunded')),
  payment_method TEXT, -- 'btcpay_lightning', 'btcpay_onchain', etc.
  btcpay_store_id TEXT,
  metadata JSONB DEFAULT '{}',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_invoice_id ON user_subscriptions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires_at ON user_subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_next_billing ON user_subscriptions(next_billing_date);

CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription_id ON payment_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_invoice_id ON payment_history(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON payment_history(status);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- Subscription Plans: Public read access
CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

-- User Subscriptions: Users can view their own
CREATE POLICY "Users can view their own subscriptions"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- User Subscriptions: Users can insert their own
CREATE POLICY "Users can create their own subscriptions"
  ON user_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Payment History: Users can view their own
CREATE POLICY "Users can view their own payment history"
  ON payment_history FOR SELECT
  USING (auth.uid() = user_id);

-- =====================================================
-- 6. FUNCTIONS FOR SUBSCRIPTION MANAGEMENT
-- =====================================================

-- Function to get user's active subscription
CREATE OR REPLACE FUNCTION get_user_active_subscription(p_user_id UUID)
RETURNS TABLE (
  subscription_id UUID,
  plan_id UUID,
  plan_name TEXT,
  plan_display_name TEXT,
  status TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  max_bots INTEGER,
  max_trades_per_day INTEGER,
  max_exchanges INTEGER,
  features JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.id as subscription_id,
    us.plan_id,
    sp.name as plan_name,
    sp.display_name as plan_display_name,
    us.status,
    us.expires_at,
    us.next_billing_date,
    sp.max_bots,
    sp.max_trades_per_day,
    sp.max_exchanges,
    sp.features
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = p_user_id
    AND us.status = 'active'
    AND (us.expires_at IS NULL OR us.expires_at > NOW())
  ORDER BY us.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can create more bots
CREATE OR REPLACE FUNCTION can_user_create_bot(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_subscription RECORD;
  v_bot_count INTEGER;
BEGIN
  -- Get active subscription
  SELECT * INTO v_subscription
  FROM get_user_active_subscription(p_user_id)
  LIMIT 1;

  -- If no subscription, check if free plan exists
  IF v_subscription IS NULL THEN
    SELECT * INTO v_subscription
    FROM subscription_plans
    WHERE name = 'Free' AND is_active = true
    LIMIT 1;
  END IF;

  -- If still no plan, deny
  IF v_subscription IS NULL THEN
    RETURN false;
  END IF;

  -- Count user's bots
  SELECT COUNT(*) INTO v_bot_count
  FROM trading_bots
  WHERE user_id = p_user_id
    AND status != 'deleted';

  -- Check if under limit
  IF v_bot_count < v_subscription.max_bots THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update subscription status
CREATE OR REPLACE FUNCTION update_subscription_status(
  p_subscription_id UUID,
  p_status TEXT,
  p_invoice_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_subscriptions
  SET 
    status = p_status,
    invoice_id = COALESCE(p_invoice_id, invoice_id),
    updated_at = NOW()
  WHERE id = p_subscription_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. INSERT DEFAULT SUBSCRIPTION PLANS
-- =====================================================
INSERT INTO subscription_plans (name, display_name, description, price_monthly_usd, price_crypto, max_bots, max_trades_per_day, max_exchanges, features, sort_order)
VALUES
  (
    'Free',
    'Free Plan',
    'Perfect for testing strategies with paper trading',
    0,
    '{"BTC": "0", "USDT": "0"}'::jsonb,
    1,
    10,
    1,
    '{"paper_trading": true, "real_trading": false, "ai_optimization": false, "advanced_strategies": false}'::jsonb,
    1
  ),
  (
    'Basic',
    'Basic Plan',
    'Start real trading with up to 3 bots',
    29.99,
    '{"BTC": "0.0005", "USDT": "30", "ETH": "0.01"}'::jsonb,
    3,
    50,
    1,
    '{"paper_trading": true, "real_trading": true, "ai_optimization": false, "advanced_strategies": true}'::jsonb,
    2
  ),
  (
    'Pro',
    'Pro Plan',
    'Unlimited trading with AI optimization',
    99.99,
    '{"BTC": "0.002", "USDT": "100", "ETH": "0.04"}'::jsonb,
    10,
    NULL, -- unlimited
    3,
    '{"paper_trading": true, "real_trading": true, "ai_optimization": true, "advanced_strategies": true, "priority_support": true}'::jsonb,
    3
  ),
  (
    'Enterprise',
    'Enterprise Plan',
    'Unlimited everything with custom features',
    299.99,
    '{"BTC": "0.006", "USDT": "300", "ETH": "0.12"}'::jsonb,
    NULL, -- unlimited
    NULL, -- unlimited
    NULL, -- unlimited
    '{"paper_trading": true, "real_trading": true, "ai_optimization": true, "advanced_strategies": true, "priority_support": true, "custom_features": true, "dedicated_account_manager": true}'::jsonb,
    4
  )
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 8. TRIGGER TO AUTO-ASSIGN FREE PLAN TO NEW USERS
-- =====================================================
CREATE OR REPLACE FUNCTION assign_free_plan_to_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_free_plan_id UUID;
BEGIN
  -- Get Free plan ID
  SELECT id INTO v_free_plan_id
  FROM subscription_plans
  WHERE name = 'Free' AND is_active = true
  LIMIT 1;

  -- Create free subscription if plan exists
  IF v_free_plan_id IS NOT NULL THEN
    INSERT INTO user_subscriptions (
      user_id,
      plan_id,
      status,
      started_at,
      expires_at
    ) VALUES (
      NEW.id,
      v_free_plan_id,
      'active',
      NOW(),
      NULL -- Free plan never expires
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (only if users table exists in public schema)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    DROP TRIGGER IF EXISTS trigger_assign_free_plan ON public.users;
    CREATE TRIGGER trigger_assign_free_plan
      AFTER INSERT ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION assign_free_plan_to_new_user();
  END IF;
END $$;

-- =====================================================
-- 9. COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE subscription_plans IS 'Available subscription plans for trading bot access';
COMMENT ON TABLE user_subscriptions IS 'User subscription records with payment tracking';
COMMENT ON TABLE payment_history IS 'Payment transaction history from BTCPay Server';
COMMENT ON FUNCTION get_user_active_subscription IS 'Get user''s currently active subscription with plan details';
COMMENT ON FUNCTION can_user_create_bot IS 'Check if user has reached their bot creation limit';
COMMENT ON FUNCTION update_subscription_status IS 'Update subscription status (used by webhooks)';

