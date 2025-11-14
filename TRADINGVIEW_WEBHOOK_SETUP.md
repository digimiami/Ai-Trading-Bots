# TradingView Webhook → Pablo AI Trading

This document explains how to connect a TradingView alert to the new Supabase Edge Function so external signals can queue trades for Pablo bots.

## 1. Environment variables

Add the following to the `tradingview-webhook` and `bot-executor` edge functions (Settings → Functions → Environment variables):

| Key | Description |
| --- | --- |
| `TRADINGVIEW_WEBHOOK_SECRET` | (Optional fallback) A global shared secret. Per-bot secrets are now generated in-app, but the edge function will also accept this value for backward compatibility. |
| `CRON_SECRET` | Existing secret used by the bot scheduler. Required so the webhook can trigger an immediate bot run. |

> Keep the secret private. Anyone with the value can fire trades on your bots.

## 2. Configure webhooks inside the app

Open `Bots → TradingView Webhook` (each bot card now includes a “Manage” link):

1. Reveal or regenerate the bot-specific webhook secret. Regeneration invalidates old alerts.
2. Copy the webhook URL (`https://<PROJECT>.supabase.co/functions/v1/tradingview-webhook`) directly from the UI.
3. Decide whether signals should trigger the bot immediately—the toggle controls the default `trigger_execution` flag for that bot.
4. Copy the pre-filled TradingView alert JSON payload.
5. Review recent webhook deliveries pulled from the `manual_trade_signals` table alongside any error messages.

> Secrets are stored per bot (`trading_bots.webhook_secret`). The webhook accepts either the per-bot secret or the global fallback secret (if set), but the UI always shows the bot-level value.

## 3. Database migration

The migration `20250210_add_manual_trade_signals.sql` creates a `manual_trade_signals` table. Run `supabase db push` (or your existing migration pipeline) to apply the table before deploying the functions.

Each TradingView alert stores one row in this table. The bot executor reads pending rows on its next run and executes them.

## 4. TradingView alert payload

Configure your TradingView alert to call:

```
https://<YOUR_PROJECT>.supabase.co/functions/v1/tradingview-webhook
```

### Alert Message Format

In your TradingView alert, use the following JSON message format. TradingView will automatically replace the variables with actual values:

```json
{
  "secret": "REPLACE_WITH_TRADINGVIEW_WEBHOOK_SECRET",
  "botId": "e0f9c1e2-1234-5678-9abc-def012345678",
  "action": "{{strategy.order.action}}",
  "marketPosition": "{{strategy.market_position}}",
  "prevMarketPosition": "{{strategy.prev_market_position}}",
  "marketPositionSize": "{{strategy.market_position_size}}",
  "prevMarketPositionSize": "{{strategy.prev_market_position_size}}",
  "instrument": "{{ticker}}",
  "timestamp": "{{timenow}}",
  "maxLag": "300",
  "investmentType": "base",
  "amount": "{{strategy.order.contracts}}",
  "mode": "paper",
  "reason": "TradingView alert signal"
}
```

**Key Variable: `{{strategy.order.action}}`**

This TradingView variable automatically provides:
- `"buy"` - When entering a long position
- `"sell"` - When entering a short position  
- `"long"` - Alternative format for long positions (also supported)
- `"short"` - Alternative format for short positions (also supported)

The webhook automatically converts:
- `"buy"` or `"long"` → Opens/closes long position
- `"sell"` or `"short"` → Opens/closes short position

### Alternative Field Names

You can also use these field names (all are supported):
- `"action"` - Uses `{{strategy.order.action}}` (recommended)
- `"side"` - Alternative to `action`
- `"signal"` - Alternative to `action`

### Complete Example for Long/Short Trading

**For Long Positions (Buy):**
```json
{
  "secret": "your_webhook_secret_here",
  "botId": "your_bot_id_here",
  "action": "{{strategy.order.action}}",
  "marketPosition": "{{strategy.market_position}}",
  "prevMarketPosition": "{{strategy.prev_market_position}}",
  "marketPositionSize": "{{strategy.market_position_size}}",
  "prevMarketPositionSize": "{{strategy.prev_market_position_size}}",
  "instrument": "{{ticker}}",
  "timestamp": "{{timenow}}",
  "maxLag": "300",
  "investmentType": "base",
  "amount": "{{strategy.order.contracts}}",
  "mode": "real",
  "reason": "Long entry: {{strategy.order.comment}}"
}
```

