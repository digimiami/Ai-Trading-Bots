import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Simple encryption/decryption (in production, use proper encryption)
// Fixed to handle UTF-8 characters properly
function encrypt(text: string): string {
  // Convert string to UTF-8 bytes, then to base64
  // This handles all Unicode characters, not just Latin1
  const utf8Bytes = new TextEncoder().encode(text);
  const binaryString = String.fromCharCode(...utf8Bytes);
  return btoa(binaryString);
}

function decrypt(encryptedText: string): string {
  // Decode base64, then convert UTF-8 bytes back to string
  const binaryString = atob(encryptedText);
  const utf8Bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    utf8Bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder().decode(utf8Bytes);
}

// Exchange API functions
async function fetchBybitBalance(apiKey: string, apiSecret: string, isTestnet: boolean) {
  const baseUrl = isTestnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com'
  
  try {
    const timestamp = Date.now().toString()
    const recvWindow = '5000'
    
    // Bybit V5 API - Use HEADER authentication
    // Step 1: Create parameters for signature (INCLUDE api_key)
    // Bybit only supports UNIFIED account type for wallet balance
    const params = {
      api_key: apiKey,
      accountType: 'UNIFIED',
      recv_window: recvWindow,
      timestamp: timestamp
    }
    
    // Step 2: Sort parameters alphabetically
    console.log('=== PARAMETER DEBUG (API-KEYS) ===');
    console.log('Raw params:', params);
    console.log('Param keys:', Object.keys(params));
    console.log('Sorted keys:', Object.keys(params).sort());
    
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&')
    
    console.log('Sorted params string:', sortedParams);
    console.log('Sorted params length:', sortedParams.length);
    
    // Step 3: Create signature string (timestamp + api_key + recv_window + parameters)
    const signatureString = timestamp + apiKey + recvWindow + sortedParams
    
    console.log('=== BYBIT SIGNATURE DEBUG (HEADER AUTH) ===')
    console.log('0. Environment:', isTestnet ? 'TESTNET' : 'MAINNET')
    console.log('0. Base URL:', baseUrl)
    console.log('0. Endpoint: /v5/account/wallet-balance')
    console.log('0. IMPORTANT: If TESTNET, account might be empty - need testnet funds!')
    console.log('1. Params for signature:', params)
    console.log('2. Sorted params string:', sortedParams)
    console.log('3. Signature string length:', signatureString.length)
    console.log('4. Signature string (first 100 chars):', signatureString.substring(0, 100))
    console.log('5. Signature string (last 100 chars):', signatureString.substring(Math.max(0, signatureString.length - 100)))
    console.log('6. API Key (first 10 chars):', apiKey.substring(0, 10) + '...')
    console.log('7. Secret (first 10 chars):', apiSecret.substring(0, 10) + '...')
    
    // Step 4: Create signature using the signature string
    const signature = await createBybitSignature(signatureString, apiSecret)
    
    console.log('6. Generated signature:', signature)
    
    // Step 5: Build URL with parameters (no signature in URL)
    const finalUrl = `${baseUrl}/v5/account/wallet-balance?${sortedParams}`
    
    console.log('7. Final URL:', finalUrl)
    console.log('=== END DEBUG ===')
    
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-SIGN': signature,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'Content-Type': 'application/json',
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Bybit API HTTP Error:', response.status, errorText)
      throw new Error(`Bybit API error: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    console.log('Bybit API Response:', JSON.stringify(data, null, 2))
    console.log('Bybit Response Status:', response.status)
    console.log('Bybit Response Headers:', Object.fromEntries(response.headers.entries()))
    
    if (data.retCode !== 0) {
      console.error('Bybit API Error:', data.retCode, data.retMsg)
      throw new Error(`Bybit API error: ${data.retMsg}`)
    }
    
    console.log('Bybit API Success - Processing balance data...')
    console.log('Full API Response Structure:', JSON.stringify(data, null, 2))
    console.log('Result object:', data.result)
    console.log('Result list length:', data.result?.list?.length || 0)
    console.log('Result list:', data.result?.list)
    
    // Check if we have any accounts at all
    if (!data.result || !data.result.list || data.result.list.length === 0) {
      console.log('No accounts found in UNIFIED response')
      console.log('This might mean:')
      console.log('1. Account has no funds')
      console.log('2. API key lacks permissions')
      console.log('3. Account structure is different')
      
      return {
        exchange: 'bybit',
        totalBalance: 0,
        availableBalance: 0,
        lockedBalance: 0,
        assets: [],
        lastUpdated: new Date().toISOString(),
        status: 'connected',
        note: 'No account data found in UNIFIED account - check if account has funds or API permissions'
      }
    }
    
    const account = data.result?.list?.[0]
    
    console.log('Found account data:', JSON.stringify(account, null, 2))
    console.log('Account type:', account.accountType)
    console.log('Account coins:', account.coin)
    console.log('Account total wallet balance:', account.totalWalletBalance)
    console.log('Account total equity:', account.totalEquity)
    console.log('Account total margin balance:', account.totalMarginBalance)
    console.log('Account total available balance:', account.totalAvailableBalance)
    console.log('All account fields:', Object.keys(account))
    
    let totalBalance = 0
    let availableBalance = 0
    let lockedBalance = 0
    const assets: any[] = []
    
    // Process coin balances
    console.log('Processing coin balances...')
    const coins = account.coin || []
    console.log('Number of coins:', coins.length)
    
    // Try to use total wallet balance first (more reliable)
    if (account.totalWalletBalance && parseFloat(account.totalWalletBalance) > 0) {
      console.log('Using totalWalletBalance:', account.totalWalletBalance)
      
      // Still process coins for asset breakdown
      for (const coin of coins) {
        const free = parseFloat(coin.free || '0')
        const locked = parseFloat(coin.locked || '0')
        const total = free + locked
        
        console.log(`Coin: ${coin.coin}, Free: ${free}, Locked: ${locked}, Total: ${total}`)
        
        if (total > 0) {
          assets.push({
            asset: coin.coin,
            free,
            locked,
            total
          })
        }
      }
      
      return {
        exchange: 'bybit',
        totalBalance: parseFloat(account.totalWalletBalance),
        availableBalance: parseFloat(account.totalWalletBalance),
        lockedBalance: 0,
        assets,
        lastUpdated: new Date().toISOString(),
        status: 'connected',
        accountType: 'UNIFIED',
        note: 'Using totalWalletBalance'
      }
    }
    
    // Fallback to coin-by-coin calculation if totalWalletBalance not available
    console.log('totalWalletBalance not available, calculating from coins...')
    
    for (const coin of coins) {
      const free = parseFloat(coin.free || '0')
      const locked = parseFloat(coin.locked || '0')
      const total = free + locked
      
      console.log(`Coin: ${coin.coin}, Free: ${free}, Locked: ${locked}, Total: ${total}`)
      
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
    
    console.log(`Final balances - Total: ${totalBalance}, Available: ${availableBalance}, Locked: ${lockedBalance}`)
    
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
  const baseUrl = 'https://www.okx.com' // OKX uses same URL for both testnet and live
  
  try {
    // OKX requires timestamp in ISO format with milliseconds
    const timestamp = new Date().toISOString()
    const method = 'GET'
    const requestPath = '/api/v5/account/balance'
    const body = ''
    
    console.log('=== OKX SIGNATURE DEBUG ===')
    console.log('0. Environment:', isTestnet ? 'TESTNET' : 'MAINNET')
    console.log('0. Base URL:', baseUrl)
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
    
    const headers: any = {
      'OK-ACCESS-KEY': apiKey,
      'OK-ACCESS-SIGN': signature,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': passphrase,
      'Content-Type': 'application/json'
    }
    
    // Add simulated trading header for testnet
    if (isTestnet) {
      headers['x-simulated-trading'] = '1'
    }
    
    const response = await fetch(`${baseUrl}${requestPath}`, {
      method,
      headers
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

async function fetchBitunixBalance(apiKey: string, apiSecret: string, isTestnet: boolean) {
  // Bitunix uses openapi.bitunix.com for REST API
  const baseUrl = isTestnet ? 'https://openapi-testnet.bitunix.com' : 'https://openapi.bitunix.com'
  
  try {
    const timestamp = Date.now().toString()
    
    console.log('=== BITUNIX BALANCE DEBUG ===')
    console.log('0. Environment:', isTestnet ? 'TESTNET' : 'MAINNET')
    console.log('0. Base URL:', baseUrl)
    console.log('1. Timestamp:', timestamp)
    console.log('2. API Key (first 10 chars):', apiKey.substring(0, 10) + '...')
    console.log('3. Secret (first 10 chars):', apiSecret.substring(0, 10) + '...')
    
    // Bitunix API uses different authentication method
    // According to documentation: /api/spot/v1/user/account
    // Headers: ACCESS-KEY, ACCESS-SIGN, ACCESS-TIMESTAMP
    // Signature: HMAC-SHA256(timestamp + method + requestPath + body, secret)
    
    const method = 'GET'
    const requestPath = '/api/spot/v1/user/account'
    const body = ''
    
    // Create signature: timestamp + method + requestPath + body
    const signatureString = timestamp + method + requestPath + body
    const signature = await createBitunixSignature(signatureString, apiSecret)
    
    console.log('4. Method:', method)
    console.log('5. Request Path:', requestPath)
    console.log('6. Signature String:', signatureString)
    console.log('7. Generated signature:', signature)
    console.log('=== END BITUNIX DEBUG ===')
    
    // Try the correct Bitunix endpoint first
    const endpointsToTry = [
      { path: '/api/spot/v1/user/account', method: 'GET', useAccessHeaders: true },
      { path: '/api/futures/v1/user/account', method: 'GET', useAccessHeaders: true },
      // Fallback: try old format with api-key headers
      { path: '/api/v1/account/wallet', method: 'GET', useAccessHeaders: false },
      { path: '/api/v1/wallet/balance', method: 'GET', useAccessHeaders: false }
    ]
    
    let response: Response | null = null
    let requestPath = ''
    let lastError: any = null
    
    for (const endpointConfig of endpointsToTry) {
      try {
        const endpointPath = endpointConfig.path
        const endpointMethod = endpointConfig.method
        console.log(`Trying Bitunix endpoint: ${endpointMethod} ${endpointPath}`)
        requestPath = endpointPath
        
        let headers: Record<string, string>
        let signature: string
        
        if (endpointConfig.useAccessHeaders) {
          // Bitunix standard API format: ACCESS-KEY, ACCESS-SIGN, ACCESS-TIMESTAMP
          const signatureString = timestamp + endpointMethod + endpointPath + ''
          signature = await createBitunixSignature(signatureString, apiSecret)
          
          headers = {
            'ACCESS-KEY': String(apiKey),
            'ACCESS-SIGN': String(signature),
            'ACCESS-TIMESTAMP': String(timestamp),
            'Content-Type': 'application/json'
          }
        } else {
          // Fallback: old format with api-key, timestamp, nonce, sign
          const nonce = timestamp
          const params: any = { timestamp, nonce }
          const queryString = Object.keys(params)
            .sort()
            .map(key => `${key}=${String(params[key])}`)
            .join('&')
          signature = await createBitunixSignature(queryString, apiSecret)
          
          headers = {
            'api-key': String(apiKey),
            'timestamp': String(timestamp),
            'nonce': String(nonce),
            'sign': String(signature),
            'Content-Type': 'application/json'
          }
        }
        
        // Make the request
        response = await fetch(`${baseUrl}${endpointPath}`, {
          method: endpointMethod,
          headers: headers
        })
        
        if (response.ok) {
          console.log(`✅ Success with endpoint: ${endpointPath}`)
          break
        } else if (response.status !== 404) {
          // If it's not 404, it might be auth error - stop trying
          const errorText = await response.text().catch(() => '')
          console.log(`Endpoint ${endpointPath} returned ${response.status}: ${errorText}`)
          if (response.status === 401 || response.status === 403) {
            lastError = new Error(`Bitunix API authentication error: ${response.status} - ${errorText}`)
            break
          }
        }
      } catch (err: any) {
        console.log(`Error trying ${endpointConfig.path}:`, err.message)
        lastError = err
        continue
      }
    }
    
    if (!response || !response.ok) {
      const errorText = lastError?.message || (response ? await response.text().catch(() => '') : 'All endpoints failed')
      const triedEndpoints = endpointsToTry.map(e => e.path).join(', ')
      console.error('Bitunix API HTTP Error:', response?.status || 'N/A', errorText)
      throw new Error(`Bitunix API error: ${response?.status || 'N/A'} - ${errorText}. Tried endpoints: ${triedEndpoints}`)
    }
    
    const data = await response.json()
    console.log('Bitunix API Response:', JSON.stringify(data, null, 2))
    
    if (data.code !== 0) {
      throw new Error(`Bitunix API error: ${data.msg || data.message} (Code: ${data.code})`)
    }
    
    // Parse Bitunix balance response
    // Bitunix response format may vary, but typically has data.balance or data.assets
    const balanceData = data.data || {}
    const assets = balanceData.assets || balanceData.balances || []
    
    let totalBalance = 0
    let availableBalance = 0
    let lockedBalance = 0
    const parsedAssets: any[] = []
    
    // Process assets/balances
    for (const asset of assets) {
      // Bitunix may use different field names: available, frozen, balance, etc.
      const free = parseFloat(asset.available || asset.free || asset.balance || '0')
      const locked = parseFloat(asset.frozen || asset.locked || asset.inUse || '0')
      const total = parseFloat(asset.total || asset.equity || (free + locked).toString())
      
      // Get asset symbol
      const assetSymbol = asset.asset || asset.coin || asset.currency || asset.symbol || ''
      
      // Only include assets with non-zero balance
      if (total > 0 || free > 0 || locked > 0) {
        totalBalance += total
        availableBalance += free
        lockedBalance += locked
        
        parsedAssets.push({
          asset: assetSymbol,
          free,
          locked,
          total
        })
      }
    }
    
    // If no assets found but response is successful, account might be empty
    if (parsedAssets.length === 0 && data.code === 0) {
      console.log('Bitunix account exists but has no balances')
    }
    
    return {
      exchange: 'bitunix',
      totalBalance,
      availableBalance,
      lockedBalance,
      assets: parsedAssets,
      lastUpdated: new Date().toISOString(),
      status: 'connected'
    }
  } catch (error: any) {
    console.error('Bitunix balance fetch error:', error)
    return {
      exchange: 'bitunix',
      totalBalance: 0,
      availableBalance: 0,
      lockedBalance: 0,
      assets: [],
      lastUpdated: new Date().toISOString(),
      status: 'error',
      error: error.message || 'Failed to fetch Bitunix balance'
    }
  }
}

// Helper function to create Bitunix signature
async function createBitunixSignature(message: string, secret: string): Promise<string> {
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
  // Bitunix expects lowercase hex string
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase()
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
          console.log('=== BALANCES ENDPOINT DEBUG ===')
          console.log('User ID:', user.id)
          
          const { data: apiKeys, error } = await supabaseClient
            .from('api_keys')
            .select('exchange, api_key, api_secret, passphrase, is_testnet')
            .eq('user_id', user.id)
            .eq('is_active', true)

          if (error) throw error

          console.log('Found API keys:', apiKeys?.length || 0)
          console.log('API keys data:', apiKeys)

          const balances = []

          for (const apiKey of apiKeys) {
            try {
              const decryptedApiKey = decrypt(apiKey.api_key)
              const decryptedApiSecret = decrypt(apiKey.api_secret)
              const decryptedPassphrase = apiKey.passphrase ? decrypt(apiKey.passphrase) : null

              let exchangeBalance: any = null

              // Fetch balance from exchange API
              if (apiKey.exchange === 'bybit') {
                exchangeBalance = await fetchBybitBalance(decryptedApiKey, decryptedApiSecret, apiKey.is_testnet)
              } else if (apiKey.exchange === 'okx') {
                exchangeBalance = await fetchOKXBalance(decryptedApiKey, decryptedApiSecret, decryptedPassphrase || '', apiKey.is_testnet)
              } else if (apiKey.exchange === 'bitunix') {
                exchangeBalance = await fetchBitunixBalance(decryptedApiKey, decryptedApiSecret, apiKey.is_testnet)
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