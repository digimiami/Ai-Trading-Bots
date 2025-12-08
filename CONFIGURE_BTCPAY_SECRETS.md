# ✅ Success! Now Configure BTCPay Server

## 🎉 Good News
You're past the "Unauthorized" error! The function is working and the secret is correct.

## ⚠️ Current Issue
The function needs BTCPay Server configuration. You're getting:
```json
{"error":"BTCPay Server not configured"}
```

## ✅ Solution: Add BTCPay Secrets to Supabase

### Step 1: Go to Supabase Secrets

1. Visit: https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc/settings/functions
2. Or: **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**

### Step 2: Add BTCPay Server Secrets

Add these three secrets:

#### Secret 1: BTCPAY_SERVER_URL
- **Name**: `BTCPAY_SERVER_URL`
- **Value**: `http://147.93.121.52:23000`
  - Or if you have a domain: `https://btcpay.pablobots.com`

#### Secret 2: BTCPAY_STORE_ID
- **Name**: `BTCPAY_STORE_ID`
- **Value**: Your BTCPay Store ID
  - Get this from BTCPay Server dashboard → Stores → Your Store → Settings → Store ID

#### Secret 3: BTCPAY_API_KEY
- **Name**: `BTCPAY_API_KEY`
- **Value**: Your BTCPay API Key
  - Format: `token_your-api-key-here`
  - Get this from BTCPay Server dashboard → Account → Manage Account → API Keys → Create API Key

### Step 3: Verify All Secrets

You should now have these secrets:
- ✅ `SUBSCRIPTION_RENEWAL_SECRET` (already set)
- ✅ `BTCPAY_SERVER_URL` (add this)
- ✅ `BTCPAY_STORE_ID` (add this)
- ✅ `BTCPAY_API_KEY` (add this)

### Step 4: Wait 2 Minutes

Secrets need time to propagate.

### Step 5: Test Again

```bash
curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/subscription-renewal \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYXd4Z3dkcWlpcmdtbWpidmhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgxOTI2NiwiZXhwIjoyMDc2Mzk1MjY2fQ.bVkrjuQJ4HJ8hzeBMe1AqC8e_Dv7m6gKq5I05ONM07U" \
  -H "x-cron-secret: 22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## ✅ Expected Success Response

Once BTCPay is configured:

```json
{
  "message": "Subscription renewal check complete",
  "checked": 0,
  "renewed": 0,
  "errors": []
}
```

## 📋 If You Don't Have BTCPay Server Set Up Yet

If you haven't set up BTCPay Server yet, you have two options:

### Option 1: Set Up BTCPay Server (Recommended)

Follow the guide: `BTCPAY_SETUP_GUIDE.md`

### Option 2: Temporarily Disable BTCPay Check

If you want to test the function without BTCPay, you can modify the function to skip BTCPay checks when it's not configured. However, this is not recommended for production.

## 🎯 Summary

**Current Status:**
- ✅ Function deployed
- ✅ Secret working
- ❌ BTCPay Server configuration needed

**Next Steps:**
1. Add `BTCPAY_SERVER_URL` secret
2. Add `BTCPAY_STORE_ID` secret
3. Add `BTCPAY_API_KEY` secret
4. Wait 2 minutes
5. Test again

The function is working correctly - it just needs BTCPay Server configuration to complete subscription renewals!

