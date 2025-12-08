/**
 * Subscription Renewal Automation
 * Checks for expiring subscriptions and generates renewal invoices
 * Should be triggered daily via cron job
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BTCPayConfig {
  serverUrl: string
  storeId: string
  apiKey: string
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

    // Verify cron secret (optional but recommended)
    const cronSecret = req.headers.get('x-cron-secret')
    const expectedSecret = Deno.env.get('SUBSCRIPTION_RENEWAL_SECRET')
    
    if (expectedSecret && cronSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get BTCPay configuration
    const btcpayConfig: BTCPayConfig = {
      serverUrl: Deno.env.get('BTCPAY_SERVER_URL') ?? '',
      storeId: Deno.env.get('BTCPAY_STORE_ID') ?? '',
      apiKey: Deno.env.get('BTCPAY_API_KEY') ?? '',
    }

    if (!btcpayConfig.serverUrl || !btcpayConfig.storeId || !btcpayConfig.apiKey) {
      return new Response(
        JSON.stringify({ error: 'BTCPay Server not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔄 Starting subscription renewal check...')

    // Find subscriptions expiring in the next 7 days
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    const { data: expiringSubscriptions, error: queryError } = await supabaseClient
      .from('user_subscriptions')
      .select(`
        *,
        subscription_plans (*),
        users!inner (id, email)
      `)
      .eq('status', 'active')
      .lte('expires_at', sevenDaysFromNow.toISOString())
      .gte('expires_at', new Date().toISOString()) // Not already expired
      .is('next_billing_date', null) // No renewal invoice created yet

    if (queryError) {
      throw queryError
    }

    if (!expiringSubscriptions || expiringSubscriptions.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No subscriptions need renewal',
          checked: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📋 Found ${expiringSubscriptions.length} subscriptions expiring soon`)

    const results = []

    for (const subscription of expiringSubscriptions) {
      try {
        const plan = subscription.subscription_plans
        const user = subscription.users

        if (!plan || plan.price_monthly_usd === 0) {
          // Free plan - skip renewal
          continue
        }

        // Calculate renewal amount
        const amount = plan.price_monthly_usd.toString()
        const priceCrypto = plan.price_crypto as Record<string, string> || {}
        const currency = 'USD' // Default to USD, can be made configurable

        // Create renewal invoice
        const invoiceData = {
          amount: amount,
          currency: currency,
          metadata: {
            orderId: `renewal_${subscription.id}_${Date.now()}`,
            userId: subscription.user_id,
            planId: plan.id,
            planName: plan.name,
            type: 'subscription_renewal',
            billingCycle: 'monthly',
            originalSubscriptionId: subscription.id
          },
          receipt: {
            enabled: true
          },
          redirectURL: `${Deno.env.get('SITE_URL') || 'https://pablobots.com'}/subscription/success`,
          notificationURL: `${Deno.env.get('SUPABASE_URL')}/functions/v1/btcpay-webhook`
        }

        console.log(`📝 Creating renewal invoice for subscription ${subscription.id}`)

        const btcpayResponse = await fetch(
          `${btcpayConfig.serverUrl}/api/v1/stores/${btcpayConfig.storeId}/invoices`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `token ${btcpayConfig.apiKey}`
            },
            body: JSON.stringify(invoiceData)
          }
        )

        if (!btcpayResponse.ok) {
          const errorText = await btcpayResponse.text()
          console.error(`❌ Failed to create renewal invoice for ${subscription.id}:`, errorText)
          results.push({
            subscriptionId: subscription.id,
            userId: subscription.user_id,
            status: 'error',
            error: errorText
          })
          continue
        }

        const invoice = await btcpayResponse.json()

        // Update subscription with renewal invoice
        await supabaseClient
          .from('user_subscriptions')
          .update({
            next_billing_date: new Date(invoice.expiryTime).toISOString(),
            metadata: {
              ...(subscription.metadata || {}),
              renewal_invoice_id: invoice.id,
              renewal_invoice_url: invoice.checkoutLink,
              renewal_created_at: new Date().toISOString()
            }
          })
          .eq('id', subscription.id)

        // Create payment history record
        await supabaseClient
          .from('payment_history')
          .insert({
            subscription_id: subscription.id,
            user_id: subscription.user_id,
            invoice_id: invoice.id,
            amount: parseFloat(amount),
            currency: currency,
            status: 'pending',
            payment_method: 'btcpay',
            btcpay_store_id: btcpayConfig.storeId,
            metadata: {
              type: 'renewal',
              checkout_link: invoice.checkoutLink
            }
          })

        // TODO: Send email notification to user
        console.log(`✅ Renewal invoice created for subscription ${subscription.id}: ${invoice.id}`)

        results.push({
          subscriptionId: subscription.id,
          userId: subscription.user_id,
          invoiceId: invoice.id,
          checkoutLink: invoice.checkoutLink,
          status: 'success'
        })

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        console.error(`❌ Error processing subscription ${subscription.id}:`, error)
        results.push({
          subscriptionId: subscription.id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${expiringSubscriptions.length} subscriptions`,
        results,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Subscription renewal error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

