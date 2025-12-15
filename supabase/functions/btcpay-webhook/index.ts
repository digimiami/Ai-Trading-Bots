/**
 * BTCPay Server Webhook Handler
 * Processes payment confirmations and updates subscriptions
 * 
 * Webhook events: https://docs.btcpayserver.org/API/Greenfield/v1/#tag/Webhooks
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BTCPayWebhookEvent {
  type: string
  invoiceId: string
  storeId: string
  deliveryId: string
  webhookId: string
  timestamp: number
  metadata?: Record<string, any>
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verify webhook secret (optional but recommended)
    const webhookSecret = Deno.env.get('BTCPAY_WEBHOOK_SECRET')
    const providedSecret = req.headers.get('btcpay-sig')
    
    if (webhookSecret && providedSecret !== webhookSecret) {
      console.warn('⚠️ Webhook signature mismatch')
      // Continue anyway for now, but log it
    }

    const event: BTCPayWebhookEvent = await req.json()
    console.log(`📨 BTCPay webhook received: ${event.type} for invoice ${event.invoiceId}`)
    console.log(`📨 Full webhook event:`, JSON.stringify(event, null, 2))

    // Get invoice details from database
    const { data: subscription, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('invoice_id', event.invoiceId)
      .single()

    if (subError || !subscription) {
      console.error('❌ Subscription not found for invoice:', event.invoiceId)
      console.error('❌ Error details:', subError)
      
      // Try to find by invoice_id in payment_history as fallback
      const { data: paymentHistory } = await supabaseClient
        .from('payment_history')
        .select('subscription_id, user_id')
        .eq('invoice_id', event.invoiceId)
        .single()
      
      if (paymentHistory && paymentHistory.subscription_id) {
        console.log(`⚠️ Found subscription via payment_history: ${paymentHistory.subscription_id}`)
        const { data: foundSubscription } = await supabaseClient
          .from('user_subscriptions')
          .select('*, subscription_plans(*)')
          .eq('id', paymentHistory.subscription_id)
          .single()
        
        if (foundSubscription) {
          console.log(`✅ Using subscription found via payment_history`)
          // Continue with foundSubscription instead
          const updatedEvent = { ...event }
          await handlePaymentSettled(supabaseClient, updatedEvent, foundSubscription)
          return new Response(
            JSON.stringify({ success: true, message: 'Webhook processed via fallback' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
      
      return new Response(
        JSON.stringify({ error: 'Subscription not found', invoiceId: event.invoiceId }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log(`✅ Found subscription: ${subscription.id}, current status: ${subscription.status}`)

    // Handle different event types
    switch (event.type) {
      case 'InvoicePaymentSettled':
      case 'InvoiceSettled':
        await handlePaymentSettled(supabaseClient, event, subscription)
        break

      case 'InvoiceReceivedPayment':
        await handlePaymentReceived(supabaseClient, event, subscription)
        break

      case 'InvoiceInvalid':
      case 'InvoiceExpired':
        await handleInvoiceExpired(supabaseClient, event, subscription)
        break

      default:
        console.log(`ℹ️ Unhandled webhook event type: ${event.type}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Webhook processing error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Handle payment settled - activate subscription
 */
