# Subscription Activation Fix

## Issue
Users who have successfully paid for a subscription via BTCPay are unable to create more bots because their subscription status remains "pending" even though payment has been "Settled" on BTCPay server.

## Root Cause
The BTCPay webhook handler (`btcpay-webhook/index.ts`) processes `InvoicePaymentSettled` events, but there were gaps in:
1. **Notification System**: Missing in-app messages
2. **Invoice Delivery**: Invoice URL not always included in notifications
3. **Error Handling**: Webhook failures weren't properly logged or handled
4. **Fallback Logic**: No fallback if subscription lookup fails

## Solution Implemented

### 1. Enhanced Webhook Handler (`supabase/functions/btcpay-webhook/index.ts`)

#### Added Features:
- **In-App Messaging**: Sends notification to user's `/messages` inbox when subscription is activated
- **Improved Email**: Enhanced email template with invoice link and better formatting
- **Better Error Handling**: Added fallback logic to find subscription via payment_history if direct lookup fails
- **Enhanced Logging**: More detailed logging for debugging webhook issues

#### Key Changes:

**`handlePaymentSettled` function:**
- Now fetches updated subscription with plan details after activation
- Calls both `sendSubscriptionEmail` and `sendSubscriptionMessage`

**`sendSubscriptionEmail` function:**
- Enhanced HTML email template with better styling
- Includes invoice URL in email
- Includes message: "Your subscription will be active once the payment has been formally settled/confirmed by our system."
- Better error handling

**`sendSubscriptionMessage` function (NEW):**
- Sends in-app message to user's inbox
- Uses admin user as sender (or falls back to user themselves)
- Includes all subscription details and invoice link

**Webhook Processing:**
- Added fallback lookup via payment_history table
- Better error messages and logging

### 2. Communication Flow

When payment is settled, the system now:

1. **Updates Subscription Status** → `pending` → `active`
2. **Sends Email** → User receives email with:
   - Subscription activation confirmation
   - Invoice link
   - Plan details
   - Message about payment settlement
3. **Sends In-App Message** → User receives message in `/messages` inbox with:
   - Same information as email
   - Direct links to create bots

## Testing

### Manual Testing Steps:

1. **Test Webhook Processing:**
   ```bash
   # Simulate webhook event (use BTCPay test invoice)
   curl -X POST https://your-project.supabase.co/functions/v1/btcpay-webhook \
     -H "Content-Type: application/json" \
     -d '{
       "type": "InvoicePaymentSettled",
       "invoiceId": "test-invoice-id",
       "storeId": "your-store-id",
       "deliveryId": "test-delivery",
       "webhookId": "test-webhook",
       "timestamp": 1234567890
     }'
   ```

2. **Check Subscription Status:**
   ```sql
   SELECT id, user_id, status, invoice_id, invoice_url, updated_at
   FROM user_subscriptions
   WHERE invoice_id = 'your-invoice-id';
   ```

3. **Check Messages:**
   ```sql
   SELECT * FROM messages
   WHERE recipient_id = 'user-id'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

4. **Check Email Logs:**
   - Check Resend dashboard for sent emails
   - Verify email includes invoice link

### Common Issues & Solutions

#### Issue: Webhook not being called
**Solution:**
- Verify webhook URL in BTCPay: `https://your-project.supabase.co/functions/v1/btcpay-webhook`
- Check BTCPay webhook logs
- Verify `BTCPAY_WEBHOOK_SECRET` is set correctly

#### Issue: Subscription not found
**Solution:**
- Check if `invoice_id` matches between BTCPay and database
- Use fallback lookup via payment_history (now implemented)
- Check webhook logs for detailed error messages

#### Issue: Email not sending
**Solution:**
- Verify `RESEND_API_KEY` is set in Supabase Edge Function secrets
- Check Resend dashboard for errors
- Verify sender email is verified in Resend

#### Issue: In-app message not appearing
**Solution:**
- Check messages table for new entries
- Verify user has access to `/messages` page
- Check for RLS policy issues

## Manual Activation (Admin)

If webhook fails, admins can manually activate subscriptions via:

1. **Admin Panel** → Subscription Management
2. **SQL Direct Update:**
   ```sql
   UPDATE user_subscriptions
   SET 
     status = 'active',
     started_at = NOW(),
     expires_at = NOW() + INTERVAL '1 month',
     next_billing_date = NOW() + INTERVAL '1 month',
     updated_at = NOW()
   WHERE invoice_id = 'invoice-id'
     AND status = 'pending';
   ```

   Then manually trigger notifications:
   ```sql
   -- Get subscription details
   SELECT * FROM user_subscriptions
   WHERE invoice_id = 'invoice-id';
   ```

   Then call the notification functions manually or use admin panel.

## Deployment

1. **Deploy Updated Webhook:**
   ```bash
   supabase functions deploy btcpay-webhook
   ```

2. **Set Environment Variables:**
   - `RESEND_API_KEY` - For email sending
   - `SITE_URL` - Your site URL (e.g., https://pablobots.com)
   - `BTCPAY_WEBHOOK_SECRET` - Optional webhook verification

3. **Test with Real Payment:**
   - Create test subscription
   - Make test payment
   - Verify webhook is called
   - Check subscription status updates
   - Verify email and message are sent

## Monitoring

Monitor these logs for issues:
- Supabase Edge Function logs for `btcpay-webhook`
- BTCPay webhook delivery logs
- Resend email delivery logs
- Database logs for subscription updates

## Next Steps

1. ✅ Enhanced webhook handler with notifications
2. ✅ Added in-app messaging
3. ✅ Improved email templates
4. ⏳ Monitor webhook delivery success rate
5. ⏳ Add admin dashboard for manual activation
6. ⏳ Add webhook retry mechanism for failed deliveries

## Related Files

- `supabase/functions/btcpay-webhook/index.ts` - Main webhook handler
- `supabase/functions/btcpay-integration/index.ts` - Invoice creation
- `src/pages/messages/page.tsx` - Message inbox UI
- `src/pages/admin/components/SubscriptionManagement.tsx` - Admin subscription management

