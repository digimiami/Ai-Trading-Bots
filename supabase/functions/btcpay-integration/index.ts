/**
 * BTCPay Server Integration Edge Function
 * Handles invoice creation, payment status, and subscription management
 * 
 * Documentation: https://docs.btcpayserver.org/API/Greenfield/v1/
 * GitHub: https://github.com/btcpayserver
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

interface CreateInvoiceRequest {
  userId: string
  planId: string
  currency?: string // 'USD', 'BTC', 'USDT', etc.
}

interface BTCPayInvoice {
  id: string
  storeId: string
  amount: string
  currency: string
  type: string
  checkoutLink: string
  status: string
  metadata: Record<string, any>
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

    // Get BTCPay configuration from environment
    const btcpayConfig: BTCPayConfig = {
      serverUrl: Deno.env.get('BTCPAY_SERVER_URL') ?? '',
      storeId: Deno.env.get('BTCPAY_STORE_ID') ?? '',
      apiKey: Deno.env.get('BTCPAY_API_KEY') ?? '',
    }

    if (!btcpayConfig.serverUrl || !btcpayConfig.storeId || !btcpayConfig.apiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'BTCPay Server not configured',
          message: 'Please set BTCPAY_SERVER_URL, BTCPAY_STORE_ID, and BTCPAY_API_KEY in Supabase Edge Function secrets'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'create-invoice'

    // ============================================================
    // CREATE INVOICE
    // ============================================================
    if (action === 'create-invoice' && req.method === 'POST') {
      const body: CreateInvoiceRequest = await req.json()
      const { planId, currency = 'USD' } = body

      if (!planId) {
        return new Response(
          JSON.stringify({ error: 'planId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get subscription plan details
      const { data: plan, error: planError } = await supabaseClient
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .eq('is_active', true)
        .single()

      if (planError || !plan) {
        return new Response(
          JSON.stringify({ error: 'Subscription plan not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Calculate amount based on currency
      let amount: string
      let cryptoCurrency: string | null = null

      if (currency === 'USD') {
        amount = plan.price_monthly_usd.toString()
      } else {
        // Get crypto amount from plan
        const priceCrypto = plan.price_crypto as Record<string, string> || {}
        cryptoCurrency = currency.toUpperCase()
        amount = priceCrypto[cryptoCurrency] || plan.price_monthly_usd.toString()
      }

      // Create BTCPay invoice
      const invoiceData = {
        amount: amount,
        currency: currency === 'USD' ? 'USD' : cryptoCurrency,
        metadata: {
          orderId: `subscription_${user.id}_${Date.now()}`,
          userId: user.id,
          planId: planId,
          planName: plan.name,
          type: 'subscription',
          billingCycle: 'monthly'
        },
        receipt: {
          enabled: true
        },
        redirectURL: `${Deno.env.get('SITE_URL') || 'https://pablobots.com'}/subscription/success`,
        notificationURL: `${Deno.env.get('SUPABASE_URL')}/functions/v1/btcpay-webhook`
      }

      console.log(`📝 Creating BTCPay invoice for user ${user.id}, plan: ${plan.name}`)

      // Call BTCPay Server Greenfield API
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
        console.error('❌ BTCPay invoice creation failed:', errorText)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create invoice',
            details: errorText
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const btcpayInvoice: BTCPayInvoice = await btcpayResponse.json()

      // Create subscription record
      const { data: subscription, error: subError } = await supabaseClient
        .from('user_subscriptions')
        .insert({
          user_id: user.id,
          plan_id: planId,
          status: 'pending',
          payment_method: 'btcpay',
          invoice_id: btcpayInvoice.id,
          invoice_url: btcpayInvoice.checkoutLink,
          amount_paid: parseFloat(amount),
          currency: currency,
          crypto_amount: cryptoCurrency ? amount : null,
          metadata: {
            btcpay_store_id: btcpayConfig.storeId,
            btcpay_invoice_id: btcpayInvoice.id,
            plan_name: plan.name
          }
        })
        .select()
        .single()

      if (subError) {
        console.error('❌ Failed to create subscription record:', subError)
        return new Response(
          JSON.stringify({ error: 'Failed to create subscription' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create payment history record
      await supabaseClient
        .from('payment_history')
        .insert({
          subscription_id: subscription.id,
          user_id: user.id,
          invoice_id: btcpayInvoice.id,
          amount: parseFloat(amount),
          currency: currency,
          crypto_amount: cryptoCurrency ? amount : null,
          crypto_currency: cryptoCurrency,
          status: 'pending',
          payment_method: 'btcpay',
          btcpay_store_id: btcpayConfig.storeId,
          metadata: {
            checkout_link: btcpayInvoice.checkoutLink
          }
        })

      console.log(`✅ Invoice created: ${btcpayInvoice.id}`)

      return new Response(
        JSON.stringify({
          success: true,
          invoice: {
            id: btcpayInvoice.id,
            checkoutLink: btcpayInvoice.checkoutLink,
            amount: amount,
            currency: currency,
            status: btcpayInvoice.status
          },
          subscription: {
            id: subscription.id,
            planName: plan.display_name
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================
    // GET INVOICE STATUS
    // ============================================================
    if (action === 'invoice-status' && req.method === 'GET') {
      const invoiceId = url.searchParams.get('invoiceId')

      if (!invoiceId) {
        return new Response(
          JSON.stringify({ error: 'invoiceId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get invoice from BTCPay
      const btcpayResponse = await fetch(
        `${btcpayConfig.serverUrl}/api/v1/stores/${btcpayConfig.storeId}/invoices/${invoiceId}`,
        {
          headers: {
            'Authorization': `token ${btcpayConfig.apiKey}`
          }
        }
      )

      if (!btcpayResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'Invoice not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const invoice: BTCPayInvoice = await btcpayResponse.json()

      return new Response(
        JSON.stringify({
          invoiceId: invoice.id,
          status: invoice.status,
          amount: invoice.amount,
          currency: invoice.currency,
          checkoutLink: invoice.checkoutLink
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================
    // GET USER SUBSCRIPTION
    // ============================================================
    if (action === 'get-subscription' && req.method === 'GET') {
      const { data: subscription, error } = await supabaseClient
        .rpc('get_user_active_subscription', { p_user_id: user.id })

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ subscription: subscription[0] || null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('BTCPay integration error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