**For Short Positions (Sell):**
```json
{
  "secret": "your_webhook_secret_here",
  "botId": "your_bot_id_here",
  "action": "{{strategy.order.action}}",
  "marketPosition": "{{strategy.market_position}}",
  "prevMarketPosition": "{{strategy.prev_market_position}}",
  "marketPositionSize": "{{strategy.market_position_size}}",
  "prevMarketPositionSize": "{{strategy.prev_market_position_size}}",
  "instrument": "{{ticker}}",
  "timestamp": "{{timenow}}",
  "maxLag": "300",
  "investmentType": "base",
  "amount": "{{strategy.order.contracts}}",
  "mode": "real",
  "reason": "Short entry: {{strategy.order.comment}}"
}
```

### Fields

| Field | Required | Notes |
| ----- | -------- | ----- |
| `secret` | ✅ | Must equal the bot's webhook secret (shown in the UI) or the legacy global secret if still used. |
| `botId` | ✅ | UUID of the Pablo trading bot to control. |
| `action` / `side` / `signal` | ✅ | Use `{{strategy.order.action}}` for automatic buy/sell/long/short detection. Accepts: `buy`, `sell`, `long`, `short`, `enter_long`, `enter_short`, `entry_long`, `entry_short`. |
| `marketPosition` | Optional | TradingView variable: `{{strategy.market_position}}` - Current market position (long/short/flat). |
| `prevMarketPosition` | Optional | TradingView variable: `{{strategy.prev_market_position}}` - Previous market position. |
| `marketPositionSize` | Optional | TradingView variable: `{{strategy.market_position_size}}` - Current position size. |
| `prevMarketPositionSize` | Optional | TradingView variable: `{{strategy.prev_market_position_size}}` - Previous position size. |
| `instrument` / `ticker` / `symbol` | Optional | TradingView variable: `{{ticker}}` - The trading pair symbol (e.g., BTCUSDT). |
| `timestamp` / `timenow` | Optional | TradingView variable: `{{timenow}}` - Timestamp when the alert was triggered. |
| `maxLag` | Optional | Maximum lag in milliseconds (e.g., "300"). |
| `investmentType` | Optional | Investment type (e.g., "base"). |
| `amount` | Optional | TradingView variable: `{{strategy.order.contracts}}` - Number of contracts/shares. Used for position sizing if provided. |
| `mode` | Optional | `real` or `paper`. Defaults to `real`; `paper` forces a paper trade even if the bot is live. |
| `size_multiplier` | Optional | Multiplies the bot's configured trade amount (e.g. `1.5` increases size by 50%). |
| `reason` / `note` / `strategy` | Optional | Stored with the signal and visible in bot activity logs. Can use TradingView variables like `{{strategy.order.comment}}`. |
| `trigger_execution` | Optional | Overrides the bot-level default. When omitted, the webhook uses the "Immediate Execution" toggle from the UI. Set `false` to queue without triggering the executor. |

**Note:** All TradingView strategy variables are stored in the `manual_trade_signals.metadata` field for reference, even if they're not directly used for trade execution.

## 5. Testing

1. Deploy the edge functions (`bot-executor` and the new `tradingview-webhook`) to Supabase.
2. Send a test request (replace placeholders):

```bash
curl -X POST https://<YOUR_PROJECT>.supabase.co/functions/v1/tradingview-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "REPLACE_WITH_TRADINGVIEW_WEBHOOK_SECRET",
    "botId": "e0f9c1e2-1234-5678-9abc-def012345678",
    "side": "buy",
    "mode": "paper",
    "reason": "Webhook test"
  }'
```

3. Check the `manual_trade_signals` table for a new row.
4. Open the bot’s activity log; you should see a “TradingView signal received” entry followed by either a paper or live trade log.
5. Confirm the trade executed (paper: `paper_trading_trades`, real: `trades` table / exchange order history).

## 6. Operational notes

- The webhook records signals even if the bot is *stopped*. The immediate trigger will execute only if the bot function runs and the signal is pending; otherwise it waits for the next scheduled run.
- Failed executions are marked in `manual_trade_signals.status = 'failed'` with an error message. Review bot logs for details.
- Because the webhook uses the service role key it bypasses RLS; ensure the secret is rotated if leaked.
- Use different secrets for staging/production and update TradingView alerts accordingly.

That’s it—TradingView alerts can now drive Pablo AI Trading bots through the managed webhook.

