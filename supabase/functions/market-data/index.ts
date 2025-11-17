// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const RATE_LIMIT_MAX = 100 // requests per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)
  
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false
  }
  
  record.count++
  return true
}

// Exponential backoff for API calls
async function fetchWithBackoff(url: string, options: RequestInit = {}, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options)
      if (response.ok) {
        return response
      }
      
      // If 429 (rate limit) or 5xx error, retry with backoff
      if (response.status === 429 || response.status >= 500) {
        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }
      
      return response
    } catch (error) {
      if (attempt === retries - 1) throw error
      const delay = Math.pow(2, attempt) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('Max retries exceeded')
}

// Calculate VWAP
function calculateVWAP(klines: any[]): number {
  let totalPV = 0
  let totalVolume = 0
  
  for (const kline of klines) {
    const typicalPrice = (parseFloat(kline[2]) + parseFloat(kline[3]) + parseFloat(kline[4])) / 3
    const volume = parseFloat(kline[5])
    totalPV += typicalPrice * volume
    totalVolume += volume
  }
  
  return totalVolume > 0 ? totalPV / totalVolume : 0
}

// Calculate ATR
function calculateATR(klines: any[], period: number = 14): number {
  if (klines.length < period + 1) return 0
  
  const trueRanges: number[] = []
  for (let i = 1; i < klines.length; i++) {
    const high = parseFloat(klines[i][2])
    const low = parseFloat(klines[i][3])
    const prevClose = parseFloat(klines[i - 1][4])
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    )
    trueRanges.push(tr)
  }
  
  const recentTRs = trueRanges.slice(-period)
  return recentTRs.reduce((a, b) => a + b, 0) / period
}

// Calculate RSI
function calculateRSI(klines: any[], period: number = 14): number {
  if (klines.length < period + 1) return 50
  
  const closes = klines.map(k => parseFloat(k[4]))
  let gains = 0
  let losses = 0
  
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1]
    if (change > 0) gains += change
    else losses += Math.abs(change)
  }
  
  const avgGain = gains / period
  const avgLoss = losses / period
  
  if (avgLoss === 0) return 100
  
  const rs = avgGain / avgLoss
  return 100 - (100 / (1 + rs))
}

// Fetch ticker data from Bybit
async function fetchTickers(symbols: string[] = []): Promise<any[]> {
  try {
    const category = 'spot'
    const symbolParam = symbols.length > 0 ? `&symbol=${symbols.join(',')}` : ''
    const url = `https://api.bybit.com/v5/market/tickers?category=${category}${symbolParam}`
    
    const response = await fetchWithBackoff(url)
    const data = await response.json()
    
    if (data.retCode === 0 && data.result?.list) {
      return data.result.list
    }
    
    return []
  } catch (error) {
    console.error('Error fetching tickers:', error)
    return []
  }
}

