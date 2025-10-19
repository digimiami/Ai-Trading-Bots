import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const exchange = url.searchParams.get('exchange') || 'bybit'
    const symbol = url.searchParams.get('symbol') || 'BTCUSDT'
    const interval = url.searchParams.get('interval') || '1h'

    // Mock market data - in production, integrate with real exchange APIs
    const mockData = {
      symbol,
      price: 45000 + Math.random() * 5000,
      change24h: (Math.random() - 0.5) * 10,
      volume24h: 1000000 + Math.random() * 500000,
      high24h: 50000,
      low24h: 44000,
      timestamp: new Date().toISOString(),
      klines: Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
        open: 45000 + Math.random() * 1000,
        high: 46000 + Math.random() * 1000,
        low: 44000 + Math.random() * 1000,
        close: 45000 + Math.random() * 1000,
        volume: 10000 + Math.random() * 5000
      }))
    }

    // Simulate different exchange endpoints
    switch (exchange.toLowerCase()) {
      case 'bybit':
        // In production: fetch from Bybit API
        break
      case 'okx':
        // In production: fetch from OKX API
        break
      default:
        // Default to Bybit
        break
    }

    return new Response(JSON.stringify(mockData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})