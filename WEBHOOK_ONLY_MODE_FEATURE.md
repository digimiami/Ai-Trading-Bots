# 🔗 Webhook-Only Mode Feature

## Overview

Added a new `webhook_only` flag to `trading_bots` table that allows bots to **only trade via webhooks** (TradingView alerts), skipping all scheduled/cron executions.

## How It Works

### When `webhook_only = true`:
- ✅ **Webhook-triggered trades work** - TradingView alerts will still place orders
- ✅ **Manual trade signals are processed** - Webhook signals are handled normally
- ❌ **Scheduled executions are skipped** - Bot won't execute during cron runs
- ❌ **Strategy-based trades are disabled** - Bot won't evaluate strategy and trade automatically

### When `webhook_only = false` (default):
- ✅ **Normal operation** - Bot executes on schedule AND via webhooks
- ✅ **Both scheduled and webhook trades work**

## Implementation

### 1. Database Migration

**File**: `supabase/migrations/20251117_add_webhook_only_mode.sql`

Adds `webhook_only BOOLEAN DEFAULT false` column to `trading_bots` table.

### 2. Bot Executor Logic

**File**: `supabase/functions/bot-executor/index.ts`

**Changes:**
- **Line 7672**: Excludes `webhook_only = true` bots from `execute_all_bots` (scheduled execution)
- **Lines 1487-1498**: Checks `webhook_only` flag in `executeBot()` and skips regular execution if enabled
- **Manual signals are processed FIRST** (line 1458), so webhook-only bots can still trade via webhooks

## Usage

### Enable Webhook-Only Mode for a Bot

```sql
UPDATE trading_bots
SET webhook_only = true
WHERE id = 'your-bot-id';
```

### Disable Webhook-Only Mode (Normal Operation)

```sql
UPDATE trading_bots
SET webhook_only = false
WHERE id = 'your-bot-id';
```

### Enable for TradingView Bots

```sql
UPDATE trading_bots
SET webhook_only = true
WHERE id IN (
  '02511945-ef73-47df-822d-15608d1bac9e',  -- BTC TRADIGVEW
  '59f7165e-aff9-4107-b4a7-66a2ecfc5087'   -- ETH TRADINGVIEW
);
```

## Benefits

1. **Prevents Unwanted Trades** - Bot won't trade based on strategy, only when you send a webhook
2. **Saves API Calls** - No scheduled executions means fewer API calls to exchanges
3. **Full Control** - You decide exactly when to trade via TradingView alerts
4. **Still Processes Webhooks** - Manual trade signals are always processed, regardless of this flag

## Important Notes

- **Manual signals are ALWAYS processed** - Even in webhook-only mode, webhook-triggered trades work
- **Bot status must be "running"** - For webhook-only mode to work, bot status should be "running"
- **Backward compatible** - Existing bots have `webhook_only = false` by default (normal operation)

## Example Flow

### Webhook-Only Bot:
1. TradingView sends alert → `tradingview-webhook`
2. Creates `manual_trade_signals` record
3. Calls `bot-executor` with `execute_bot` action
4. `bot-executor` processes manual signal ✅
5. **Order placed on Bybit** ✅
6. Scheduled cron runs → Bot is skipped (webhook_only = true) ❌

### Normal Bot:
1. TradingView sends alert → Works ✅
2. Scheduled cron runs → Bot executes strategy and trades ✅

---

**Perfect for TradingView bots that should only trade when you send alerts!**

