# How Pablo AI Trading and TradingView Work Together

This document explains the complete integration flow between TradingView (charting platform) and Pablo AI Trading (automated trading bot system).

---

## 🎯 Overview

**TradingView** is a charting platform where you create trading strategies/alerts.  
**Pablo AI Trading** is an automated trading bot system that executes trades on cryptocurrency exchanges (like Bybit).

The integration allows you to:
1. Create trading alerts in TradingView based on your strategies
2. Have those alerts automatically trigger trades in Pablo AI Trading
3. Execute those trades on real exchanges (or paper trade mode)

---

## 📊 Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRADINGVIEW                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Your Trading Strategy/Alert                             │   │
│  │  - Strategy conditions trigger                           │   │
│  │  - Alert fires when conditions met                       │   │
│  │  - Sends HTTP POST request with JSON payload             │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP POST
                             │ JSON Payload:
                             │ {
                             │   "secret": "webhook_secret",
                             │   "botId": "uuid",
                             │   "action": "buy" or "sell",
                             │   "instrument": "BTCUSDT",
                             │   "mode": "real" or "paper",
                             │   ...
                             │ }
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│          SUPABASE EDGE FUNCTION                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  tradingview-webhook (index.ts)                          │   │
│  │                                                           │   │
│  │  1. Receives webhook request                             │   │
│  │  2. Validates webhook secret                             │   │
│  │  3. Parses JSON payload                                  │   │
│  │  4. Creates record in manual_trade_signals table         │   │
│  │  5. Logs to bot_activity_logs                            │   │
│  │  6. Triggers bot-executor (if immediate execution)       │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Database Insert
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  manual_trade_signals table                              │   │
│  │  - bot_id                                                │   │
│  │  - side (buy/sell)                                       │   │
│  │  - mode (real/paper)                                     │   │
│  │  - status (pending/processing/completed/failed)          │   │
│  │  - metadata (TradingView variables)                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Query for pending signals
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│          SUPABASE EDGE FUNCTION                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  bot-executor (index.ts)                                 │   │
│  │                                                           │   │
│  │  1. Processes manual_trade_signals                       │   │
│  │  2. Updates signal status to "processing"                │   │
│  │  3. Calls executeManualTrade()                           │   │
│  │  4. Validates bot configuration                          │   │
│  │  5. Determines mode (real vs paper)                      │   │
│  │  6. Routes to exchange API or paper trading executor     │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
    ┌──────────────────────┐  ┌──────────────────────┐
    │   REAL TRADING       │  │  PAPER TRADING       │
    │                      │  │                      │
    │  Exchange API        │  │  PaperTradingExecutor│
    │  (Bybit, etc.)       │  │  - Virtual balance   │
    │  - Place order       │  │  - Simulate trades   │
    │  - Check balance     │  │  - Track P&L         │
    │  - Update position   │  │  - No real money     │
    └──────────────────────┘  └──────────────────────┘
                    │                 │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Database       │
                    │  - trades table │
                    │  - positions    │
                    │  - P&L records  │
                    └─────────────────┘
