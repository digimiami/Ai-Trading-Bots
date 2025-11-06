import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const exchange = url.searchParams.get('exchange') || 'bybit'
    const action = url.searchParams.get('action') || 'tickers'

    if (action === 'tickers') {
      // Fetch all futures tickers from Bybit
      if (exchange === 'bybit') {
        const response = await fetch('https://api.bybit.com/v5/market/tickers?category=linear')
        const data = await response.json()
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } else if (exchange === 'okx') {
        const response = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SWAP')
        const data = await response.json()
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    if (action === 'klines') {
      const symbol = url.searchParams.get('symbol')
      const start = url.searchParams.get('start')
      const limit = url.searchParams.get('limit') || '30'
      const interval = url.searchParams.get('interval') || 'D'

      if (!symbol) {
        return new Response(JSON.stringify({ error: 'Symbol parameter required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (exchange === 'bybit') {
        const klinesUrl = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&start=${start}&limit=${limit}`
        const response = await fetch(klinesUrl)
        const data = await response.json()
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } else if (exchange === 'okx') {
        // OKX klines endpoint
        const instId = symbol
        const klinesUrl = `https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=${interval}&after=${start}&limit=${limit}`
        const response = await fetch(klinesUrl)
        const data = await response.json()
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Futures pairs error:', error)
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to fetch futures pairs data' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

