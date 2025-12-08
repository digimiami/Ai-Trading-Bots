# Subscription System Deployment Guide

Complete guide to deploy the BTCPay Server subscription system.

## ✅ What's Been Created

### Frontend
- ✅ **Pricing Page** (`/pricing`) - View plans and subscribe
- ✅ **Subscription Success Page** (`/subscription/success`) - Payment confirmation
- ✅ **Subscription Hook** (`useSubscription`) - Manage subscriptions
- ✅ **Bot Creation Check** - Validates subscription limits before creating bots
- ✅ **Navigation Link** - Added "Pricing" to navigation menu

### Backend
- ✅ **Database Schema** - Subscription plans, user subscriptions, payment history
- ✅ **BTCPay Integration** - Create invoices, check status
- ✅ **Webhook Handler** - Process payment confirmations
- ✅ **Renewal Automation** - Monthly invoice generation
- ✅ **Email Notifications** - Subscription activation emails

## 📋 Deployment Steps

### Step 1: Run Database Migration

Execute `create_subscription_system.sql` in Supabase SQL Editor:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy and paste contents of `create_subscription_system.sql`
3. Click **Run**
4. Verify tables were created:
   - `subscription_plans`
   - `user_subscriptions`
   - `payment_history`

### Step 2: Deploy Edge Functions

```bash
# Deploy BTCPay integration
supabase functions deploy btcpay-integration

# Deploy webhook handler
supabase functions deploy btcpay-webhook

# Deploy renewal automation
supabase functions deploy subscription-renewal
```

### Step 3: Configure Supabase Secrets

Go to **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**

Add these secrets:

```
BTCPAY_SERVER_URL=http://147.93.121.52:23000
# OR if using subdomain:
# BTCPAY_SERVER_URL=https://btcpay.pablobots.com

BTCPAY_STORE_ID=your-store-id-here
BTCPAY_API_KEY=token_your-api-key-here
SITE_URL=https://pablobots.com
RESEND_API_KEY=your-resend-api-key (optional, for emails)
CRON_SECRET=your-random-secret (optional, for renewal cron)
```

### Step 4: Set Up BTCPay Server

Follow `BTCPAY_SETUP_GUIDE.md` to:
1. Install BTCPay Server on VPS
2. Create store
3. Generate API key
4. Configure webhook

### Step 5: Set Up Monthly Renewal

#### Option A: Using Supabase Cron (if pg_cron available)

Run `setup_subscription_renewal_cron.sql` in Supabase SQL Editor.

#### Option B: External Cron Job

Add to your server's crontab (`crontab -e`):

```bash
# Run daily at 2 AM UTC
0 2 * * * curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/subscription-renewal \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

### Step 6: Build and Deploy Frontend

```bash
npm run build
# Deploy to your VPS (or push to GitHub for auto-deployment)
```

## 🧪 Testing

### Test Subscription Flow

1. **Visit Pricing Page:**
   - Go to `/pricing`
   - Should see 4 plans (Free, Basic, Pro, Enterprise)

2. **Select a Plan:**
   - Click "Subscribe" on Basic plan
   - Should redirect to BTCPay payment page

3. **Make Payment:**
   - Pay from your wallet (test with small amount)
   - BTCPay webhook should activate subscription

4. **Verify Activation:**
   - Check `/pricing` - should show "Current Plan"
   - Try creating a bot - should work if under limit

### Test Bot Creation Limits

1. **Free Plan:**
   - Create 1 bot → ✅ Should work
   - Try to create 2nd bot → ❌ Should show upgrade message

2. **Basic Plan:**
   - Create 3 bots → ✅ Should work
   - Try to create 4th bot → ❌ Should show upgrade message

### Test Renewal Automation

1. **Manually Trigger:**
   ```bash
   curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/subscription-renewal \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "x-cron-secret: YOUR_CRON_SECRET"
   ```

2. **Check Results:**
   - Should find expiring subscriptions
   - Should create renewal invoices
   - Should update `next_billing_date`

## 📧 Email Notifications Setup

### Using Resend API (Recommended)

1. **Sign up at:** https://resend.com
2. **Get API Key**
3. **Add to Supabase Secrets:**
   ```
   RESEND_API_KEY=re_your-api-key-here
   ```

4. **Verify Domain** (optional but recommended)
   - Add `pablobots.com` to Resend
   - Verify DNS records

### Email Events

- ✅ **Subscription Activated** - Sent when payment confirmed
- ⏳ **Subscription Expiring** - Sent 7 days before expiration (via renewal function)
- ⏳ **Subscription Expired** - Sent when subscription expires

## 🔍 Monitoring

### Check Subscription Status

```sql
-- View all active subscriptions
SELECT 
  us.id,
  u.email,
  sp.name as plan_name,
  us.status,
  us.expires_at,
  us.next_billing_date
