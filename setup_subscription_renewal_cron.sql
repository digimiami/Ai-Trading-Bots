-- =====================================================
-- SUBSCRIPTION RENEWAL AUTOMATION
-- =====================================================
-- Sets up a cron job to check for expiring subscriptions
-- and generate renewal invoices automatically

-- =====================================================
-- 1. CREATE FUNCTION TO TRIGGER RENEWAL CHECK
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_subscription_renewal()
RETURNS void AS $$
BEGIN
  -- Call the Supabase Edge Function via HTTP
  -- This will be handled by pg_net extension if available
  -- Or use a scheduled task/cron job on your server
  PERFORM
    net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/subscription-renewal',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
        'x-cron-secret', current_setting('app.cron_secret', true)
      ),
      body := '{}'::jsonb
    );
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail
    RAISE WARNING 'Failed to trigger subscription renewal: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. SET UP PG_CRON JOB (if pg_cron extension available)
-- =====================================================
-- Note: This requires pg_cron extension to be enabled
-- If not available, use external cron job instead

DO $$
BEGIN
  -- Check if pg_cron extension exists
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Schedule daily check at 2 AM UTC
    PERFORM cron.schedule(
      'subscription-renewal-daily',
      '0 2 * * *', -- Daily at 2 AM UTC
      $$SELECT trigger_subscription_renewal()$$
    );
    
    RAISE NOTICE 'pg_cron job scheduled successfully';
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Use external cron job instead.';
  END IF;
END $$;

-- =====================================================
-- 3. ALTERNATIVE: EXTERNAL CRON JOB SETUP
-- =====================================================
-- If pg_cron is not available, set up a cron job on your server:
--
-- Add to crontab (crontab -e):
-- 0 2 * * * curl -X POST https://your-project.supabase.co/functions/v1/subscription-renewal \
--   -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
--   -H "x-cron-secret: YOUR_CRON_SECRET" \
--   -H "Content-Type: application/json"
--
-- This runs daily at 2 AM UTC

-- =====================================================
-- 4. HELPER FUNCTION TO CHECK EXPIRING SUBSCRIPTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION get_expiring_subscriptions(days_ahead INTEGER DEFAULT 7)
RETURNS TABLE (
  subscription_id UUID,
  user_id UUID,
  user_email TEXT,
  plan_name TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  days_until_expiry INTEGER,
  price_monthly_usd DECIMAL,
  has_renewal_invoice BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.id as subscription_id,
    us.user_id,
    u.email as user_email,
    sp.name as plan_name,
    us.expires_at,
    EXTRACT(DAY FROM (us.expires_at - NOW()))::INTEGER as days_until_expiry,
    sp.price_monthly_usd,
    (us.metadata->>'renewal_invoice_id') IS NOT NULL as has_renewal_invoice
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  JOIN auth.users u ON us.user_id = u.id
  WHERE us.status = 'active'
    AND us.expires_at IS NOT NULL
    AND us.expires_at BETWEEN NOW() AND NOW() + (days_ahead || ' days')::INTERVAL
    AND sp.price_monthly_usd > 0 -- Skip free plans
  ORDER BY us.expires_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. COMMENTS
-- =====================================================
COMMENT ON FUNCTION trigger_subscription_renewal IS 'Triggers subscription renewal check via Edge Function';
COMMENT ON FUNCTION get_expiring_subscriptions IS 'Get subscriptions expiring within specified days';

