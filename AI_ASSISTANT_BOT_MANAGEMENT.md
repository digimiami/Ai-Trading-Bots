# AI Assistant Bot Management Feature

## Overview

The AI Assistant at `/ai-assistant` now has full access to create, edit, and manage your trading bots! You can simply ask the AI to create or modify bots, and it will do it for you.

## ✨ Features

### 1. **Create Bots**
Ask the AI to create new bots with optimized settings:
- "Create a BTCUSDT bot with RSI strategy, low risk"
- "Set up an ETHUSDT futures bot with 5x leverage"
- "Make a bot for SOLUSDT with medium risk"

### 2. **Edit Bots**
Modify existing bots based on your requests:
- "Update my BTC bot to use tighter stop loss"
- "Change my bot's take profit to 6%"
- "Switch my bot to paper trading mode"

### 3. **View Bot Performance**
Get detailed performance metrics:
- "Show me my bot's performance"
- "What's the win rate of my BTC bot?"

### 4. **Context Awareness**
The AI knows about all your existing bots and can:
- Avoid creating duplicate bots
- Reference your current bot configurations
- Make recommendations based on your actual bot data

## 🚀 How It Works

### Technical Implementation

1. **Edge Function Enhancement** (`supabase/functions/ai-assistant/index.ts`)
   - Fetches user's bots before each AI call
   - Includes bot data in AI context
   - Uses OpenAI function calling (tools) for bot operations
   - Executes bot creation/updates via Supabase

2. **Function Calling**
   - `create_bot`: Creates new trading bots
   - `update_bot`: Modifies existing bots
   - `get_bot_performance`: Retrieves bot performance metrics

3. **Frontend Integration** (`src/pages/ai-assistant/page.tsx`)
   - Detects bot actions in AI responses
   - Shows action notifications
   - Refreshes bot list automatically
   - Provides "View Bots" button after actions

## 📋 Example Conversations

### Creating a Bot
```
User: "Create a BTCUSDT bot with RSI strategy, low risk"

AI: "I'll create a BTCUSDT bot with RSI strategy optimized for low risk settings..."

✅ Created bot: "BTCUSDT RSI Low Risk" (BTCUSDT)
```

### Updating a Bot
```
User: "Update my BTC bot to use 2% stop loss instead"

AI: "I'll update your BTC bot's stop loss to 2%..."

✅ Updated bot: "BTCUSDT RSI Low Risk"
```

### Getting Performance
```
User: "How is my BTC bot performing?"

AI: "Let me check your BTC bot's performance..."

📊 Bot Performance: BTCUSDT RSI Low Risk - PnL: 45.23 USDT (2.1%), Win Rate: 65%, Trades: 20
```

## 🔒 Safety Features

1. **Paper Trading Default**: New bots default to paper trading mode for safety
2. **Subscription Limits**: Checks bot creation limits before creating
3. **User Verification**: Ensures bots belong to the authenticated user
4. **Error Handling**: Graceful error messages if operations fail
5. **Action Notifications**: Clear feedback when actions complete

## ⚙️ Configuration

### Required Setup

1. **OpenAI API Key** (for function calling support)
   - Function calling works best with OpenAI (gpt-4o)
   - DeepSeek may not support function calling
   - Configure in Settings → AI API Configuration

2. **Supabase Service Role Key**
   - Must be set in Edge Function secrets
   - Required for bot operations

### Bot Creation Defaults

The AI uses smart defaults based on risk level:

**Low Risk:**
- Stop Loss: 1.5%
- Take Profit: 3.0%
- Trade Amount: 50 USDT
- Leverage: 1x (spot) or 1x (futures)

**Medium Risk:**
- Stop Loss: 2.5%
- Take Profit: 5.0%
- Trade Amount: 100 USDT
- Leverage: 1x (spot) or 2x (futures)

**High Risk:**
- Stop Loss: 4.0%
- Take Profit: 8.0%
- Trade Amount: 200 USDT
- Leverage: 1x (spot) or 5x (futures)

## 🎯 Best Practices

1. **Be Specific**: The more details you provide, the better the AI can configure your bot
2. **Start with Paper Trading**: Always test new bots in paper trading mode first
3. **Review Before Starting**: Bots are created in 'stopped' status - review settings before starting
4. **Check Limits**: Be aware of your subscription bot limits
5. **Monitor Performance**: Use the AI to check bot performance regularly

## 🔧 Technical Details

### Function Calling Format

The AI uses OpenAI's function calling (tools) API:

```typescript
{
  tools: [
    {
      type: 'function',
      function: {
        name: 'create_bot',
        description: '...',
        parameters: { ... }
      }
    }
  ]
}
```

### Bot Data Structure

Bots are created with this structure:
- Basic settings (name, exchange, symbol, timeframe)
- Risk management (stop loss, take profit, trade amount)
- Strategy configuration (RSI, ADX, etc.)
- Advanced settings (strategy config, paper trading)

### Error Handling

- Subscription limit checks
- Bot ownership verification
- Database error handling
- User-friendly error messages

## 📝 Notes

- **OpenAI vs DeepSeek**: Function calling works with OpenAI. DeepSeek may fall back to text-only responses.
- **Bot Status**: New bots are created in 'stopped' status - you must start them manually
- **Paper Trading**: Defaults to paper trading for safety - change in bot settings if needed
- **Strategy Defaults**: If no strategy specified, defaults to RSI with standard parameters

## 🐛 Troubleshooting

### AI doesn't create bots
- Check OpenAI API key is configured
- Verify Supabase Service Role Key is set
- Check subscription limits
- Review browser console for errors

### Function calling not working
- Ensure using OpenAI (not DeepSeek)
- Check API key is valid
- Verify model supports function calling (gpt-4o recommended)

### Bots not appearing
- Check "View Bots" button after creation
- Refresh bot list manually
- Verify bot was created in database

## 🎉 Success!

Your AI Assistant can now:
- ✅ Create bots on command
- ✅ Edit existing bots
- ✅ View bot performance
- ✅ Make recommendations based on your actual bot data
- ✅ Optimize settings automatically

Just ask naturally, and the AI will handle the rest!

