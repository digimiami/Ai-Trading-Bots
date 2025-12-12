# 🚀 BTCPay Server Integration - Deployment Guide

## ✅ Step 1: Secrets Already Configured!

You've already added:
- ✅ `BTCPAY_SERVER_URL`
- ✅ `BTCPAY_STORE_ID`
- ✅ `BTCPAY_API_KEY`

## 📦 Step 2: Deploy Edge Functions

### Option A: Deploy via Supabase Dashboard (Recommended - No CLI needed)

#### Deploy `btcpay-integration`:

1. **Go to Supabase Dashboard:**
   - Navigate to: **Edge Functions** → **Functions**
   - URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_ID/functions`

2. **Create/Update Function:**
   - If function exists: Click on `btcpay-integration` → **Edit**
   - If new: Click **"Create a new function"** → Name: `btcpay-integration`

3. **Copy & Paste Code:**
   - Open: `supabase/functions/btcpay-integration/index.ts`
   - Copy **ALL** code (Ctrl+A, Ctrl+C)
   - Paste into dashboard editor
   - Click **"Deploy"**

#### Deploy `btcpay-webhook`:

1. **Create/Update Function:**
   - If function exists: Click on `btcpay-webhook` → **Edit**
   - If new: Click **"Create a new function"** → Name: `btcpay-webhook`

2. **Copy & Paste Code:**
   - Open: `supabase/functions/btcpay-webhook/index.ts`
   - Copy **ALL** code (Ctrl+A, Ctrl+C)
   - Paste into dashboard editor
   - Click **"Deploy"**

#### Deploy `subscription-renewal` (Optional - for monthly billing):

1. **Create/Update Function:**
   - If function exists: Click on `subscription-renewal` → **Edit**
   - If new: Click **"Create a new function"** → Name: `subscription-renewal`

2. **Copy & Paste Code:**
   - Open: `supabase/functions/subscription-renewal/index.ts`
   - Copy **ALL** code (Ctrl+A, Ctrl+C)
   - Paste into dashboard editor
   - Click **"Deploy"**

### Option B: Deploy via GitHub Actions (Automatic)

If you push to the main branch, GitHub Actions will automatically deploy all functions.

## 🔗 Step 3: Configure Webhook in BTCPay Server

1. **Access BTCPay Server:**
   - Go to: `http://YOUR_SERVER_IP:23000` (or your BTCPay URL)
   - Login to your admin account

2. **Navigate to Webhooks:**
   - Go to: **Stores** → **Your Store** → **Webhooks**
   - Click **"Create Webhook"**

3. **Configure Webhook:**
   - **Webhook URL:** 
     ```
     https://YOUR_PROJECT_ID.supabase.co/functions/v1/btcpay-webhook
     ```
     Replace `YOUR_PROJECT_ID` with your actual Supabase project ID
   
   - **Events to Listen:**
     - ✅ `InvoicePaymentSettled`
     - ✅ `InvoiceSettled`
     - ✅ `InvoiceReceivedPayment`
     - ✅ `InvoiceInvalid`
     - ✅ `InvoiceExpired`

4. **Save Webhook:**
   - Click **"Save"** or **"Create"**

## 🧪 Step 4: Test the Integration

### Test 1: Verify Functions are Deployed

1. Go to Supabase Dashboard → **Edge Functions**
2. Verify you see:
   - ✅ `btcpay-integration` (Status: Active)
   - ✅ `btcpay-webhook` (Status: Active)

### Test 2: Test Invoice Creation

1. **Via Frontend:**
   - Go to: `https://pablobots.com/pricing` (or your domain)
   - Click **"Subscribe"** on any plan
   - Should redirect to BTCPay payment page

2. **Via API (Optional):**
   ```bash
   curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/btcpay-integration?action=create-invoice \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "planId": "your-plan-id",
       "currency": "USD"
     }'
   ```

### Test 3: Test Payment Flow

1. **Create Test Invoice:**
   - Use the frontend or API to create an invoice
   - Copy the `checkoutLink` from response

2. **Make Test Payment:**
   - Open the checkout link
   - Complete a small test payment
   - Wait 1-2 minutes for webhook to process

3. **Verify Subscription Activated:**
   - Check Supabase Dashboard → **Edge Functions** → `btcpay-webhook` → **Logs**
   - Should see: `✅ Payment settled for subscription...`
   - Check database: `SELECT * FROM user_subscriptions WHERE status = 'active'`

## 📊 Step 5: Verify Database Tables

Run this SQL in Supabase SQL Editor to verify tables exist:

```sql
-- Check subscription tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('subscription_plans', 'user_subscriptions', 'payment_history');
```

If tables are missing, run `create_subscription_system.sql` in SQL Editor.

## 🔍 Troubleshooting

### Issue: "BTCPay Server not configured"

**Solution:**
- Verify secrets are set in Supabase Dashboard → **Settings** → **Edge Functions** → **Secrets**
- Wait 2 minutes after adding secrets (they need time to propagate)
- Redeploy the function after adding secrets

### Issue: Webhook not receiving events

**Solution:**
1. Verify webhook URL is correct in BTCPay
2. Check webhook is enabled in BTCPay
3. Check Supabase Edge Function logs for errors
4. Test webhook manually in BTCPay dashboard

### Issue: Invoice creation fails

**Solution:**
1. Check BTCPay Server is accessible
2. Verify API key has correct permissions
3. Verify Store ID is correct
4. Check Edge Function logs for detailed error

### Issue: Payment doesn't activate subscription

**Solution:**
1. Check `btcpay-webhook` function logs
2. Verify invoice ID matches in database
3. Check `user_subscriptions` table for status
4. Verify webhook events are being received

## ✅ Checklist

- [ ] Secrets configured in Supabase (`BTCPAY_SERVER_URL`, `BTCPAY_STORE_ID`, `BTCPAY_API_KEY`)
- [ ] `btcpay-integration` function deployed
- [ ] `btcpay-webhook` function deployed
- [ ] `subscription-renewal` function deployed (optional)
- [ ] Webhook configured in BTCPay Server
- [ ] Database tables exist (`subscription_plans`, `user_subscriptions`, `payment_history`)
- [ ] Test invoice creation works
- [ ] Test payment flow works
- [ ] Subscription activates after payment

## 🎉 You're Done!

Once all steps are complete:
- ✅ Users can subscribe via `/pricing` page
- ✅ Payments process through BTCPay Server
- ✅ Subscriptions activate automatically via webhook
- ✅ Monthly renewals can be automated (if renewal function is set up)

## 📞 Next Steps

1. **Set up Monthly Renewal Automation:**
   - Configure cron job to run `subscription-renewal` daily
   - See `SUBSCRIPTION_SYSTEM_DEPLOYMENT.md` for details

2. **Configure Email Notifications:**
   - Add `RESEND_API_KEY` to Supabase secrets
   - Users will receive subscription activation emails

3. **Monitor Subscriptions:**
   - Check `user_subscriptions` table regularly
   - Monitor Edge Function logs for errors


