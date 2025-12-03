import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sb-access-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
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
        if (!response.ok) {
          const errorText = await response.text()
          console.error('Bybit tickers fetch failed:', response.status, errorText)
          return new Response(JSON.stringify({
            error: 'Failed to fetch Bybit tickers',
            status: response.status,
            body: errorText
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const data = await response.json()
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } else if (exchange === 'okx') {
        const response = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SWAP')
        if (!response.ok) {
          const errorText = await response.text()
          console.error('OKX tickers fetch failed:', response.status, errorText)
          return new Response(JSON.stringify({
            error: 'Failed to fetch OKX tickers',
            status: response.status,
            body: errorText
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const data = await response.json()
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } else if (exchange === 'bitunix') {
        // Bitunix futures tickers endpoint
        // Try multiple possible endpoints
        let response;
        let data;
        let error;
        
        // Try the tickers endpoint first
        try {
          response = await fetch('https://api.bitunix.com/api/v1/market/tickers?marketType=futures', {
            signal: AbortSignal.timeout(10000)
          });
          
          if (!response.ok) {
            error = await response.text();
            console.error('Bitunix tickers fetch failed:', response.status, error);
            // Try alternative endpoint
            response = await fetch('https://api.bitunix.com/api/v1/market/ticker/all?marketType=futures', {
              signal: AbortSignal.timeout(10000)
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error('Bitunix alternative endpoint also failed:', response.status, errorText);
              return new Response(JSON.stringify({
                error: 'Failed to fetch Bitunix tickers',
                status: response.status,
                body: errorText
              }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
          }
          
          data = await response.json();
          
          // Ensure data is in expected format
          // Bitunix might return { code: 0, data: [...] } or { code: 0, data: {...} }
          if (data.code === 0 && data.data) {
            // If data.data is not an array, try to convert it
            if (!Array.isArray(data.data)) {
              // If it's an object, try to extract an array from it
              const dataObj = data.data;
              if (typeof dataObj === 'object') {
                // Try to find array values
                const possibleArrays = Object.values(dataObj).filter(v => Array.isArray(v));
                if (possibleArrays.length > 0) {
                  data.data = possibleArrays[0];
                } else {
                  // Convert object to array
                  data.data = Object.keys(dataObj).map(key => ({
                    symbol: key,
                    ...dataObj[key]
                  }));
                }
              }
            }
          }
          
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } catch (fetchError: any) {
          console.error('Bitunix tickers fetch error:', fetchError);
          return new Response(JSON.stringify({
            error: 'Failed to fetch Bitunix tickers',
            details: fetchError.message
          }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          })
        }
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
        const params = new URLSearchParams({
          category: 'linear',
          symbol,
          interval,
          limit,
        })
        if (start) params.set('start', start)

        const klinesUrl = `https://api.bybit.com/v5/market/kline?${params.toString()}`
        const response = await fetch(klinesUrl)
        if (!response.ok) {
          const errorText = await response.text()
          console.error('Bybit klines fetch failed:', response.status, errorText)
          return new Response(JSON.stringify({
            error: 'Failed to fetch Bybit klines',
            status: response.status,
            body: errorText
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const data = await response.json()
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } else if (exchange === 'okx') {
        const params = new URLSearchParams({
          instId: symbol,
          bar: interval,
          limit,
        })
        if (start) params.set('after', start)

        const klinesUrl = `https://www.okx.com/api/v5/market/candles?${params.toString()}`
        const response = await fetch(klinesUrl)
        if (!response.ok) {
          const errorText = await response.text()
          console.error('OKX klines fetch failed:', response.status, errorText)
          return new Response(JSON.stringify({
            error: 'Failed to fetch OKX klines',
            status: response.status,
            body: errorText
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const data = await response.json()
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } else if (exchange === 'bitunix') {
        const marketType = 'futures' // Bitunix futures pairs finder
        const klinesUrl = `https://api.bitunix.com/api/v1/market/klines?symbol=${symbol}&marketType=${marketType}&interval=${interval}&limit=${limit}${start ? `&start=${start}` : ''}`
        const response = await fetch(klinesUrl)
        if (!response.ok) {
          const errorText = await response.text()
          console.error('Bitunix klines fetch failed:', response.status, errorText)
          return new Response(JSON.stringify({
            error: 'Failed to fetch Bitunix klines',
            status: response.status,
            body: errorText
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

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

