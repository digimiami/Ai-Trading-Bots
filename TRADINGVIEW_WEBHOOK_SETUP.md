# TradingView Webhook → Pablo AI Trading

This document explains how to connect a TradingView alert to the new Supabase Edge Function so external signals can queue trades for Pablo bots.

## 1. Environment variables

Add the following to the `tradingview-webhook` and `bot-executor` edge functions (Settings → Functions → Environment variables):

| Key | Description |
| --- | --- |
| `TRADINGVIEW_WEBHOOK_SECRET` | Shared secret string that every TradingView alert must include. |
| `CRON_SECRET` | Existing secret used by the bot scheduler. Required so the webhook can trigger an immediate bot run. |

> Keep the secret private. Anyone with the value can fire trades on your bots.

## 2. Database migration

The migration `20250210_add_manual_trade_signals.sql` creates a `manual_trade_signals` table. Run `supabase db push` (or your existing migration pipeline) to apply the table before deploying the functions.

Each TradingView alert stores one row in this table. The bot executor reads pending rows on its next run and executes them.

## 3. TradingView alert payload

Configure your TradingView alert to call:

```
https://<YOUR_PROJECT>.supabase.co/functions/v1/tradingview-webhook
```

with `POST` and JSON body similar to:

```json
{
  "secret": "REPLACE_WITH_TRADINGVIEW_WEBHOOK_SECRET",
  "botId": "e0f9c1e2-1234-5678-9abc-def012345678",
  "side": "buy",
  "mode": "real",
  "size_multiplier": 1.0,
  "reason": "TradingView RSI crossover"
}
```

### Fields

| Field | Required | Notes |
| ----- | -------- | ----- |
| `secret` | ✅ | Must equal `TRADINGVIEW_WEBHOOK_SECRET`. |
| `botId` | ✅ | UUID of the Pablo trading bot to control. |
| `side` | ✅ | `buy`, `sell`, `long`, or `short`. (`long` maps to `buy`, `short` to `sell`). |
| `mode` | Optional | `real` or `paper`. Defaults to `real`; `paper` forces a paper trade even if the bot is live. |
| `size_multiplier` | Optional | Multiplies the bot’s configured trade amount (e.g. `1.5` increases size by 50%). |
| `reason` / `note` / `strategy` | Optional | Stored with the signal and visible in bot activity logs. |
| `trigger_execution` | Optional | Set to `false` to *skip* the immediate bot execution trigger. Otherwise the webhook will call `bot-executor` right away. |

## 4. Testing

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

## 5. Operational notes

- The webhook records signals even if the bot is *stopped*. The immediate trigger will execute only if the bot function runs and the signal is pending; otherwise it waits for the next scheduled run.
- Failed executions are marked in `manual_trade_signals.status = 'failed'` with an error message. Review bot logs for details.
- Because the webhook uses the service role key it bypasses RLS; ensure the secret is rotated if leaked.
- Use different secrets for staging/production and update TradingView alerts accordingly.

That’s it—TradingView alerts can now drive Pablo AI Trading bots through the managed webhook.

