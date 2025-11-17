# ✅ Fix: TradingView Webhook Authentication (401 Errors)

## Problem

`tradingview-webhook` was calling `webhook-executor`, which was returning **401 "Missing authorization header"** errors at the platform level (before the function code even executed). This prevented TradingView webhooks from triggering bot executions.

## Root Cause

`webhook-executor` was not set to **Public** in the Supabase dashboard, so Supabase's platform-level authentication was blocking requests before they reached the function code. Even though the function code had logic to detect `execute_bot` in the body and bypass authentication, the request never reached that code.

## Solution

Changed `tradingview-webhook` to call **`bot-executor` directly** instead of going through `webhook-executor`. This works because:

1. ✅ `bot-executor` already supports `execute_bot` action
2. ✅ `bot-executor` uses `x-cron-secret` header for authentication (same as `bot-scheduler`)
3. ✅ `bot-executor` is already working (successfully called by `bot-scheduler`)
4. ✅ No need to change dashboard settings

## Changes Made

**File**: `supabase/functions/tradingview-webhook/index.ts`

- Changed target URL from `/functions/v1/webhook-executor` to `/functions/v1/bot-executor`
- Updated comments to reflect the new approach
- Removed references to `webhook-executor` authentication logic
- Kept the same headers: `x-cron-secret` and `apikey`

## How It Works Now

1. TradingView sends webhook → `tradingview-webhook` function
2. `tradingview-webhook` processes the signal and creates `manual_trade_signals` record
3. If `trigger_execution` is enabled, `tradingview-webhook` calls `bot-executor` directly:
   - Headers: `x-cron-secret` (matches `CRON_SECRET` env var) + `apikey`
   - Body: `{ "action": "execute_bot", "botId": "..." }`
4. `bot-executor` detects `x-cron-secret` matches → uses service role client → executes bot

## Testing

After deployment, test a TradingView webhook. You should see:
- ✅ No more 401 errors
- ✅ Bot execution triggered successfully
- ✅ Trades placed on Bybit (if conditions are met)

## Deployment Status

✅ **Committed and pushed to git** (auto-deployment enabled)
- Commit: `2bad4438`
- Message: "Fix: Change tradingview-webhook to call bot-executor directly instead of webhook-executor to fix 401 authentication errors"

## Next Steps

1. Wait for auto-deployment to complete
2. Test a TradingView webhook
3. Monitor logs to confirm successful bot execution
4. Verify trades are placed on Bybit mainnet

---

**Note**: The `webhook-executor` function is no longer used for TradingView webhooks, but it's still in the codebase in case it's needed for other webhook sources in the future.

