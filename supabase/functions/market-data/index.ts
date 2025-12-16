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

// Cache for market data responses (reduces egress by caching responses)
const marketDataCache: {
  data: any | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0
}

const MARKET_DATA_CACHE_TTL_MS = 180000 // Cache for 3 minutes (180 seconds)

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

// Calculate SMA (Simple Moving Average)
function calculateSMA(klines: any[], period: number): number {
  if (klines.length < period) return 0
  const closes = klines.slice(-period).map(k => parseFloat(k[4]))
  return closes.reduce((a, b) => a + b, 0) / period
}

// Calculate EMA (Exponential Moving Average)
function calculateEMA(klines: any[], period: number): number {
  if (klines.length < period) return 0
  const closes = klines.map(k => parseFloat(k[4]))
  const multiplier = 2 / (period + 1)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  
  for (let i = period; i < closes.length; i++) {
    ema = (closes[i] - ema) * multiplier + ema
  }
  
  return ema
}

// Calculate Stochastic Oscillator
function calculateStochastic(klines: any[], period: number = 14): { k: number; d: number } {
  if (klines.length < period) return { k: 50, d: 50 }
  
  const recent = klines.slice(-period)
  const highs = recent.map(k => parseFloat(k[2]))
  const lows = recent.map(k => parseFloat(k[3]))
  const closes = recent.map(k => parseFloat(k[4]))
  
  const highestHigh = Math.max(...highs)
  const lowestLow = Math.min(...lows)
  const currentClose = closes[closes.length - 1]
  
  if (highestHigh === lowestLow) return { k: 50, d: 50 }
  
  const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100
  
  // Calculate D (3-period SMA of K)
  const kValues = []
  for (let i = period - 3; i < period; i++) {
    if (i >= 0) {
      const h = Math.max(...highs.slice(Math.max(0, i - 3), i + 1))
      const l = Math.min(...lows.slice(Math.max(0, i - 3), i + 1))
      const c = closes[i]
      if (h !== l) {
        kValues.push(((c - l) / (h - l)) * 100)
      }
    }
  }
  const d = kValues.length > 0 ? kValues.reduce((a, b) => a + b, 0) / kValues.length : k
  
  return { k, d }
}

// Calculate MACD
function calculateMACD(klines: any[]): { macd: number; signal: number; histogram: number } {
  if (klines.length < 26) return { macd: 0, signal: 0, histogram: 0 }
  
  const ema12 = calculateEMA(klines, 12)
  const ema26 = calculateEMA(klines, 26)
  const macd = ema12 - ema26
  
  // Signal line (9-period EMA of MACD)
  // Simplified: use a shorter period for signal
  const signal = macd * 0.9 // Approximation
  const histogram = macd - signal
  
  return { macd, signal, histogram }
}

// Calculate technical analysis signals
function calculateTechnicalSignals(klines: any[]): {
  oscillators: { sell: number; neutral: number; buy: number };
  movingAverages: { sell: number; neutral: number; buy: number };
  summary: { sell: number; neutral: number; buy: number };
} {
  const rsi = calculateRSI(klines)
  const stochastic = calculateStochastic(klines)
  const macd = calculateMACD(klines)
  const sma20 = calculateSMA(klines, 20)
  const sma50 = calculateSMA(klines, 50)
  const sma200 = calculateSMA(klines, 200)
  const currentPrice = parseFloat(klines[klines.length - 1][4])
  
  // Oscillators signals
  let oscillatorSell = 0
  let oscillatorNeutral = 0
  let oscillatorBuy = 0
  
  // RSI signals
  if (rsi > 70) oscillatorSell++
  else if (rsi < 30) oscillatorBuy++
  else oscillatorNeutral++
  
  // Stochastic signals
  if (stochastic.k > 80) oscillatorSell++
  else if (stochastic.k < 20) oscillatorBuy++
  else oscillatorNeutral++
  
  // MACD signals
  if (macd.histogram < 0 && macd.macd < macd.signal) oscillatorSell++
  else if (macd.histogram > 0 && macd.macd > macd.signal) oscillatorBuy++
  else oscillatorNeutral++
  
  // Moving Averages signals
  let maSell = 0
  let maNeutral = 0
  let maBuy = 0
  
  // Price vs SMAs
  if (currentPrice < sma20 && sma20 < sma50) maSell++
  else if (currentPrice > sma20 && sma20 > sma50) maBuy++
  else maNeutral++
  
  if (currentPrice < sma50 && sma50 < sma200) maSell++
  else if (currentPrice > sma50 && sma50 > sma200) maBuy++
  else maNeutral++
  
  // Summary (combine oscillators and moving averages)
  const summarySell = oscillatorSell + maSell
  const summaryBuy = oscillatorBuy + maBuy
  const summaryNeutral = oscillatorNeutral + maNeutral
  
  return {
    oscillators: {
      sell: oscillatorSell,
      neutral: oscillatorNeutral,
      buy: oscillatorBuy
    },
    movingAverages: {
      sell: maSell,
      neutral: maNeutral,
      buy: maBuy
    },
    summary: {
      sell: summarySell,
      neutral: summaryNeutral,
      buy: summaryBuy
    }
  }
}

