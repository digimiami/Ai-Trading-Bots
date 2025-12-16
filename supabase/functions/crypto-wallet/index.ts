/**
 * Crypto Wallet Edge Function
 * Handles wallet operations: buy BTC, send BTC, get balance, transaction history
 * 
 * Endpoints:
 * - GET / - Get wallet info, balances, transactions
 * - POST /create-wallet - Create a new wallet address
 * - POST /buy - Initiate BTC purchase
 * - POST /send - Send BTC to an address
 * - GET /transactions - Get transaction history
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BuyBTCRequest {
  amount: number // Amount in USD or BTC
  currency: 'USD' | 'BTC' // Purchase currency
  paymentMethod?: 'coinbase' | 'moonpay' | 'transak' // Payment provider
}

interface SendBTCRequest {
  toAddress: string
  amount: number // Amount in BTC
  currency?: string // Default 'BTC'
  networkFee?: number // Optional network fee override
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('💰 [Wallet] Request received:', req.method, req.url)
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message || 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const path = url.pathname
    const action = path.split('/').pop() || ''

    // Route handling
    if (req.method === 'GET' && (action === '' || action === 'crypto-wallet')) {
      // Get wallet info, balances, and recent transactions
      return await getWalletInfo(supabaseClient, user.id)
    }

    if (req.method === 'POST' && action === 'create-wallet') {
      // Create a new wallet address
      const body = await req.json()
      return await createWallet(supabaseClient, user.id, body)
    }

    if (req.method === 'POST' && action === 'buy') {
      // Buy BTC
      const body: BuyBTCRequest = await req.json()
      return await buyBTC(supabaseClient, user.id, body)
    }

    if (req.method === 'POST' && action === 'send') {
      // Send BTC
      const body: SendBTCRequest = await req.json()
      return await sendBTC(supabaseClient, user.id, body)
    }

    if (req.method === 'GET' && action === 'transactions') {
      // Get transaction history
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const offset = parseInt(url.searchParams.get('offset') || '0')
      return await getTransactions(supabaseClient, user.id, limit, offset)
    }

    return new Response(
      JSON.stringify({ error: 'Not found', details: 'Invalid endpoint' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ [Wallet] Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Get wallet info, balances, and transactions
async function getWalletInfo(supabase: any, userId: string) {
  try {
    // Get user's wallets
    const { data: wallets, error: walletsError } = await supabase
      .from('crypto_wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (walletsError) throw walletsError

    // Get balances
    const { data: balances, error: balancesError } = await supabase
      .from('wallet_balances')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (balancesError) throw balancesError

    // Get recent transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (transactionsError) throw transactionsError

    // Calculate total balance per currency
    const totalBalances: Record<string, number> = {}
    balances?.forEach((balance: any) => {
      if (!totalBalances[balance.currency]) {
        totalBalances[balance.currency] = 0
      }
      totalBalances[balance.currency] += parseFloat(balance.available_balance || '0')
    })

    return new Response(
      JSON.stringify({
        wallets: wallets || [],
        balances: balances || [],
        totalBalances,
        recentTransactions: transactions || [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ [Wallet] Error getting wallet info:', error)
    throw error
  }
}

// Create a new wallet address
async function createWallet(supabase: any, userId: string, body: any) {
  try {
    const { currency = 'BTC', label, network = 'mainnet' } = body

    // Generate a wallet address (in production, use a proper Bitcoin address generator)
    // For now, we'll create a placeholder that should be replaced with actual address generation
    // You can integrate with services like BlockCypher, Blockchain.info, or generate addresses using bitcoinjs-lib
    
    // For demonstration, we'll use a mock address generator
    // In production, integrate with a Bitcoin wallet service
    const address = generateMockAddress(currency)

    // Check if wallet already exists
    const { data: existingWallet } = await supabase
      .from('crypto_wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('currency', currency)
      .eq('address', address)
      .single()

    if (existingWallet) {
      return new Response(
        JSON.stringify({ 
          wallet: existingWallet,
          message: 'Wallet already exists'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create wallet
    const { data: wallet, error: walletError } = await supabase
      .from('crypto_wallets')
      .insert({
        user_id: userId,
        currency,
        address,
        label: label || `${currency} Wallet`,
        network,
        is_active: true,
      })
      .select()
      .single()

    if (walletError) throw walletError

    // Initialize balance
    await supabase
      .from('wallet_balances')
      .insert({
        wallet_id: wallet.id,
        user_id: userId,
        currency,
        balance: 0,
        available_balance: 0,
        pending_balance: 0,
      })

    return new Response(
      JSON.stringify({ 
        wallet,
        message: 'Wallet created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ [Wallet] Error creating wallet:', error)
    throw error
  }
}

// Buy BTC
async function buyBTC(supabase: any, userId: string, body: BuyBTCRequest) {
  try {
    const { amount, currency, paymentMethod = 'coinbase' } = body

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount', details: 'Amount must be greater than 0' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get or create BTC wallet
    let { data: wallet } = await supabase
      .from('crypto_wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('currency', 'BTC')
      .eq('is_active', true)
      .single()

    if (!wallet) {
      // Create wallet if it doesn't exist
      const address = generateMockAddress('BTC')
      const { data: newWallet, error: walletError } = await supabase
        .from('crypto_wallets')
        .insert({
          user_id: userId,
          currency: 'BTC',
          address,
          label: 'BTC Wallet',
          network: 'mainnet',
          is_active: true,
        })
        .select()
        .single()

      if (walletError) throw walletError
      wallet = newWallet

      // Initialize balance
      await supabase
        .from('wallet_balances')
        .insert({
          wallet_id: wallet.id,
          user_id: userId,
          currency: 'BTC',
          balance: 0,
          available_balance: 0,
          pending_balance: 0,
        })
    }

    // Get current BTC price (using CoinGecko API as fallback)
    const btcPrice = await getBTCPrice()
    
    // Calculate BTC amount if buying with USD
    let btcAmount = amount
    let fiatAmount = amount
    if (currency === 'USD') {
      btcAmount = amount / btcPrice
      fiatAmount = amount
    }

    // Create transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        user_id: userId,
        transaction_type: 'buy',
        currency: 'BTC',
        amount: btcAmount,
        to_address: wallet.address,
        status: 'pending',
        payment_provider: paymentMethod,
        fiat_amount: fiatAmount,
        fiat_currency: currency,
        exchange_rate: btcPrice,
        metadata: {
          payment_method: paymentMethod,
          original_amount: amount,
          original_currency: currency,
        },
      })
      .select()
      .single()

    if (transactionError) throw transactionError

    // Generate payment URL based on payment provider
    // In production, integrate with actual payment providers
    const paymentUrl = await generatePaymentUrl(paymentMethod, {
      amount: currency === 'USD' ? amount : btcAmount * btcPrice,
      currency: currency === 'USD' ? 'USD' : 'BTC',
      transactionId: transaction.id,
      walletAddress: wallet.address,
    })

    return new Response(
      JSON.stringify({
        transaction,
        paymentUrl,
        message: 'Purchase initiated. Please complete payment.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ [Wallet] Error buying BTC:', error)
    throw error
  }
}

// Send BTC
async function sendBTC(supabase: any, userId: string, body: SendBTCRequest) {
  try {
    const { toAddress, amount, currency = 'BTC', networkFee } = body

    if (!toAddress || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid parameters', details: 'toAddress and amount are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate Bitcoin address format (basic check)
    if (currency === 'BTC' && !isValidBitcoinAddress(toAddress)) {
      return new Response(
        JSON.stringify({ error: 'Invalid address', details: 'Invalid Bitcoin address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's wallet
    const { data: wallet } = await supabase
      .from('crypto_wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('currency', currency)
      .eq('is_active', true)
      .single()

    if (!wallet) {
      return new Response(
        JSON.stringify({ error: 'Wallet not found', details: `No ${currency} wallet found` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check balance
    const { data: balance } = await supabase
      .from('wallet_balances')
      .select('*')
      .eq('wallet_id', wallet.id)
      .eq('currency', currency)
      .single()

    const availableBalance = parseFloat(balance?.available_balance || '0')
    const estimatedFee = networkFee || 0.00001 // Default network fee (~$0.50 at current rates)
    const totalRequired = amount + estimatedFee

    if (availableBalance < totalRequired) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient balance', 
          details: `Available: ${availableBalance} ${currency}, Required: ${totalRequired} ${currency}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        user_id: userId,
        transaction_type: 'send',
        currency,
        amount,
        fee: estimatedFee,
        network_fee: estimatedFee,
        from_address: wallet.address,
        to_address: toAddress,
        status: 'pending',
        metadata: {
          network_fee_override: networkFee ? true : false,
        },
      })
      .select()
      .single()

    if (transactionError) throw transactionError

    // In production, here you would:
    // 1. Sign the transaction using a Bitcoin wallet service
    // 2. Broadcast the transaction to the Bitcoin network
    // 3. Update transaction status based on confirmation
    
    // For now, we'll simulate the transaction
    // In production, integrate with BlockCypher, Blockchain.info, or a Bitcoin node
    const txHash = await simulateSendTransaction(wallet.address, toAddress, amount, estimatedFee)

    // Update transaction with hash
    await supabase
      .from('wallet_transactions')
      .update({
        transaction_hash: txHash,
        status: 'processing',
      })
      .eq('id', transaction.id)

    return new Response(
      JSON.stringify({
        transaction: {
          ...transaction,
          transaction_hash: txHash,
          status: 'processing',
        },
        message: 'Transaction submitted. Waiting for confirmation.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ [Wallet] Error sending BTC:', error)
    throw error
  }
}

// Get transaction history
async function getTransactions(supabase: any, userId: string, limit: number, offset: number) {
  try {
    const { data: transactions, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return new Response(
      JSON.stringify({ transactions: transactions || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ [Wallet] Error getting transactions:', error)
    throw error
  }
}

// Helper functions

function generateMockAddress(currency: string): string {
  // In production, use a proper address generator or integrate with a wallet service
  // This is a mock address for demonstration
  if (currency === 'BTC') {
    // Bitcoin addresses start with 1, 3, or bc1
    const prefixes = ['1', '3', 'bc1']
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
    const randomChars = Array.from({ length: 33 }, () => 
      '0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Math.floor(Math.random() * 58)]
    ).join('')
    return prefix + randomChars.substring(0, 33 - prefix.length)
  }
  return '0x' + Array.from({ length: 40 }, () => 
    '0123456789abcdef'[Math.floor(Math.random() * 16)]
  ).join('')
}

async function getBTCPrice(): Promise<number> {
  try {
    // Try CoinGecko API first (free, no auth required)
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
    const data = await response.json()
    return data.bitcoin?.usd || 50000 // Fallback price
  } catch (error) {
    console.error('Error fetching BTC price:', error)
    return 50000 // Fallback price
  }
}

function isValidBitcoinAddress(address: string): boolean {
  // Basic Bitcoin address validation
  // In production, use a proper Bitcoin address validation library
  if (!address || address.length < 26 || address.length > 62) return false
  if (address.startsWith('1') || address.startsWith('3') || address.startsWith('bc1')) {
    return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) || 
           /^bc1[a-z0-9]{39,59}$/.test(address)
  }
  return false
}

async function generatePaymentUrl(provider: string, params: any): Promise<string> {
  // In production, integrate with actual payment providers:
  // - Coinbase Commerce API
  // - MoonPay API
  // - Transak API
  
  // For now, return a mock URL
  const baseUrl = Deno.env.get('APP_URL') || 'http://localhost:3000'
  return `${baseUrl}/wallet/payment?provider=${provider}&transactionId=${params.transactionId}`
}

async function simulateSendTransaction(from: string, to: string, amount: number, fee: number): Promise<string> {
  // In production, integrate with:
  // - BlockCypher API
  // - Blockchain.info API
  // - Your own Bitcoin node
  // - Exchange API that supports withdrawals
  
  // Generate mock transaction hash
  return '0x' + Array.from({ length: 64 }, () => 
    '0123456789abcdef'[Math.floor(Math.random() * 16)]
  ).join('')
}

