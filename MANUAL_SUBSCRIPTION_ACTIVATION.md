# Manual Subscription Activation Guide

## Quick Fix for Pending Subscriptions

If a subscription shows "pending" status but the BTCPay invoice shows "Settled", you can manually activate it.

### Option 1: Admin Panel (Recommended)

1. Go to **Admin Panel** → **Subscription Management**
2. Find the subscription with status "PENDING"
3. Click the **"Activate"** button next to it
4. The system will:
   - Update subscription status to "active"
   - Send email notification to user
   - Send in-app message to user
   - Update payment history

### Option 2: Direct API Call

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/btcpay-webhook?action=manual-activate" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptionId": "subscription-uuid",
    "invoiceId": "61EG1DE8BkiuggnUHYyach"
  }'
```

### Option 3: SQL Direct Update (Emergency Only)

```sql
-- Update subscription status
UPDATE user_subscriptions
SET 
  status = 'active',
  started_at = COALESCE(started_at, NOW()),
  expires_at = NOW() + INTERVAL '1 month',
  next_billing_date = NOW() + INTERVAL '1 month',
  updated_at = NOW()
WHERE invoice_id = '61EG1DE8BkiuggnUHYyach'
  AND status = 'pending';

-- Update payment history
UPDATE payment_history
SET 
  status = 'paid',
  paid_at = NOW(),
  updated_at = NOW()
WHERE invoice_id = '61EG1DE8BkiuggnUHYyach'
  AND status = 'pending';
```

**Note:** SQL method won't send notifications. Use Admin Panel or API for full functionality.

## Finding Subscription Details

To find a subscription by invoice ID:

```sql
SELECT 
  id,
  user_id,
  status,
  invoice_id,
  invoice_url,
  created_at
FROM user_subscriptions
WHERE invoice_id = '61EG1DE8BkiuggnUHYyach';
```

## Troubleshooting

### Why is subscription still pending?

1. **Webhook not called**: BTCPay may not have sent the webhook
2. **Webhook failed**: Check Supabase Edge Function logs
3. **Invoice ID mismatch**: Verify invoice_id matches between BTCPay and database

### Check Webhook Logs

1. Go to Supabase Dashboard → Edge Functions → `btcpay-webhook`
2. Check logs for errors or missing webhook calls
3. Look for: `📨 BTCPay webhook received` messages

### Verify Invoice Status in BTCPay

1. Go to BTCPay Server → Invoices
2. Find invoice: `61EG1DE8BkiuggnUHYyach`
3. Check "State" field - should be "Settled"
4. Check webhook delivery logs in BTCPay

## Prevention

To prevent this issue in the future:

1. **Verify Webhook URL**: Ensure BTCPay webhook points to correct URL
2. **Monitor Logs**: Regularly check webhook delivery success rate
3. **Set Up Alerts**: Configure alerts for failed webhook deliveries
4. **Test Webhooks**: Test webhook delivery after deployment

## Related Files

- `supabase/functions/btcpay-webhook/index.ts` - Webhook handler with manual activation
- `src/pages/admin/components/SubscriptionManagement.tsx` - Admin UI with activate button
