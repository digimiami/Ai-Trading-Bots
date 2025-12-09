-- =====================================================
-- UPDATE SUBSCRIPTION SYSTEM WITH TESTING PLAN & ADMIN ACCESS
-- =====================================================

-- 1. Add trial_period_days and trial_started_at to user_subscriptions
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS trial_period_days INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Update can_user_create_bot to check admin and trial expiration
CREATE OR REPLACE FUNCTION can_user_create_bot(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_role TEXT;
  v_active_subscription RECORD;
  v_current_bot_count INTEGER;
  v_trial_expired BOOLEAN;
  v_trial_days_remaining INTEGER;
BEGIN
  -- Check if user is admin - admins get unlimited access
  SELECT role INTO v_user_role
  FROM users
  WHERE id = p_user_id;
  
  IF v_user_role = 'admin' THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', 'Admin users have unlimited access',
      'max_bots', null,
      'current_bots', 0,
      'remaining_bots', null
    );
  END IF;

  -- Get active subscription
  SELECT * INTO v_active_subscription
  FROM user_subscriptions
  WHERE user_id = p_user_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no active subscription, check for free plan assignment
  IF v_active_subscription IS NULL THEN
    -- Try to assign free plan
    PERFORM assign_free_plan_to_new_user(p_user_id);
    
    -- Get subscription again
    SELECT * INTO v_active_subscription
    FROM user_subscriptions
    WHERE user_id = p_user_id
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- Still no subscription - deny
  IF v_active_subscription IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'No active subscription. Please subscribe to a plan.',
      'max_bots', 0,
      'current_bots', 0,
      'remaining_bots', 0
    );
  END IF;

  -- Check trial expiration for Testing plan
  IF v_active_subscription.trial_started_at IS NOT NULL 
     AND v_active_subscription.trial_period_days IS NOT NULL THEN
    v_trial_days_remaining := v_active_subscription.trial_period_days - 
      EXTRACT(DAY FROM (NOW() - v_active_subscription.trial_started_at))::INTEGER;
    
    IF v_trial_days_remaining <= 0 THEN
      v_trial_expired := true;
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Trial period has expired. Please upgrade to continue using the service.',
        'max_bots', 1,
        'current_bots', 0,
        'remaining_bots', 0,
        'trial_expired', true,
        'trial_days_remaining', 0
      );
    END IF;
  END IF;

  -- Get plan details
  DECLARE
    v_plan RECORD;
  BEGIN
    SELECT * INTO v_plan
    FROM subscription_plans
    WHERE id = v_active_subscription.plan_id;
    
    -- If plan allows unlimited bots
    IF v_plan.max_bots IS NULL THEN
      RETURN jsonb_build_object(
        'allowed', true,
        'reason', 'Unlimited bots allowed',
        'max_bots', null,
        'current_bots', 0,
        'remaining_bots', null
      );
    END IF;
  END;

  -- Count current bots
  SELECT COUNT(*) INTO v_current_bot_count
  FROM trading_bots
  WHERE user_id = p_user_id
    AND status != 'deleted';

  -- Get plan max_bots
  DECLARE
    v_max_bots INTEGER;
  BEGIN
    SELECT max_bots INTO v_max_bots
    FROM subscription_plans
    WHERE id = v_active_subscription.plan_id;
    
    IF v_max_bots IS NULL THEN
      RETURN jsonb_build_object(
        'allowed', true,
        'reason', 'Unlimited bots allowed',
        'max_bots', null,
        'current_bots', v_current_bot_count,
        'remaining_bots', null
      );
    END IF;

    IF v_current_bot_count >= v_max_bots THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', format('You have reached your bot limit (%s bots). Please upgrade your plan.', v_max_bots),
        'max_bots', v_max_bots,
        'current_bots', v_current_bot_count,
        'remaining_bots', 0
      );
    END IF;

    RETURN jsonb_build_object(
      'allowed', true,
      'reason', 'Bot creation allowed',
      'max_bots', v_max_bots,
      'current_bots', v_current_bot_count,
      'remaining_bots', v_max_bots - v_current_bot_count,
      'trial_days_remaining', v_trial_days_remaining
    );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Add Testing plan with 2-week trial
