# 🛡️ Safety Settings Location in Bot Settings

## **Where to Find Safety Settings**

### **📍 Location: Create Bot Page**

When creating a new bot, safety settings are located in:

**Path**: `Create Bot` → `Advanced Strategy Configuration` → Scroll down to:

1. **🛡️ Risk Management Section** (Red border)
   - Risk Per Trade (%)
   - Daily Loss Limit (%)
   - Max Trades/Day
   - Weekly Loss Limit (%) ⭐ **NEW**
   - Max Concurrent Positions ⭐ **NEW**

2. **🛡️ Safety Features Section** (Orange border) ⭐ **NEW**
   - Max Consecutive Losses

---

## **🎯 How to Configure**

### **Step 1: Create a New Bot**

1. Go to **Create Bot** page
2. Fill in basic bot information
3. Scroll to **"⚙️ Advanced Strategy Configuration"**
4. Click to expand if collapsed

### **Step 2: Configure Safety Features**

#### **In Risk Management Section:**
- **Weekly Loss Limit**: Set percentage (default: 6%)
- **Max Concurrent Positions**: Set number (default: 2)

#### **In Safety Features Section:**
- **Max Consecutive Losses**: Set number (default: 5)
  - Bot will auto-pause after this many consecutive losses

---

## **📋 Available Safety Settings**

### **1. Max Consecutive Losses**
- **Location**: Safety Features section
- **Default**: 5
- **Range**: 2-10
- **Effect**: Auto-pauses bot after X consecutive losses

### **2. Daily Loss Limit**
- **Location**: Risk Management section
- **Default**: 3%
- **Range**: 1-10%
- **Effect**: Auto-pauses bot if daily loss exceeds limit

### **3. Weekly Loss Limit**
- **Location**: Risk Management section ⭐ **NEW**
- **Default**: 6%
- **Range**: 2-15%
- **Effect**: Auto-pauses bot if weekly loss exceeds limit

### **4. Max Trades Per Day**
- **Location**: Risk Management section
- **Default**: 8
- **Range**: 2-20
- **Effect**: Blocks new trades after reaching limit (resets daily)

### **5. Max Concurrent Positions**
- **Location**: Risk Management section ⭐ **NEW**
- **Default**: 2
- **Range**: 1-5
- **Effect**: Blocks new trades when max positions are open

---

## **💡 Settings Summary**

### **Current Defaults:**
```json
{
  "max_consecutive_losses": 5,
  "daily_loss_limit_pct": 3.0,
  "weekly_loss_limit_pct": 6.0,
  "max_trades_per_day": 8,
  "max_concurrent": 2
}
```

### **Recommended Conservative Settings:**
```json
{
  "max_consecutive_losses": 3,
  "daily_loss_limit_pct": 2.0,
  "weekly_loss_limit_pct": 5.0,
  "max_trades_per_day": 5,
  "max_concurrent": 1
}
```

### **Recommended Aggressive Settings:**
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

## **🔧 Editing Safety Settings for Existing Bots**

### **Option 1: Via Database (Recommended)**

```sql
UPDATE trading_bots
SET strategy_config = jsonb_set(
  COALESCE(strategy_config, '{}'::jsonb),
  '{max_consecutive_losses}', 
  '5'::jsonb
)
WHERE id = 'your-bot-id';
```

### **Option 2: Via API (Future Enhancement)**

The edit bot page can be enhanced to include safety settings UI. For now, use the database method above.

---

## **✅ Verification**

After configuring safety settings:

1. **Check bot `strategy_config`:**
```sql
SELECT 
  id, 
  name,
  strategy_config->>'max_consecutive_losses' as max_consecutive_losses,
  strategy_config->>'daily_loss_limit_pct' as daily_loss_limit,
  strategy_config->>'weekly_loss_limit_pct' as weekly_loss_limit,
  strategy_config->>'max_trades_per_day' as max_trades,
  strategy_config->>'max_concurrent' as max_concurrent
FROM trading_bots
WHERE id = 'your-bot-id';
```

2. **Test Safety Limits:**
   - Trigger consecutive losses → Bot should auto-pause
   - Exceed daily loss → Bot should auto-pause
   - Exceed weekly loss → Bot should auto-pause
   - Reach max trades → Trading should stop for today

---

## **📝 Notes**

- Safety settings are saved in `strategy_config` JSONB column
- Settings apply immediately after bot is created
- Auto-pause happens automatically when limits are breached
- Check `bot_activity_logs` for safety limit breach notifications

---

**Location Summary**: Safety settings are in **Create Bot** → **Advanced Strategy Configuration** → **Risk Management** & **Safety Features** sections ✅

