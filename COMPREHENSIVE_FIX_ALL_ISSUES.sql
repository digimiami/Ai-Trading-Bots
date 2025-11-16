-- ============================================
-- COMPREHENSIVE FIX FOR ALL TRADING ISSUES
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: FIX RLS POLICIES FOR MANUAL TRADE SIGNALS
-- ============================================

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

-- Policy 4: Admins can manage all manual trade signals
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
-- Note: Service role typically bypasses RLS, but this policy ensures compatibility
CREATE POLICY "Service role can manage all signals"
  ON manual_trade_signals
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON manual_trade_signals TO authenticated;
GRANT ALL ON manual_trade_signals TO service_role;

-- ============================================
-- PART 2: DIAGNOSTIC QUERIES
-- ============================================

-- 1. Check bot status and paper_trading flags
SELECT 
  '=== BOT STATUS CHECK ===' as section,
  b.id,
  b.name,
  b.status,
  b.paper_trading,
  b.exchange,
  b.symbol,
  b.user_id,
  u.email as owner_email,
  CASE 
    WHEN b.paper_trading = true THEN '📝 PAPER MODE'
    WHEN b.paper_trading = false THEN '💵 REAL MODE'
    ELSE '❓ UNKNOWN'
  END as trading_mode
FROM trading_bots b
LEFT JOIN auth.users u ON b.user_id = u.id
WHERE b.status = 'running'
ORDER BY b.paper_trading, b.created_at DESC;

-- 2. Check API keys configuration
SELECT 
  '=== API KEYS CHECK ===' as section,
  u.email,
  ak.exchange,
  ak.is_active,
  ak.is_testnet,
  ak.created_at,
  ak.updated_at,
  CASE 
    WHEN ak.is_active = true AND ak.is_testnet = false THEN '✅ ACTIVE (MAINNET)'
    WHEN ak.is_active = true AND ak.is_testnet = true THEN '✅ ACTIVE (TESTNET)'
    WHEN ak.is_active = false THEN '❌ INACTIVE'
    ELSE '❓ UNKNOWN'
  END as api_key_status
FROM api_keys ak
JOIN auth.users u ON ak.user_id = u.id
WHERE ak.exchange = 'bybit'
ORDER BY ak.updated_at DESC;

-- 3. Check bots with missing or invalid API keys
SELECT 
  '=== BOTS WITH API KEY ISSUES ===' as section,
  b.id,
  b.name,
  b.exchange,
  b.symbol,
  b.user_id,
  u.email as owner_email,
  CASE 
    WHEN ak.id IS NULL THEN '❌ NO API KEYS'
    WHEN ak.is_active = false THEN '❌ API KEYS INACTIVE'
    WHEN ak.is_testnet IS NULL THEN '❓ TESTNET FLAG MISSING'
    ELSE '✅ API KEYS OK'
  END as api_key_status,
  ak.is_testnet as api_testnet_flag
FROM trading_bots b
LEFT JOIN auth.users u ON b.user_id = u.id
LEFT JOIN api_keys ak ON ak.user_id = b.user_id 
  AND ak.exchange = b.exchange 
  AND ak.is_active = true
WHERE b.status = 'running'
  AND b.paper_trading = false  -- Only check real trading bots
  AND (ak.id IS NULL OR ak.is_active = false)
ORDER BY b.created_at DESC;

-- 4. Check pending manual trade signals
SELECT 
  '=== PENDING MANUAL TRADE SIGNALS ===' as section,
  mts.id,
  mts.bot_id,
  b.name as bot_name,
  mts.side,
  mts.mode,
  mts.status,
  mts.error,
  mts.created_at,
  EXTRACT(EPOCH FROM (NOW() - mts.created_at)) / 60 as minutes_old,
  b.paper_trading as bot_paper_mode,
  CASE 
    WHEN mts.status = 'pending' AND EXTRACT(EPOCH FROM (NOW() - mts.created_at)) / 60 > 30 THEN '🚨 STUCK > 30 min'
    WHEN mts.status = 'pending' AND EXTRACT(EPOCH FROM (NOW() - mts.created_at)) / 60 > 5 THEN '⚠️ STUCK > 5 min'
    WHEN mts.status = 'processing' THEN '🔄 PROCESSING'
    ELSE '⏳ PENDING'
  END as signal_status
FROM manual_trade_signals mts
JOIN trading_bots b ON mts.bot_id = b.id
WHERE mts.status IN ('pending', 'processing')
  AND mts.created_at > NOW() - INTERVAL '24 hours'
ORDER BY mts.created_at DESC;

-- 5. Check recent errors from bot activity logs
SELECT 
  '=== RECENT ERRORS ===' as section,
  bal.bot_id,
  b.name as bot_name,
  bal.level,
  bal.message,
  bal.timestamp,
  CASE 
    WHEN bal.message LIKE '%API key%' OR bal.message LIKE '%10003%' THEN '🔑 API KEY ISSUE'
    WHEN bal.message LIKE '%403%' OR bal.message LIKE '%Forbidden%' THEN '🚫 HTTP 403 ERROR'
    WHEN bal.message LIKE '%price%' OR bal.message LIKE '%unavailable%' THEN '💰 PRICE FETCH ERROR'
    WHEN bal.message LIKE '%balance%' OR bal.message LIKE '%insufficient%' THEN '💵 BALANCE ISSUE'
    ELSE '❌ OTHER ERROR'
  END as error_category
FROM bot_activity_logs bal
JOIN trading_bots b ON bal.bot_id = b.id
WHERE bal.level = 'error'
  AND bal.timestamp > NOW() - INTERVAL '24 hours'
ORDER BY bal.timestamp DESC
LIMIT 20;

-- 6. Check recent real trades
SELECT 
  '=== RECENT REAL TRADES ===' as section,
  COUNT(*) as total_real_trades,
  COUNT(*) FILTER (WHERE status = 'filled') as filled,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE exchange_order_id IS NOT NULL) as has_order_id,
  MIN(created_at) as first_trade,
  MAX(created_at) as last_trade
FROM trades
WHERE created_at > NOW() - INTERVAL '7 days';

-- ============================================
-- PART 3: SUMMARY
-- ============================================

SELECT 
  '=== FIX SUMMARY ===' as section,
  '✅ RLS policies for manual_trade_signals updated' as fix_1,
  '✅ Diagnostic queries completed' as fix_2,
  '📋 Review the diagnostic results above' as next_step_1,
  '🔑 Update API keys if needed (see API KEYS CHECK section)' as next_step_2,
  '🔄 Verify bot paper_trading flags (see BOT STATUS CHECK section)' as next_step_3;

