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

    // Real market data integration
    let marketData;
    
    try {
      switch (exchange.toLowerCase()) {
        case 'bybit':
          // Fetch real data from Bybit API
          const bybitResponse = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`);
          const bybitData = await bybitResponse.json();
          
          if (bybitData.retCode === 0 && bybitData.result.list.length > 0) {
            const ticker = bybitData.result.list[0];
            marketData = {
              symbol: ticker.symbol,
              price: parseFloat(ticker.lastPrice),
              change24h: parseFloat(ticker.price24hPcnt) * 100,
              volume24h: parseFloat(ticker.volume24h),
              high24h: parseFloat(ticker.highPrice24h),
              low24h: parseFloat(ticker.lowPrice24h),
              timestamp: new Date().toISOString(),
              klines: [] // Will be populated by separate kline endpoint
            };
          } else {
            throw new Error('Failed to fetch Bybit data');
          }
          break;
          
        case 'okx':
          // Fetch real data from OKX API
          const okxResponse = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${symbol}`);
          const okxData = await okxResponse.json();
          
          if (okxData.code === '0' && okxData.data.length > 0) {
            const ticker = okxData.data[0];
            marketData = {
              symbol: ticker.instId,
              price: parseFloat(ticker.last),
              change24h: parseFloat(ticker.sodUtc8) * 100,
              volume24h: parseFloat(ticker.vol24h),
              high24h: parseFloat(ticker.high24h),
              low24h: parseFloat(ticker.low24h),
              timestamp: new Date().toISOString(),
              klines: [] // Will be populated by separate kline endpoint
            };
          } else {
            throw new Error('Failed to fetch OKX data');
          }
          break;
          
        default:
          throw new Error(`Unsupported exchange: ${exchange}`);
      }
      
      return new Response(JSON.stringify(marketData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (apiError) {
      console.error('API Error:', apiError);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch market data',
        details: apiError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})