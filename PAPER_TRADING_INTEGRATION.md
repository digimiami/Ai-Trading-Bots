# 🎯 PAPER TRADING INTEGRATION - COMPREHENSIVE IMPLEMENTATION

You are tasked with adding a complete Paper Trading system to the Pablo AI Trading application. This system must use REAL MAINNET market data for accuracy but simulate all trades without placing real orders.

## 🎯 CRITICAL REQUIREMENTS

### ✅ MUST HAVE:
1. **Toggle Switch**: Toggle between Paper Trading and Real Trading modes
2. **Virtual Balance Management**: Set initial paper trading balance, add more funds
3. **Real Mainnet API Data**: Use live market data from mainnet APIs (Bybit/OKX)
4. **Zero Impact on Real Trading**: Existing real trading must work exactly as before
5. **Complete Isolation**: Paper trading should never interfere with real API calls

### ⚠️ CRITICAL CONSTRAINTS:
- **DO NOT** modify existing real trading logic
- **DO NOT** change existing API order placement functions
- **DO NOT** affect existing bot execution flow for real trading
- **USE** real mainnet market data APIs (same as real trading)
- **SIMULATE** orders only when paper_trading = true

---

## 📋 IMPLEMENTATION REQUIREMENTS

### 1. DATABASE SCHEMA CHANGES

**Add to `trading_bots` table:**
```sql
ALTER TABLE trading_bots 
ADD COLUMN IF NOT EXISTS paper_trading BOOLEAN DEFAULT false;

ALTER TABLE trading_bots
ADD COLUMN IF NOT EXISTS paper_balance DECIMAL DEFAULT 10000; -- Default $10,000 virtual balance
```

**Create `paper_trading_accounts` table:**
```sql
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

CREATE INDEX idx_paper_accounts_user ON paper_trading_accounts(user_id);
```

**Create `paper_trading_positions` table:**
```sql
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

CREATE INDEX idx_paper_positions_bot ON paper_trading_positions(bot_id);
CREATE INDEX idx_paper_positions_user ON paper_trading_positions(user_id);
CREATE INDEX idx_paper_positions_status ON paper_trading_positions(status);
```

**Create `paper_trading_trades` table:**
```sql
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
  fees DECIMAL DEFAULT 0.001, -- 0.1% fee simulation
  margin_used DECIMAL NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'filled' CHECK (status IN ('filled', 'closed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_paper_trades_bot ON paper_trading_trades(bot_id);
CREATE INDEX idx_paper_trades_user ON paper_trading_trades(user_id);
CREATE INDEX idx_paper_trades_position ON paper_trading_trades(position_id);
```

**Enable RLS:**
```sql
ALTER TABLE paper_trading_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_trading_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_trading_trades ENABLE ROW LEVEL SECURITY;

-- RLS Policies for paper_trading_accounts
CREATE POLICY "Users can view own paper account" ON paper_trading_accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own paper account" ON paper_trading_accounts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own paper account" ON paper_trading_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for paper_trading_positions
CREATE POLICY "Users can view own paper positions" ON paper_trading_positions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own paper positions" ON paper_trading_positions
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for paper_trading_trades
CREATE POLICY "Users can view own paper trades" ON paper_trading_trades
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own paper trades" ON paper_trading_trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

---

## ✅ VALIDATION CHECKLIST

Before completing, verify:

- [ ] Paper trading toggle works in bot creation form
- [ ] Paper trading toggle works in bot edit page
- [ ] Paper trading mode uses REAL mainnet market data (check logs)
- [ ] Paper trading mode does NOT place real API orders
- [ ] Real trading mode works exactly as before (test with real bot)
- [ ] Paper balance management works (add funds, view balance)
- [ ] Paper positions update with real market prices
- [ ] SL/TP triggers work correctly in paper trading
- [ ] Paper trades are recorded in database
- [ ] Bot performance metrics update from paper trades
- [ ] No interference between paper and real trading

---

## 🚨 CRITICAL: DO NOT BREAK REAL TRADING

- **NEVER** modify existing `placeBybitOrder()` or `placeOKXOrder()` functions
- **NEVER** change existing API call logic
- **ALWAYS** check `paper_trading` flag BEFORE any real API calls
- **ALWAYS** return early if `paper_trading === true`
- **USE** same market data fetching functions for consistency
- **ISOLATE** paper trading completely from real trading code paths

