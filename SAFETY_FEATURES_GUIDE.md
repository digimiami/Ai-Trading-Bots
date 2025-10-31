# 🛡️ Safety Features Guide

## **Overview**

Comprehensive safety features have been added to protect your trading bots from excessive losses and manage risk automatically.

---

## **🛡️ Safety Features Implemented**

### **1. Emergency Stop (Global Kill Switch)**
**Purpose**: Instantly stop all trading across all bots

**How it works:**
- Set `emergency_stop: true` in user metadata or system settings
- All bots will stop trading immediately
- Works as a global kill switch for emergency situations

**How to activate:**
```sql
-- For specific user
UPDATE users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb), 
  '{emergency_stop}', 
  'true'::jsonb
)
WHERE id = 'user-id-here';

-- For all users (admin only)
INSERT INTO system_settings (key, value, created_at)
VALUES ('emergency_stop', 'true', NOW())
ON CONFLICT (key) DO UPDATE SET value = 'true';
```

**How to deactivate:**
```sql
-- For specific user
UPDATE users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb), 
  '{emergency_stop}', 
  'false'::jsonb
)
WHERE id = 'user-id-here';

-- For all users
UPDATE system_settings SET value = 'false' WHERE key = 'emergency_stop';
```

---

### **2. Max Consecutive Losses**
**Purpose**: Stop trading after X consecutive losses to prevent revenge trading

**Default**: 5 consecutive losses

**How it works:**
- Tracks consecutive losses from most recent trades
- When limit is reached, bot is automatically paused
- Prevents emotional trading after a losing streak

**Configuration:**
```json
{
  "max_consecutive_losses": 5
}
```

**Example:**
- Bot loses 5 trades in a row → Trading paused automatically
- Bot wins 1 trade → Counter resets

---

### **3. Daily Loss Limit**
**Purpose**: Stop trading if daily loss exceeds threshold

**Default**: 3% of account or $X

**How it works:**
- Calculates total losses for the day
- When daily loss limit is reached, bot is paused for the day
- Resets at midnight UTC

**Configuration:**
```json
{
  "daily_loss_limit_pct": 3.0
}
```

**Example:**
- Daily loss limit: $100
- Bot loses $50 → Still trading
- Bot loses another $60 → Trading paused (total loss: $110 > $100)

---

### **4. Weekly Loss Limit**
**Purpose**: Stop trading if weekly loss exceeds threshold

**Default**: 6% of account

**How it works:**
- Calculates total losses for the last 7 days
- When weekly loss limit is reached, bot is paused for the week
- Prevents extended losing periods

**Configuration:**
```json
{
  "weekly_loss_limit_pct": 6.0
}
```

---

### **5. Max Trades Per Day**
**Purpose**: Prevent overtrading

**Default**: 8 trades per day

**How it works:**
- Counts total trades executed today
- When limit is reached, trading stops until tomorrow
- Protects from excessive trading fees and overtrading

**Configuration:**
```json
{
  "max_trades_per_day": 8
}
```

**Example:**
- Max trades per day: 8
- Bot executes 8 trades → Trading stops for today
- At midnight UTC → Counter resets, trading resumes

---

### **6. Max Concurrent Positions**
**Purpose**: Limit number of open positions simultaneously

**Default**: 2 concurrent positions

**How it works:**
- Counts open/pending positions
- When limit is reached, new trades are blocked
- Reduces risk from too many simultaneous positions

**Configuration:**
```json
{
  "max_concurrent": 2
}
```

**Example:**
- Max concurrent: 2
- Bot has 2 open positions → New trades blocked
- One position closes → New trades allowed again

---

## **📊 Safety Check Flow**

```
Bot Execution Starts
       ↓
🛡️ Safety Checks
       ↓
1. Emergency Stop? → YES → ⛔ Stop Trading
       ↓ NO
2. Bot Running? → NO → ⛔ Stop Trading
       ↓ YES
3. Max Consecutive Losses? → YES → ⛔ Pause Bot
       ↓ NO
4. Daily Loss Limit? → YES → ⛔ Pause Bot
       ↓ NO
5. Weekly Loss Limit? → YES → ⛔ Pause Bot
       ↓ NO
6. Max Trades Today? → YES → ⛔ Stop for Today
       ↓ NO
7. Max Concurrent Positions? → YES → ⛔ Block New Trades
       ↓ NO
✅ All Checks Passed → Execute Trade
```