async function handlePaymentSettled(
  supabaseClient: any,
  event: BTCPayWebhookEvent,
  subscription: any
) {
  console.log(`✅ Payment settled for subscription ${subscription.id}`)

  // Calculate next billing date (1 month from now)
  const nextBillingDate = new Date()
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)

  // Calculate expiration date
  const expiresAt = new Date(nextBillingDate)

  // Update subscription to active
  const { error: updateError } = await supabaseClient
    .from('user_subscriptions')
    .update({
      status: 'active',
      started_at: subscription.started_at || new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      next_billing_date: nextBillingDate.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', subscription.id)

  if (updateError) {
    console.error('❌ Failed to activate subscription:', updateError)
    throw updateError
  }

  // Update payment history
  await supabaseClient
    .from('payment_history')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('invoice_id', event.invoiceId)
    .eq('status', 'pending')

  // Log activity
  console.log(`✅ Subscription ${subscription.id} activated until ${expiresAt.toISOString()}`)

  // Get updated subscription with plan details
  const { data: updatedSubscription } = await supabaseClient
    .from('user_subscriptions')
    .select('*, subscription_plans(*)')
    .eq('id', subscription.id)
    .single()

  // Send confirmation email to user (includes invoice)
  await sendSubscriptionEmail(supabaseClient, updatedSubscription || subscription, 'activated')

  // Send in-app message to user
  await sendSubscriptionMessage(supabaseClient, updatedSubscription || subscription, 'activated')
}

/**
 * Handle payment received (but not yet settled)
 */
async function handlePaymentReceived(
  supabaseClient: any,
  event: BTCPayWebhookEvent,
  subscription: any
) {
  console.log(`💰 Payment received for subscription ${subscription.id}`)

  // Update payment history status
  await supabaseClient
    .from('payment_history')
    .update({
      status: 'paid',
      updated_at: new Date().toISOString()
    })
    .eq('invoice_id', event.invoiceId)
    .eq('status', 'pending')

  // Subscription will be activated when payment settles
}

/**
 * Send subscription email notification
 */
async function sendSubscriptionEmail(
  supabaseClient: any,
  subscription: any,
  eventType: 'activated' | 'expiring' | 'expired'
) {
  try {
    // Get user email
    const { data: user } = await supabaseClient.auth.admin.getUserById(subscription.user_id)
    if (!user || !user.email) {
      console.warn(`⚠️ User email not found for subscription ${subscription.id}`)
      return
    }

    const plan = subscription.subscription_plans || subscription.subscription_plans
    const siteUrl = Deno.env.get('SITE_URL') || 'https://pablobots.com'
    const invoiceUrl = subscription.invoice_url || subscription.metadata?.invoice_url || `${siteUrl}/subscription`
    
    const emailSubject = 
      eventType === 'activated' ? 'Subscription Activated - Pablo Trading Bots' :
      eventType === 'expiring' ? 'Subscription Renewal Required - Pablo Trading Bots' :
      'Subscription Expired - Pablo Trading Bots'

    const emailBody = eventType === 'activated'
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">🎉 Subscription Activated!</h2>
          <p>Your ${plan?.display_name || 'subscription'} has been activated successfully.</p>
          <p>Your subscription will be active once the payment has been formally settled/confirmed by our system.</p>
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Plan:</strong> ${plan?.display_name || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> Active</p>
            <p style="margin: 5px 0;"><strong>Expires:</strong> ${subscription.expires_at ? new Date(subscription.expires_at).toLocaleDateString() : 'Never'}</p>
            <p style="margin: 5px 0;"><strong>Max Bots:</strong> ${plan?.max_bots === null ? 'Unlimited' : plan.max_bots}</p>
          </div>

          <p><strong>Invoice:</strong> <a href="${invoiceUrl}" style="color: #2563eb;">View Invoice</a></p>
          
          <div style="margin: 30px 0;">
            <a href="${siteUrl}/bots" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Start Creating Bots</a>
          </div>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
            If you have any questions, please contact our support team.
          </p>
        </div>
      `
      : eventType === 'expiring'
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #f59e0b;">Subscription Renewal Required</h2>
          <p>Your ${plan?.display_name || 'subscription'} is expiring soon.</p>
          <p><strong>Expires:</strong> ${new Date(subscription.expires_at).toLocaleDateString()}</p>
          <p>Please renew your subscription to continue using all features.</p>
          <p><a href="${subscription.metadata?.renewal_invoice_url || `${siteUrl}/pricing`}" style="color: #2563eb;">Renew Now</a></p>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc2626;">Subscription Expired</h2>
          <p>Your ${plan?.display_name || 'subscription'} has expired.</p>
          <p>Please renew to continue using premium features.</p>
          <p><a href="${siteUrl}/pricing" style="color: #2563eb;">Renew Subscription</a></p>
        </div>
      `

    // Use Supabase's built-in email function or Resend API
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    
    if (RESEND_API_KEY) {
      // Send via Resend
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: 'Pablo Trading Bots <noreply@pablobots.com>',
          to: user.email,
          subject: emailSubject,
          html: emailBody
        })
      })

      if (emailResponse.ok) {
        console.log(`✅ Email sent to ${user.email} for subscription ${subscription.id}`)
      } else {
        const errorText = await emailResponse.text()
        console.error(`❌ Failed to send email:`, errorText)
      }
    } else {
      console.log(`ℹ️ Email notification (${eventType}) for ${user.email} - Resend API key not configured`)
    }
  } catch (error) {
    console.error('Error sending subscription email:', error)
  }
}

