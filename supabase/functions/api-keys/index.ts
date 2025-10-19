import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  
  // For demo purposes, return mock data
  // In production, implement actual Bybit API calls with proper authentication
  return {
    exchange: 'bybit',
    totalBalance: 1250.75,
    availableBalance: 1100.25,
    lockedBalance: 150.50,
    assets: [
      { asset: 'USDT', free: 1100.25, locked: 150.50, total: 1250.75 },
      { asset: 'BTC', free: 0.05, locked: 0.01, total: 0.06 },
      { asset: 'ETH', free: 2.5, locked: 0.5, total: 3.0 },
      { asset: 'BNB', free: 10.0, locked: 0.0, total: 10.0 }
    ],
    lastUpdated: new Date().toISOString(),
    status: 'connected'
  }
}

async function fetchOKXBalance(apiKey: string, apiSecret: string, passphrase: string, isTestnet: boolean) {
  const baseUrl = isTestnet ? 'https://www.okx.com' : 'https://www.okx.com'
  
  // For demo purposes, return mock data
  // In production, implement actual OKX API calls with proper authentication
  return {
    exchange: 'okx',
    totalBalance: 2100.30,
    availableBalance: 1950.80,
    lockedBalance: 149.50,
    assets: [
      { asset: 'USDT', free: 1950.80, locked: 149.50, total: 2100.30 },
      { asset: 'BTC', free: 0.08, locked: 0.02, total: 0.10 },
      { asset: 'ETH', free: 3.2, locked: 0.8, total: 4.0 },
      { asset: 'SOL', free: 25.0, locked: 5.0, total: 30.0 }
    ],
    lastUpdated: new Date().toISOString(),
    status: 'connected'
  }
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