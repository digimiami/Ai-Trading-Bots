# BTCPay Server Setup Guide

Complete guide to set up BTCPay Server for monthly crypto subscriptions.

## Overview

BTCPay Server is an open-source, self-hosted Bitcoin payment processor that allows customers to pay from their own wallets. Perfect for monthly subscriptions with zero transaction fees.

**GitHub:** https://github.com/btcpayserver  
**Documentation:** https://docs.btcpayserver.org/API/Greenfield/v1/

## Prerequisites

- VPS with Docker installed
- Domain name (optional but recommended)
- Basic server administration knowledge

## Option 1: Docker Installation (Recommended)

### Step 1: Install BTCPay Server

```bash
# SSH into your VPS
ssh user@your-server-ip

# Create BTCPay directory
mkdir -p ~/btcpayserver
cd ~/btcpayserver

# Download and run BTCPay Server
curl -sSL https://raw.githubusercontent.com/btcpayserver/btcpayserver-docker/master/docker-compose-generator.sh | bash -s - -o

# Start BTCPay Server
docker-compose up -d
```

### Step 2: Access BTCPay Server

1. Open browser: `http://your-server-ip:23000`
2. Create admin account
3. Complete initial setup

### Step 3: Configure Store

1. Go to **Stores** → **Create Store**
2. Name: "Pablo Trading Bots"
3. Default currency: USD
4. Save Store ID (you'll need this)

### Step 4: Generate API Key

1. Go to **Account** → **Manage Account** → **API Keys**
2. Click **Generate API Key**
3. Permissions:
   - ✅ `btcpay.store.canviewinvoices`
   - ✅ `btcpay.store.cancreateinvoice`
   - ✅ `btcpay.store.canmodifyinvoices`
   - ✅ `btcpay.store.webhooks.canmodifywebhooks`
4. Copy the API Key (starts with `token_`)

### Step 5: Set Up Webhook

1. Go to **Stores** → Your Store → **Webhooks**
2. Click **Create Webhook**
3. Webhook URL: `https://your-project.supabase.co/functions/v1/btcpay-webhook`
4. Events to listen:
   - ✅ `InvoicePaymentSettled`
   - ✅ `InvoiceSettled`
   - ✅ `InvoiceReceivedPayment`
   - ✅ `InvoiceInvalid`
   - ✅ `InvoiceExpired`
5. Save webhook

## Option 2: BTCPay Hosting (Easier)

If you don't want to self-host, use a BTCPay hosting provider:

1. **BTCPay Server Hosting Providers:**
   - https://btcpayserver.org/hosting/
   - Choose a provider (e.g., LunaNode, DigitalOcean)

2. Follow their setup instructions
3. Get your BTCPay Server URL, Store ID, and API Key

## Configuration in Supabase

### Step 1: Add Edge Function Secrets

Go to **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**

Add these secrets:

```
BTCPAY_SERVER_URL=https://your-btcpay-server.com
BTCPAY_STORE_ID=your-store-id-here
BTCPAY_API_KEY=token_your-api-key-here
BTCPAY_WEBHOOK_SECRET=your-webhook-secret (optional)
SITE_URL=https://pablobots.com
```

### Step 2: Deploy Edge Functions

```bash
# Deploy BTCPay integration function
supabase functions deploy btcpay-integration

# Deploy webhook handler
supabase functions deploy btcpay-webhook
```

### Step 3: Run Database Migration

```bash
# Run the subscription system SQL
psql -h your-db-host -U postgres -d postgres -f create_subscription_system.sql
```

Or run it in Supabase Dashboard → SQL Editor

## Testing

### Test Invoice Creation

```bash
curl -X POST https://your-project.supabase.co/functions/v1/btcpay-integration?action=create-invoice \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "plan-uuid-here",
    "currency": "USD"
  }'
```

### Test Webhook

BTCPay Server will automatically send webhooks when payments are received. Check Supabase Edge Function logs to verify.

## Lightning Network Setup (Optional)

For faster, cheaper payments:

1. In BTCPay Server, go to **Stores** → Your Store → **Lightning**
2. Connect to a Lightning node (e.g., via BTCPay's built-in node)
3. Enable Lightning payments in store settings

## Security Best Practices

1. **Use HTTPS:** Set up SSL certificate for BTCPay Server
2. **Webhook Secret:** Enable webhook signature verification
3. **API Key Security:** Never commit API keys to git
4. **Firewall:** Only expose necessary ports
5. **Backups:** Regularly backup BTCPay Server data

## Troubleshooting

### Invoice Not Creating

- Check BTCPay Server logs: `docker-compose logs btcpayserver`
- Verify API key permissions
- Check Store ID is correct

### Webhook Not Receiving Events

- Verify webhook URL is accessible
- Check Supabase Edge Function logs
- Test webhook manually in BTCPay dashboard

### Payment Not Activating Subscription

- Check webhook handler logs
- Verify invoice ID matches subscription record
- Check database for subscription status

## Support

- **BTCPay Documentation:** https://docs.btcpayserver.org/
- **BTCPay GitHub:** https://github.com/btcpayserver
- **Community:** https://chat.btcpayserver.org/

## Next Steps

After setup:
1. ✅ Test invoice creation
2. ✅ Test payment flow
3. ✅ Verify subscription activation
4. ✅ Set up recurring billing logic
5. ✅ Configure email notifications

