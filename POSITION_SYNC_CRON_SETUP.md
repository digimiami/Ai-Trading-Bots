# 🔄 Position Sync Cron Job Setup Guide

This guide explains how to set up the automatic position synchronization cron job that syncs all running bots' positions from the exchange.

## 📋 Overview

The position sync cron job:
- Runs every 5 minutes (configurable)
- Syncs positions for all running bots (non-paper trading)
- Updates unrealized PnL for open positions
- Closes positions in database if closed on exchange
- Calculates realized PnL and fees when positions close
- Updates bot metrics automatically via database triggers

## 🚀 Quick Setup

### Step 1: Deploy the Edge Function

The Edge Function is located at: `supabase/functions/position-sync/index.ts`

**Deploy via Supabase CLI:**
```bash
supabase functions deploy position-sync
```

**OR deploy manually via Supabase Dashboard:**
1. Go to Edge Functions → Create new function
2. Name: `position-sync`
3. Copy contents from `supabase/functions/position-sync/index.ts`
4. Deploy

### Step 2: Set Environment Variables

In Supabase Dashboard → Edge Functions → position-sync → Settings → Secrets:

- `CRON_SECRET`: Your cron secret (same as bot-scheduler)
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your service role key

### Step 3: Set Up Cron Schedule

**Option A: Using Supabase Dashboard (Recommended)**

1. Go to Edge Functions → position-sync → Schedules tab
2. Click "Create Schedule"
3. Configure:
   - **Schedule Name**: `position-sync-schedule`
   - **Cron Expression**: `*/5 * * * *` (every 5 minutes)
   - **HTTP Method**: `POST`
   - **Headers**:
     ```
     x-cron-secret: YOUR_CRON_SECRET_VALUE
     ```
   - **Enabled**: ✅ Yes
4. Click "Save"

**Option B: Using SQL (pg_cron)**

Run the migration file in Supabase SQL Editor:
```sql
-- Run: supabase/migrations/20250128_setup_position_sync_cron.sql
```

**Option C: External Cron Job**

Add to your server's crontab:
```bash
# Position Sync - Every 5 minutes
*/5 * * * * curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/position-sync \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}' \
  >> /var/log/position-sync.log 2>&1
```

## ✅ Verification

### Test Manually

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/position-sync \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response:
```json
{
  "success": true,
  "requestId": "abc12345",
  "timestamp": "2025-01-28T12:00:00.000Z",
  "duration": "1234ms",
  "totalBots": 5,
  "synced": 8,
  "closed": 2,
  "errors": [],
  "botResults": [...]
}
```

### Check Logs

1. Go to Edge Functions → position-sync → Logs
2. Look for:
   - `Position Sync Cron Job STARTED`
   - `Found X running bot(s) to sync`
   - `Position sync completed`
   - Any errors or warnings

### Check Database

```sql
-- Check recent position updates
SELECT 
  bot_id,
  symbol,
  status,
  current_price,
  unrealized_pnl,
  updated_at
FROM trading_positions
WHERE status = 'open'
ORDER BY updated_at DESC
LIMIT 10;

-- Check closed positions from sync
SELECT 
  bot_id,
  symbol,
  status,
  realized_pnl,
  close_reason,
  closed_at
FROM trading_positions
WHERE close_reason = 'exchange_sync'
ORDER BY closed_at DESC
LIMIT 10;
```

## ⚙️ Configuration

### Cron Schedule Options

- `*/5 * * * *` - Every 5 minutes (recommended)
- `*/10 * * * *` - Every 10 minutes (less frequent)
- `* * * * *` - Every minute (more frequent, may hit rate limits)

### What Gets Synced

For each running bot:
1. Fetches current positions from exchange API
2. Compares with database positions
3. Updates:
   - Current price
   - Unrealized PnL
   - Position size (if changed)
4. Closes positions if:
   - Position size is 0 on exchange
   - Calculates realized PnL and fees
   - Updates bot metrics via trigger

## 🔍 Troubleshooting

### Cron Job Not Running

1. Check schedule is enabled in Dashboard
2. Verify `CRON_SECRET` matches in both function secrets and schedule headers
3. Check function logs for errors

### No Positions Synced

1. Verify bots are running (`status = 'running'`)
2. Check bots are not paper trading (`paper_trading = false`)
3. Verify API keys exist and are active
4. Check exchange API responses in logs

### Errors in Logs

Common errors:
- **"No API keys found"**: User doesn't have API keys configured
- **"Failed to fetch positions"**: Exchange API error or rate limit
- **"Database error"**: Check RLS policies and permissions

## 📊 Monitoring

Monitor the cron job:
1. Check Edge Function logs regularly
2. Monitor position sync frequency
3. Watch for errors or warnings
4. Verify positions are updating correctly

## 🔐 Security

- Uses `CRON_SECRET` for authentication
- Requires service role key for database access
- Only syncs positions for bots owned by authenticated users
- Respects RLS policies

## 📝 Notes

- The sync only processes **running bots** (status = 'running')
- Only **real trading bots** are synced (paper_trading = false)
- Positions are synced **every 5 minutes** by default
- Each bot sync includes a 500ms delay to avoid rate limiting
- Database triggers automatically update bot metrics when positions close
