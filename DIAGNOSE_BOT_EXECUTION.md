# 🔍 Diagnosing Why Bots Aren't Executing Trades

## Problem Analysis

Your logs show only time synchronization, but **NO bot execution logs**. This means:

❌ Missing logs that should appear:
- `🚀 === BOT EXECUTION STARTED ===`
- `🔍 Looking for running bots...`
- `📊 Querying database for running bots...`
- `📊 Database query result: Found X running bots`

✅ Logs that ARE appearing:
- `✅ Time synced with Bybit`
- `🕐 Time sync needed...`
- `booted` and `shutdown` events

## Root Causes to Check

### 1. **Cron Job Not Running bot-scheduler**

The `bot-scheduler` function should be called by a Supabase scheduled trigger. Check:

1. Go to Supabase Dashboard → Edge Functions → `bot-scheduler`
2. Check if there's a **Schedule** configured
3. Look for logs showing: `📅 Bot Scheduler called at:`

**If no logs exist**, the cron job isn't configured or running.

### 2. **bot-scheduler Not Calling bot-executor**

Check `bot-scheduler` logs for:
- `🚀 Calling bot-executor at:`
- `✅ Bot-executor response:`

If these are missing, the scheduler might be failing before calling bot-executor.

### 3. **No Running Bots in Database**

Even if execution runs, it will find no bots. Check your database:

```sql
-- Check bot statuses
SELECT 
  id, 
  name, 
  status, 
  symbol, 
  exchange,
  created_at,
  updated_at
FROM trading_bots
WHERE user_id = auth.uid()
ORDER BY updated_at DESC;
```

**Expected**: At least one bot with `status = 'running'`

### 4. **Request Body Not Parsed Correctly**

The bot-executor might not be receiving the action. Check logs for any parsing errors.

---

## 🔧 Diagnostic Steps

### Step 1: Check bot-scheduler Logs

1. Go to Supabase Dashboard
2. Edge Functions → `bot-scheduler` → Logs
3. Look for recent entries (last hour)

**What to look for:**
- `📅 Bot Scheduler called at:` - Cron is running ✅
- `🚀 Calling bot-executor at:` - Scheduler is calling executor ✅
- `❌` errors - Something is broken ❌

### Step 2: Check Database for Running Bots

Run this SQL in Supabase SQL Editor:

```sql
-- Get all your bots and their status
SELECT 
  id,
  name,
  status,
  symbol,
  exchange,
  strategy,
  strategyConfig,
  created_at,
  updated_at
FROM trading_bots
WHERE user_id = auth.uid()
ORDER BY created_at DESC;
```

**Action Required:**
- If no bots exist → Create a bot
- If bots exist but `status != 'running'` → Change status to `'running'`

### Step 3: Manually Trigger Bot Execution

Test if execution works manually:

#### Option A: Via Supabase Dashboard

1. Go to Edge Functions → `bot-executor`
2. Click "Invoke Function"
3. Set body:
   ```json
   {
     "action": "execute_all_bots"
   }
   ```
4. Set headers:
   ```
   Authorization: Bearer YOUR_SERVICE_ROLE_KEY
   Content-Type: application/json
   ```

#### Option B: Via API Call

```bash
curl -X POST \
  'https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/bot-executor' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "execute_all_bots"
  }'
```

#### Option C: Check bot-scheduler Function

Check if `bot-scheduler` exists and is configured:

```bash
npx supabase functions list
```

### Step 4: Check Cron Configuration

If `bot-scheduler` has no schedule:

1. Go to Supabase Dashboard → Edge Functions → `bot-scheduler`
2. Click "Schedule" tab
3. Create a new schedule:
   - **Schedule**: `*/5 * * * *` (every 5 minutes)
   - **Headers**: Add `x-cron-secret: YOUR_CRON_SECRET`
4. Save

---

## 🔍 Quick Diagnostic Script

Run this in your browser console (while logged into your app):

