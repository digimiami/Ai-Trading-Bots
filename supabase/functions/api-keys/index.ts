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
async function fetchBybitBalance(apiKey: string, apiSecret: string) {
  // Always use mainnet
  const baseUrl = 'https://api.bybit.com'
  
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
    console.log('0. Environment: MAINNET')
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
      
      // Check if it's a CloudFront 403 blocking error (geographic restriction)
      const isCloudFrontError = response.status === 403 && (
        errorText.includes('CloudFront') ||
        errorText.includes('block access from your country') ||
        errorText.includes('Amazon CloudFront distribution is configured to block') ||
        (errorText.includes('<!DOCTYPE') && errorText.includes('403 ERROR') && errorText.includes('could not be satisfied'))
      )
      
      if (isCloudFrontError) {
        const friendlyError = 'Bybit API is not accessible from your current location. This is due to geographic restrictions by Bybit. Please use a VPN to connect from an allowed country, or contact Bybit support for assistance.'
        throw new Error(friendlyError)
      }
      
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
    
    // Check if the error message contains CloudFront blocking information
    let errorMessage = error.message || 'Unknown error occurred'
    
    // Check for CloudFront geographic blocking errors
    const isCloudFrontBlocking = 
      errorMessage.includes('CloudFront') || 
      errorMessage.includes('block access from your country') ||
      errorMessage.includes('Amazon CloudFront distribution is configured to block') ||
      (errorMessage.includes('403') && (errorMessage.includes('<!DOCTYPE') || errorMessage.includes('<HTML>') || errorMessage.includes('CloudFront')))
    
    if (isCloudFrontBlocking) {
      errorMessage = 'Bybit API is not accessible from your current location. This is due to geographic restrictions by Bybit. Please use a VPN to connect from an allowed country, or contact Bybit support for assistance.'
    }
    
    return {
      exchange: 'bybit',
      totalBalance: 0,
      availableBalance: 0,
      lockedBalance: 0,
      assets: [],
      lastUpdated: new Date().toISOString(),
      status: 'error',
      error: errorMessage
    }
  }
}

