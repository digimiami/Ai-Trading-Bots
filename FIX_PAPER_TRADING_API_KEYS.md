# Fix Paper Trading API Keys Issue

## Problem
Your paper trading bots are trying to use **mainnet API keys** on the **testnet**, which causes "API key is invalid (Code: 10003)" errors.

**Paper trading = Testnet = Requires testnet API keys**
**Real trading = Mainnet = Requires mainnet API keys**

## Solution

### Step 1: Check Current Configuration

Run this query in Supabase SQL Editor:

```sql
-- See the diagnostic query
\i CHECK_PAPER_TRADING_CONFIG.sql
```

Look for bots with "❌ MISMATCH" status.

### Step 2: Create Testnet API Keys (for Paper Trading)

1. Go to Bybit Testnet: https://testnet.bybit.com/
2. Log in (you may need to create a separate testnet account)
3. Go to API Management
4. Create a new API key with these permissions:
   - ✅ Read-Write
   - ✅ Contract Trading (for futures)
   - ✅ Spot Trading (for spot)
5. Save your API Key and Secret

### Step 3: Add Testnet API Keys to Database

Go to your application's **Settings** page (`/settings`) and:

1. Click "Manage Bybit Keys"
2. Add your **TESTNET** API keys
3. **IMPORTANT:** Check the "Is Testnet" checkbox ✅
4. Save

OR run this SQL directly:

```sql
-- Add testnet API keys for paper trading
INSERT INTO api_keys (
    user_id,
    exchange,
    api_key_encrypted,
    api_secret_encrypted,
    is_testnet,
    is_active
) VALUES (
    'YOUR_USER_ID',  -- Replace with your user ID
    'bybit',
    crypt('YOUR_TESTNET_API_KEY', gen_salt('bf')),
    crypt('YOUR_TESTNET_API_SECRET', gen_salt('bf')),
    true,  -- ✅ This is the key part!
    true
);
```

### Step 4: Verify Configuration

Run the diagnostic query again:

```sql
\i CHECK_PAPER_TRADING_CONFIG.sql
```

All paper trading bots should now show "✅ Correct: Paper bot with testnet key".

### Step 5: Restart Failed Bots

If bots are still showing errors, restart them:

```sql
-- Clear error logs for paper trading bots
DELETE FROM bot_activity_logs 
WHERE bot_id IN (
    SELECT id FROM trading_bots 
    WHERE trading_type = 'paper' AND status = 'running'
)
AND level = 'error'
AND created_at > NOW() - INTERVAL '1 hour';
```

## Important Notes

### For Paper Trading:
- ✅ Use testnet.bybit.com API keys
- ✅ Set `is_testnet = true` in database
- ✅ No real money involved
- ✅ Free testnet tokens available

### For Real Trading:
- ✅ Use www.bybit.com API keys
- ✅ Set `is_testnet = false` (or leave unchecked)
- ⚠️ Real money involved
- ⚠️ Requires funded account

## Quick Fix SQL

If you want to temporarily disable all paper trading bots until you set up testnet keys:

```sql
-- Pause all paper trading bots
UPDATE trading_bots
SET status = 'paused'
WHERE trading_type = 'paper' AND status = 'running';
```

Or convert them to real trading (⚠️ **DANGEROUS - ONLY IF YOU WANT REAL TRADES**):

```sql
-- Convert all paper bots to real trading
-- ⚠️ WARNING: This will use real money!
UPDATE trading_bots
SET trading_type = 'real'
WHERE trading_type = 'paper' AND status = 'running';
```

## Checking Your API Keys

You can see all your API keys and their testnet status:

```sql
SELECT 
    id,
    exchange,
    is_testnet,
    is_active,
    created_at,
    CASE 
        WHEN is_testnet = true THEN '🧪 Testnet (Paper Trading)'
        ELSE '💰 Mainnet (Real Trading)'
    END as usage
FROM api_keys
WHERE user_id = 'YOUR_USER_ID'  -- Replace with your user ID
ORDER BY exchange, is_testnet;
```

## Summary

The issue is that your paper trading bots are configured correctly, but they don't have the correct **testnet API keys** to use. You need to:

1. Create testnet API keys from testnet.bybit.com
2. Add them to your account with `is_testnet = true`
3. The bots will automatically use the correct keys based on their `trading_type`

Once you have both mainnet and testnet keys in the database, the system will automatically select the right keys for each bot! 🎯

