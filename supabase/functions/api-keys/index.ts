import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Simple encryption/decryption (in production, use proper encryption)
function encrypt(text: string): string {
  return btoa(text) // Base64 encoding - use proper encryption in production
}

function decrypt(encryptedText: string): string {
  return atob(encryptedText) // Base64 decoding - use proper decryption in production
}

// Exchange API functions
async function fetchBybitBalance(apiKey: string, apiSecret: string, isTestnet: boolean) {
  const baseUrl = isTestnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com'
  
  try {
    const timestamp = Date.now().toString()
    const recvWindow = '5000'
    
    // Bybit V5 API signature format - CORRECTED approach
    // Step 1: Create parameters object with ALL parameters including api_key
    const params = {
      api_key: apiKey,
      accountType: 'UNIFIED',
      recv_window: recvWindow,
      timestamp: timestamp
    }
    
    // Step 2: Sort parameters alphabetically (Bybit requirement)
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&')
    
    console.log('=== BYBIT SIGNATURE DEBUG (CORRECTED) ===')
    console.log('1. Original params:', params)
    console.log('2. Sorted params string:', sortedParams)
    console.log('3. API Key (first 10 chars):', apiKey.substring(0, 10) + '...')
    console.log('4. Secret (first 10 chars):', apiSecret.substring(0, 10) + '...')
    
    // Step 3: Create signature using the sorted parameter string
    const signature = await createBybitSignature(sortedParams, apiSecret)
    
    console.log('5. Generated signature:', signature)
    
    // Step 4: Build final URL with signature
    const finalUrl = `${baseUrl}/v5/account/wallet-balance?${sortedParams}&sign=${signature}`
    
    console.log('6. Final URL:', finalUrl)
    console.log('=== END DEBUG ===')
    
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Bybit API HTTP Error:', response.status, errorText)
      throw new Error(`Bybit API error: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    console.log('Bybit API Response:', data)
    
    if (data.retCode !== 0) {
      throw new Error(`Bybit API error: ${data.retMsg}`)
    }
    
    const account = data.result?.list?.[0]
    if (!account) {
      return {
        exchange: 'bybit',
        totalBalance: 0,
        availableBalance: 0,
        lockedBalance: 0,
        assets: [],
        lastUpdated: new Date().toISOString(),
        status: 'connected'
      }
    }
    
    let totalBalance = 0
    let availableBalance = 0
    let lockedBalance = 0
    const assets: any[] = []
    
    // Process coin balances
    for (const coin of account.coin || []) {
      const free = parseFloat(coin.free || '0')
      const locked = parseFloat(coin.locked || '0')
      const total = free + locked
      
      totalBalance += total
      availableBalance += free
      lockedBalance += locked
      
      assets.push({
        asset: coin.coin,
        free,
        locked,
        total
      })
    }
    
    return {
      exchange: 'bybit',
      totalBalance,
      availableBalance,
      lockedBalance,
      assets,
      lastUpdated: new Date().toISOString(),
      status: 'connected'
    }
  } catch (error) {
    console.error('Bybit balance fetch error:', error)
    return {
      exchange: 'bybit',
      totalBalance: 0,
      availableBalance: 0,
      lockedBalance: 0,
      assets: [],
      lastUpdated: new Date().toISOString(),
      status: 'error',
      error: error.message
    }
  }
}

async function fetchOKXBalance(apiKey: string, apiSecret: string, passphrase: string, isTestnet: boolean) {
  const baseUrl = isTestnet ? 'https://www.okx.com' : 'https://www.okx.com'
  
  try {
    // OKX requires timestamp in ISO format with milliseconds
    const timestamp = new Date().toISOString()
    const method = 'GET'
    const requestPath = '/api/v5/account/balance'
    const body = ''
    
    console.log('=== OKX SIGNATURE DEBUG ===')
    console.log('1. Timestamp:', timestamp)
    console.log('2. Method:', method)
    console.log('3. Request Path:', requestPath)
    console.log('4. Body:', body)
    console.log('5. API Key (first 10 chars):', apiKey.substring(0, 10) + '...')
    console.log('6. Secret (first 10 chars):', apiSecret.substring(0, 10) + '...')
    console.log('7. Passphrase (first 10 chars):', passphrase.substring(0, 10) + '...')
    
    // Create signature
    const signature = await createOKXSignature(timestamp, method, requestPath, body, apiSecret)
    
    console.log('8. Generated signature:', signature)
    console.log('9. Full URL:', `${baseUrl}${requestPath}`)
    console.log('=== END OKX DEBUG ===')
    
    const response = await fetch(`${baseUrl}${requestPath}`, {
      method,
      headers: {
        'OK-ACCESS-KEY': apiKey,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': passphrase,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('OKX API HTTP Error:', response.status, errorText)
      throw new Error(`OKX API error: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    console.log('OKX API Response:', data)
    
    if (data.code !== '0') {
      throw new Error(`OKX API error: ${data.msg}`)
    }
    
    const account = data.data?.[0]
    if (!account) {
      return {
        exchange: 'okx',
        totalBalance: 0,
        availableBalance: 0,
        lockedBalance: 0,
        assets: [],
        lastUpdated: new Date().toISOString(),
        status: 'connected'
      }
    }
    
    let totalBalance = 0
    let availableBalance = 0
    let lockedBalance = 0
    const assets: any[] = []
    
    // Process coin balances
    for (const coin of account.details || []) {
      const free = parseFloat(coin.availBal || '0')
      const locked = parseFloat(coin.frozenBal || '0')
      const total = free + locked
      
      totalBalance += total
      availableBalance += free
      lockedBalance += locked
      
      assets.push({
        asset: coin.ccy,
        free,
        locked,
        total
      })
    }
    
    return {
      exchange: 'okx',
      totalBalance,
      availableBalance,
      lockedBalance,
      assets,
      lastUpdated: new Date().toISOString(),
      status: 'connected'
    }
  } catch (error) {
    console.error('OKX balance fetch error:', error)
    return {
      exchange: 'okx',
      totalBalance: 0,
      availableBalance: 0,
      lockedBalance: 0,
      assets: [],
      lastUpdated: new Date().toISOString(),
      status: 'error',
      error: error.message
    }
  }
}

// Helper function to create Bybit signature
async function createBybitSignature(params: string, secret: string): Promise<string> {
  console.log('Creating signature for params:', params)
  console.log('Using secret (first 10 chars):', secret.substring(0, 10) + '...')
  
  // Bybit expects HMAC-SHA256 signature in lowercase hex format
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(params);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  
  // Convert to lowercase hex string as required by Bybit
  const hexSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
  
  console.log('Generated signature:', hexSignature)
  
  return hexSignature;
}

// Helper function to create OKX signature
async function createOKXSignature(timestamp: string, method: string, requestPath: string, body: string, secret: string): Promise<string> {
  const message = timestamp + method + requestPath + body
  
  console.log('OKX Signature Debug:')
  console.log('- Timestamp:', timestamp)
  console.log('- Method:', method)
  console.log('- Request Path:', requestPath)
  console.log('- Body:', body)
  console.log('- Message to sign:', message)
  console.log('- Secret (first 10 chars):', secret.substring(0, 10) + '...')
  
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(message)
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  const hashArray = Array.from(new Uint8Array(signature))
  const base64Signature = btoa(String.fromCharCode(...hashArray))
  
  console.log('- Generated signature:', base64Signature)
  
  return base64Signature
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const method = req.method
    const url = new URL(req.url)
    const action = url.pathname.split('/').pop()

    switch (method) {
      case 'GET':
        if (action === 'list') {
          const { data: apiKeys, error } = await supabaseClient
            .from('api_keys')
            .select('id, exchange, is_testnet, is_active, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

          if (error) throw error

          return new Response(JSON.stringify({ apiKeys }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (action === 'balances') {
          // Fetch balances from connected exchanges
          const { data: apiKeys, error } = await supabaseClient
            .from('api_keys')
            .select('exchange, api_key, api_secret, passphrase, is_testnet')
            .eq('user_id', user.id)
            .eq('is_active', true)

          if (error) throw error

          const balances = []

          for (const apiKey of apiKeys) {
            try {
              const decryptedApiKey = decrypt(apiKey.api_key)
              const decryptedApiSecret = decrypt(apiKey.api_secret)
              const decryptedPassphrase = apiKey.passphrase ? decrypt(apiKey.passphrase) : null

              let exchangeBalance = null

              // Fetch balance from exchange API
              if (apiKey.exchange === 'bybit') {
                exchangeBalance = await fetchBybitBalance(decryptedApiKey, decryptedApiSecret, apiKey.is_testnet)
              } else if (apiKey.exchange === 'okx') {
                exchangeBalance = await fetchOKXBalance(decryptedApiKey, decryptedApiSecret, decryptedPassphrase, apiKey.is_testnet)
              }

              if (exchangeBalance) {
                balances.push(exchangeBalance)
              }
            } catch (err) {
              console.error(`Error fetching ${apiKey.exchange} balance:`, err)
              // Add error balance entry
              balances.push({
                exchange: apiKey.exchange,
                totalBalance: 0,
                availableBalance: 0,
                lockedBalance: 0,
                assets: [],
                lastUpdated: new Date().toISOString(),
                status: 'error',
                error: err.message
              })
            }
          }

          return new Response(JSON.stringify({ balances }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        break

      case 'POST':
        if (action === 'save') {
          const body = await req.json()
          const { exchange, apiKey, apiSecret, passphrase, isTestnet } = body

          // Ensure user exists in users table
          const { data: existingUser, error: userCheckError } = await supabaseClient
            .from('users')
            .select('id')
            .eq('id', user.id)
            .single()

          if (userCheckError && userCheckError.code === 'PGRST116') {
            // User doesn't exist, create them
            const { error: createUserError } = await supabaseClient
              .from('users')
              .insert({
                id: user.id,
                email: user.email,
                role: 'user',
                name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })

            if (createUserError) {
              console.error('Error creating user:', createUserError)
              throw createUserError
            }
            console.log('Created user:', user.id)
          } else if (userCheckError) {
            console.error('Error checking user:', userCheckError)
            throw userCheckError
          }

          // Encrypt sensitive data
          const encryptedApiKey = encrypt(apiKey)
          const encryptedApiSecret = encrypt(apiSecret)
          const encryptedPassphrase = passphrase ? encrypt(passphrase) : null

          const { data: savedKey, error } = await supabaseClient
            .from('api_keys')
            .insert({
              user_id: user.id,
              exchange,
              api_key: encryptedApiKey,
              api_secret: encryptedApiSecret,
              passphrase: encryptedPassphrase,
              is_testnet: isTestnet,
              is_active: true
            })
            .select('id, exchange, is_testnet, is_active, created_at')
            .single()

          if (error) throw error

          return new Response(JSON.stringify({ apiKey: savedKey }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (action === 'test') {
          const body = await req.json()
          const { exchange, apiKey, apiSecret, passphrase, isTestnet } = body

          // Mock API connection test
          // In production, implement actual exchange API testing
          const testResult = {
            success: Math.random() > 0.3, // 70% success rate for demo
            message: Math.random() > 0.3 ? 'Connection successful' : 'Invalid API credentials',
            exchange,
            testnet: isTestnet
          }

          return new Response(JSON.stringify(testResult), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        break

      case 'PUT':
        if (action === 'toggle') {
          const body = await req.json()
          const { id, isActive } = body

          const { data: apiKey, error } = await supabaseClient
            .from('api_keys')
            .update({ is_active: isActive, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', user.id)
            .select('id, exchange, is_testnet, is_active, created_at')
            .single()

          if (error) throw error

          return new Response(JSON.stringify({ apiKey }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        break

      case 'DELETE':
        const keyId = url.searchParams.get('id')
        if (keyId) {
          const { error } = await supabaseClient
            .from('api_keys')
            .delete()
            .eq('id', keyId)
            .eq('user_id', user.id)

          if (error) throw error

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        break
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})