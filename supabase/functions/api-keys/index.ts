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
        break

      case 'POST':
        if (action === 'save') {
          const body = await req.json()
          const { exchange, apiKey, apiSecret, passphrase, isTestnet } = body

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