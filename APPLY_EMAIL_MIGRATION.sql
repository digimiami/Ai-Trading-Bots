-- Email System Migration
-- Run this in Supabase SQL Editor to create mailboxes and emails tables

-- Mailboxes table (for managing email addresses)
CREATE TABLE IF NOT EXISTS public.mailboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address TEXT UNIQUE NOT NULL,
  display_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emails table (for storing sent/received emails)
CREATE TABLE IF NOT EXISTS public.emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID REFERENCES public.mailboxes(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  cc_addresses TEXT[],
  bcc_addresses TEXT[],
  subject TEXT,
  text_body TEXT,
  html_body TEXT,
  message_id TEXT,
  in_reply_to TEXT,
  thread_id TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'pending')),
  error_message TEXT,
  metadata JSONB,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_emails_mailbox_id ON public.emails(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_emails_direction ON public.emails(direction);
CREATE INDEX IF NOT EXISTS idx_emails_to_address ON public.emails(to_address);
CREATE INDEX IF NOT EXISTS idx_emails_from_address ON public.emails(from_address);
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON public.emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_created_at ON public.emails(created_at DESC);

-- Insert default mailboxes
INSERT INTO public.mailboxes (email_address, display_name) VALUES
  ('no-reply@pablobots.com', 'Pablo Bots - No Reply'),
  ('support@pablobots.com', 'Pablo Bots - Support'),
  ('alerts@pablobots.com', 'Pablo Bots - Alerts'),
  ('contact@pablobots.com', 'Pablo Bots - Contact'),
  ('pablo@pablobots.com', 'Pablo Bots - Pablo')
ON CONFLICT (email_address) DO NOTHING;

-- RLS Policies
ALTER TABLE public.mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on both tables (to avoid conflicts)
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    -- Drop all policies on mailboxes
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'mailboxes'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.mailboxes', pol.policyname);
    END LOOP;
    
    -- Drop all policies on emails
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'emails'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.emails', pol.policyname);
    END LOOP;
END $$;

-- Admin can manage mailboxes
CREATE POLICY "Admins can manage mailboxes"
  ON public.mailboxes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admin can view all emails
CREATE POLICY "Admins can view all emails"
  ON public.emails
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admin can insert emails
CREATE POLICY "Admins can insert emails"
  ON public.emails
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admin can update emails
CREATE POLICY "Admins can update emails"
  ON public.emails
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Comments
COMMENT ON TABLE public.mailboxes IS 'Email addresses managed by admin for sending emails';
COMMENT ON TABLE public.emails IS 'Sent and received emails stored for admin management';

-- Refresh PostgREST schema cache (CRITICAL - must do this!)
NOTIFY pgrst, 'reload schema';

-- Wait a moment for cache refresh
SELECT pg_sleep(1);

-- Success message
SELECT 'Email system tables created successfully! Schema cache refreshed.' as status;
