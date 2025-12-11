-- Auto-assign Testing plan to new users
-- This updates the ensure_user_profile trigger to also assign the Testing plan with 14-day trial

CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
  v_subscription_id UUID;
  v_existing_subscription_count INTEGER;
  v_error_message TEXT;
BEGIN
  -- Create user profile
  INSERT INTO public.users (id, email, name, role, status, status_updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_app_meta_data->>'role', 'user'),
    'active',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.users.name),
        status_updated_at = NOW();

  -- Auto-assign Testing plan with 14-day trial (only for new users, not on conflict)
  -- Check if subscription already exists
  SELECT COUNT(*) INTO v_existing_subscription_count
  FROM user_subscriptions 
  WHERE user_id = NEW.id;

  IF v_existing_subscription_count = 0 THEN
    -- Get Testing plan ID
    SELECT id INTO v_plan_id
    FROM subscription_plans
    WHERE name = 'Testing' AND is_active = true
    LIMIT 1;

    IF v_plan_id IS NOT NULL THEN
      BEGIN
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
          NEW.id,
          v_plan_id,
          'active',
          14, -- 2 weeks
          NOW(),
          NOW(),
          NOW() + INTERVAL '14 days'
        )
        RETURNING id INTO v_subscription_id;
        
        -- Log success (using RAISE NOTICE for debugging)
        RAISE NOTICE 'Successfully assigned Testing plan to user % (subscription_id: %)', NEW.id, v_subscription_id;
      EXCEPTION
        WHEN OTHERS THEN
          -- Log error but don't fail the trigger
          v_error_message := SQLERRM;
          RAISE WARNING 'Failed to assign Testing plan to user %: %', NEW.id, v_error_message;
          -- Continue execution - don't fail user creation if subscription assignment fails
      END;
    ELSE
      RAISE WARNING 'Testing plan not found or inactive for user %', NEW.id;
    END IF;
  ELSE
    RAISE NOTICE 'User % already has % subscription(s), skipping Testing plan assignment', NEW.id, v_existing_subscription_count;
  END IF;

  RETURN NEW;
END;
$$;