// Fetch ticker data from Bybit
async function fetchTickers(symbols: string[] = []): Promise<any[]> {
  try {
    const category = 'spot'
    
    // Try with specific symbols first
    if (symbols.length > 0) {
      const symbolParam = `&symbol=${symbols.join(',')}`
      const url = `https://api.bybit.com/v5/market/tickers?category=${category}${symbolParam}`
      
      console.log(`📊 Fetching tickers from Bybit (with symbols): ${url}`)
      
      const response = await fetchWithBackoff(url)
      const data = await response.json()
      
      console.log(`📊 Bybit ticker response: retCode=${data.retCode}, hasResult=${!!data.result}, listLength=${data.result?.list?.length || 0}`)
      
      if (data.retCode === 0 && data.result?.list && data.result.list.length > 0) {
        console.log(`✅ Successfully fetched ${data.result.list.length} tickers`)
        // Filter to only requested symbols
        return data.result.list.filter((t: any) => symbols.includes(t.symbol))
      }
      
      console.warn(`⚠️ Symbol-specific request failed or returned empty, trying without symbols...`)
    }
    
    // Fallback: fetch all tickers and filter
    const url = `https://api.bybit.com/v5/market/tickers?category=${category}`
    console.log(`📊 Fetching all tickers from Bybit (fallback): ${url}`)
    
    try {
      const response = await fetchWithBackoff(url)
      const responseText = await response.text()
      console.log(`📊 Bybit raw response status: ${response.status}, length: ${responseText.length}`)
      
      let data
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error(`❌ Failed to parse Bybit response as JSON:`, parseError)
        console.error(`📊 Response text (first 500 chars):`, responseText.substring(0, 500))
        return []
      }
      
      console.log(`📊 Bybit ticker response (fallback): retCode=${data.retCode}, hasResult=${!!data.result}, listLength=${data.result?.list?.length || 0}`)
      
      if (data.retCode === 0 && data.result?.list) {
        console.log(`✅ Successfully fetched ${data.result.list.length} tickers (fallback)`)
        // Filter to requested symbols if provided
        if (symbols.length > 0) {
          const filtered = data.result.list.filter((t: any) => symbols.includes(t.symbol))
          console.log(`📊 Filtered to ${filtered.length} requested symbols from ${data.result.list.length} total`)
          return filtered
        }
        return data.result.list
      }
      
      console.error(`❌ Failed to fetch tickers: retCode=${data.retCode}, retMsg=${data.retMsg || 'N/A'}`)
      if (data.retMsg) {
        console.error(`❌ Error message: ${data.retMsg}`)
      }
      return []
    } catch (error) {
      console.error(`❌ Exception fetching tickers (fallback):`, error)
      return []
    }
  } catch (error) {
    console.error('❌ Error fetching tickers:', error)
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
// Optimized: Accept ticker data to avoid redundant API calls
async function getMarketCap(symbol: string, price: number, ticker?: any): Promise<number> {
  try {
    // Use provided ticker data if available (avoids redundant API call)
    if (ticker && ticker.turnover24h) {
      const turnover24h = parseFloat(ticker.turnover24h)
      return (turnover24h / price) * 1.5 // Rough multiplier
    }
    
    // Fallback: fetch ticker if not provided (should rarely happen)
    const tickers = await fetchTickers([symbol])
    const foundTicker = tickers.find(t => t.symbol === symbol)
    
    if (foundTicker && foundTicker.turnover24h) {
      const turnover24h = parseFloat(foundTicker.turnover24h)
      return (turnover24h / price) * 1.5 // Rough multiplier
    }
    
    return 0
  } catch (error) {
    console.error('Error calculating market cap:', error)
    return 0
  }
}

// Fetch Crypto Fear & Greed Index
async function fetchFearGreedIndex(): Promise<any> {
  try {
    const url = 'https://api.alternative.me/fng/?limit=2'
    console.log(`📊 Fetching Fear & Greed Index from: ${url}`)
    
    const response = await fetchWithBackoff(url)
    const data = await response.json()
    
    if (data && data.data && data.data.length > 0) {
      const current = data.data[0]
      const yesterday = data.data[1] || current
      
      console.log(`✅ Fear & Greed Index: ${current.value} (${current.value_classification})`)
      
      return {
        value: parseInt(current.value),
        classification: current.value_classification,
        timestamp: new Date(parseInt(current.timestamp) * 1000).toISOString(),
        yesterday: {
          value: parseInt(yesterday.value),
          classification: yesterday.value_classification
        }
      }
    }
    
    console.warn('⚠️ No Fear & Greed Index data available')
    return null
  } catch (error) {
    console.error('❌ Error fetching Fear & Greed Index:', error)
    return null
  }
}

// Fetch Crypto News
async function fetchCryptoNews(limit: number = 10): Promise<any[]> {
  const COINDESK_API_KEY = '748ace4c55e1966f240d16b797e6187e1efa229dbe28969cdd9f784fe2462121'
  
  try {
    // Try CoinDesk API first (with API key for better access)
    const coindeskUrl = `https://api.coindesk.com/v1/news/headlines?limit=${limit}`
    console.log(`📰 Fetching crypto news from CoinDesk: ${coindeskUrl}`)
    
    const coindeskResponse = await fetchWithBackoff(coindeskUrl, {
      headers: {
        'X-API-Key': COINDESK_API_KEY,
        'Accept': 'application/json'
      }
    })
    
    if (coindeskResponse.ok) {
      const coindeskData = await coindeskResponse.json()
      
      if (coindeskData && Array.isArray(coindeskData) && coindeskData.length > 0) {
        console.log(`✅ Fetched ${coindeskData.length} news articles from CoinDesk`)
        
        return coindeskData.slice(0, limit).map((article: any) => ({
          id: article.id || `coindesk-${Math.random().toString(36).substr(2, 9)}`,
          title: article.title || '',
          body: article.description || article.body || '',
          url: article.url || '',
          imageUrl: article.image || article.imageUrl || null,
          source: article.source || 'CoinDesk',
          publishedOn: article.publishedAt || article.published_on || new Date().toISOString(),
          categories: article.categories || '',
          tags: article.tags || ''
        }))
      }
    }
    
    console.warn('⚠️ CoinDesk API response not valid, trying CryptoCompare...')
  } catch (coindeskError) {
    console.warn('⚠️ CoinDesk API failed, trying CryptoCompare:', coindeskError)
  }
  
  // Fallback: CryptoCompare API (free tier)
  try {
    const url = `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&limit=${limit}`
    console.log(`📰 Fetching crypto news from CryptoCompare: ${url}`)
    
    const response = await fetchWithBackoff(url)
    const data = await response.json()
    
    if (data && data.Data && Array.isArray(data.Data)) {
      console.log(`✅ Fetched ${data.Data.length} news articles from CryptoCompare`)
      
      return data.Data.map((article: any) => ({
        id: article.id?.toString() || `cryptocompare-${Math.random().toString(36).substr(2, 9)}`,
        title: article.title || '',
        body: article.body?.substring(0, 200) || '',
        url: article.url || '',
        imageUrl: article.imageurl || null,
        source: article.source || 'CryptoCompare',
        publishedOn: article.published_on ? new Date(article.published_on * 1000).toISOString() : new Date().toISOString(),
        categories: article.categories || '',
        tags: article.tags || ''
      }))
    }
  } catch (cryptocompareError) {
    console.error('❌ CryptoCompare API also failed:', cryptocompareError)
  }
  
  console.warn('⚠️ All news APIs failed, returning empty array')
  return []
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
      // Check cache first (reduces egress by serving cached responses)
      const now = Date.now()
      if (marketDataCache.data && (now - marketDataCache.timestamp) < MARKET_DATA_CACHE_TTL_MS) {
        const cacheAge = Math.round((now - marketDataCache.timestamp) / 1000)
        console.log(`📦 Serving cached market data (age: ${cacheAge}s, cache TTL: ${MARKET_DATA_CACHE_TTL_MS / 1000}s)`)
        return new Response(
          JSON.stringify({
            ...marketDataCache.data,
            cached: true,
            cacheAge: cacheAge
          }),
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=180' // 3 minutes browser cache
            } 
          }
        )
      }
      
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'MATICUSDT', 'LINKUSDT']
      console.log(`📊 Fetching fresh market data for ${symbols.length} symbols: ${symbols.join(', ')}`)
      
      const tickers = await fetchTickers(symbols)
      console.log(`📊 Received ${tickers.length} tickers from Bybit`)
      
      if (tickers.length === 0) {
        console.error('❌ No tickers received from Bybit API')
        return new Response(
          JSON.stringify({
            error: 'No ticker data available from Bybit API',
            marketData: [],
            topGainers: [],
            rapidChanges: [],
            timestamp: new Date().toISOString()
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log(`📊 Processing ${tickers.length} tickers into market data...`)
      
      const marketData = await Promise.all(
        tickers.map(async (ticker, index) => {
          try {
            const symbol = ticker.symbol
            console.log(`📊 [${index + 1}/${tickers.length}] Processing ${symbol}...`)
            
            // Reduced from 200 to 50 klines for UI display (saves egress, trading bots fetch their own data)
            const klines = await fetchKlines(symbol, '1h', 50)
            const price = parseFloat(ticker.lastPrice)
            const prevPrice = parseFloat(ticker.prevPrice24h || ticker.lastPrice)
            
            const vwap = calculateVWAP(klines)
            const atr = calculateATR(klines)
            const rsi = calculateRSI(klines)
            // Pass ticker data to avoid redundant API call (optimization for egress reduction)
            const marketCap = await getMarketCap(symbol, price, ticker)
            const flows = calculateFlows(ticker, prevPrice)
            
            console.log(`✅ [${index + 1}/${tickers.length}] ${symbol} processed: price=${price}, vwap=${vwap}, atr=${atr}, rsi=${rsi}`)
            
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
          } catch (error) {
            console.error(`❌ Error processing ticker ${ticker.symbol}:`, error)
            return null
          }
        })
      )
      
      // Filter out null values
      const validMarketData = marketData.filter((item): item is NonNullable<typeof item> => item !== null)
      console.log(`✅ Processed ${validMarketData.length} valid market data items from ${tickers.length} tickers`)
      
      // Sort by market cap
      validMarketData.sort((a, b) => b.marketCap - a.marketCap)
      
      // Top gainers
      const topGainers = [...validMarketData]
        .sort((a, b) => b.change24h - a.change24h)
        .slice(0, 5)
      
      // Rapid changes (change > 5% in 24h)
      const rapidChanges = validMarketData.filter(d => Math.abs(d.change24h) > 5)
      
      console.log(`📊 Final market data: ${validMarketData.length} items, ${topGainers.length} top gainers, ${rapidChanges.length} rapid changes`)
      
      // Fetch Fear & Greed Index and News in parallel
      const [fearGreedIndex, news] = await Promise.all([
        fetchFearGreedIndex(),
        fetchCryptoNews(10)
      ])
      
      const responseData = {
        marketData: validMarketData,
        topGainers,
        rapidChanges,
        fearGreedIndex,
        news,
        timestamp: new Date().toISOString()
      }
      
      // Cache the response
      marketDataCache.data = responseData
      marketDataCache.timestamp = Date.now()
      console.log(`💾 Cached market data response (will expire in ${MARKET_DATA_CACHE_TTL_MS / 1000}s)`)
      
      return new Response(
        JSON.stringify({
          ...responseData,
          cached: false
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=180' // 3 minutes browser cache
          } 
        }
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
      // Fetch ticker first, then pass to getMarketCap to avoid redundant call
      const tickers = await fetchTickers([symbol])
      const ticker = tickers.find(t => t.symbol === symbol)
      const marketCap = await getMarketCap(symbol, price, ticker)
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
    
    // Get technical analysis
    if (action === 'technical') {
      const symbol = url.searchParams.get('symbol') || 'BTCUSDT'
      const timeframe = url.searchParams.get('timeframe') || '1D'
      
      // Map timeframe to Bybit interval
      const intervalMap: Record<string, string> = {
        '1m': '1',
        '5m': '5',
        '15m': '15',
        '30m': '30',
        '1h': '60',
        '2h': '120',
        '4h': '240',
        '1D': 'D',
        '1W': 'W',
        '1M': 'M'
      }
      
      const interval = intervalMap[timeframe] || 'D'
      const limit = timeframe === '1M' ? 50 : timeframe === '1W' ? 100 : 200
      
      console.log(`📊 Fetching technical analysis for ${symbol} on ${timeframe} timeframe (interval: ${interval})`)
      
      const klines = await fetchKlines(symbol, interval, limit)
      
      if (klines.length === 0) {
        return new Response(
          JSON.stringify({ 
            error: 'No kline data available for this symbol/timeframe',
            symbol,
            timeframe
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const signals = calculateTechnicalSignals(klines)
      const rsi = calculateRSI(klines)
      const stochastic = calculateStochastic(klines)
      const macd = calculateMACD(klines)
      const sma20 = calculateSMA(klines, 20)
      const sma50 = calculateSMA(klines, 50)
      const sma200 = calculateSMA(klines, 200)
      const currentPrice = parseFloat(klines[klines.length - 1][4])
      
      return new Response(
        JSON.stringify({
          symbol,
          timeframe,
          signals,
          indicators: {
            rsi,
            stochastic,
            macd,
            sma20,
            sma50,
            sma200,
            currentPrice
          },
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
      JSON.stringify({ error: 'Invalid action. Use ?action=all, ?action=symbol&symbol=BTCUSDT, ?action=technical&symbol=BTCUSDT&timeframe=1D, or ?action=alerts' }),
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
