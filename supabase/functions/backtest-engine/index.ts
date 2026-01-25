import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Map timeframe to Bybit interval
function mapTimeframeToBybitInterval(timeframe: string): string {
  const intervalMap: { [key: string]: string } = {
    '1m': '1',
    '3m': '3',
    '5m': '5',
    '15m': '15',
    '30m': '30',
    '1h': '60',
    '2h': '120',
    '4h': '240',
    '6h': '360',
    '12h': '720',
    '1d': 'D',
    '1w': 'W',
    '1M': 'M'
  };
  return intervalMap[timeframe] || '60';
}

// Fetch historical klines from CryptoCompare (fallback when Bybit and Binance are geo-blocked)
async function fetchCryptoCompareKlines(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<any[]> {
  // Map symbol to CryptoCompare format (e.g., BTCUSDT -> BTC)
  const baseSymbol = symbol.replace('USDT', '').replace('USD', '');
  
  // Map interval to CryptoCompare endpoint and parameters
  const intervalMap: { [key: string]: { endpoint: string; limit: number; aggregate: number } } = {
    '1m': { endpoint: 'histominute', limit: 2000, aggregate: 1 },
    '3m': { endpoint: 'histominute', limit: 2000, aggregate: 3 },
    '5m': { endpoint: 'histominute', limit: 2000, aggregate: 5 },
    '15m': { endpoint: 'histominute', limit: 2000, aggregate: 15 },
    '30m': { endpoint: 'histominute', limit: 2000, aggregate: 30 },
    '1h': { endpoint: 'histohour', limit: 2000, aggregate: 1 },
    '2h': { endpoint: 'histohour', limit: 2000, aggregate: 2 },
    '4h': { endpoint: 'histohour', limit: 2000, aggregate: 4 },
    '6h': { endpoint: 'histohour', limit: 2000, aggregate: 6 },
    '12h': { endpoint: 'histohour', limit: 2000, aggregate: 12 },
    '1d': { endpoint: 'histoday', limit: 2000, aggregate: 1 },
    '1w': { endpoint: 'histoday', limit: 2000, aggregate: 7 },
    '1M': { endpoint: 'histoday', limit: 2000, aggregate: 30 },
  };
  const intervalConfig = intervalMap[interval] || { endpoint: 'histohour', limit: 2000, aggregate: 1 };
  
  const allKlines: any[] = [];
  let currentEnd = Math.floor(endTime / 1000); // CryptoCompare uses seconds
  const startTimeSeconds = Math.floor(startTime / 1000);

  while (currentEnd > startTimeSeconds) {
    const url = `https://min-api.cryptocompare.com/data/v2/${intervalConfig.endpoint}?fsym=${baseSymbol}&tsym=USDT&limit=${Math.min(intervalConfig.limit, 2000)}&aggregate=${intervalConfig.aggregate}&toTs=${currentEnd}`;
    console.log(`Fetching klines from CryptoCompare for ${symbol}: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`CryptoCompare API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.Response === 'Error' || !data.Data || !data.Data.Data || data.Data.Data.length === 0) {
        break; // No more data
      }

      // CryptoCompare format: { time, high, low, open, close, volumefrom, volumeto }
      // Convert to Bybit-like format: [timestamp, open, high, low, close, volume]
      const klines = data.Data.Data
        .filter((k: any) => k.time * 1000 >= startTime && k.time * 1000 <= endTime)
        .map((k: any) => [
          (k.time * 1000).toString(), // timestamp in ms
          k.open.toString(),
          k.high.toString(),
          k.low.toString(),
          k.close.toString(),
          (k.volumeto || k.volumefrom || '0').toString(), // volume in USDT or base currency
        ])
        .sort((a: any, b: any) => parseInt(a[0]) - parseInt(b[0])); // Sort by timestamp

      if (klines.length === 0) {
        break;
      }

      allKlines.push(...klines);

      const firstTimestamp = parseInt(klines[0][0]);
      if (firstTimestamp <= startTime || klines.length < intervalConfig.limit) {
        break; // Reached start time or got all data
      }

      currentEnd = Math.floor(firstTimestamp / 1000) - 1;
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error fetching klines from CryptoCompare for ${symbol}:`, error);
      throw error;
    }
  }

  // Sort all klines by timestamp (oldest first)
  allKlines.sort((a: any, b: any) => parseInt(a[0]) - parseInt(b[0]));

  return allKlines;
}

// Fetch historical klines from Binance (fallback when Bybit is geo-blocked)
async function fetchBinanceKlines(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<any[]> {
  const intervalMap: { [key: string]: string } = {
    '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
    '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '12h': '12h',
    '1d': '1d', '1w': '1w', '1M': '1M'
  };
  const binanceInterval = intervalMap[interval] || '1h';
  const allKlines: any[] = [];
  let currentStart = startTime;
  const maxLimit = 1000; // Binance max per request

  while (currentStart < endTime) {
    const params = new URLSearchParams({
      symbol: symbol,
      interval: binanceInterval,
      startTime: currentStart.toString(),
      endTime: endTime.toString(),
      limit: maxLimit.toString(),
    });

    const url = `https://api.binance.com/api/v3/klines?${params.toString()}`;
    console.log(`Fetching klines from Binance for ${symbol}: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        // Check if it's a geo-block (451 Unavailable For Legal Reasons)
        if (response.status === 451) {
          throw new Error('GEO_BLOCKED: Binance API is blocked from this geographical region.');
        }
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data) || data.length === 0) {
        break; // No more data
      }

      // Binance format: [timestamp, open, high, low, close, volume, ...]
      // Convert to Bybit-like format: [timestamp, open, high, low, close, volume]
      const klines = data.map((k: any[]) => [
        k[0].toString(), // timestamp in ms
        k[1], // open
        k[2], // high
        k[3], // low
        k[4], // close
        k[5], // volume
      ]);

      allKlines.push(...klines);

      const lastTimestamp = parseInt(klines[klines.length - 1][0]);
      if (lastTimestamp >= endTime || klines.length < maxLimit) {
        break; // Reached end time or got all data
      }

      currentStart = lastTimestamp + 1;
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error fetching klines from Binance for ${symbol}:`, error);
      throw error;
    }
  }

  return allKlines;
}