// Fetch klines for indicators
async function fetchKlines(symbol: string, interval: string = '1h', limit: number = 200): Promise<any[]> {
  try {
    const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${interval}&limit=${limit}`
    const response = await fetchWithBackoff(url)
    const data = await response.json()
    
    if (data.retCode === 0 && data.result?.list) {
      return data.result.list.reverse() // Reverse to chronological order
    }
    
    return []
  } catch (error) {
    console.error('Error fetching klines:', error)
    return []
  }
}

// Get market cap (estimated from 24h volume)
async function getMarketCap(symbol: string, price: number): Promise<number> {
  try {
    const tickers = await fetchTickers([symbol])
    const ticker = tickers.find(t => t.symbol === symbol)
    
    if (ticker && ticker.turnover24h) {
      // Rough estimate: turnover / price * multiplier
      const turnover24h = parseFloat(ticker.turnover24h)
      return (turnover24h / price) * 1.5 // Rough multiplier
    }
    
    return 0
  } catch (error) {
    console.error('Error calculating market cap:', error)
    return 0
  }
}

// Calculate inflows/outflows (simplified: based on volume and price change)
function calculateFlows(ticker: any, prevPrice: number): { inflow: number; outflow: number } {
  const currentPrice = parseFloat(ticker.lastPrice)
  const volume24h = parseFloat(ticker.turnover24h || '0')
  const priceChange = currentPrice - prevPrice
  
  // Simplified: positive change = inflow, negative = outflow
  const inflow = priceChange > 0 ? volume24h * 0.6 : volume24h * 0.4
  const outflow = priceChange < 0 ? volume24h * 0.6 : volume24h * 0.4
  
  return { inflow, outflow }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 })
  }
  
  // Rate limiting
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  if (!checkRateLimit(clientIP)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  
  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    
    // Get all market data
    if (action === 'all') {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'MATICUSDT', 'LINKUSDT']
      const tickers = await fetchTickers(symbols)
      
      const marketData = await Promise.all(
        tickers.map(async (ticker) => {
          const symbol = ticker.symbol
          const klines = await fetchKlines(symbol, '1h', 200)
          const price = parseFloat(ticker.lastPrice)
          const prevPrice = parseFloat(ticker.prevPrice24h || ticker.lastPrice)
          
          const vwap = calculateVWAP(klines)
          const atr = calculateATR(klines)
          const rsi = calculateRSI(klines)
          const marketCap = await getMarketCap(symbol, price)
          const flows = calculateFlows(ticker, prevPrice)
          
          return {
            symbol,
            price,
            change24h: parseFloat(ticker.price24hPcnt || '0') * 100,
            volume24h: parseFloat(ticker.turnover24h || '0'),
            high24h: parseFloat(ticker.highPrice24h || '0'),
            low24h: parseFloat(ticker.lowPrice24h || '0'),
            vwap,
            atr,
            rsi,
            marketCap,
            inflow: flows.inflow,
            outflow: flows.outflow
          }
        })
      )
      
      // Sort by market cap
      marketData.sort((a, b) => b.marketCap - a.marketCap)
      
      // Top gainers
      const topGainers = [...marketData]
        .sort((a, b) => b.change24h - a.change24h)
        .slice(0, 5)
      
      // Rapid changes (change > 5% in 24h)
      const rapidChanges = marketData.filter(d => Math.abs(d.change24h) > 5)
      
      return new Response(
        JSON.stringify({
          marketData,
          topGainers,
          rapidChanges,
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Get single symbol data
    if (action === 'symbol') {
      const symbol = url.searchParams.get('symbol') || 'BTCUSDT'
      const tickers = await fetchTickers([symbol])
      const ticker = tickers[0]
      
      if (!ticker) {
        return new Response(
          JSON.stringify({ error: 'Symbol not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const klines = await fetchKlines(symbol, '1h', 200)
      const price = parseFloat(ticker.lastPrice)
      const prevPrice = parseFloat(ticker.prevPrice24h || ticker.lastPrice)
      
      const vwap = calculateVWAP(klines)
      const atr = calculateATR(klines)
      const rsi = calculateRSI(klines)
      const marketCap = await getMarketCap(symbol, price)
      const flows = calculateFlows(ticker, prevPrice)
      
      return new Response(
        JSON.stringify({
          symbol,
          price,
          change24h: parseFloat(ticker.price24hPcnt || '0') * 100,
          volume24h: parseFloat(ticker.turnover24h || '0'),
          high24h: parseFloat(ticker.highPrice24h || '0'),
          low24h: parseFloat(ticker.lowPrice24h || '0'),
          vwap,
          atr,
          rsi,
          marketCap,
          inflow: flows.inflow,
          outflow: flows.outflow,
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Get alerts (large trades, 24h highs)
    if (action === 'alerts') {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']
      const tickers = await fetchTickers(symbols)
      
      const alerts: any[] = []
      
      for (const ticker of tickers) {
        const price = parseFloat(ticker.lastPrice)
        const high24h = parseFloat(ticker.highPrice24h || '0')
        const volume24h = parseFloat(ticker.turnover24h || '0')
        
        // Check for 24h high (within 0.1% of high)
        if (high24h > 0 && (price / high24h) >= 0.999) {
          alerts.push({
            type: '24h_high',
            symbol: ticker.symbol,
            price,
            high24h,
            timestamp: new Date().toISOString()
          })
        }
        
        // Check for large volume (top 10% of symbols)
        // This is simplified - in production, you'd track historical averages
        if (volume24h > 1000000000) { // $1B+ volume
          alerts.push({
            type: 'large_volume',
            symbol: ticker.symbol,
            volume24h,
            timestamp: new Date().toISOString()
          })
        }
      }
      
      return new Response(
        JSON.stringify({ alerts, timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ error: 'Invalid action. Use ?action=all, ?action=symbol&symbol=BTCUSDT, or ?action=alerts' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error: any) {
    console.error('Market data error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
