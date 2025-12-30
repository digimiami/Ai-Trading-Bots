-- Migration: 20251230_add_admin_signup_notification.sql
-- Description: Adds a trigger to notify admin when a new user signs up

-- We'll modify the existing ensure_user_profile function to also queue an admin notification
-- or call the edge function if http extension is available.

CREATE OR REPLACE FUNCTION public.notify_admin_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result RECORD;
  v_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Get configuration
  -- Note: In a real Supabase environment, you would use vault or a secrets table
  -- For now, we'll try to use the edge function directly if the http extension is enabled
  
  -- Create a record in a new admin_notifications table instead
  -- This is more reliable than synchronous HTTP calls in triggers
  INSERT INTO admin_notification_queue (type, data)
  VALUES ('new_user', jsonb_build_object(
    'id', NEW.id,
    'email', NEW.email,
    'name', NEW.name,
    'created_at', NEW.created_at
  ));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail user creation if notification fails
  RAISE WARNING 'Failed to queue admin signup notification: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create the queue table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.admin_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processed, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Add RLS to the queue table
ALTER TABLE public.admin_notification_queue ENABLE ROW LEVEL SECURITY;

-- Only admins can see the queue
CREATE POLICY admin_notification_queue_admin_policy ON public.admin_notification_queue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid() AND public.users.role = 'admin'
    )
  );

-- Create the trigger
DROP TRIGGER IF EXISTS trg_notify_admin_on_signup ON public.users;
CREATE TRIGGER trg_notify_admin_on_signup
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_on_signup();