// Fetch historical klines from Bybit
async function fetchBybitKlines(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number,
  category: 'spot' | 'linear' = 'linear'
): Promise<any[]> {
  const bybitInterval = mapTimeframeToBybitInterval(interval);
  const allKlines: any[] = [];
  let currentStart = startTime;
  const maxLimit = 200; // Bybit max per request

  while (currentStart < endTime) {
    const params = new URLSearchParams({
      category: category,
      symbol: symbol,
      interval: bybitInterval,
      start: currentStart.toString(),
      limit: maxLimit.toString(),
    });

    const url = `https://api.bybit.com/v5/market/kline?${params.toString()}`;
    console.log(`Fetching klines for ${symbol}: ${url}`);

    try {
      // Retry logic for rate limiting
      let retries = 3;
      let response;
      let data;
      
      while (retries > 0) {
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.bybit.com/',
            'Origin': 'https://www.bybit.com',
          },
        });
        
        if (response.ok) {
          data = await response.json();
          
          if (data.retCode !== 0) {
            // Check if it's a rate limit error
            if (data.retCode === 10006 || data.retMsg?.includes('rate limit') || data.retMsg?.includes('too many requests')) {
              retries--;
              if (retries > 0) {
                const waitTime = (4 - retries) * 1000; // Exponential backoff: 1s, 2s, 3s
                console.log(`Rate limited, waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
              }
            }
            throw new Error(`Bybit API error: ${data.retMsg || 'Unknown error'} (retCode: ${data.retCode})`);
          }
          break; // Success
        } else {
          // Handle HTTP errors
          const errorText = await response.text().catch(() => '');
          console.error(`Bybit API error response: ${response.status} ${response.statusText}`, errorText.substring(0, 500));
          
          // Check if it's a geographical restriction (CloudFront blocking)
          if (response.status === 403 && errorText.includes('CloudFront') && errorText.includes('block access from your country')) {
            console.error(`❌ Bybit API is geo-blocked from this region. Error: ${errorText.substring(0, 200)}`);
            throw new Error('GEO_BLOCKED: Bybit API is blocked from this geographical region. Please use Binance API or contact support.');
          }
          
          // Retry on 429 (Too Many Requests) or 503 (Service Unavailable)
          // Don't retry on 403 as it's likely a permanent geo-block
          if ((response.status === 429 || response.status === 503) && retries > 1) {
            retries--;
            const waitTime = (4 - retries) * 2000; // Longer wait: 2s, 4s, 6s
            console.log(`HTTP ${response.status}, waiting ${waitTime}ms before retry (${4 - retries}/3)...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          
          throw new Error(`Bybit API error: ${response.status} ${response.statusText}`);
        }
      }
      
      if (!data) {
        throw new Error('Failed to fetch data from Bybit API after retries');
      }

      if (!data.result?.list || data.result.list.length === 0) {
        break; // No more data
      }

      const klines = data.result.list.reverse(); // Oldest first
      allKlines.push(...klines);

      // Get the timestamp of the last kline
      const lastKline = klines[klines.length - 1];
      const lastTimestamp = parseInt(lastKline[0]); // First element is timestamp

      if (lastTimestamp >= endTime || klines.length < maxLimit) {
        break; // Reached end time or got all data
      }

      currentStart = lastTimestamp + 1; // Start from next candle
      
      // Rate limiting - wait longer between requests to avoid 403 errors
      // Bybit allows 600 requests per 5 seconds = 120 requests/second = ~8ms per request
      // We'll wait 200ms to be safe and avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error fetching klines for ${symbol}:`, error);
      throw error;
    }
  }

  return allKlines;
}

// Calculate technical indicators (simplified versions)
function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateADX(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  if (highs.length < period + 1) return 20;
  
  // Simplified ADX calculation
  let trSum = 0;
  let plusDM = 0;
  let minusDM = 0;
  
  for (let i = highs.length - period; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trSum += tr;
    
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    
    if (upMove > downMove && upMove > 0) plusDM += upMove;
    if (downMove > upMove && downMove > 0) minusDM += downMove;
  }
  
  const atr = trSum / period;
  const plusDI = (plusDM / atr) * 100;
  const minusDI = (minusDM / atr) * 100;
  const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
  
  return dx;
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  if (highs.length < period + 1) return 0;
  
  let trSum = 0;
  for (let i = highs.length - period; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trSum += tr;
  }
  
  return trSum / period;
}

// Run backtest for a single symbol
async function runBacktestForSymbol(
  symbol: string,
  config: any,
  strategy: any,
  strategyConfig: any,
  startDate: string,
  endDate: string
): Promise<any> {
  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime();
  
  const category = config.tradingType === 'spot' ? 'spot' : 'linear';
  
  // Fetch all klines - try Bybit first, fallback to Binance if geo-blocked
  console.log(`Fetching klines for ${symbol} from ${startDate} to ${endDate}`);
  let klines: any[] = [];
  
  try {
    klines = await fetchBybitKlines(
      symbol,
      config.timeframe,
      startTime,
      endTime,
      category
    );
  } catch (error: any) {
    // If Bybit is geo-blocked, try Binance as fallback
    if (error.message && error.message.includes('GEO_BLOCKED')) {
      console.log(`⚠️ Bybit is geo-blocked, falling back to Binance API for ${symbol}...`);
      try {
        klines = await fetchBinanceKlines(
          symbol,
          config.timeframe,
          startTime,
          endTime
        );
        console.log(`✅ Successfully fetched ${klines.length} klines from Binance for ${symbol}`);
      } catch (binanceError: any) {
        // If Binance is also geo-blocked, try CryptoCompare as final fallback
        if (binanceError.message && binanceError.message.includes('GEO_BLOCKED')) {
          console.log(`⚠️ Binance is also geo-blocked, falling back to CryptoCompare API for ${symbol}...`);
          try {
            klines = await fetchCryptoCompareKlines(
              symbol,
              config.timeframe,
              startTime,
              endTime
            );
            console.log(`✅ Successfully fetched ${klines.length} klines from CryptoCompare for ${symbol}`);
          } catch (cryptoCompareError: any) {
            throw new Error(`Failed to fetch data from Bybit, Binance, and CryptoCompare: ${cryptoCompareError.message}`);
          }
        } else {
          throw new Error(`Failed to fetch data from both Bybit and Binance: ${binanceError.message}`);
        }
      }
    } else {
      throw error;
    }
  }
  
  if (klines.length === 0) {
    throw new Error(`No historical data found for ${symbol}`);
  }
  
  console.log(`Fetched ${klines.length} klines for ${symbol}`);
  
  if (klines.length < 50) {
    console.warn(`Warning: Only ${klines.length} klines fetched for ${symbol}, may not be enough for accurate backtesting`);
  }
  
  // Extract price arrays
  const opens = klines.map(k => parseFloat(k[1]));
  const highs = klines.map(k => parseFloat(k[2]));
  const lows = klines.map(k => parseFloat(k[3]));
  const closes = klines.map(k => parseFloat(k[4]));
  const volumes = klines.map(k => parseFloat(k[5]));
  const timestamps = klines.map(k => parseInt(k[0]));
  
  // Initialize backtest state
  const trades: any[] = [];
  let position: any = null;
  let lastTradeBar = -1;
  let dailyPnL = 0;
  let weeklyPnL = 0;
  let tradesToday = 0;
  let tradesThisWeek = 0;
  let consecutiveLosses = 0;
  let openPositions = 0;
  let currentDate = '';
  let currentWeek = '';
  
  const atrPeriod = strategyConfig.atr_period || 14;
  const rsiPeriod = strategyConfig.rsi_period || 14;
  
  // Process each bar
  for (let i = Math.max(atrPeriod, rsiPeriod); i < closes.length; i++) {
    const currentPrice = closes[i];
    const currentHigh = highs[i];
    const currentLow = lows[i];
    const timestamp = timestamps[i];
    const date = new Date(timestamp);
    const dateStr = date.toISOString().split('T')[0];
    const weekStr = `${date.getFullYear()}-W${Math.ceil((date.getDate() + date.getDay()) / 7)}`;
    
    // Reset daily/weekly counters if needed
    if (dateStr !== currentDate) {
      if (currentDate) {
        dailyPnL = 0;
        tradesToday = 0;
      }
      currentDate = dateStr;
    }
    
    if (weekStr !== currentWeek) {
      if (currentWeek) {
        weeklyPnL = 0;
        tradesThisWeek = 0;
      }
      currentWeek = weekStr;
    }
    
    // Check cooldown
    const barsSinceLastTrade = i - lastTradeBar;
    const cooldownBars = strategyConfig.cooldown_bars || 8;
    if (barsSinceLastTrade < cooldownBars) {
      // Skip trading due to cooldown
    }
    
    // Check trading hours
    const currentHourUTC = date.getUTCHours();
    const sessionFilterEnabled = strategyConfig.session_filter_enabled || false;
    const allowedHours = strategyConfig.allowed_hours_utc || [];
    if (sessionFilterEnabled && allowedHours.length > 0 && !allowedHours.includes(currentHourUTC)) {
      // Skip trading outside allowed hours
      continue;
    }
    
    // Check risk limits
    if (tradesToday >= (strategyConfig.max_trades_per_day || 8)) {
      continue; // Max trades per day reached
    }
    
    if (openPositions >= (strategyConfig.max_concurrent || 2)) {
      continue; // Max concurrent positions reached
    }
    
    if (consecutiveLosses >= (strategyConfig.max_consecutive_losses || 5)) {
      continue; // Too many consecutive losses
    }
    
    // Calculate indicators
    const priceSlice = closes.slice(0, i + 1);
    const highSlice = highs.slice(0, i + 1);
    const lowSlice = lows.slice(0, i + 1);
    
    const rsi = calculateRSI(priceSlice, rsiPeriod);
    const adx = calculateADX(highSlice, lowSlice, priceSlice, atrPeriod);
    const atr = calculateATR(highSlice, lowSlice, priceSlice, atrPeriod);
    
    // Check if we should enter a trade (simplified strategy)
    // Use strategyConfig values first, fallback to strategy, then defaults
    const rsiOversold = strategyConfig.rsi_oversold || 30;
    const rsiOverbought = strategyConfig.rsi_overbought || 70;
    const adxThreshold = strategyConfig.adx_trend_min || strategyConfig.adx_min_htf || strategy.adxThreshold || 25;
    
    const shouldEnterLong = 
      rsi < rsiOversold &&
      adx > adxThreshold;
    
    const shouldEnterShort = 
      rsi > rsiOverbought &&
      adx > adxThreshold;
    
    // Exit existing position
    if (position) {
      const entryPrice = position.entryPrice;
      const slPrice = position.stopLoss;
      const tpPrice = position.takeProfit;
      
      let exitPrice = currentPrice;
      let exitReason = '';
      
      // Check stop loss
      if (position.side === 'long' && currentLow <= slPrice) {
        exitPrice = slPrice;
        exitReason = 'stop_loss';
      } else if (position.side === 'short' && currentHigh >= slPrice) {
        exitPrice = slPrice;
        exitReason = 'stop_loss';
      }
      // Check take profit
      else if (position.side === 'long' && currentHigh >= tpPrice) {
        exitPrice = tpPrice;
        exitReason = 'take_profit';
      } else if (position.side === 'short' && currentLow <= tpPrice) {
        exitPrice = tpPrice;
        exitReason = 'take_profit';
      }
      
      if (exitReason) {
        const pnl = position.side === 'long' 
          ? (exitPrice - entryPrice) * position.size
          : (entryPrice - exitPrice) * position.size;
        
        const pnlPercent = position.side === 'long'
          ? ((exitPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - exitPrice) / entryPrice) * 100;
        
        trades.push({
          symbol,
          side: position.side,
          entryPrice,
          exitPrice,
          size: position.size,
          pnl,
          pnlPercent,
          entryTime: new Date(position.entryTime).toISOString(),
          exitTime: new Date(timestamp).toISOString(),
          duration: timestamp - position.entryTime,
          exitReason
        });
        
        dailyPnL += pnl;
        weeklyPnL += pnl;
        tradesToday++;
        tradesThisWeek++;
        
        if (pnl < 0) {
          consecutiveLosses++;
        } else {
          consecutiveLosses = 0;
        }
        
        position = null;
        openPositions--;
      }
    }
    
    // Enter new position
    if (!position && barsSinceLastTrade >= cooldownBars) {
      let side: 'long' | 'short' | null = null;
      
      // Default bias_mode to 'auto' if not set
      const biasMode = strategyConfig.bias_mode || 'auto';
      
      if (shouldEnterLong && (biasMode === 'auto' || biasMode === 'long-only' || biasMode === 'both')) {
        side = 'long';
      } else if (shouldEnterShort && (biasMode === 'auto' || biasMode === 'short-only' || biasMode === 'both')) {
        side = 'short';
      }
      
      if (side) {
        const tradeAmount = config.tradeAmount || 100;
        const leverage = config.leverage || 1;
        const entryPrice = currentPrice;
        const size = (tradeAmount * leverage) / entryPrice;
        
        const stopLossPercent = config.stopLoss || 2.0;
        const takeProfitPercent = config.takeProfit || 4.0;
        
        const stopLoss = side === 'long'
          ? entryPrice * (1 - stopLossPercent / 100)
          : entryPrice * (1 + stopLossPercent / 100);
        
        const takeProfit = side === 'long'
          ? entryPrice * (1 + takeProfitPercent / 100)
          : entryPrice * (1 - takeProfitPercent / 100);
        
        position = {
          side,
          entryPrice,
          stopLoss,
          takeProfit,
          size,
          entryTime: timestamp
        };
        
        lastTradeBar = i;
        openPositions++;
      }
    }
  }
  
  // Close any remaining position
  if (position) {
    const exitPrice = closes[closes.length - 1];
    const pnl = position.side === 'long'
      ? (exitPrice - position.entryPrice) * position.size
      : (position.entryPrice - exitPrice) * position.size;
    
    trades.push({
      symbol,
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice,
      size: position.size,
      pnl,
      entryTime: new Date(position.entryTime).toISOString(),
      exitTime: new Date(timestamps[timestamps.length - 1]).toISOString(),
      duration: timestamps[timestamps.length - 1] - position.entryTime,
      exitReason: 'end_of_backtest'
    });
  }
  
    // Calculate metrics
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl <= 0);
    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
    
    // Calculate position sizes
    const positionSizes = trades.map(t => t.size || 0).filter(s => s > 0);
    const avgPositionSize = positionSizes.length > 0 
      ? positionSizes.reduce((sum, s) => sum + s, 0) / positionSizes.length 
      : 0;
    const minPositionSize = positionSizes.length > 0 ? Math.min(...positionSizes) : 0;
    const maxPositionSize = positionSizes.length > 0 ? Math.max(...positionSizes) : 0;
    
    // Long/Short breakdown
    const longTrades = trades.filter(t => t.side === 'long');
    const shortTrades = trades.filter(t => t.side === 'short');
    const longWins = longTrades.filter(t => t.pnl > 0);
    const longLosses = longTrades.filter(t => t.pnl <= 0);
    const shortWins = shortTrades.filter(t => t.pnl > 0);
    const shortLosses = shortTrades.filter(t => t.pnl <= 0);
    
    const longWinRate = longTrades.length > 0 ? (longWins.length / longTrades.length) * 100 : 0;
    const shortWinRate = shortTrades.length > 0 ? (shortWins.length / shortTrades.length) * 100 : 0;
    
    // Gross profit and loss
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const netProfit = totalPnL; // Same as totalPnL
    
    // Long/Short PnL
    const longPnL = longTrades.reduce((sum, t) => sum + t.pnl, 0);
    const shortPnL = shortTrades.reduce((sum, t) => sum + t.pnl, 0);
    
    console.log(`Backtest completed for ${symbol}: ${trades.length} trades, ${winRate.toFixed(2)}% win rate, $${totalPnL.toFixed(2)} PnL`);
    
    return {
      symbol,
      trades: trades.length,
      winning_trades: winningTrades.length,
      losing_trades: losingTrades.length,
      win_rate: winRate,
      pnl: totalPnL,
      pnl_percentage: config.tradeAmount > 0 ? (totalPnL / config.tradeAmount) * 100 : 0,
      // Position size metrics
      avg_position_size: avgPositionSize,
      min_position_size: minPositionSize,
      max_position_size: maxPositionSize,
      // Long/Short breakdown
      long_trades: longTrades.length,
      short_trades: shortTrades.length,
      long_wins: longWins.length,
      long_losses: longLosses.length,
      short_wins: shortWins.length,
      short_losses: shortLosses.length,
      long_win_rate: longWinRate,
      short_win_rate: shortWinRate,
      long_pnl: longPnL,
      short_pnl: shortPnL,
      // Profit metrics
      gross_profit: grossProfit,
      gross_loss: grossLoss,
      net_profit: netProfit,
      all_trades: trades
    };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    const accessToken = authHeader?.replace(/^Bearer\s+/i, '').trim() || ''
    if (!authHeader || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': anonKey },
    })
    if (!authRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const userJson = await authRes.json() as { id?: string }
    if (!userJson?.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { name, symbols, exchange, tradingType, timeframe, leverage, riskLevel, tradeAmount, stopLoss, takeProfit, strategy, strategyConfig, startDate, endDate } = await req.json()

    if (!symbols || symbols.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No symbols provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (exchange !== 'bybit') {
      return new Response(
        JSON.stringify({ error: 'Only Bybit exchange is supported for backtesting' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Starting backtest for ${symbols.length} symbols: ${symbols.join(', ')}`)

    const config = {
      exchange,
      tradingType,
      timeframe,
      leverage,
      riskLevel,
      tradeAmount,
      stopLoss,
      takeProfit
    }

    // Run backtest for each symbol with timeout protection
    const resultsPerPair: { [key: string]: any } = {}
    const allTrades: any[] = []
    const SYMBOL_TIMEOUT_MS = 4 * 60 * 1000 // 4 minutes per symbol

    for (const symbol of symbols) {
      try {
        console.log(`Running backtest for ${symbol}...`)
        
        // Add timeout protection for each symbol
        const symbolPromise = runBacktestForSymbol(
          symbol,
          config,
          strategy,
          strategyConfig,
          startDate,
          endDate
        )
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Timeout: Backtest for ${symbol} took longer than ${SYMBOL_TIMEOUT_MS / 1000 / 60} minutes`)), SYMBOL_TIMEOUT_MS)
        })
        
        const result = await Promise.race([symbolPromise, timeoutPromise]) as any
        
        resultsPerPair[symbol] = {
          trades: result.trades,
          win_rate: result.win_rate,
          pnl: result.pnl,
          pnl_percentage: result.pnl_percentage,
          avg_position_size: result.avg_position_size,
          long_trades: result.long_trades,
          short_trades: result.short_trades,
          long_wins: result.long_wins,
          long_losses: result.long_losses,
          short_wins: result.short_wins,
          short_losses: result.short_losses,
          long_pnl: result.long_pnl,
          short_pnl: result.short_pnl,
          gross_profit: result.gross_profit,
          gross_loss: result.gross_loss
        }
        
        // Add trades with symbol
        if (result.all_trades) {
          allTrades.push(...result.all_trades.map((t: any) => ({ ...t, symbol })))
        }
        
        console.log(`✅ Completed backtest for ${symbol}: ${result.trades} trades, PnL: ${result.pnl.toFixed(2)}`)
      } catch (error: any) {
        console.error(`❌ Error backtesting ${symbol}:`, error?.message || error)
        resultsPerPair[symbol] = {
          trades: 0,
          win_rate: 0,
          pnl: 0,
          pnl_percentage: 0,
          avg_position_size: 0,
          long_trades: 0,
          short_trades: 0,
          long_wins: 0,
          long_losses: 0,
          short_wins: 0,
          short_losses: 0,
          long_pnl: 0,
          short_pnl: 0,
          gross_profit: 0,
          gross_loss: 0,
          error: error?.message || String(error) || 'Unknown error'
        }
      }
    }

    // Calculate overall metrics with error handling
    let totalTrades = 0
    let winningTrades = 0
    let losingTrades = 0
    let totalPnL = 0
    let avgWinRate = 0
    
    try {
      totalTrades = Object.values(resultsPerPair).reduce((sum: number, data: any) => sum + (data.trades || 0), 0)
      winningTrades = Object.values(resultsPerPair).reduce((sum: number, data: any) => {
        return sum + Math.floor((data.trades || 0) * (data.win_rate || 0) / 100)
      }, 0)
      losingTrades = totalTrades - winningTrades
      totalPnL = Object.values(resultsPerPair).reduce((sum: number, data: any) => sum + (data.pnl || 0), 0)
      const validPairs = Object.values(resultsPerPair).filter((data: any) => !data.error).length
      avgWinRate = validPairs > 0 
        ? Object.values(resultsPerPair).reduce((sum: number, data: any) => sum + (data.win_rate || 0), 0) / validPairs
        : 0
    } catch (calcError: any) {
      console.error('Error calculating overall metrics:', calcError)
      // Continue with default values
    }

    // Position size metrics (aggregate) with error handling
    let avgPositionSize = 0
    let minPositionSize = 0
    let maxPositionSize = 0
    try {
      const allPositionSizes = allTrades.map(t => t.size || 0).filter(s => s > 0)
      avgPositionSize = allPositionSizes.length > 0
        ? allPositionSizes.reduce((sum, s) => sum + s, 0) / allPositionSizes.length
        : 0
      minPositionSize = allPositionSizes.length > 0 ? Math.min(...allPositionSizes) : 0
      maxPositionSize = allPositionSizes.length > 0 ? Math.max(...allPositionSizes) : 0
    } catch (e) {
      console.error('Error calculating position size metrics:', e)
    }

    // Long/Short breakdown (aggregate) with error handling
    let longTrades: any[] = []
    let shortTrades: any[] = []
    let longWins: any[] = []
    let longLosses: any[] = []
    let shortWins: any[] = []
    let shortLosses: any[] = []
    let longWinRate = 0
    let shortWinRate = 0
    let longPnL = 0
    let shortPnL = 0
    
    try {
      longTrades = allTrades.filter(t => t.side === 'long')
      shortTrades = allTrades.filter(t => t.side === 'short')
      longWins = longTrades.filter(t => t.pnl > 0)
      longLosses = longTrades.filter(t => t.pnl <= 0)
      shortWins = shortTrades.filter(t => t.pnl > 0)
      shortLosses = shortTrades.filter(t => t.pnl <= 0)
      
      longWinRate = longTrades.length > 0 ? (longWins.length / longTrades.length) * 100 : 0
      shortWinRate = shortTrades.length > 0 ? (shortWins.length / shortTrades.length) * 100 : 0
      
      longPnL = longTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
      shortPnL = shortTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
    } catch (e) {
      console.error('Error calculating long/short breakdown:', e)
    }

    // Calculate Sharpe ratio (simplified) with error handling
    let sharpeRatio = 0
    try {
      const returns = allTrades.map(t => t.pnlPercent || 0).filter(r => !isNaN(r) && isFinite(r))
      if (returns.length > 0) {
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
        const stdDev = Math.sqrt(variance)
        sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0 // Annualized
      }
    } catch (e) {
      console.error('Error calculating Sharpe ratio:', e)
    }

    // Calculate profit metrics with error handling
    let grossProfit = 0
    let grossLoss = 0
    let netProfit = 0
    let profitFactor = 0
    try {
      grossProfit = allTrades.filter(t => (t.pnl || 0) > 0).reduce((sum, t) => sum + (t.pnl || 0), 0)
      grossLoss = Math.abs(allTrades.filter(t => (t.pnl || 0) <= 0).reduce((sum, t) => sum + (t.pnl || 0), 0))
      netProfit = totalPnL // Same as totalPnL
      profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0
    } catch (e) {
      console.error('Error calculating profit metrics:', e)
    }

    // Calculate max drawdown (more detailed) with error handling
    let maxDrawdown = 0
    let maxDrawdownValue = 0
    let maxDrawdownPercent = 0
    let avgDrawdown = 0
    
    try {
      let peak = 0
      let runningPnL = 0
      const drawdowns: number[] = []
      
      const sortedTrades = allTrades
        .filter(t => t.entryTime)
        .sort((a, b) => {
          try {
            return new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime()
          } catch {
            return 0
          }
        })
      
      for (const trade of sortedTrades) {
        runningPnL += (trade.pnl || 0)
        if (runningPnL > peak) peak = runningPnL
        const drawdown = peak - runningPnL
        drawdowns.push(drawdown)
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown
          maxDrawdownValue = runningPnL
        }
      }
      
      maxDrawdownPercent = tradeAmount > 0 ? (maxDrawdown / (tradeAmount * symbols.length)) * 100 : 0
      avgDrawdown = drawdowns.length > 0 ? drawdowns.reduce((sum, d) => sum + d, 0) / drawdowns.length : 0
    } catch (e) {
      console.error('Error calculating drawdown metrics:', e)
    }

    // Build results object with error handling
    let results: any
    try {
      results = {
        total_trades: totalTrades,
        winning_trades: winningTrades,
        losing_trades: losingTrades,
        win_rate: isNaN(avgWinRate) ? 0 : avgWinRate,
        total_pnl: isNaN(totalPnL) ? 0 : totalPnL,
        total_pnl_percentage: tradeAmount > 0 && !isNaN(totalPnL) ? (totalPnL / (tradeAmount * symbols.length)) * 100 : 0,
        // Position size metrics
        avg_position_size: isNaN(avgPositionSize) ? 0 : avgPositionSize,
        min_position_size: isNaN(minPositionSize) ? 0 : minPositionSize,
        max_position_size: isNaN(maxPositionSize) ? 0 : maxPositionSize,
        // Long/Short breakdown
        long_trades: longTrades.length,
        short_trades: shortTrades.length,
        long_wins: longWins.length,
        long_losses: longLosses.length,
        short_wins: shortWins.length,
        short_losses: shortLosses.length,
        long_win_rate: isNaN(longWinRate) ? 0 : longWinRate,
        short_win_rate: isNaN(shortWinRate) ? 0 : shortWinRate,
        long_pnl: isNaN(longPnL) ? 0 : longPnL,
        short_pnl: isNaN(shortPnL) ? 0 : shortPnL,
        // Profit metrics
        gross_profit: isNaN(grossProfit) ? 0 : grossProfit,
        gross_loss: isNaN(grossLoss) ? 0 : grossLoss,
        net_profit: isNaN(netProfit) ? 0 : netProfit,
        // Drawdown metrics
        max_drawdown: isNaN(maxDrawdownPercent) ? 0 : -maxDrawdownPercent,
        max_drawdown_value: isNaN(maxDrawdown) ? 0 : -maxDrawdown,
        avg_drawdown: isNaN(avgDrawdown) ? 0 : -avgDrawdown,
        sharpe_ratio: isNaN(sharpeRatio) ? 0 : sharpeRatio,
        profit_factor: isNaN(profitFactor) ? 0 : profitFactor,
        results_per_pair: resultsPerPair,
        all_trades: allTrades || []
      }
    } catch (buildError: any) {
      console.error('Error building results object:', buildError)
      throw new Error(`Failed to build results: ${buildError?.message || String(buildError)}`)
    }

    console.log(`✅ Backtest completed: ${totalTrades} total trades across ${symbols.length} symbols`)

    // Limit all_trades to prevent response size issues (keep only first 100 trades for summary)
    // Winners backtest doesn't need all trades, just the aggregated results
    if (results.all_trades && results.all_trades.length > 100) {
      console.log(`Limiting all_trades from ${results.all_trades.length} to 100 to prevent response size issues`)
      results.all_trades = results.all_trades.slice(0, 100)
    }

    // Serialize response with error handling
    let responseBody: string
    try {
      responseBody = JSON.stringify(results)
      const responseSizeMB = new Blob([responseBody]).size / (1024 * 1024)
      console.log(`Response size: ${responseSizeMB.toFixed(2)} MB`)
      
      // Supabase Edge Functions have a ~6MB response limit
      if (responseSizeMB > 5) {
        console.warn(`Response size (${responseSizeMB.toFixed(2)} MB) is large, removing all_trades to reduce size`)
        results.all_trades = []
        responseBody = JSON.stringify(results)
      }
    } catch (serializeError: any) {
      console.error('Error serializing response:', serializeError)
      // Try without all_trades if serialization fails
      try {
        const resultsWithoutTrades = { ...results, all_trades: [] }
        responseBody = JSON.stringify(resultsWithoutTrades)
        console.log('Successfully serialized response without all_trades')
      } catch (retryError: any) {
        console.error('Failed to serialize even without all_trades:', retryError)
        return new Response(
          JSON.stringify({ 
            error: 'Response too large to serialize',
            results_per_pair: resultsPerPair,
            summary: {
              total_trades: totalTrades,
              total_pnl: totalPnL,
              win_rate: avgWinRate
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      responseBody,
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Backtest error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Backtest failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

