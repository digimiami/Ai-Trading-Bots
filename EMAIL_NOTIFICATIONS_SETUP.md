# Email Notifications Setup Guide

## Overview
This guide explains how to set up and use email notifications in the Pablo Trading platform.

## Database Setup

### 1. Create User Settings Table
Run the SQL script to create the `user_settings` table:
```sql
-- Run: create_user_settings_table.sql
```

This creates a table to store:
- Email notification preferences
- Alert settings
- Risk management settings

### 2. Create Email Notifications Table
Run the SQL script to create the `email_notifications` table for tracking sent emails:
```sql
-- Run: create_email_notifications_table.sql
```

## Email Service Configuration

### Option 1: Resend (Recommended)
1. Sign up at [Resend.com](https://resend.com)
2. Get your API key
3. Add to Supabase Edge Function secrets:
   - `RESEND_API_KEY`: Your Resend API key
   - `RESEND_FROM_EMAIL`: Your verified sender email (e.g., `notifications@pablobots.net`)

### Option 2: SendGrid
1. Sign up at [SendGrid.com](https://sendgrid.com)
2. Get your API key
3. Modify `supabase/functions/email-notifications/index.ts` to use SendGrid API

### Option 3: Supabase Auth Email
If you have Supabase Auth email configured, you can use that instead.

## Edge Function Deployment

Deploy the email notifications Edge Function:
```bash
supabase functions deploy email-notifications
```

Or deploy manually via Supabase Dashboard:
1. Go to Edge Functions
2. Create new function: `email-notifications`
3. Copy code from `supabase/functions/email-notifications/index.ts`
4. Add environment variables (RESEND_API_KEY, etc.)

## Usage

### User Settings Page
Users can configure email notifications in Settings:
1. Navigate to `/settings`
2. Find "Email Notifications" card
3. Toggle "Enable Email Notifications"
4. Configure individual notification types:
   - Trade Executed
   - Bot Started/Stopped
   - Position Opened/Closed
   - Stop Loss/Take Profit Triggered
   - Error Occurred
   - Profit/Loss Alerts
   - Daily Summary

### Sending Email Notifications

From your Edge Functions or backend code:

```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/email-notifications?action=send`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'trade_executed',
      subject: 'Trade Executed - BTCUSDT',
      message: 'Your bot executed a trade...',
      data: {
        symbol: 'BTCUSDT',
        side: 'buy',
        price: 50000,
        quantity: 0.1,
      },
    }),
  }
);
```

### Testing Email Notifications

Users can test their email settings by clicking "Send Test Email" in the Settings page.

## Notification Types

Available notification types:
- `trade_executed` - When a trade is executed
- `bot_started` - When a bot starts trading
- `bot_stopped` - When a bot stops trading
- `position_opened` - When a new position is opened
- `position_closed` - When a position is closed
- `stop_loss_triggered` - When stop loss is hit
- `take_profit_triggered` - When take profit is hit
- `error_occurred` - When a bot encounters an error
- `profit_alert` - When profit threshold is reached
- `loss_alert` - When loss threshold is reached
- `daily_summary` - Daily trading summary

## Integration with Bot Executor

To send emails when trades are executed, add this to `bot-executor/index.ts`:

```typescript
// After trade execution
try {
  await fetch(`${supabaseUrl}/functions/v1/email-notifications?action=send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'trade_executed',
      subject: `Trade Executed - ${bot.symbol}`,
      message: `Your bot "${bot.name}" executed a ${trade.side} trade...`,
      data: { bot, trade },
    }),
  });
} catch (error) {
  console.error('Failed to send email notification:', error);
  // Don't fail the trade if email fails
}
```

## Troubleshooting

### Emails Not Sending
1. Check that `RESEND_API_KEY` is set in Edge Function secrets
2. Verify the sender email is verified in Resend
3. Check Edge Function logs for errors
4. Verify user has email notifications enabled in settings

### Test Email Fails
1. Ensure user is authenticated
2. Check browser console for errors
3. Verify Edge Function is deployed
4. Check Supabase logs

## Security Notes

- Email notifications respect user preferences
- Users can disable email notifications at any time
- All email notifications are logged in the `email_notifications` table
- Only authenticated users can send test emails

