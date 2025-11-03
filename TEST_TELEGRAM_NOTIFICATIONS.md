# 🔔 Testing Telegram Notifications for Trade Alerts

This guide will help you:
1. Check telegram-notifier function logs
2. Set up and execute a test trade to verify notifications

## 📋 Prerequisites

Before testing, ensure:
- ✅ Telegram bot token and chat ID are configured in Settings → Telegram Notifications
- ✅ `trade_executed` notifications are enabled in your Telegram settings
- ✅ You have at least one bot with status `running`
- ✅ The bot has valid API keys configured

---

## 🔍 Step 1: Check telegram-notifier Logs

### Option A: Via Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **dkawxgwdqiirgmmjbvhc**
3. Navigate to **Edge Functions** in the left sidebar
4. Click on **`telegram-notifier`**
5. Click on **Logs** tab
6. Filter logs by:
   - **Time Range**: Last 24 hours or Last hour
   - **Event Type**: All or Log
   - **Level**: All levels (or just `info` and `error`)

### What to Look For:

#### ✅ Success Indicators:
```
✅ Telegram notification sent successfully
✅ Message sent to Telegram chat: [chat_id]
```

#### ❌ Error Indicators:
```
⚠️ Failed to send Telegram notification
❌ Telegram API error: [error message]
⚠️ User not found for Telegram notification
⚠️ Telegram config not found
```

### Option B: Via Supabase CLI

```bash
# View recent logs
npx supabase functions logs telegram-notifier --limit 50

# View logs in real-time
npx supabase functions logs telegram-notifier --follow
```

---

## 🧪 Step 2: Check bot-executor Logs for Notification Attempts

The `bot-executor` function logs when it tries to send notifications:

1. Go to **Edge Functions** → **`bot-executor`**
2. Click **Logs** tab
3. Search for: `Telegram notification` or `sendTradeNotification`

### Success Log Messages:
```
✅ Telegram notification sent for trade: [trade-id]
```

### Warning Log Messages:
```
⚠️ Failed to send Telegram notification (non-critical): [error]
⚠️ Supabase URL or Anon Key not configured for Telegram notifications
```

**Note**: The bot-executor will NOT fail a trade if notification fails - it just logs a warning.

---

## 🚀 Step 3: Execute a Test Trade

### Method 1: Using Frontend UI (Easiest)

1. Open your app in the browser
2. Navigate to **Bots** page
3. Find a bot with status `running`
4. If no running bots:
   - Create a new bot OR
   - Edit an existing bot and set status to `running`
5. The bot will be executed automatically by the cron job (every few minutes)
   
   **OR** manually trigger execution:
   - Open browser console (F12)
   - Run:
   ```javascript
   // Get your bot ID from the Bots page
   const botId = 'your-bot-id-here';
   
   // Import the hook (if available) or call API directly
   fetch('https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/bot-executor', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${localStorage.getItem('sb-access-token') || 'YOUR_ANON_KEY'}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       action: 'execute_bot',
       botId: botId
     })
   }).then(r => r.json()).then(console.log);
   ```

### Method 2: Direct API Call (via curl or Postman)

```bash
# Replace YOUR_ANON_KEY and YOUR_BOT_ID
curl -X POST \
  'https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/bot-executor' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -H 'apikey: YOUR_ANON_KEY' \
  -d '{
    "action": "execute_bot",
    "botId": "YOUR_BOT_ID"
  }'
```

### Method 3: Using useBotExecutor Hook (If available in your UI)

Some UI components might have a "Test" or "Execute Now" button that uses the `useBotExecutor` hook.

---

## 📊 Step 4: Verify Notification Was Sent

After executing a trade, check:

1. **Telegram App**: Check if you received a message like:
   ```
   💰 Trade Executed
   
   Bot: [Bot Name]
   Symbol: BTCUSDT
   Side: BUY
   Price: $43,250.50
   Amount: 0.001
   Order ID: [Order ID]
   ```

2. **Supabase Logs**: Check both functions:
   - `bot-executor`: Should show `✅ Telegram notification sent for trade: [id]`
   - `telegram-notifier`: Should show `✅ Message sent to Telegram chat`