```javascript
(async function diagnoseBots() {
  console.log('🔍 Starting Bot Diagnosis...\n');
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      'https://dkawxgwdqiirgmmjbvhc.supabase.co',
      'YOUR_ANON_KEY'
    );
    
    // Get session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('❌ Not authenticated');
      return;
    }
    
    console.log('✅ Authenticated:', session.user.email, '\n');
    
    // Check bots
    console.log('📊 Checking bots...');
    const { data: bots, error: botsError } = await supabase
      .from('trading_bots')
      .select('id, name, status, symbol, exchange, strategy')
      .eq('user_id', session.user.id);
    
    if (botsError) {
      console.error('❌ Error fetching bots:', botsError);
      return;
    }
    
    console.log(`📊 Found ${bots.length} total bots`);
    console.log(`   Running: ${bots.filter(b => b.status === 'running').length}`);
    console.log(`   Paused: ${bots.filter(b => b.status === 'paused').length}`);
    console.log(`   Stopped: ${bots.filter(b => b.status === 'stopped').length}\n`);
    
    if (bots.length === 0) {
      console.warn('⚠️ NO BOTS FOUND! Create a bot first.');
      return;
    }
    
    const runningBots = bots.filter(b => b.status === 'running');
    if (runningBots.length === 0) {
      console.warn('⚠️ NO RUNNING BOTS! Set bot status to "running"');
      console.log('\nYour bots:');
      bots.forEach(b => {
        console.log(`   - ${b.name}: ${b.status}`);
      });
      return;
    }
    
    console.log('✅ Running bots found:');
    runningBots.forEach(b => {
      console.log(`   - ${b.name} (${b.symbol}) - Strategy: ${b.strategy || 'none'}`);
    });
    
    console.log('\n📋 Recent trades...');
    const { data: trades } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (trades && trades.length > 0) {
      console.log(`   Found ${trades.length} recent trades`);
      const lastTrade = trades[0];
      const timeAgo = Math.round((Date.now() - new Date(lastTrade.created_at).getTime()) / 1000 / 60);
      console.log(`   Last trade: ${timeAgo} minutes ago`);
    } else {
      console.warn('   ⚠️ No trades found');
    }
    
    console.log('\n✅ Diagnosis complete!');
    console.log('\n💡 Next steps:');
    console.log('   1. Check bot-scheduler logs in Supabase Dashboard');
    console.log('   2. Verify cron job is scheduled');
    console.log('   3. Manually trigger execution to test');
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
  }
})();
```

---

## ✅ Fix Checklist

After diagnosis, fix issues in this order:

- [ ] **Cron Job Configured**: `bot-scheduler` has an active schedule
- [ ] **Running Bots Exist**: At least one bot with `status = 'running'`
- [ ] **bot-scheduler Logs**: Shows "Bot Scheduler called"
- [ ] **bot-executor Receives Calls**: Logs show "BOT EXECUTION STARTED"
- [ ] **Bots Found**: Logs show "Found X running bots"
- [ ] **Execution Happens**: Logs show bot execution details

---

## 🚨 Common Issues

### Issue: "No running bots found"

**Fix:**
```sql
UPDATE trading_bots 
SET status = 'running' 
WHERE user_id = auth.uid() 
AND id = 'YOUR_BOT_ID';
```

### Issue: "bot-scheduler not configured"

**Fix:**
1. Deploy bot-scheduler: `npx supabase functions deploy bot-scheduler`
2. Create schedule in Supabase Dashboard
3. Set CRON_SECRET environment variable

### Issue: "Bot execution started but no trades"

This is different - execution is working but strategies aren't triggering trades. Check:
- Strategy configuration
- Market conditions
- Trade limits (max_trades_per_day)

---

## 📊 Expected Log Flow (When Working)

When everything works, you should see this sequence:

1. **bot-scheduler logs:**
   ```
   📅 Bot Scheduler called at: [timestamp]
   🚀 Calling bot-executor at: [url]
   ✅ Bot-executor response: [status 200]
   ```

2. **bot-executor logs:**
   ```
   🚀 === BOT EXECUTION STARTED ===
   📅 Timestamp: [timestamp]
   🔐 Auth mode: CRON (service role)
   🔍 Cron: Looking for all running bots (service role)
   📊 Querying database for running bots...
   📊 Database query result: Found X running bots
   📋 Bot details: [bot list]
   🚀 Executing X running bots...
   🤖 [Bot Name] Starting execution...
   ✅ [Bot Name] Execution completed in Xms
   📈 === EXECUTION SUMMARY ===
   ```

If any of these are missing, that's where the problem is!

