-- Allow admins to create and manage manual trade signals for any bot
-- This enables admin test trade functionality

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view manual signals" ON manual_trade_signals;
DROP POLICY IF EXISTS "Users can insert manual signals" ON manual_trade_signals;
DROP POLICY IF EXISTS "Users can update own manual signals" ON manual_trade_signals;
DROP POLICY IF EXISTS "Admins can manage manual signals" ON manual_trade_signals;

-- Create updated policies that allow admins to manage signals for any bot
CREATE POLICY "Users can view manual signals"
  ON manual_trade_signals
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE POLICY "Users can insert manual signals"
  ON manual_trade_signals
  FOR INSERT
  WITH CHECK (
    -- Users can insert their own signals
    auth.uid() = user_id
    -- OR admins can insert signals for any bot owner
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE POLICY "Users can update own manual signals"
  ON manual_trade_signals
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage manual signals"
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

-- Success message
SELECT 'Admin access to manual_trade_signals enabled!' as status;