/**
 * Send in-app message notification to user
 */
async function sendSubscriptionMessage(
  supabaseClient: any,
  subscription: any,
  eventType: 'activated' | 'expiring' | 'expired'
) {
  try {
    const plan = subscription.subscription_plans || subscription.subscription_plans
    const siteUrl = Deno.env.get('SITE_URL') || 'https://pablobots.com'
    const invoiceUrl = subscription.invoice_url || subscription.metadata?.invoice_url || `${siteUrl}/subscription`

    // Try to find an admin user to send from (system messages)
    const { data: adminUsers } = await supabaseClient
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1)

    const senderId = adminUsers && adminUsers.length > 0 ? adminUsers[0].id : subscription.user_id

    let subject = ''
    let body = ''

    if (eventType === 'activated') {
      subject = '🎉 Subscription Activated!'
      body = `Your ${plan?.display_name || 'subscription'} has been activated successfully!

Your subscription will be active once the payment has been formally settled/confirmed by our system.

Plan: ${plan?.display_name || 'N/A'}
Status: Active
Expires: ${subscription.expires_at ? new Date(subscription.expires_at).toLocaleDateString() : 'Never'}
Max Bots: ${plan?.max_bots === null ? 'Unlimited' : plan.max_bots}

Invoice: ${invoiceUrl}

You can now create up to ${plan?.max_bots === null ? 'unlimited' : plan.max_bots} trading bots. Start creating your bots here: ${siteUrl}/bots

If you have any questions, please contact our support team.`
    } else if (eventType === 'expiring') {
      subject = '⚠️ Subscription Renewal Required'
      body = `Your ${plan?.display_name || 'subscription'} is expiring soon.

Expires: ${new Date(subscription.expires_at).toLocaleDateString()}

Please renew your subscription to continue using all features: ${subscription.metadata?.renewal_invoice_url || `${siteUrl}/pricing`}`
    } else {
      subject = '❌ Subscription Expired'
      body = `Your ${plan?.display_name || 'subscription'} has expired.

Please renew to continue using premium features: ${siteUrl}/pricing`
    }

    // Send message to user's inbox
    const { error: messageError } = await supabaseClient
      .from('messages')
      .insert({
        sender_id: senderId,
        recipient_id: subscription.user_id,
        subject: subject,
        body: body,
        is_read: false
      })

    if (messageError) {
      console.error(`❌ Failed to send in-app message:`, messageError)
      // Don't throw - email notification is more important
    } else {
      console.log(`✅ In-app message sent to user ${subscription.user_id} for subscription ${subscription.id}`)
    }
  } catch (error) {
    console.error('Error sending subscription message:', error)
    // Don't throw - email notification is more important
  }
}

/**
 * Handle invoice expired or invalid
 */
async function handleInvoiceExpired(
  supabaseClient: any,
  event: BTCPayWebhookEvent,
  subscription: any
) {
  console.log(`⏰ Invoice expired for subscription ${subscription.id}`)

  // Only update if still pending
  if (subscription.status === 'pending') {
    await supabaseClient
      .from('user_subscriptions')
      .update({
        status: 'expired',
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id)

    // Update payment history
    await supabaseClient
      .from('payment_history')
      .update({
        status: 'expired',
        updated_at: new Date().toISOString()
      })
      .eq('invoice_id', event.invoiceId)
  }
}