INSERT INTO subscription_plans (name, display_name, description, price_monthly_usd, price_crypto, max_bots, max_trades_per_day, max_exchanges, features, sort_order)
VALUES
  (
    'Testing',
    'Testing Plan',
    '2-week free trial: 1 bot, 10 trades/day, real & paper trading',
    0,
    '{"BTC": "0", "USDT": "0"}'::jsonb,
    1,
    10,
    1,
    '{"paper_trading": true, "real_trading": true, "ai_optimization": false, "advanced_strategies": false, "trial_days": 14}'::jsonb,
    0
  )
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  price_monthly_usd = EXCLUDED.price_monthly_usd,
  price_crypto = EXCLUDED.price_crypto,
  max_bots = EXCLUDED.max_bots,
  max_trades_per_day = EXCLUDED.max_trades_per_day,
  max_exchanges = EXCLUDED.max_exchanges,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order;

-- 4. Function to assign Testing plan with trial
CREATE OR REPLACE FUNCTION assign_testing_plan_to_new_user(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_plan_id UUID;
  v_subscription_id UUID;
BEGIN
  -- Get Testing plan ID
  SELECT id INTO v_plan_id
  FROM subscription_plans
  WHERE name = 'Testing'
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Testing plan not found';
  END IF;

  -- Create subscription with trial
  INSERT INTO user_subscriptions (
    user_id,
    plan_id,
    status,
    trial_period_days,
    trial_started_at,
    started_at,
    expires_at
  )
  VALUES (
    p_user_id,
    v_plan_id,
    'active',
    14, -- 2 weeks
    NOW(),
    NOW(),
    NOW() + INTERVAL '14 days'
  )
  RETURNING id INTO v_subscription_id;

  RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update assign_free_plan_to_new_user to use Testing plan instead
CREATE OR REPLACE FUNCTION assign_free_plan_to_new_user(p_user_id UUID)
RETURNS UUID AS $$
BEGIN
  -- Use Testing plan for new users (2-week trial)
  RETURN assign_testing_plan_to_new_user(p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function to check if user can trade (check daily trade limit and trial)
CREATE OR REPLACE FUNCTION can_user_trade(p_user_id UUID, p_trade_type TEXT DEFAULT 'real')
RETURNS JSONB AS $$
DECLARE
  v_user_role TEXT;
  v_active_subscription RECORD;
  v_today_trade_count INTEGER;
  v_max_trades INTEGER;
  v_trial_expired BOOLEAN;
BEGIN
  -- Check if user is admin - admins get unlimited access
  SELECT role INTO v_user_role
  FROM users
  WHERE id = p_user_id;
  
  IF v_user_role = 'admin' THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', 'Admin users have unlimited access',
      'max_trades', null,
      'current_trades', 0,
      'remaining_trades', null
    );
  END IF;

  -- Get active subscription
  SELECT * INTO v_active_subscription
  FROM user_subscriptions
  WHERE user_id = p_user_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_active_subscription IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'No active subscription',
      'max_trades', 0,
      'current_trades', 0,
      'remaining_trades', 0
    );
  END IF;

  -- Check trial expiration
  IF v_active_subscription.trial_started_at IS NOT NULL 
     AND v_active_subscription.trial_period_days IS NOT NULL THEN
    IF EXTRACT(DAY FROM (NOW() - v_active_subscription.trial_started_at))::INTEGER >= v_active_subscription.trial_period_days THEN
      v_trial_expired := true;
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Trial period has expired. Please upgrade to continue trading.',
        'max_trades', 10,
        'current_trades', 0,
        'remaining_trades', 0,
        'trial_expired', true
      );
    END IF;
  END IF;

  -- Get plan max_trades_per_day
  SELECT max_trades_per_day INTO v_max_trades
  FROM subscription_plans
  WHERE id = v_active_subscription.plan_id;

  IF v_max_trades IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', 'Unlimited trades allowed',
      'max_trades', null,
      'current_trades', 0,
      'remaining_trades', null
    );
  END IF;

  -- Count today's trades
  SELECT COUNT(*) INTO v_today_trade_count
  FROM trades
  WHERE user_id = p_user_id
    AND DATE(created_at) = CURRENT_DATE
    AND (p_trade_type = 'all' OR (p_trade_type = 'real' AND paper_trading = false) OR (p_trade_type = 'paper' AND paper_trading = true));

  IF v_today_trade_count >= v_max_trades THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Daily trade limit reached (%s trades). Limit resets at midnight.', v_max_trades),
      'max_trades', v_max_trades,
      'current_trades', v_today_trade_count,
      'remaining_trades', 0
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'Trading allowed',
    'max_trades', v_max_trades,
    'current_trades', v_today_trade_count,
    'remaining_trades', v_max_trades - v_today_trade_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_user_create_bot IS 'Check if user can create a bot - admins get unlimited, checks subscription limits and trial expiration';
COMMENT ON FUNCTION can_user_trade IS 'Check if user can trade - admins get unlimited, checks daily trade limits and trial expiration';