```

---

## 🔄 Step-by-Step Process

### **Step 1: TradingView Alert Configuration**

In TradingView, you configure an alert with:

**Webhook URL:**
```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/tradingview-webhook
```

**Alert Message (JSON):**
```json
{
  "secret": "your_webhook_secret_here",
  "botId": "your-bot-uuid-here",
  "action": "{{strategy.order.action}}",
  "instrument": "{{ticker}}",
  "amount": "{{strategy.order.contracts}}",
  "mode": "real",
  "reason": "TradingView alert signal"
}
```

**Key TradingView Variables:**
- `{{strategy.order.action}}` → Automatically becomes `"buy"` or `"sell"` when alert fires
- `{{ticker}}` → Symbol like `BTCUSDT`
- `{{strategy.order.contracts}}` → Number of contracts/shares
- `{{timenow}}` → Timestamp when alert fired

### **Step 2: Webhook Reception**

When your TradingView strategy conditions are met:

1. **TradingView sends HTTP POST** to `tradingview-webhook` function
2. **Function receives request** at `supabase/functions/tradingview-webhook/index.ts`
3. **Validates webhook secret** (matches bot's `webhook_secret` or global secret)
4. **Parses JSON payload** and extracts trading parameters

### **Step 3: Signal Storage**

The webhook function:

1. **Creates record** in `manual_trade_signals` table with:
   - `bot_id` - Which bot should execute
   - `side` - "buy" or "sell" (normalized from action)
   - `mode` - "real" or "paper"
   - `status` - "pending"
   - `metadata` - All TradingView variables stored for reference

2. **Logs activity** to `bot_activity_logs` table (visible in UI)

3. **Triggers bot-executor** (if `trigger_execution` is enabled)

### **Step 4: Bot Execution**

The `bot-executor` function:

1. **Queries** `manual_trade_signals` for pending signals
2. **Updates signal status** to "processing"
3. **Loads bot configuration** from `trading_bots` table
4. **Validates** bot is active and properly configured
5. **Calls `executeManualTrade()`** method

### **Step 5: Trade Execution**

The execution depends on mode:

**Real Trading Mode:**
- Connects to exchange API (Bybit, etc.)
- Places actual order on exchange
- Updates balance and position
- Records trade in `trades` table

**Paper Trading Mode:**
- Uses `PaperTradingExecutor` class
- Simulates trade execution
- Updates virtual balance
- Records in `paper_trading_trades` table
- Uses real market prices for accuracy

### **Step 6: Signal Completion**

After trade execution:

1. **Signal status** updated to "completed" or "failed"
2. **Trade record** created in appropriate table
3. **Bot activity log** updated with results
4. **P&L calculated** and recorded

---

## 🔑 Key Components

### **1. tradingview-webhook Function**
**Location:** `supabase/functions/tradingview-webhook/index.ts`

**Responsibilities:**
- Receives webhook requests from TradingView
- Validates authentication (webhook secret)
- Parses and normalizes payload
- Creates `manual_trade_signals` records
- Triggers immediate bot execution if enabled
- Logs all webhook calls to `webhook_calls` table

**Key Features:**
- Supports multiple payload formats (JSON, form data, query params)
- Handles TradingView template variables
- Normalizes symbol names (removes `.P`, `.PERP` suffixes)
- Security: Validates webhook secrets per-bot

### **2. bot-executor Function**
**Location:** `supabase/functions/bot-executor/index.ts`

**Responsibilities:**
- Processes pending `manual_trade_signals`
- Executes trades on exchanges
- Manages paper trading execution
- Updates bot performance metrics
- Handles errors and retries

**Key Methods:**
- `processManualSignals()` - Finds and processes pending signals
- `executeManualTrade()` - Executes individual trade
- `PaperTradingExecutor` - Handles paper trading mode

### **3. Database Tables**

**`manual_trade_signals`**
- Stores all TradingView webhook signals
- Tracks status: pending → processing → completed/failed
- Contains metadata with all TradingView variables

**`trading_bots`**
- Bot configuration
- `webhook_secret` - Per-bot authentication
- `webhook_trigger_immediate` - Auto-execute on signal
- `webhook_only` - Only trade via webhooks (skip scheduled runs)

**`trades` / `paper_trading_trades`**
- Records of executed trades
- Contains P&L, fees, timestamps

**`bot_activity_logs`**
- Human-readable activity timeline
- Shows signals received, trades executed, errors

**`webhook_calls`**
- Raw webhook request logs
- Useful for debugging

---

## ⚙️ Configuration Options

### **Bot-Level Settings**

1. **Webhook Secret**
   - Unique secret per bot for authentication
   - Regenerated in UI (invalidates old alerts)
   - Can use global secret as fallback

2. **Immediate Execution**
   - Toggle: Execute trades immediately vs queue for next cycle
   - When enabled: Webhook triggers `bot-executor` right away
   - When disabled: Signal waits for scheduled bot execution

3. **Webhook-Only Mode**
   - Bot only trades via webhooks
   - Skips scheduled/cron executions
   - Perfect for TradingView-only bots

### **TradingView Alert Payload Options**

**Required Fields:**
- `secret` - Webhook secret
- `botId` - Bot UUID
- `action` / `side` / `signal` - "buy", "sell", "long", "short"

**Optional Fields:**
- `mode` - "real" or "paper" (default: "real")
- `amount` - Position size override
- `size_multiplier` - Multiply bot's default size (e.g., 1.5 = 50% larger)
- `reason` - Description (visible in logs)
- `trigger_execution` - Override bot's immediate execution setting

---

## 🔒 Security

1. **Webhook Authentication**
   - Each bot has unique `webhook_secret`
   - Webhook validates secret before processing
   - Secrets can be regenerated to invalidate old alerts

2. **Service Role Access**
   - Functions use service role key internally
   - Bypasses Row Level Security (RLS)
   - Only accessible from Supabase Edge Functions

3. **Input Validation**
   - All payloads validated and sanitized
   - Template variables checked (no unprocessed `{{...}}` values)
   - Symbol normalization prevents injection

---

## 📝 Example Scenarios

### **Scenario 1: Simple Buy Signal**

1. TradingView strategy detects buy condition
2. Alert fires with `"action": "buy"`
3. Webhook creates signal: `{ side: "buy", mode: "real", status: "pending" }`
4. Bot-executor processes signal
5. Places buy order on Bybit
6. Records trade in database

### **Scenario 2: Paper Trading Test**

1. TradingView alert configured with `"mode": "paper"`
2. Webhook creates paper trading signal
3. Bot-executor routes to `PaperTradingExecutor`
4. Simulates trade with real market prices
5. Updates virtual balance
6. Records in `paper_trading_trades` (no real money used)

### **Scenario 3: Webhook-Only Bot**

1. Bot configured with `webhook_only: true`
2. Bot ignores scheduled/cron executions
3. Only executes when TradingView alert fires
4. Perfect for manual strategy execution

---

## 🐛 Troubleshooting

### **Signal Not Executing?**

1. Check `manual_trade_signals` table - is status "pending"?
2. Check bot status - is bot "running"?
3. Check `bot_activity_logs` - look for errors
4. Verify webhook secret matches
5. Check `webhook_calls` table for webhook receipt

### **Trade Not Placed on Exchange?**

1. Check if mode is "paper" (won't place real orders)
2. Verify API keys are valid
3. Check exchange balance
4. Look for API errors in logs
5. Check `webhook_only` mode - bot might be stopped

### **Webhook Authentication Failing?**

1. Verify webhook secret in bot settings
2. Check TradingView alert payload includes `secret` field
3. Ensure secret matches exactly (no extra spaces)
4. Try regenerating secret and updating alert

---

## 📚 Related Files

- **Webhook Handler:** `supabase/functions/tradingview-webhook/index.ts`
- **Bot Executor:** `supabase/functions/bot-executor/index.ts`
- **Setup Guide:** `TRADINGVIEW_WEBHOOK_SETUP.md`
- **Bot Management UI:** `src/pages/bots/page.tsx` (TradingView Webhook section)
- **Database Schema:** `supabase/migrations/20250210_add_manual_trade_signals.sql`

---

## 🎯 Summary

**TradingView** → Creates alerts based on your strategies  
**Webhook** → Sends HTTP POST to Pablo AI Trading  
**Pablo AI Trading** → Receives signal, validates, stores in database  
**Bot Executor** → Processes signal and executes trade  
**Exchange/Paper** → Trade is placed (real or simulated)  
**Database** → Trade recorded, P&L calculated, logs updated

This integration allows you to leverage TradingView's powerful charting and strategy tools while using Pablo AI Trading for automated execution on cryptocurrency exchanges.
