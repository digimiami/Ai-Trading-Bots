# 🚀 How to Use "Always Trade" in the Frontend

The "Always Trade" feature is now available directly in the frontend UI! You can enable it when creating a new bot or editing an existing bot.

---

## 📋 **Using Always Trade Mode**

### **Method 1: When Creating a New Bot**

1. **Navigate to Create Bot Page**
   - Go to `/create-bot` or click "Create Bot" in the navigation

2. **Fill in Basic Configuration**
   - Bot name, exchange, symbol, etc.

3. **Expand Advanced Strategy Configuration**
   - Scroll down to find the "⚙️ Advanced Strategy Configuration" section
   - Click to expand it

4. **Enable Always Trade Mode**
   - At the top of the advanced configuration, you'll see a red-bordered section: **"🚀 Always Trade Mode"**
   - Toggle the switch to **ON** (red when enabled)
   - You'll see a warning message when enabled

5. **Configure Risk Management** (Important!)
   - Set appropriate limits:
     - **Max Trades Per Day**: Recommended 10-20
     - **Max Concurrent Positions**: Recommended 1-3
     - **Daily Loss Limit**: Recommended 3-5%
     - **Risk Per Trade**: Recommended 0.5-1%

6. **Create the Bot**
   - Click "Create Bot" to save

---

### **Method 2: When Editing an Existing Bot**

1. **Navigate to Edit Bot Page**
   - Go to your bots list (`/bots`)
   - Click "Edit" on the bot you want to modify

2. **Find Always Trade Mode**
   - Scroll down to the "Risk Management" section
   - Above it, you'll see the **"🚀 Always Trade Mode"** section

3. **Enable/Disable**
   - Toggle the switch to enable or disable
   - The toggle will be red when enabled

4. **Save Changes**
   - Click "Update Bot" to save

---

## ⚙️ **What Happens When Enabled**

### **Trading Behavior**
- ✅ Bot trades on **every execution cycle** (typically every 1-5 minutes)
- ✅ **Bypasses all strategy conditions** (RSI, ADX, EMA, etc.)
- ✅ Trade direction determined by RSI:
  - **RSI > 50** → **SELL/SHORT** signal
  - **RSI ≤ 50** → **BUY/LONG** signal

### **Automatic Settings**
- **Stop Loss**: 2% from entry price
- **Take Profit 1**: 2% from entry price
- **Take Profit 2**: 5% from entry price
- **Confidence**: 60% (moderate confidence)

---

## ⚠️ **Important Warnings**

### **⚠️ High Trade Frequency**
- Bot will generate **many trades** (potentially hundreds per day)
- Ensure you have:
  - ✅ Sufficient balance
  - ✅ Proper position sizing
  - ✅ Risk management limits configured

### **⚠️ Recommended Settings**

When enabling Always Trade, configure these limits:

```json
{
  "max_trades_per_day": 20,      // Limit daily trades
  "max_concurrent": 2,            // Max open positions
  "cooldown_bars": 0,             // No cooldown (trades every cycle)
  "risk_per_trade_pct": 0.5,      // Lower risk per trade
  "daily_loss_limit_pct": 5.0     // Daily loss limit
}
```

### **⚠️ Test First**
- **Strongly recommended** to test with **Paper Trading** first
- Enable paper trading mode when creating the bot
- Monitor for a few hours/days before using real trading

---

## 🔍 **Visual Indicators**

### **When Enabled:**
- ✅ Toggle switch is **red** (enabled state)
- ✅ Warning message appears in yellow box
- ✅ Section has red border and red background tint

### **When Disabled:**
- ⚪ Toggle switch is **gray** (disabled state)
- ⚪ No warning message
- ⚪ Normal section styling

---

## 📊 **Example Workflow**

### **Creating a Paper Trading Bot with Always Trade:**

1. Go to Create Bot page
2. Fill in:
   - Name: "Always Trade Test - BTCUSDT"
   - Exchange: Bybit
   - Symbol: BTCUSDT
   - **Paper Trading: ON** ✅
3. Expand Advanced Strategy Configuration
4. Enable **Always Trade Mode** ✅
5. Set Risk Management:
   - Max Trades Per Day: 15
   - Max Concurrent: 2
   - Daily Loss Limit: 5%
6. Create Bot
7. Monitor the bot's activity
8. If satisfied, edit the bot and disable paper trading

---

## 🛠️ **Troubleshooting**

### **Toggle Not Working?**
- Make sure you've expanded the "Advanced Strategy Configuration" section
- Check browser console for errors
- Try refreshing the page

### **Bot Still Not Trading?**
- Verify Always Trade is enabled (toggle should be red)
- Check bot status is "running"
- Review bot logs for errors
- Ensure you've deployed the updated bot-executor function

### **Too Many Trades?**
- Edit the bot
- Reduce "Max Trades Per Day"
- Increase "Cooldown Bars" (if available)
- Reduce "Max Concurrent Positions"

---

## 📝 **Summary**

**To Enable:**
1. ✅ Create or edit a bot
2. ✅ Expand Advanced Strategy Configuration
3. ✅ Toggle "Always Trade Mode" to ON (red)
4. ✅ Configure risk management limits
5. ✅ Save the bot

**What Happens:**
- ✅ Bot trades on every execution cycle
- ✅ Trade direction based on RSI
- ✅ Automatic stop loss and take profit
- ✅ Works with both paper and real trading

**Remember:**
- ⚠️ Start with paper trading
- ⚠️ Set proper risk limits
- ⚠️ Monitor trade frequency
- ⚠️ Ensure sufficient balance

---

**Ready to use in the frontend!** 🚀