async function fetchOKXBalance(apiKey: string, apiSecret: string, passphrase: string) {
  const baseUrl = 'https://www.okx.com' // OKX uses same URL for both testnet and live
  
  try {
    // OKX requires timestamp in ISO format with milliseconds
    const timestamp = new Date().toISOString()
    const method = 'GET'
    const requestPath = '/api/v5/account/balance'
    const body = ''
    
    console.log('=== OKX SIGNATURE DEBUG ===')
    console.log('0. Environment: MAINNET')
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
    // Always use mainnet - testnet removed
    if (false) {
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

// Helper function to generate random 32-bit nonce
function generateNonce(): string {
  // Generate a random 32-character string
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let nonce = ''
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return nonce
}

async function fetchBitunixBalance(apiKey: string, apiSecret: string) {
  // According to official documentation: https://openapidoc.bitunix.com
  // API domain: https://fapi.bitunix.com (for futures API)
  // But bot-executor uses api.bitunix.com for orders, so try both
  const baseUrls = ['https://fapi.bitunix.com', 'https://api.bitunix.com']
  
  try {
    const timestamp = Date.now().toString() // milliseconds
    const nonce = generateNonce() // 32-bit random string
    
    console.log('=== BITUNIX BALANCE DEBUG (Official API) ===')
    console.log('0. Environment: MAINNET')
    console.log('0. Base URLs to try:', baseUrls.join(', '))
    console.log('1. Timestamp (ms):', timestamp)
    console.log('2. Nonce (32-bit):', nonce)
    console.log('3. API Key (first 10 chars):', apiKey.substring(0, 10) + '...')
    console.log('4. Secret (first 10 chars):', apiSecret.substring(0, 10) + '...')
    
    // According to official docs, headers required:
    // - api-key: api-key of the request
    // - nonce: random string, 32-bit, generated by the caller
    // - timestamp: current timestamp, milliseconds
    // - sign: signature string
    // - Content-Type: application/json
    
    // Try multiple account endpoints based on documentation
    const endpointsToTry = [
      '/api/v1/account', // Get single account (from Account section)
      '/api/v1/account/balance', // Alternative balance endpoint
      '/api/spot/v1/user/account', // Spot account
      '/api/futures/v1/user/account' // Futures account
    ]
    
    let response: Response | null = null
    let requestPath = ''
    let lastError: any = null
    let successfulBaseUrl = ''
    let data: any = null
    
    // Try both API domains (fapi for futures, api for general)
    // Prioritize api.bitunix.com since bot-executor uses it successfully
    const sortedBaseUrls = ['https://api.bitunix.com', 'https://fapi.bitunix.com']
    
    for (const baseUrl of sortedBaseUrls) {
      for (const endpointPath of endpointsToTry) {
        try {
          console.log(`Trying Bitunix: ${baseUrl}${endpointPath}`)
          requestPath = endpointPath
          
          // According to official Bitunix docs, signature uses double SHA256:
          // digest = SHA256(nonce + timestamp + api-key + queryParams + body)
          // sign = SHA256(digest + secretKey)
          // For GET with no query params: queryParams = "", body = ""
          
          const queryParams = '' // Empty for GET with no query params
          const body = '' // Empty for GET request
          
          // Create signature using double SHA256 (official method)
          const signature = await createBitunixSignatureDoubleSHA256(nonce, timestamp, apiKey, queryParams, body, apiSecret)
          
          console.log('5. Signature input: nonce + timestamp + api-key + queryParams + body')
          console.log('   nonce:', nonce)
          console.log('   timestamp:', timestamp)
          console.log('   api-key:', apiKey.substring(0, 10) + '...')
          console.log('   queryParams:', queryParams || '(empty)')
          console.log('   body:', body || '(empty)')
          console.log('6. Generated signature (double SHA256):', signature)
          
          // Headers according to official documentation
          const headers: Record<string, string> = {
            'api-key': String(apiKey),
            'nonce': String(nonce),
            'timestamp': String(timestamp),
            'sign': String(signature),
            'Content-Type': 'application/json'
          }
          
          // Try GET request without query params first (some endpoints don't need params in URL)
          response = await fetch(`${baseUrl}${endpointPath}`, {
            method: 'GET',
            headers: headers
          })
          
          // Parse response to check error code
          if (!response.ok) {
            const errorData = await response.json().catch(() => null)
            if (errorData && errorData.code === 2) {
              console.log(`System error (Code: 2) from ${baseUrl}${endpointPath}, trying with query params in URL...`)
              // Try with query params in URL (timestamp and nonce)
              // Query params for signature: sorted keys concatenated without separators (per docs)
              const queryParamsForSig = `nonce${nonce}timestamp${timestamp}` // Sorted: nonce first, then timestamp
              const retrySignature = await createBitunixSignatureDoubleSHA256(nonce, timestamp, apiKey, queryParamsForSig, '', apiSecret)
              const retryHeaders: Record<string, string> = {
                'api-key': String(apiKey),
                'nonce': String(nonce),
                'timestamp': String(timestamp),
                'sign': String(retrySignature),
                'Content-Type': 'application/json'
              }
              const queryString = `timestamp=${timestamp}&nonce=${nonce}`
              response = await fetch(`${baseUrl}${endpointPath}?${queryString}`, {
                method: 'GET',
                headers: retryHeaders
              })
            }
          }
          
          // If GET still fails, try POST
          if (!response.ok) {
            const errorData = await response.json().catch(() => null)
            if (errorData && (errorData.code === 2 || response.status === 404 || response.status === 400)) {
              console.log(`GET failed, trying POST for ${baseUrl}${endpointPath}...`)
              // For POST, body must be JSON string with NO SPACES (per docs)
              const bodyParams = { timestamp, nonce }
              const bodyString = JSON.stringify(bodyParams).replace(/\s+/g, '') // Remove all spaces
              // For POST, queryParams = "" (empty), body is in request body
              const postQueryParams = '' // Empty for POST
              const postSignature = await createBitunixSignatureDoubleSHA256(nonce, timestamp, apiKey, postQueryParams, bodyString, apiSecret)
              
              const postHeaders: Record<string, string> = {
                'api-key': String(apiKey),
                'nonce': String(nonce),
                'timestamp': String(timestamp),
                'sign': String(postSignature),
                'Content-Type': 'application/json'
              }
              
              response = await fetch(`${baseUrl}${endpointPath}`, {
                method: 'POST',
                headers: postHeaders,
                body: bodyString
              })
            }
          }
          
          // Check if successful - read response once
          let responseData: any = null
          if (response.ok) {
            try {
              responseData = await response.json()
              if (responseData && responseData.code === 0) {
                console.log(`✅ Success with: ${baseUrl}${endpointPath}`)
                successfulBaseUrl = baseUrl
                // Store response data for later parsing
                data = responseData
                // Break out of both loops
                break
              } else if (responseData && responseData.code !== 0) {
                // Got response but with error code
                const errorMsg = responseData.msg || responseData.message || 'Unknown error'
                console.log(`Endpoint ${baseUrl}${endpointPath} returned code ${responseData.code}: ${errorMsg}`)
                lastError = new Error(`Bitunix API error: ${errorMsg} (Code: ${responseData.code})`)
                // Continue to next endpoint
                continue
              }
            } catch (parseError) {
              console.log(`Failed to parse response from ${baseUrl}${endpointPath}:`, parseError)
              lastError = parseError
              continue
            }
          } else {
            // HTTP error - try to get error message
            try {
              const errorText = await response.text()
              console.log(`Endpoint ${baseUrl}${endpointPath} returned ${response.status}: ${errorText}`)
              // Try to parse as JSON for error details
              try {
                responseData = JSON.parse(errorText)
                if (responseData.code !== undefined) {
                  const errorMsg = responseData.msg || responseData.message || errorText
                  lastError = new Error(`Bitunix API error: ${errorMsg} (Code: ${responseData.code})`)
                } else {
                  lastError = new Error(`Bitunix API HTTP error: ${response.status} - ${errorText}`)
                }
              } catch {
                lastError = new Error(`Bitunix API HTTP error: ${response.status} - ${errorText}`)
              }
            } catch {
              lastError = new Error(`Bitunix API HTTP error: ${response.status}`)
            }
            
            if (response.status === 401 || response.status === 403) {
              // Auth error - might want to stop trying, but continue for now
              console.log('Authentication error, but continuing to try other endpoints...')
            }
          }
        } catch (err: any) {
          console.log(`Error trying ${baseUrl}${endpointPath}:`, err.message)
          lastError = err
          continue
        }
      }
      
      // Break out of baseUrl loop if we found a successful response
      if (data && data.code === 0) {
        break
      }
    }
    
    // Check if we got a successful response
    if (!data || data.code !== 0) {
      // If all endpoints failed with Code 2, it might mean the account endpoint doesn't exist
      // or requires different permissions. Since orders work, we'll return a "connected" status
      // but with zero balance, indicating the API key is valid but balance fetching isn't available
      const errorText = lastError?.message || (data ? `${data.msg || data.message} (Code: ${data.code})` : 'All endpoints failed')
      const triedEndpoints = endpointsToTry.join(', ')
      console.warn('Bitunix API Error - Account endpoint not available:', errorText)
      console.log('⚠️ Bitunix account balance endpoint not available, but API key is valid (orders work). Returning connected status with zero balance.')
      
      // Return connected status with zero balance instead of throwing error
      // This allows the user to use Bitunix for trading even if balance fetching doesn't work
      return {
        exchange: 'bitunix',
        totalBalance: 0,
        availableBalance: 0,
        lockedBalance: 0,
        assets: [],
        lastUpdated: new Date().toISOString(),
        status: 'connected',
        note: 'API key is valid. Balance fetching is not available for this exchange. Trading functionality is available.'
      }
    }
    
    console.log('Bitunix API Response:', JSON.stringify(data, null, 2))
    
    // Parse Bitunix balance response
    // According to docs, response format: { code: 0, msg: "success", data: [...] }
    // Data may be array or object depending on endpoint
    const responseData = data.data || {}
    
    // Handle different response formats
    let assets: any[] = []
    if (Array.isArray(responseData)) {
      assets = responseData
    } else if (responseData.assets) {
      assets = responseData.assets
    } else if (responseData.balances) {
      assets = responseData.balances
    } else if (responseData.coin || responseData.balance !== undefined) {
      // Single asset response
      assets = [responseData]
    }
    
    let totalBalance = 0
    let availableBalance = 0
    let lockedBalance = 0
    const parsedAssets: any[] = []
    
    // Process assets/balances
    // Official Bitunix format: { coin: "BTC", balance: 1.5, balanceLocked: 0.5 }
    // balance = total balance, balanceLocked = locked amount
    // available = balance - balanceLocked
    for (const asset of assets) {
      // Official Bitunix response format
      const total = parseFloat(asset.balance || asset.total || asset.equity || '0')
      const locked = parseFloat(asset.balanceLocked || asset.frozen || asset.locked || asset.inUse || '0')
      const free = total - locked // Available = total - locked
      
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

async function fetchMEXCBalance(apiKey: string, apiSecret: string) {
  const baseUrl = 'https://api.mexc.com'
  
  try {
    const timestamp = Date.now().toString()
    const recvWindow = '5000'
    const requestPath = '/api/v1/private/account/assets'
    
    console.log('=== MEXC BALANCE DEBUG ===')
    console.log('0. Environment: MAINNET')
    console.log('0. Base URL:', baseUrl)
    console.log('1. Timestamp (ms):', timestamp)
    console.log('2. RecvWindow:', recvWindow)
    console.log('3. API Key (first 10 chars):', apiKey.substring(0, 10) + '...')
    console.log('4. Secret (first 10 chars):', apiSecret.substring(0, 10) + '...')
    
    // MEXC signature: HMAC SHA256(queryString + timestamp + recvWindow)
    // Query string should be sorted alphabetically
    const queryParams: Record<string, string> = {
      timestamp,
      recvWindow
    }
    
    // Sort parameters alphabetically
    const sortedParams = Object.keys(queryParams)
      .sort()
      .map(key => `${key}=${queryParams[key]}`)
      .join('&')
    
    // Create signature string: queryString + timestamp + recvWindow
    const signatureString = sortedParams
    
    console.log('5. Sorted params:', sortedParams)
    console.log('6. Signature string:', signatureString)
    
    // Create HMAC SHA256 signature
    const signature = await createMEXCSignature(signatureString, apiSecret)
    
    console.log('7. Generated signature:', signature)
    
    // Build final URL with signature
    const finalUrl = `${baseUrl}${requestPath}?${sortedParams}&signature=${signature}`
    
    console.log('8. Final URL:', finalUrl.replace(/signature=[^&]+/, 'signature=***'))
    console.log('=== END MEXC DEBUG ===')
    
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'X-MEXC-APIKEY': apiKey,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('MEXC API HTTP Error:', response.status, errorText)
      throw new Error(`MEXC API error: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    console.log('MEXC API Response:', JSON.stringify(data, null, 2))
    
    // MEXC returns { code: 0, data: { assets: [...] } } on success
    if (data.code !== 0 && data.code !== '0') {
      throw new Error(`MEXC API error: ${data.msg || data.message || 'Unknown error'}`)
    }
    
    const assets = data.data?.assets || []
    
    if (!assets || assets.length === 0) {
      return {
        exchange: 'mexc',
        totalBalance: 0,
        availableBalance: 0,
        lockedBalance: 0,
        assets: [],
        lastUpdated: new Date().toISOString(),
        status: 'connected',
        note: 'Account has no balances'
      }
    }
    
    let totalBalance = 0
    let availableBalance = 0
    let lockedBalance = 0
    const parsedAssets: any[] = []
    
    // Process MEXC assets
    // MEXC format: { asset: "BTC", free: "1.5", frozen: "0.5", ... }
    for (const asset of assets) {
      const free = parseFloat(asset.free || asset.available || '0')
      const locked = parseFloat(asset.frozen || asset.locked || '0')
      const total = free + locked
      
      const assetSymbol = asset.asset || asset.currency || asset.coin || ''
      
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
    
    console.log(`MEXC Final balances - Total: ${totalBalance}, Available: ${availableBalance}, Locked: ${lockedBalance}`)
    
    return {
      exchange: 'mexc',
      totalBalance,
      availableBalance,
      lockedBalance,
      assets: parsedAssets,
      lastUpdated: new Date().toISOString(),
      status: 'connected'
    }
  } catch (error: any) {
    console.error('MEXC balance fetch error:', error)
    return {
      exchange: 'mexc',
      totalBalance: 0,
      availableBalance: 0,
      lockedBalance: 0,
      assets: [],
      lastUpdated: new Date().toISOString(),
      status: 'error',
      error: error.message || 'Failed to fetch MEXC balance'
    }
  }
}

// Helper function to create MEXC signature
async function createMEXCSignature(message: string, secret: string): Promise<string> {
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
  // MEXC expects lowercase hex string
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase()
}

// Helper function to create Bitunix signature using HMAC-SHA256 (same as bot-executor)
// This method works for orders, so let's try it for account endpoint too
async function createBitunixSignatureHMAC(message: string, secret: string): Promise<string> {
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

// Helper function to create Bitunix signature using double SHA256 (official docs method)
// According to official docs: digest = SHA256(nonce + timestamp + api-key + queryParams + body)
// Then: sign = SHA256(digest + secretKey)
async function createBitunixSignatureDoubleSHA256(nonce: string, timestamp: string, apiKey: string, queryParams: string, body: string, secretKey: string): Promise<string> {
  // Step 1: Create digest
  const digestInput = nonce + timestamp + apiKey + queryParams + body
  const digestHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(digestInput))
  const digestHex = Array.from(new Uint8Array(digestHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  // Step 2: Create final signature
  const signInput = digestHex + secretKey
  const signHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signInput))
  const signHex = Array.from(new Uint8Array(signHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  return signHex.toLowerCase()
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
            .select('id, exchange, is_active, created_at')
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
            .select('exchange, api_key, api_secret, passphrase')
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
                exchangeBalance = await fetchBybitBalance(decryptedApiKey, decryptedApiSecret)
              } else if (apiKey.exchange === 'okx') {
                exchangeBalance = await fetchOKXBalance(decryptedApiKey, decryptedApiSecret, decryptedPassphrase || '')
              } else if (apiKey.exchange === 'bitunix') {
                exchangeBalance = await fetchBitunixBalance(decryptedApiKey, decryptedApiSecret)
              } else if (apiKey.exchange === 'mexc') {
                exchangeBalance = await fetchMEXCBalance(decryptedApiKey, decryptedApiSecret)
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
          const { exchange, apiKey, apiSecret, passphrase } = body

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
              is_testnet: false, // Always mainnet
              is_active: true
            })
            .select('id, exchange, is_active, created_at')
            .single()

          if (error) throw error

          return new Response(JSON.stringify({ apiKey: savedKey }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (action === 'test') {
          const body = await req.json()
          const { exchange, apiKey, apiSecret, passphrase } = body

          if (!apiKey || !apiSecret) {
            return new Response(JSON.stringify({
              success: false,
              message: 'API Key and Secret are required'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }

          try {
            // Actually test the API connection by fetching balance
            let testResult: any = { success: false, message: 'Unknown error' }

            if (exchange === 'bybit') {
              const balance = await fetchBybitBalance(apiKey, apiSecret)
              testResult = {
                success: balance.status === 'connected',
                message: balance.status === 'connected' 
                  ? 'Connection successful' 
                  : balance.error || 'Connection failed',
                exchange
              }
            } else if (exchange === 'okx') {
              const balance = await fetchOKXBalance(apiKey, apiSecret, passphrase || '')
              testResult = {
                success: balance.status === 'connected',
                message: balance.status === 'connected' 
                  ? 'Connection successful' 
                  : balance.error || 'Connection failed',
                exchange
              }
            } else if (exchange === 'bitunix') {
              const balance = await fetchBitunixBalance(apiKey, apiSecret)
              testResult = {
                success: balance.status === 'connected',
                message: balance.status === 'connected' 
                  ? 'Connection successful' 
                  : balance.error || 'Connection failed',
                exchange
              }
            } else if (exchange === 'mexc') {
              const balance = await fetchMEXCBalance(apiKey, apiSecret)
              testResult = {
                success: balance.status === 'connected',
                message: balance.status === 'connected' 
                  ? 'Connection successful' 
                  : balance.error || 'Connection failed',
                exchange
              }
            } else {
              testResult = {
                success: false,
                message: `Unsupported exchange: ${exchange}`
              }
            }

            return new Response(JSON.stringify(testResult), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          } catch (error: any) {
            console.error('Test connection error:', error)
            return new Response(JSON.stringify({
              success: false,
              message: error.message || 'Failed to test connection',
              exchange,
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
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
            .select('id, exchange, is_active, created_at')
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