FROM user_subscriptions us
JOIN subscription_plans sp ON us.plan_id = sp.id
JOIN auth.users u ON us.user_id = u.id
WHERE us.status = 'active'
ORDER BY us.expires_at;
```

### Check Expiring Subscriptions

```sql
-- Subscriptions expiring in next 7 days
SELECT * FROM get_expiring_subscriptions(7);
```

### Check Payment History

```sql
-- Recent payments
SELECT 
  ph.*,
  u.email,
  sp.name as plan_name
FROM payment_history ph
JOIN auth.users u ON ph.user_id = u.id
LEFT JOIN user_subscriptions us ON ph.subscription_id = us.id
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
ORDER BY ph.created_at DESC
LIMIT 20;
```

## 🐛 Troubleshooting

### Subscription Not Activating

1. **Check Webhook Logs:**
   - Supabase Dashboard → Edge Functions → `btcpay-webhook` → Logs
   - Look for payment confirmation events

2. **Check BTCPay Invoice:**
   - Go to BTCPay Server
   - Check invoice status
   - Verify webhook was sent

3. **Check Database:**
   ```sql
   SELECT * FROM user_subscriptions 
   WHERE invoice_id = 'your-invoice-id';
   ```

### Bot Creation Fails

1. **Check Subscription:**
   ```sql
   SELECT * FROM get_user_active_subscription('user-id-here');
   ```

2. **Check Bot Count:**
   ```sql
   SELECT COUNT(*) FROM trading_bots 
   WHERE user_id = 'user-id-here' 
   AND status != 'deleted';
   ```

### Renewal Not Working

1. **Check Cron Job:**
   - Verify cron is running
   - Check logs for errors

2. **Check Function:**
   - Manually trigger renewal function
   - Check Edge Function logs

3. **Check Expiring Subscriptions:**
   ```sql
   SELECT * FROM get_expiring_subscriptions(7);
   ```

## 📊 Quick Reference

### URLs
- **Pricing Page:** `/pricing`
- **Subscription Success:** `/subscription/success`
- **BTCPay Server:** `http://147.93.121.52:23000`

### Database Functions
- `get_user_active_subscription(user_id)` - Get user's subscription
- `can_user_create_bot(user_id)` - Check bot creation limit
- `get_expiring_subscriptions(days)` - Get expiring subscriptions

### Edge Functions
- `btcpay-integration` - Create invoices, check status
- `btcpay-webhook` - Process payment confirmations
- `subscription-renewal` - Generate renewal invoices

## ✅ Checklist

- [ ] Database migration executed
- [ ] Edge Functions deployed
- [ ] Supabase secrets configured
- [ ] BTCPay Server installed and configured
- [ ] Webhook configured in BTCPay
- [ ] Renewal cron job set up
- [ ] Email notifications configured (optional)
- [ ] Frontend built and deployed
- [ ] Tested subscription flow
- [ ] Tested bot creation limits
- [ ] Tested renewal automation

## 🎉 You're Done!

The subscription system is now fully deployed. Users can:
- ✅ View pricing plans
- ✅ Subscribe with crypto payments
- ✅ Create bots based on plan limits
- ✅ Receive automatic renewal invoices
- ✅ Get email notifications

