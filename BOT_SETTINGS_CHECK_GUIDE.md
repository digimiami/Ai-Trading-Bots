# 🔍 Bot Settings Check Guide

Quick scripts to check active bots and their configurations.

---

## **Quick Status Check**

### **Show Bot Status (Simple)**

```bash
bash scripts/show-bot-status.sh
```

**What it shows:**
- ✅ All active bots
- 📊 Basic settings (exchange, symbol, leverage)
- ⚙️ Safety settings
- ⏰ Last execution time

---

## **Detailed Check**

### **Check Active Bots (Detailed)**

```bash
bash scripts/check-active-bots.sh
```

**What it shows:**
- All running bots with full configurations
- Strategy settings
- Safety limits
- Database connection info

---

## **SQL Queries (Supabase Dashboard)**

### **Run in Supabase SQL Editor**

Open **Supabase Dashboard** → **SQL Editor** → Run these queries:

**File**: `scripts/check-bot-settings.sql`

#### **Query 1: Basic Bot List**
```sql
SELECT 
    id,
    name,
    status,
    exchange,
    symbol,
    trading_type,
    base_amount,
    leverage,
    created_at
FROM trading_bots
WHERE status = 'running'
ORDER BY created_at DESC;
```

#### **Query 2: Safety Settings**
```sql
SELECT 
    b.id,
    b.name,
    b.symbol,
    COALESCE((b.strategy_config->>'max_consecutive_losses')::int, 5) as max_consecutive_losses,
    COALESCE((b.strategy_config->>'max_trades_per_day')::int, 10) as max_trades_per_day,
    COALESCE((b.strategy_config->>'max_concurrent')::int, 3) as max_concurrent_positions
FROM trading_bots b
WHERE b.status = 'running';
```

#### **Query 3: Activity Summary (24h)**
```sql
SELECT 
    b.id,
    b.name,
    b.symbol,
    COUNT(t.id) as trades_24h,
    SUM(CASE WHEN t.pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
    SUM(CASE WHEN t.pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
    SUM(COALESCE(t.pnl, 0)) as total_pnl_24h
FROM trading_bots b
LEFT JOIN trades t ON b.id = t.bot_id 
    AND t.executed_at >= NOW() - INTERVAL '24 hours'
WHERE b.status = 'running'
GROUP BY b.id, b.name, b.symbol;
```

#### **Query 4: Current Safety Limit Status**
Shows if any limits are close to being reached:
```sql
-- Shows trades_today vs max_trades_per_day
-- Shows open_positions vs max_concurrent
-- Shows daily/weekly losses
```

---

## **Usage Examples**

### **Example 1: Quick Status**
```bash
cd /var/www/Ai-Trading-Bots
bash scripts/show-bot-status.sh
```

**Output:**
```
╔══════════════════════════════════════════════════════════╗
║         🤖 Active Bots Status Overview                  ║
╚══════════════════════════════════════════════════════════╝

✅ Found 2 active bot(s)

============================================================
🤖 Bot #1: ETH $$$
============================================================
  ID:      6c325f80-0ac2-481c-9d91-f2332828a1b8
  Status:  running
  Exchange: bybit
  Symbol:  ETHUSDT
  Type:    futures
  
  💰 Trading Settings:
    Base Amount: $50
    Leverage:    5x
    Risk Level:  medium
  
  ⚙️  Safety Settings:
    Max Consecutive Losses: 5
    Max Trades/Day: 8
    Max Positions: 3
  
  ⏰ Last Execution: 2025-10-31 08:21:37
```

### **Example 2: Detailed Check**
```bash
bash scripts/check-active-bots.sh
```

Shows full JSON configurations for each bot.

### **Example 3: SQL Query**
1. Go to **Supabase Dashboard**
2. **SQL Editor** → **New Query**
3. Copy queries from `scripts/check-bot-settings.sql`
4. **Run**

---

## **What to Look For**

### **✅ Good Signs:**
- Status: `running`
- Recent `last_execution_at` timestamp
- Safety limits not reached
- Recent trades in activity summary

### **⚠️ Warning Signs:**
- No `last_execution_at` (bot not executing)
- `trades_today` >= `max_trades_per_day` (limit reached)
- `open_positions` >= `max_concurrent` (position limit reached)
- High daily/weekly losses approaching limits

---

## **Troubleshooting**

### **Issue: Scripts show "No active bots"**

**Check:**
1. Bot status in database:
   ```sql
   SELECT id, name, status FROM trading_bots;
   ```
2. Make sure status is `'running'` (not `'active'` or `'paused'`)

### **Issue: Script fails to connect**

**Fix:**
1. Check `.env.cron` has `SUPABASE_ANON_KEY`
2. Verify `SUPABASE_URL` is correct
3. Test API connection:
   ```bash
   curl "${SUPABASE_URL}/rest/v1/trading_bots?select=id,name&limit=1" \
     -H "apikey: ${SUPABASE_ANON_KEY}"
   ```

---

## **Summary**

**Quick Check:**
```bash
bash scripts/show-bot-status.sh
```

**Detailed Check:**
```bash
bash scripts/check-active-bots.sh
```

**SQL Queries:**
- Copy queries from `scripts/check-bot-settings.sql`
- Run in Supabase SQL Editor

---

**These scripts help you quickly verify bot configurations and identify any issues!** ✅