---

## **⚙️ Configuration**

### **Setting Safety Limits Per Bot**

Update `strategy_config` in `trading_bots` table:

```sql
UPDATE trading_bots
SET strategy_config = jsonb_set(
  COALESCE(strategy_config, '{}'::jsonb),
  '{max_consecutive_losses}', 
  '3'::jsonb  -- Stop after 3 consecutive losses
)
WHERE id = 'bot-id-here';

UPDATE trading_bots
SET strategy_config = jsonb_set(
  COALESCE(strategy_config, '{}'::jsonb),
  '{daily_loss_limit_pct}', 
  '2.0'::jsonb  -- 2% daily loss limit
)
WHERE id = 'bot-id-here';
```

### **Complete Safety Config Example:**

```json
{
  "max_consecutive_losses": 5,
  "daily_loss_limit_pct": 3.0,
  "weekly_loss_limit_pct": 6.0,
  "max_trades_per_day": 8,
  "max_concurrent": 2
}
```

---

## **📝 Safety Logs**

All safety checks are logged in `bot_activity_logs`:

```sql
SELECT * FROM bot_activity_logs 
WHERE category = 'safety' 
ORDER BY timestamp DESC 
LIMIT 10;
```

**Example Log Messages:**
- `Trading blocked: Max consecutive losses reached: 5/5. Trading paused for safety.`
- `Trading blocked: Daily loss limit exceeded: $105.00 >= $100.00. Trading paused for today.`
- `Bot paused automatically: Max consecutive losses reached`

---

## **🔄 Auto-Pause Behavior**

When a critical safety limit is breached, the bot is automatically paused:

**Auto-paused when:**
- ✅ Emergency stop activated
- ✅ Max consecutive losses reached
- ✅ Daily loss limit exceeded
- ✅ Weekly loss limit exceeded

**NOT auto-paused when:**
- ⚠️ Max trades per day reached (resets tomorrow)
- ⚠️ Max concurrent positions reached (resets when position closes)

**To resume bot after auto-pause:**
```sql
UPDATE trading_bots 
SET status = 'running' 
WHERE id = 'bot-id-here';
```

**Note**: Make sure to address the safety issue before resuming!

---

## **🚨 Emergency Stop Usage**

### **When to Use:**
- Major market crash or volatility
- API issues or exchange problems
- Account security concerns
- Strategy issues detected
- Manual intervention needed

### **How to Activate Quickly:**

```sql
-- Quick emergency stop for all bots
UPDATE users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb), 
  '{emergency_stop}', 
  'true'::jsonb
)
WHERE id IN (
  SELECT DISTINCT user_id FROM trading_bots WHERE status = 'running'
);
```

---

## **📈 Best Practices**

### **Recommended Settings:**

**Conservative:**
```json
{
  "max_consecutive_losses": 3,
  "daily_loss_limit_pct": 2.0,
  "weekly_loss_limit_pct": 5.0,
  "max_trades_per_day": 5,
  "max_concurrent": 1
}
```

**Moderate:**
```json
{
  "max_consecutive_losses": 5,
  "daily_loss_limit_pct": 3.0,
  "weekly_loss_limit_pct": 6.0,
  "max_trades_per_day": 8,
  "max_concurrent": 2
}
```

**Aggressive:**
```json
{
  "max_consecutive_losses": 7,
  "daily_loss_limit_pct": 5.0,
  "weekly_loss_limit_pct": 10.0,
  "max_trades_per_day": 15,
  "max_concurrent": 3
}
```

---

## **✅ Summary**

**Safety Features Added:**
1. ✅ Emergency Stop (Global Kill Switch)
2. ✅ Max Consecutive Losses (Default: 5)
3. ✅ Daily Loss Limit (Default: 3%)
4. ✅ Weekly Loss Limit (Default: 6%)
5. ✅ Max Trades Per Day (Default: 8)
6. ✅ Max Concurrent Positions (Default: 2)

**Benefits:**
- 🛡️ Automatic risk protection
- 🚨 Emergency stop capability
- 📊 Prevents overtrading
- 🔄 Auto-pause on critical limits
- 📝 Comprehensive logging

Your bots are now protected with comprehensive safety features! 🎉

