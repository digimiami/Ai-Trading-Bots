# 🚨 URGENT: Create Paper Trading Tables

## Error:
```
Could not find the table 'public.paper_trading_accounts' in the schema cache
```

## ✅ SOLUTION - Run This SQL Now:

### Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** (left sidebar)

### Step 2: Copy & Run This SQL:
Open `CREATE_PAPER_TRADING_TABLES.sql` and copy **ALL** the SQL.

Or copy directly from here:
```sql
-- Create paper_trading_accounts table
CREATE TABLE IF NOT EXISTS paper_trading_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance DECIMAL NOT NULL DEFAULT 10000,
  initial_balance DECIMAL NOT NULL DEFAULT 10000,
  total_deposited DECIMAL DEFAULT 0,
  total_withdrawn DECIMAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paper_accounts_user ON paper_trading_accounts(user_id);

-- Create paper_trading_positions table
CREATE TABLE IF NOT EXISTS paper_trading_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES trading_bots(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  exchange TEXT NOT NULL,
  trading_type TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  entry_price DECIMAL NOT NULL,
  quantity DECIMAL NOT NULL,
  leverage INTEGER DEFAULT 1,
  stop_loss_price DECIMAL,
  take_profit_price DECIMAL,
  current_price DECIMAL,
  unrealized_pnl DECIMAL DEFAULT 0,
  margin_used DECIMAL NOT NULL,
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'stopped', 'taken_profit', 'manual_close')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paper_positions_bot ON paper_trading_positions(bot_id);
CREATE INDEX IF NOT EXISTS idx_paper_positions_user ON paper_trading_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_paper_positions_status ON paper_trading_positions(status);

-- Create paper_trading_trades table
CREATE TABLE IF NOT EXISTS paper_trading_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES trading_bots(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  position_id UUID REFERENCES paper_trading_positions(id),
  symbol TEXT NOT NULL,
  exchange TEXT NOT NULL,
  side TEXT NOT NULL,
  entry_price DECIMAL NOT NULL,
  exit_price DECIMAL,
  quantity DECIMAL NOT NULL,
  leverage INTEGER DEFAULT 1,
  pnl DECIMAL DEFAULT 0,
  pnl_percentage DECIMAL DEFAULT 0,
  fees DECIMAL DEFAULT 0.001,
  margin_used DECIMAL NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'filled' CHECK (status IN ('filled', 'closed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paper_trades_bot ON paper_trading_trades(bot_id);
CREATE INDEX IF NOT EXISTS idx_paper_trades_user ON paper_trading_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_paper_trades_position ON paper_trading_trades(position_id);

-- Enable RLS
ALTER TABLE paper_trading_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_trading_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_trading_trades ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own paper account" ON paper_trading_accounts;
DROP POLICY IF EXISTS "Users can update own paper account" ON paper_trading_accounts;
DROP POLICY IF EXISTS "Users can insert own paper account" ON paper_trading_accounts;
DROP POLICY IF EXISTS "Users can view own paper positions" ON paper_trading_positions;
DROP POLICY IF EXISTS "Users can manage own paper positions" ON paper_trading_positions;
DROP POLICY IF EXISTS "Users can view own paper trades" ON paper_trading_trades;
DROP POLICY IF EXISTS "Users can insert own paper trades" ON paper_trading_trades;

-- RLS Policies
CREATE POLICY "Users can view own paper account" ON paper_trading_accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own paper account" ON paper_trading_accounts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own paper account" ON paper_trading_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own paper positions" ON paper_trading_positions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own paper positions" ON paper_trading_positions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own paper trades" ON paper_trading_trades
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own paper trades" ON paper_trading_trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Success message
SELECT '✅ Paper trading tables created successfully!' as status;
```

### Step 3: Verify
After running, you should see:
- ✅ "✅ Paper trading tables created successfully!"

### Step 4: Test
1. Wait 10-20 seconds for schema cache to refresh
2. Try running your paper trading bot again
3. Should work now!

---

## 📋 What This Creates:
- ✅ `paper_trading_accounts` - Virtual balance management
- ✅ `paper_trading_positions` - Open positions tracking
- ✅ `paper_trading_trades` - Trade history
- ✅ RLS policies for security
- ✅ Indexes for performance

---

## ⚠️ Important:
- Make sure you ran `QUICK_FIX_PAPER_TRADING.sql` first (adds columns to trading_bots)
- Then run this SQL to create the tables
- Wait a few seconds after running for schema cache to refresh



