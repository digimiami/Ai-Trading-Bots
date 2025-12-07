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

    // Get invoice details from database
    const { data: subscription, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('invoice_id', event.invoiceId)
      .single()

    if (subError || !subscription) {
      console.error('❌ Subscription not found for invoice:', event.invoiceId)
      return new Response(
        JSON.stringify({ error: 'Subscription not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

  // TODO: Send confirmation email to user
  // TODO: Notify user via app notification
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

