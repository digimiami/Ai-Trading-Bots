# 📱 **Telegram Notifications Setup Guide**

## **✅ What's Implemented**

Your Pablo AI Trading Platform now has **full Telegram notification support**! Get real-time alerts for:

- 💰 **Trade Executed** - Every trade your bots make
- 🚀 **Bot Started** - When bots are activated
- 🛑 **Bot Stopped** - When bots are deactivated
- ❌ **Errors** - Trading errors and issues
- 🎉 **Profit Alerts** - When you make profitable trades
- ⚠️ **Loss Alerts** - When trades result in losses
- 📊 **Daily Summary** - End-of-day performance report

---

## **🚀 Quick Setup (5 Minutes)**

### **Step 1: Create Your Telegram Bot**

1. **Open Telegram** and search for **@BotFather**
2. **Send command**: `/newbot`
3. **Choose a name** for your bot (e.g., "Pablo Trading Alerts")
4. **Choose a username** for your bot (must end with "bot", e.g., "pablo_trading_alerts_bot")
5. **Copy the Bot Token** you receive (looks like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### **Step 2: Get Your Chat ID**

1. **Search for** **@userinfobot** on Telegram
2. **Send** `/start`
3. **Copy your ID** (the number shown)

### **Step 3: Configure in Pablo**

1. Go to **Settings**: http://localhost:3000/settings
2. Scroll to **"Telegram Notifications"** section
3. Click **"Setup Telegram Notifications"**
4. **Paste**:
   - Bot Token (from Step 1)
   - Chat ID (from Step 2)
5. **Select** which notifications you want
6. Click **"Save Configuration"**
7. Click **"📨 Test"** to verify it works!

You should receive a test message on Telegram! 🎉

---

## **📦 Database Migration Required**

**Run this in Supabase SQL Editor:**

Open: https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc/sql

Paste and run: `supabase/migrations/20251026_add_telegram_notifications.sql`

This creates:
- ✅ `telegram_config` table - Stores your Telegram credentials
- ✅ `notification_logs` table - Tracks all sent notifications
- ✅ Helper functions for queuing notifications

---

## **🔌 Edge Function Deployed**

**Function**: `telegram-notifier` ✅ **Deployed**

**URL**: `https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/telegram-notifier`

**Actions:**
- `GET ?action=get_config` - Fetch Telegram configuration
- `GET ?action=get_logs` - Fetch notification history
- `POST ?action=save_config` - Save Telegram credentials
- `POST ?action=test` - Send test message
- `POST ?action=send` - Send notification

---

## **📨 Notification Examples**

### **Trade Executed**
```
💰 Trade Executed

Bot: BTC Scalper
Symbol: BTCUSDT
Side: BUY
Price: $65,432.10
Amount: 0.015 BTC
Order ID: abc123xyz
```

### **Bot Started**
```
🚀 Bot Started

PABLO BNB AI-COMBO is now running
Symbol: BNBUSDT
Exchange: BYBIT
```

### **Profit Alert**
```
🎉 Profit Alert!

Bot: ETH Momentum
Profit: $45.20
Win Rate: 73.5%
Total P&L: $1,247.80
```

### **Error Alert**
```
❌ Error Alert

Bot: SOL Scalper
Error: Insufficient balance
Details: Order value $500 exceeds available balance
```

### **Daily Summary**
```
📊 Daily Summary

Total Trades: 47
Win Rate: 68.1%
Total P&L: +$234.56
Active Bots: 9
Best Performer: BTC DCA-5X (+$89.23)
```

---

## **🔧 How to Use Programmatically**

### **Send Notification from Your Code**

```typescript
// Example: Send trade execution notification
import { supabase } from './lib/supabase';

async function notifyTradeExecuted(bot, trade) {
  const { data: { session } } = await supabase.auth.getSession();
  
  await fetch(
    `${process.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/telegram-notifier?action=send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notification_type: 'trade_executed',
        data: {
          bot_name: bot.name,
          symbol: bot.symbol,
          side: trade.side,
          price: trade.price,
          amount: trade.amount,
          order_id: trade.orderId
        }
      })
    }
  );
}
```

### **Send Bot Started Notification**

```typescript
async function notifyBotStarted(bot) {
  await fetch(
    `${process.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/telegram-notifier?action=send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notification_type: 'bot_started',
        data: {
          bot_name: bot.name,
          symbol: bot.symbol,
          exchange: bot.exchange
        }
      })
    }
  );
}
```

---

## **🎯 Integration with Bot Executor**

Add notifications to your bot execution flow:

```typescript
// In bot-executor Edge function
async function executeBot(bot) {
  try {
    // Execute trade
    const trade = await placeTrade(bot);
    
    // Send notification
    await queueTelegramNotification(
      bot.user_id,
      'trade_executed',
      {
        bot_name: bot.name,
        symbol: bot.symbol,
        side: trade.side,
        price: trade.price,
        amount: trade.quantity,
        order_id: trade.orderId
      }
    );
    
  } catch (error) {
    // Send error notification
    await queueTelegramNotification(
      bot.user_id,
      'error_occurred',
      {
        bot_name: bot.name,
        error_message: error.message,
        details: error.details
      }
    );
  }
}
```

---

## **📊 Notification Settings**

### **Enable/Disable Individual Notifications**

In Settings → Telegram Notifications, toggle:
- ✅ Trade Executed
- ✅ Bot Started
- ✅ Bot Stopped
- ✅ Errors
- ✅ Profit Alert
- ✅ Loss Alert
- ✅ Daily Summary

### **Disable All Notifications**

Uncheck the "Enabled" toggle to stop all notifications while keeping your configuration saved.

---

## **🔒 Security Notes**

### **Bot Token Security**
- ⚠️ **NEVER share your bot token** with anyone
- ⚠️ Bot token is stored encrypted in Supabase
- ⚠️ Only you can send messages to your chat

### **Chat ID Privacy**
- Your Chat ID is private and only accessible by your bot
- Group chat IDs can be used for team notifications

### **Recommended Settings**
- Use your **personal Telegram account** for alerts
- Create a **dedicated chat** or channel for bot notifications
- Enable **2FA** on your Telegram account

---

## **🆘 Troubleshooting**

### **Test Message Not Received?**

1. **Check Bot Token**: Make sure you copied it correctly from @BotFather
2. **Check Chat ID**: Verify with @userinfobot
3. **Start the Bot**: Send `/start` to your bot on Telegram first
4. **Check Spam**: Look in Telegram's archived or spam chats

### **Notifications Not Sending?**

1. **Verify Configuration**: Go to Settings → Telegram Notifications
2. **Check Enabled**: Make sure the main toggle is ON
3. **Check Individual Toggles**: Enable the notification types you want
4. **View Logs**: Check notification_logs table in Supabase

### **503 Error When Deploying?**

If the Edge function deployment fails:
1. Wait 1-2 minutes and try again
2. Check Supabase status page
3. Function may still be deployed - test it!

---

## **📈 Advanced Features**

### **Group Notifications**

Want team notifications?
1. Create a Telegram group
2. Add your bot to the group
3. Get the group Chat ID (negative number)
4. Use the group Chat ID in settings

### **Custom Notification Logic**

```sql
-- Only notify for large profits (>$50)
SELECT queue_telegram_notification(
    user_id,
    'profit_alert',
    format('Profit: $%s', profit)
)
FROM trades
WHERE profit > 50;
```

### **Daily Summary Automation**

Set up a scheduled Edge function (cron job) to send daily summaries:

```typescript
// supabase/functions/daily-telegram-summary/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (_req) => {
  // Calculate daily stats
  // Send via telegram-notifier
  // Return success
});
```

---

## **✅ Setup Checklist**

- [ ] Created Telegram bot with @BotFather
- [ ] Got Bot Token
- [ ] Got Chat ID from @userinfobot
- [ ] Ran SQL migration in Supabase
- [ ] Configured in Pablo Settings
- [ ] Sent test message successfully
- [ ] Selected desired notification types
- [ ] Integrated with bot executor (optional)

---

## **🎉 You're All Set!**

Your Telegram notifications are now active! You'll receive real-time alerts about your trading bots directly on your phone.

**Never miss a trade again!** 📱🚀