3. **Database**: Check `trades` table to confirm trade was recorded:
   ```sql
   SELECT * FROM trades 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

---

## 🐛 Troubleshooting

### Problem: No notification received but trade executed

1. **Check Telegram Config**:
   ```sql
   SELECT * FROM telegram_config 
   WHERE user_id = auth.uid();
   ```
   - Verify `bot_token` and `chat_id` are correct
   - Verify `enabled = true`
   - Verify `notifications.trade_executed = true`

2. **Check Logs**:
   - Look for errors in `telegram-notifier` logs
   - Common errors:
     - `Telegram API error: Invalid bot token`
     - `Telegram API error: Chat not found`
     - `Telegram API error: Unauthorized`

3. **Test Telegram Connection**:
   - Go to Settings → Telegram Notifications
   - Click "Test Notification"
   - If test works but trade alerts don't, the issue is in `bot-executor` → `telegram-notifier` flow

### Problem: "Telegram notification sent" in logs but no message received

1. **Check Chat ID**: 
   - Ensure chat_id in database matches your Telegram chat
   - Send a message to your bot first to initialize the chat

2. **Check Bot Permissions**:
   - Ensure the bot has permission to send messages
   - Ensure you haven't blocked the bot

3. **Verify Notification Enabled**:
   ```sql
   SELECT notifications->>'trade_executed' as trade_enabled
   FROM telegram_config 
   WHERE user_id = auth.uid();
   ```

### Problem: Notification fails silently

Check `bot-executor` logs for warnings like:
```
⚠️ Failed to send Telegram notification (non-critical): [error]
```

This means:
- Trade executed successfully ✅
- Notification failed ❌
- Check `telegram-notifier` logs for the actual error

---

## ✅ Verification Checklist

After testing, verify:

- [ ] Trade was executed and recorded in database
- [ ] `bot-executor` logs show `✅ Telegram notification sent`
- [ ] `telegram-notifier` logs show successful message send
- [ ] Telegram message received in your chat
- [ ] Message contains correct trade details (bot name, symbol, side, price, amount)

---

## 📝 Expected Log Flow

When a trade executes successfully, you should see this sequence:

1. **bot-executor** logs:
   ```
   ✅ Trade recorded successfully: [trade object]
   ✅ Telegram notification sent for trade: [trade-id]
   ```

2. **telegram-notifier** logs:
   ```
   ✅ Received notification request: trade_executed
   ✅ Fetching Telegram config for user: [user-id]
   ✅ Message sent to Telegram chat: [chat-id]
   ✅ Telegram notification sent successfully
   ```

If any step is missing, that's where the issue is!

---

## 🎯 Quick Test Script

Run this in your browser console (on your app page):

```javascript
// Quick test - get your bot ID from the Bots page first
async function testTradeNotification() {
  try {
    // Get Supabase client (adjust based on your setup)
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      'https://dkawxgwdqiirgmmjbvhc.supabase.co',
      'YOUR_ANON_KEY'
    );
    
    // Get first running bot
    const { data: bots } = await supabase
      .from('trading_bots')
      .select('id, name, symbol')
      .eq('status', 'running')
      .limit(1);
    
    if (!bots || bots.length === 0) {
      console.error('❌ No running bots found');
      return;
    }
    
    const bot = bots[0];
    console.log('🤖 Testing with bot:', bot.name, '(', bot.id, ')');
    
    // Execute bot
    const response = await fetch(
      'https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/bot-executor',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
          'apikey': 'YOUR_ANON_KEY'
        },
        body: JSON.stringify({
          action: 'execute_bot',
          botId: bot.id
        })
      }
    );
    
    const result = await response.json();
    console.log('📊 Execution result:', result);
    console.log('✅ Check your Telegram chat and Supabase logs!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test
testTradeNotification();
```

---

## 📞 Still Having Issues?

If notifications still don't work after following this guide:

1. Share the relevant logs from both functions
2. Verify Telegram config is correct
3. Check if test notifications work (Settings → Telegram → Test)
4. Check database for recent trades

