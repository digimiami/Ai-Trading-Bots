-- ============================================
-- FIX RLS POLICIES FOR MANUAL TRADE SIGNALS
-- This ensures bot-executor can read and update manual trade signals
-- ============================================

-- Check current policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'manual_trade_signals';

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view manual signals" ON manual_trade_signals;
DROP POLICY IF EXISTS "Users can insert manual signals" ON manual_trade_signals;
DROP POLICY IF EXISTS "Users can update own manual signals" ON manual_trade_signals;
DROP POLICY IF EXISTS "Admins can manage all manual signals" ON manual_trade_signals;
DROP POLICY IF EXISTS "Service role can manage all signals" ON manual_trade_signals;

-- Policy 1: Users can view their own manual signals
CREATE POLICY "Users can view manual signals"
  ON manual_trade_signals
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can insert their own manual signals
CREATE POLICY "Users can insert manual signals"
  ON manual_trade_signals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their own manual signals
CREATE POLICY "Users can update own manual signals"
  ON manual_trade_signals
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Admins can manage all manual trade signals (view, insert, update, delete)
CREATE POLICY "Admins can manage all manual signals"
  ON manual_trade_signals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- Policy 5: Service role (bot-executor) can read and update all signals
-- This is critical for the bot-executor function to process signals
CREATE POLICY "Service role can manage all signals"
  ON manual_trade_signals
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON manual_trade_signals TO authenticated;
GRANT ALL ON manual_trade_signals TO service_role;

-- Verify policies were created
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename = 'manual_trade_signals'
ORDER BY policyname;

-- Success message
SELECT 'RLS policies for manual_trade_signals updated successfully. Bot-executor should now be able to process signals.' as status;

