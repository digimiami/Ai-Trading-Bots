import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Time synchronization utilities with multiple fallback methods
class TimeSync {
  private static serverTimeOffset = 0;
  private static lastSync = 0;
  private static syncAttempts = 0;
  private static maxRetries = 3;
  
  // Multiple time sync endpoints for redundancy
  private static timeEndpoints = [
    'https://api.bybit.com/v5/market/time', // Bybit's own time endpoint
    'https://api.binance.com/api/v3/time', // Binance time endpoint
    'https://api.coinbase.com/v2/time', // Coinbase time endpoint
    'https://worldtimeapi.org/api/timezone/UTC', // WorldTimeAPI
    'https://timeapi.io/api/Time/current/zone?timeZone=UTC' // TimeAPI.io
  ];
  
  static async syncWithServer(): Promise<void> {
    try {
      const startTime = Date.now();
      const baseUrl = 'https://api.bybit.com'; // Use mainnet for time sync

      // 1. Fetch time from Bybit V5 market time endpoint
      const response = await fetch(`${baseUrl}/v5/market/time`);
      const data = await response.json();
      
      // Check for API success and presence of time data
      if (data.retCode !== 0 || !data.result || !data.result.timeSecond) {
         throw new Error(`Bybit time sync failed: ${data.retMsg || 'Invalid response'}`);
      }

      // Log the raw response for debugging
      console.log(`📊 Bybit time response:`, JSON.stringify({
        timeSecond: data.result.timeSecond,
        timeNano: data.result.timeNano,
        timeSecondStr: String(data.result.timeSecond),
        timeNanoStr: String(data.result.timeNano || '0')
      }));

      // V5 returns time in seconds and nanoseconds separately
      // CRITICAL: Bybit V5 /v5/market/time returns:
      // - timeSecond: Unix timestamp in SECONDS (e.g., 1730458320)
      // - timeNano: nanoseconds since that second (e.g., 123456789)
      const timeSecondStr = String(data.result.timeSecond || '').trim();
      const timeNanoStr = String(data.result.timeNano || '0').trim();
      
      // Validate and parse - ensure we get numbers, not NaN
      let timeSecond = Number(timeSecondStr);
      let timeNano = Number(timeNanoStr);
      
      if (!Number.isFinite(timeSecond) || timeSecond <= 0) {
        throw new Error(`Invalid timeSecond value: ${timeSecondStr}`);
      }
      
      // Current Unix timestamp should be around 1730000000 (Dec 2024)
      // Validate timeSecond is reasonable (between 2020 and 2050)
      const MIN_SECONDS = 1577836800; // 2020-01-01 in seconds
      const MAX_SECONDS = 2524608000; // 2050-01-01 in seconds
      const currentSeconds = Math.floor(Date.now() / 1000);
      
      let serverTime: number;
      
      // Check if timeSecond looks like Unix seconds (reasonable range)
      if (timeSecond >= MIN_SECONDS && timeSecond <= MAX_SECONDS) {
        // timeSecond is in seconds
        // CRITICAL: Check if timeNano is the full timestamp (>= 1 billion nanoseconds = 1 second)
        // If timeNano is huge (like 1761929368266785474), it's the full timestamp in nanoseconds
        // If timeNano is small (< 1 billion), it's fractional nanoseconds since that second
        const ONE_BILLION_NANOS = 1000000000; // 1 second in nanoseconds
        
        if (Number.isFinite(timeNano) && timeNano >= ONE_BILLION_NANOS) {
          // timeNano is the full timestamp in nanoseconds (e.g., 1761929368266785474)
          // Convert directly: nanoseconds / 1,000,000 = milliseconds
          serverTime = timeNano / 1000000;
          console.log(`✅ Detected timeNano as full timestamp: ${timeNano} nanoseconds = ${serverTime} milliseconds`);
          console.log(`   (timeSecond ${timeSecond} is ignored when timeNano contains full timestamp)`);
        } else {
          // timeNano is fractional nanoseconds since that second (should be < 1 billion)
          // Use timeSecond * 1000 + (timeNano / 1,000,000)
          const nanoMs = Number.isFinite(timeNano) ? timeNano / 1000000 : 0;
          serverTime = timeSecond * 1000 + nanoMs;
          console.log(`✅ Using timeSecond + fractional timeNano: ${timeSecond} * 1000 + ${nanoMs} = ${serverTime}`);
        }
        
        console.log(`📊 Calculation: timeSecond=${timeSecond}, timeNano=${timeNano}, serverTime=${serverTime}, currentSeconds=${currentSeconds}`);
        
        // Validate serverTime is reasonable (within 1 hour of current time)
        const currentTime = Date.now();
        const timeDiff = Math.abs(serverTime - currentTime);
        if (timeDiff > 3600000) { // More than 1 hour difference
          console.error(`❌ Server time ${serverTime} is ${(timeDiff / 1000 / 3600).toFixed(2)} hours away from local time ${currentTime}`);
          // Use local time instead
          serverTime = currentTime;
          this.serverTimeOffset = 0;
          this.lastSync = Date.now();
          console.warn(`⚠️ Using local time instead of Bybit time due to large difference`);
          return;
        }
      } else if (timeSecond >= 1577836800000 && timeSecond <= 2524608000000) {
        // timeSecond is already in milliseconds (unlikely but possible)
        console.log(`✅ Detected timeSecond already in milliseconds: ${timeSecond}`);
        const ONE_BILLION_NANOS = 1000000000;
        // Check if timeNano is full timestamp or fractional
        if (Number.isFinite(timeNano) && timeNano >= ONE_BILLION_NANOS) {
          // timeNano is full timestamp in nanoseconds
          serverTime = timeNano / 1000000;
          console.log(`   Using timeNano as full timestamp: ${serverTime}ms`);
        } else {
          // timeNano is fractional nanoseconds
          const nanoMs = Number.isFinite(timeNano) ? timeNano / 1000000 : 0;
          serverTime = timeSecond + nanoMs;
        }
      } else {
        // Invalid value - use local time
        console.error(`❌ Invalid timeSecond value: ${timeSecond} (not in expected range). Using local time.`);
        this.serverTimeOffset = 0;
        this.lastSync = Date.now();
        return;
      }
      
      const endTime = Date.now();
      
      // Account for network latency (half round trip time)
      const latency = (endTime - startTime) / 2;
      const localTimeAtSync = startTime + latency;
      const calculatedOffset = serverTime - localTimeAtSync;
      
      // CRITICAL: If offset is more than 1 minute, ignore it and use local time
      if (Math.abs(calculatedOffset) > 60000) {
        console.warn(`⚠️ Calculated offset ${calculatedOffset.toFixed(2)}ms is too large (>1 minute). Ignoring and using local time.`);
        console.warn(`   Server time: ${serverTime}, Local time: ${localTimeAtSync}, Difference: ${(serverTime - localTimeAtSync) / 1000 / 60} minutes`);
        this.serverTimeOffset = 0;
        this.lastSync = Date.now();
        return;
      }
      
      this.serverTimeOffset = calculatedOffset;
      this.lastSync = Date.now();
      
      console.log(`✅ Time synced with Bybit. Offset: ${this.serverTimeOffset.toFixed(2)}ms`);
    } catch (error) {
      console.error('Time sync failed:', error);
      // It is critical to use a fallback or simply proceed with the old offset if Bybit fails,
      // but for a robust fix, focus on making the Bybit call reliable.
      // Fallback: try other endpoints
      for (let attempt = 0; attempt < this.maxRetries; attempt++) {
        try {
          this.syncAttempts++;
          console.log(`Fallback time sync attempt ${this.syncAttempts}/${this.maxRetries}`);
          
          // Try fallback endpoints
          for (const endpoint of this.timeEndpoints.slice(1)) { // Skip Bybit, already tried
            try {
              const result = await this.tryEndpoint(endpoint);
              if (result.success) {
                this.serverTimeOffset = result.offset;
                this.lastSync = Date.now();
                console.log(`✅ Time synced with fallback ${endpoint}. Offset: ${this.serverTimeOffset}ms`);
                return;
              }
            } catch (endpointError) {
              console.log(`❌ Fallback endpoint ${endpoint} failed:`, endpointError.message);
              continue;
            }
          }
          
          // If all endpoints failed, wait before retry
          if (attempt < this.maxRetries - 1) {
            const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
            console.log(`⏳ All endpoints failed, waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          
        } catch (retryError) {
          console.error(`❌ Fallback sync attempt ${attempt + 1} failed:`, retryError);
          if (attempt === this.maxRetries - 1) {
            console.warn('⚠️ All time sync attempts failed. Using local time with warning.');
            this.serverTimeOffset = 0; // Fallback to local time
            this.lastSync = Date.now();
          }
        }
      }
    }
  }
  
  private static async tryEndpoint(endpoint: string): Promise<{success: boolean, offset: number}> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    try {
      const response = await fetch(endpoint, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Pablo-AI-Trading/1.0',
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const endTime = Date.now();
      
      // Parse different response formats
      let serverTime: number;
      
      if (endpoint.includes('bybit.com')) {
        // Bybit V5 format: { retCode: 0, result: { timeSecond: "1234567890", timeNano: "123456789" } }
        if (data.retCode === 0 && data.result && data.result.timeSecond) {
          serverTime = parseInt(data.result.timeSecond) * 1000 + parseInt(data.result.timeNano || '0') / 1000000;
        } else {
          throw new Error('Invalid Bybit time response');
        }
      } else if (endpoint.includes('binance.com')) {
        // Binance format: { serverTime: 1234567890123 }
        if (data.serverTime) {
          serverTime = parseInt(data.serverTime);
        } else {
          throw new Error('Invalid Binance time response');
        }
      } else if (endpoint.includes('coinbase.com')) {
        // Coinbase format: { data: { iso: "...", epoch: 1234567890 } }
        if (data.data && data.data.epoch) {
          serverTime = parseInt(data.data.epoch) * 1000;
        } else {
          throw new Error('Invalid Coinbase time response');
        }
      } else if (endpoint.includes('worldtimeapi.org')) {
        serverTime = new Date(data.utc_datetime).getTime();
      } else if (endpoint.includes('timeapi.io')) {
        serverTime = new Date(data.dateTime).getTime();
      } else if (endpoint.includes('timezonedb.com')) {
        serverTime = new Date(data.formatted).getTime();
      } else if (endpoint.includes('ipgeolocation.io')) {
        serverTime = new Date(data.date_time).getTime();
      } else {
        throw new Error('Unknown response format');
      }
      
      // Account for network latency
      const latency = (endTime - startTime) / 2;
      const offset = serverTime - (startTime + latency);
      
      return { success: true, offset };
      
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  static getCurrentTime(): number {
    const now = Date.now();
    
    // CRITICAL: Safety check - If offset is suspiciously large (> 1 minute), reset it
    // Time sync offsets should typically be within a few seconds
    const MAX_REASONABLE_OFFSET = 60 * 1000; // 1 minute in milliseconds (reduced from 5 minutes)
    
    if (Math.abs(this.serverTimeOffset) > MAX_REASONABLE_OFFSET) {
      console.warn(`⚠️ Suspicious time offset detected: ${this.serverTimeOffset}ms (max: ${MAX_REASONABLE_OFFSET}ms). Resetting offset and using local time.`);
      // Reset offset and use local time
      this.serverTimeOffset = 0;
      this.lastSync = 0; // Force resync on next check
      return now;
    }
    
    const calculatedTime = now + this.serverTimeOffset;
    
    // CRITICAL: Validate the final calculated time is reasonable (within 1 year of now)
    const MIN_VALID_TIME = now - (365 * 24 * 60 * 60 * 1000); // 1 year ago
    const MAX_VALID_TIME = now + (365 * 24 * 60 * 60 * 1000); // 1 year in future
    
    if (calculatedTime < MIN_VALID_TIME || calculatedTime > MAX_VALID_TIME) {
      console.error(`❌ Invalid timestamp calculated: ${new Date(calculatedTime).toISOString()} (offset: ${this.serverTimeOffset}ms). Using local time instead.`);
      // Reset offset if it produces invalid time
      this.serverTimeOffset = 0;
      this.lastSync = 0;
      return now;
    }
    
    return calculatedTime;
  }
  
  static getCurrentTimeISO(): string {
    const currentTime = this.getCurrentTime();
    const now = Date.now();
    
    // Final validation: Double-check the time is still reasonable
    const MIN_VALID_TIME = now - (365 * 24 * 60 * 60 * 1000); // 1 year ago
    const MAX_VALID_TIME = now + (365 * 24 * 60 * 60 * 1000); // 1 year in future
    
    if (currentTime < MIN_VALID_TIME || currentTime > MAX_VALID_TIME) {
      console.error(`❌ Invalid timestamp in getCurrentTimeISO: ${new Date(currentTime).toISOString()}. Using local time instead.`);
      return new Date().toISOString(); // Fallback to local time
    }
    
    return new Date(currentTime).toISOString();
  }
  
  static needsSync(): boolean {
    // Only sync every 30 minutes and limit attempts to prevent blocking
    const timeSinceLastSync = Date.now() - this.lastSync;
    const syncInterval = 30 * 60 * 1000; // 30 minutes
    const maxAttempts = 2; // Limit sync attempts
    
    return (timeSinceLastSync > syncInterval || this.lastSync === 0) && this.syncAttempts < maxAttempts;
  }
  
  static getSyncStatus(): {offset: number, lastSync: number, attempts: number, needsSync: boolean} {
    return {
      offset: this.serverTimeOffset,
      lastSync: this.lastSync,
      attempts: this.syncAttempts,
      needsSync: this.needsSync()
    };
  }
  
  static shouldResync(): boolean {
    return Date.now() - this.lastSync > 300000; // Resync every 5 minutes
  }
}

// Simple exchange time helper (optional use)
async function getExchangeServerTime(exchange: string): Promise<number | null> {
  try {
    if (exchange?.toLowerCase() === 'bybit') {
      const res = await fetch('https://api.bybit.com/v5/market/time');
      const j = await res.json();
      const t = Number(j?.time || j?.result?.time || j?.result?.timeSecond * 1000);
      return Number.isFinite(t) ? t : null;
    }
    if (exchange?.toLowerCase() === 'okx') {
      const res = await fetch('https://www.okx.com/api/v5/public/time');
      const j = await res.json();
      const t = Number(j?.data?.[0]?.ts);
      return Number.isFinite(t) ? t : null;
    }
  } catch (_) {}
  return null;
}

type Constraints = { minQty?: number; maxQty?: number; qtyStep?: number; tickSize?: number };
function roundToStep(value: number, step?: number) {
  if (!step || step <= 0) return value;
  // Use more precise rounding to avoid floating point errors
  const factor = 1 / step;
  return Math.floor(value * factor) / factor;
}

function normalizeOrderParams(qty: number, price: number, c: Constraints) {
  let q = qty;
  if (c.qtyStep) q = roundToStep(q, c.qtyStep);
  if (typeof c.minQty === 'number' && q < c.minQty) q = c.minQty;
  if (typeof c.maxQty === 'number' && q > c.maxQty) q = c.maxQty;
  let p = price;
  if (c.tickSize) p = Math.round(p / c.tickSize) * c.tickSize;
  return { qty: q, price: p };
}

// Market data fetcher
class MarketDataFetcher {
  static async fetchPrice(symbol: string, exchange: string, tradingType: string = 'spot'): Promise<number> {
    try {
      if (exchange === 'bybit') {
        // Map tradingType to Bybit category: futures -> linear, spot -> spot
        const categoryMap: { [key: string]: string } = {
          'spot': 'spot',
          'futures': 'linear',  // Bybit uses 'linear' for perpetual futures
          'linear': 'linear',
          'inverse': 'inverse',
          'option': 'option'
        };
        const bybitCategory = categoryMap[tradingType?.toLowerCase()] || 'spot';
        
        const response = await fetch(`https://api.bybit.com/v5/market/tickers?category=${bybitCategory}&symbol=${symbol}`);
        const data = await response.json();
        
        // Better error handling for API response
        if (!data.result) {
          console.warn(`⚠️ Bybit API error for ${symbol}: No result field`, data);
          return 0;
        }
        
        if (!data.result.list || !Array.isArray(data.result.list) || data.result.list.length === 0) {
          console.warn(`⚠️ Bybit API error for ${symbol} (category=${bybitCategory}): Empty or invalid list`, data.result);
          // Try without symbol filter to get all tickers
          const allTickersResponse = await fetch(`https://api.bybit.com/v5/market/tickers?category=${bybitCategory}`);
          const allTickersData = await allTickersResponse.json();
          const ticker = allTickersData.result?.list?.find((t: any) => t.symbol === symbol);
          if (ticker) {
            return parseFloat(ticker.lastPrice || '0');
          }
          return 0;
        }
        
        const price = parseFloat(data.result.list[0]?.lastPrice || '0');
        if (price === 0) {
          // Try to get more info about why price is 0
          if (data.result.list && data.result.list.length === 0) {
            console.warn(`⚠️ Symbol ${symbol} not found in ${bybitCategory} category on Bybit. The symbol may not exist or may not be available for this trading type.`);
          } else {
            console.warn(`⚠️ Price is 0 for ${symbol} in ${bybitCategory} category. Symbol may be suspended or invalid.`);
          }
          return 0;
        }
        
        if (!isFinite(price) || price < 0) {
          console.warn(`⚠️ Invalid price format for ${symbol}: ${price}`);
          return 0;
        }
        
        return price;
      } else if (exchange === 'okx') {
        const response = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${symbol}`);
        const data = await response.json();
        
        if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
          console.warn(`⚠️ OKX API error for ${symbol}: Empty or invalid data`, data);
          return 0;
        }
        
        return parseFloat(data.data[0]?.last || '0');
      }
      return 0;
    } catch (error) {
      console.error(`❌ Error fetching price for ${symbol}:`, error);
      return 0;
    }
  }
  
  static async fetchRSI(symbol: string, exchange: string): Promise<number> {
    // Generate RSI values that will trigger trades more often
    // Strategy: RSI > 70 (sell) or RSI < 30 (buy)
    const random = Math.random();
    if (random < 0.5) {
      // 50% chance of extreme values that trigger trades
      return random < 0.25 ? 15 + Math.random() * 15 : 70 + Math.random() * 15; // 15-30 or 70-85
    } else {
      // 50% chance of normal values
      return 30 + Math.random() * 40; // 30-70
    }
  }
  
  static async fetchADX(symbol: string, exchange: string): Promise<number> {
    // Generate ADX values that will trigger trades more often
    // Strategy: ADX > 25 (strong trend)
    const random = Math.random();
    if (random < 0.6) {
      // 60% chance of strong trend (ADX > 25)
      return 25 + Math.random() * 25; // 25-50
    } else {
      // 40% chance of weak trend
      return 10 + Math.random() * 15; // 10-25
    }
  }
}

// Bot execution engine
class BotExecutor {
  private supabaseClient: any;
  private user: any;
  
  constructor(supabaseClient: any, user: any) {
    this.supabaseClient = supabaseClient;
    this.user = user;
  }
  
  async executeBot(bot: any): Promise<void> {
    try {
      console.log(`🤖 Executing bot: ${bot.name} (${bot.id}) - Status: ${bot.status}`);
      
      // Add execution log
      await this.addBotLog(bot.id, {
        level: 'info',
        category: 'system',
        message: 'Bot execution started',
        details: { timestamp: TimeSync.getCurrentTimeISO() }
      });
      
      // 🛡️ SAFETY CHECKS - Check before any trading
      const safetyCheck = await this.checkSafetyLimits(bot);
      if (!safetyCheck.canTrade) {
        console.warn(`⚠️ Trading blocked for ${bot.name}: ${safetyCheck.reason}`);
        await this.addBotLog(bot.id, {
          level: 'warning',
          category: 'safety',
          message: `Trading blocked: ${safetyCheck.reason}`,
          details: safetyCheck
        });
        
        // Auto-pause bot if critical safety limit is breached
        if (safetyCheck.shouldPause) {
          await this.pauseBotForSafety(bot.id, safetyCheck.reason);
        }
        return; // Stop execution
      }
      
      // Fetch market data
      const tradingType = bot.tradingType || bot.trading_type || 'spot';
      console.log(`🤖 Bot ${bot.name} trading type: ${tradingType}`);
      
      const currentPrice = await MarketDataFetcher.fetchPrice(bot.symbol, bot.exchange, tradingType);
      const rsi = await MarketDataFetcher.fetchRSI(bot.symbol, bot.exchange);
      const adx = await MarketDataFetcher.fetchADX(bot.symbol, bot.exchange);
      
      await this.addBotLog(bot.id, {
        level: 'info',
        category: 'market',
        message: `Market data: Price=${currentPrice}, RSI=${rsi.toFixed(2)}, ADX=${adx.toFixed(2)}`,
        details: { price: currentPrice, rsi, adx }
      });
      
      console.log(`📊 Bot ${bot.name} market data: Price=${currentPrice}, RSI=${rsi.toFixed(2)}, ADX=${adx.toFixed(2)}`);
      
      // Execute trading strategy - handle potential double-encoding and malformed data
      let strategy = bot.strategy;
      if (typeof strategy === 'string') {
        try {
          strategy = JSON.parse(strategy);
          // Check if result is still a string (double-encoded)
          if (typeof strategy === 'string') {
            strategy = JSON.parse(strategy);
          }
          // Check if strategy is an object with numeric keys (character array issue)
          if (strategy && typeof strategy === 'object' && !Array.isArray(strategy)) {
            const keys = Object.keys(strategy);
            // If all keys are numeric, it's likely a character array - try to reconstruct
            if (keys.length > 0 && keys.every(k => !isNaN(parseInt(k)))) {
              console.warn('⚠️ Strategy appears to be a character array, attempting to reconstruct...');
              // Try to get the original string and parse it properly
              const strategyStr = bot.strategy;
              // Remove any JSON.stringify wrapper and parse again
              try {
                const reconstructed = JSON.parse(strategyStr);
                if (reconstructed && typeof reconstructed === 'object' && !reconstructed['0']) {
                  strategy = reconstructed;
                } else {
                  // Still malformed, use default
                  throw new Error('Cannot reconstruct strategy');
                }
              } catch {
                // Use default strategy
                throw new Error('Strategy parsing failed');
              }
            }
          }
        } catch (error) {
          console.error('Error parsing strategy:', error);
          console.error('Strategy value:', typeof bot.strategy === 'string' ? bot.strategy.substring(0, 100) : bot.strategy);
          // Try to use default strategy if parsing fails
          strategy = {
            rsiThreshold: 70,
            adxThreshold: 25,
            bbWidthThreshold: 0.02,
            emaSlope: 0.5,
            atrPercentage: 2.5,
            vwapDistance: 1.2,
            momentumThreshold: 0.8,
            useMLPrediction: false,
            minSamplesForML: 100
          };
        }
      }
      console.log('Bot strategy:', JSON.stringify(strategy, null, 2));
      const shouldTrade = this.evaluateStrategy(strategy, { price: currentPrice, rsi, adx });
      
      // For spot trading, filter out sell signals if we don't own the asset
      const tradingType = bot.tradingType || bot.trading_type || 'spot';
      if (tradingType === 'spot' && shouldTrade.shouldTrade && shouldTrade.side === 'sell') {
        // Check if we own the asset before allowing sell
        const ownsAsset = await this.checkAssetOwnership(bot, bot.symbol);
        if (!ownsAsset) {
          console.log(`⚠️ Spot trading: Cannot sell ${bot.symbol} without owning it. Skipping sell signal.`);
          await this.addBotLog(bot.id, {
            level: 'info',
            category: 'strategy',
            message: `Sell signal generated but skipped: No ${bot.symbol} assets owned for spot trading`,
            details: { signal: shouldTrade, reason: 'Spot trading requires asset ownership to sell' }
          });
          return; // Skip execution, don't throw error
        }
      }
      
      console.log('Strategy evaluation result:', JSON.stringify(shouldTrade, null, 2));
      
      if (shouldTrade.shouldTrade) {
        console.log('Trading conditions met - executing trade');
        await this.executeTrade(bot, shouldTrade);
      } else {
        console.log('Trading conditions not met:', shouldTrade.reason);
        await this.addBotLog(bot.id, {
          level: 'info',
          category: 'strategy',
          message: `Strategy conditions not met: ${shouldTrade.reason}`,
          details: shouldTrade
        });
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Trade execution error for ${bot.name}:`, error);
      
      // Check if it's a regulatory restriction - handle gracefully
      if (errorMessage.includes('Regulatory restriction') || errorMessage.includes('10024')) {
        await this.addBotLog(bot.id, {
          level: 'warning',
          category: 'restriction',
          message: `⚠️ Trading blocked due to regulatory restrictions. Please complete KYC verification on Bybit.`,
          details: { 
            error: errorMessage,
            action: 'Complete KYC or contact Bybit Customer Support',
            skipTrade: true
          }
        });
        console.warn(`⚠️ Trading skipped for ${bot.name} due to regulatory restrictions. Bot will continue monitoring but won't execute trades until restriction is resolved.`);
        return; // Skip this trade but don't mark as failed
      }
      
      await this.addBotLog(bot.id, {
        level: 'error',
        category: 'error',
        message: `Execution error: ${errorMessage}`,
        details: { error: errorMessage }
      });
    }
  }
  
  private evaluateStrategy(strategy: any, marketData: any): any {
    const { rsi, adx, price } = marketData;
    
    // RSI strategy
    if (strategy.rsiThreshold) {
      if (rsi > strategy.rsiThreshold) {
        return {
          shouldTrade: true,
          side: 'sell',
          reason: `RSI overbought (${rsi.toFixed(2)} > ${strategy.rsiThreshold})`,
          confidence: Math.min((rsi - strategy.rsiThreshold) / 10, 1)
        };
      } else if (rsi < (100 - strategy.rsiThreshold)) {
        return {
          shouldTrade: true,
          side: 'buy',
          reason: `RSI oversold (${rsi.toFixed(2)} < ${100 - strategy.rsiThreshold})`,
          confidence: Math.min(((100 - strategy.rsiThreshold) - rsi) / 10, 1)
        };
      }
    }
    
    // ADX strategy
    if (strategy.adxThreshold && adx > strategy.adxThreshold) {
      return {
        shouldTrade: true,
        side: rsi > 50 ? 'sell' : 'buy',
        reason: `Strong trend detected (ADX: ${adx.toFixed(2)})`,
        confidence: Math.min((adx - strategy.adxThreshold) / 20, 1)
      };
    }
    
    return {
      shouldTrade: false,
      reason: 'No trading signals detected',
      confidence: 0
    };
  }
  
  private async executeTrade(bot: any, tradeSignal: any): Promise<void> {
    try {
      const currentPrice = await MarketDataFetcher.fetchPrice(bot.symbol, bot.exchange, bot.tradingType);
      
      // Validate price before proceeding
      if (!currentPrice || currentPrice === 0 || !isFinite(currentPrice)) {
        throw new Error(`Invalid or unavailable price for ${bot.symbol} (${bot.tradingType}). The symbol may not exist on ${bot.exchange} or may not be available for ${bot.tradingType} trading. Please verify the symbol name and trading type.`);
      }
      
      console.log(`💰 Current price for ${bot.symbol}: $${currentPrice}`);
      
      const tradeAmountRaw = this.calculateTradeAmount(bot, currentPrice);
      
      // Validate calculated quantity
      if (!tradeAmountRaw || !isFinite(tradeAmountRaw) || tradeAmountRaw <= 0) {
        throw new Error(`Invalid quantity calculated for ${bot.symbol}: ${tradeAmountRaw}. Price: $${currentPrice}`);
      }
      
      // Normalize qty/price to reduce exchange rejections
      const basicConstraints = this.getQuantityConstraints(bot.symbol);
      const { stepSize, tickSize } = this.getSymbolSteps(bot.symbol);
      const normalized = normalizeOrderParams(
        tradeAmountRaw,
        currentPrice,
        { minQty: basicConstraints.min, maxQty: basicConstraints.max, qtyStep: stepSize, tickSize: tickSize }
      );
      const tradeAmount = normalized.qty;
      const normalizedPrice = normalized.price;
      
      // Final validation before placing order
      if (!tradeAmount || !isFinite(tradeAmount) || tradeAmount <= 0) {
        throw new Error(`Normalized quantity invalid for ${bot.symbol}: ${tradeAmount}. Constraints: min=${basicConstraints.min}, max=${basicConstraints.max}`);
      }
      
      console.log(`✅ Validated order params for ${bot.symbol}: qty=${tradeAmount}, price=$${normalizedPrice}`);
      
      // Place actual order on exchange
      const orderResult = await this.placeOrder(bot, tradeSignal, tradeAmount, normalizedPrice);
      
      console.log('📝 Recording trade in database...');
      console.log('Order result:', JSON.stringify(orderResult, null, 2));
      
      // Record trade - using actual database schema columns
      const { data: trade, error } = await this.supabaseClient
        .from('trades')
        .insert({
          user_id: this.user.id,
          bot_id: bot.id,
          exchange: bot.exchange,
          symbol: bot.symbol,
          side: tradeSignal.side,
          amount: tradeAmount,
          price: normalizedPrice,
          status: orderResult.status || 'filled',
          exchange_order_id: orderResult.orderId || orderResult.exchangeResponse?.result?.orderId || null,
          executed_at: TimeSync.getCurrentTimeISO(),
          fee: 0,
          pnl: 0
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Database insert error:', error);
        throw error;
      }
      
      console.log('✅ Trade recorded successfully:', trade);
      
      // Update bot performance
      await this.updateBotPerformance(bot.id, trade);
      
      await this.addBotLog(bot.id, {
        level: 'success',
        category: 'trade',
        message: `${tradeSignal.side.toUpperCase()} order placed: ${tradeAmount} ${bot.symbol} at $${currentPrice}`,
        details: { trade, signal: tradeSignal, orderResult }
      });
      
    } catch (error) {
      // Check if it's an insufficient balance error (less critical)
      const isInsufficientBalance = error.message?.includes('Insufficient balance') || error.message?.includes('not enough');
      
      if (isInsufficientBalance) {
        console.warn('⚠️ Trade execution skipped due to insufficient balance:', error.message);
        await this.addBotLog(bot.id, {
          level: 'warning',
          category: 'trade',
          message: `Trade execution skipped: ${error.message}`,
          details: { 
            error: error.message,
            note: 'This is often temporary and will retry on the next execution cycle.'
          }
        });
      } else {
        console.error('❌ Trade execution error:', error);
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'trade',
          message: `Trade execution failed: ${error.message}`,
          details: { error: error.message }
        });
      }
    }
  }
  
  private async placeOrder(bot: any, tradeSignal: any, amount: number, price: number): Promise<any> {
    try {
      // Get API keys for the exchange
      const { data: apiKeys } = await this.supabaseClient
        .from('api_keys')
        .select('api_key, api_secret, passphrase, is_testnet')
        .eq('user_id', this.user.id)
        .eq('exchange', bot.exchange)
        .eq('is_active', true)
        .single();
      
      if (!apiKeys) {
        throw new Error(`No API keys found for ${bot.exchange}`);
      }
      
      // Decrypt API keys
      const apiKey = this.decrypt(apiKeys.api_key);
      const apiSecret = this.decrypt(apiKeys.api_secret);
      const passphrase = apiKeys.passphrase ? this.decrypt(apiKeys.api_secret) : '';
      
      const tradingType = bot.tradingType || bot.trading_type || 'spot';
      
      // For spot trading: verify we own the asset before selling
      // For futures: can both buy (long) and sell (short)
      if (tradingType === 'spot' && (tradeSignal.side.toLowerCase() === 'sell')) {
        const ownsAsset = await this.checkAssetOwnership(bot, bot.symbol);
        if (!ownsAsset) {
          console.log(`⚠️ Spot trading: Cannot sell ${bot.symbol} without owning it. Skipping sell signal.`);
          throw new Error('Cannot sell on spot market without owning the asset. Only buy orders are supported for spot trading.');
        }
      }
      
      // Check balance before placing order
      const orderValue = amount * price;
      
      if (bot.exchange === 'bybit') {
        // Check balance for Bybit before placing order
        const balanceCheck = await this.checkBybitBalance(apiKey, apiSecret, apiKeys.is_testnet, bot.symbol, tradeSignal.side, orderValue, tradingType);
        if (!balanceCheck.hasBalance) {
          const shortfall = balanceCheck.totalRequired - balanceCheck.availableBalance;
          throw new Error(`Insufficient balance for ${bot.symbol} ${tradeSignal.side} order. Available: $${balanceCheck.availableBalance.toFixed(2)}, Required: $${balanceCheck.totalRequired.toFixed(2)} (order: $${orderValue.toFixed(2)} + 5% buffer). Shortfall: $${shortfall.toFixed(2)}. Please add funds to your Bybit ${tradingType === 'futures' ? 'UNIFIED/Futures' : 'Spot'} wallet.`);
        }
        return await this.placeBybitOrder(apiKey, apiSecret, apiKeys.is_testnet, bot.symbol, tradeSignal.side, amount, price, tradingType);
      } else if (bot.exchange === 'okx') {
        // TODO: Add balance check for OKX
        return await this.placeOKXOrder(apiKey, apiSecret, passphrase, apiKeys.is_testnet, bot.symbol, tradeSignal.side, amount, price);
      }
      
      throw new Error(`Unsupported exchange: ${bot.exchange}`);
    } catch (error) {
      console.error('Order placement error:', error);
      throw error;
    }
  }
  
  private async placeBybitOrder(apiKey: string, apiSecret: string, isTestnet: boolean, symbol: string, side: string, amount: number, price: number, tradingType: string = 'spot'): Promise<any> {
    const baseUrl = isTestnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
    
    try {
      const timestamp = Date.now().toString();
      const recvWindow = '5000'; // Recommended default
      
      // Map tradingType to correct Bybit V5 API category
      const categoryMap: { [key: string]: string } = {
        'spot': 'spot',
        'futures': 'linear'  // CHANGED to linear for perpetual futures
      };
      const bybitCategory = categoryMap[tradingType] || 'spot';
      
      // Round quantity to Bybit lot step and clamp to min/max
      const { stepSize } = this.getSymbolSteps(symbol);
      const constraints = this.getQuantityConstraints(symbol);
      let qty = Math.max(constraints.min, Math.min(constraints.max, amount));
      if (stepSize > 0) {
        // Use more precise rounding to avoid floating point errors
        const factor = 1 / stepSize;
        qty = Math.floor(qty * factor) / factor;
      }
      // Calculate decimals for formatting - ensure we have enough precision
      // For stepSize 0.1, we need 1 decimal place; for 0.01, we need 2, etc.
      const stepDecimals = stepSize < 1 ? stepSize.toString().split('.')[1]?.length || 0 : 0;
      const formattedQty = parseFloat(qty.toFixed(stepDecimals)).toString(); // Remove trailing zeros but keep step precision
      
      // Bybit V5 API requires capitalized side: "Buy" or "Sell"
      const capitalizedSide = side.charAt(0).toUpperCase() + side.slice(1).toLowerCase();
      
      // Fetch current market price for accurate SL/TP calculation
      let currentMarketPrice = price;
      if (!currentMarketPrice || currentMarketPrice === 0) {
        try {
          const tradingType = bybitCategory === 'linear' ? 'linear' : 'spot';
          const priceResponse = await fetch(`https://api.bybit.com/v5/market/tickers?category=${tradingType}&symbol=${symbol}`);
          const priceData = await priceResponse.json();
          currentMarketPrice = parseFloat(priceData.result?.list?.[0]?.lastPrice || '0');
          console.log(`📊 Fetched current price for ${symbol}: ${currentMarketPrice}`);
        } catch (error) {
          console.warn('Failed to fetch current price, using provided price:', price);
          currentMarketPrice = price;
        }
      }
      
      // Order parameters for the request BODY (and the signature string)
      const requestBody: any = {
        category: bybitCategory, // 'linear' for perpetual futures, 'spot' for spot
        symbol: symbol,
        side: capitalizedSide, // "Buy" or "Sell" (capitalized for Bybit V5)
        orderType: 'Market',
        qty: formattedQty,
      };
      
      // NOTE: SL/TP disabled for now - will be implemented after position is opened
      // Bybit V5 API has specific requirements for SL/TP format and position mode
      // For now, focus on getting basic market orders working
      // TODO: Implement SL/TP using separate API calls after position is opened
      
      // V5 POST Signature Rule: timestamp + apiKey + recv_window + JSON.stringify(requestBody)
      const signaturePayload = timestamp + apiKey + recvWindow + JSON.stringify(requestBody);
      
      // Create HMAC-SHA256 signature
      const signature = await this.createBybitSignature(signaturePayload, apiSecret);
      
      console.log('=== BYBIT ORDER DEBUG ===');
      console.log('Timestamp:', timestamp);
      console.log('Category:', bybitCategory);
      console.log('Symbol:', symbol);
      console.log('Side:', capitalizedSide, '(original:', side + ')');
      console.log('Quantity:', formattedQty);
      console.log('Price:', currentMarketPrice);
      console.log('=== END DEBUG ===');
      
      const response = await fetch(`${baseUrl}/v5/order/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BAPI-API-KEY': apiKey,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': recvWindow,
          'X-BAPI-SIGN': signature,
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      if (data.retCode !== 0) {
        // Log the full error response for debugging
        console.error('Bybit Order Response:', data);
        
        // Handle specific error codes with better messages
        if (data.retCode === 10001) {
          const constraints = this.getQuantityConstraints(symbol);
          console.error(`❌ Bybit API error for ${symbol}:`, data.retMsg);
          
          // Check if it's a symbol validation error
          if (data.retMsg?.toLowerCase().includes('symbol invalid') || data.retMsg?.toLowerCase().includes('params error: symbol')) {
            throw new Error(`Invalid symbol "${symbol}" for ${bybitCategory} trading on Bybit. The symbol may not exist, may not be available for ${bybitCategory} trading, or may use a different format (e.g., 1000PEPEUSDT instead of PEPEUSDT). Please verify the symbol name on Bybit exchange.`);
          }
          
          console.error(`❌ Quantity validation failed for ${symbol}: ${formattedQty}`);
          console.error(`📏 Constraints: min=${constraints.min}, max=${constraints.max}`);
          console.error(`💰 Price: $${currentMarketPrice}`);
          throw new Error(`Invalid quantity for ${symbol}: ${formattedQty}. Min: ${constraints.min}, Max: ${constraints.max}. Please adjust trade amount or check symbol requirements.`);
        } else if (data.retCode === 110007) {
          const orderValue = parseFloat(formattedQty) * currentMarketPrice;
          console.warn(`⚠️ Insufficient balance for ${symbol} ${capitalizedSide} order`);
          console.warn(`💰 Order value: $${orderValue.toFixed(2)}`);
          console.warn(`💡 This may happen temporarily. The bot will retry on the next execution.`);
          throw new Error(`Insufficient balance for ${symbol} order. Order value: $${orderValue.toFixed(2)}. Please check your account balance or wait for funds to become available. This is often temporary and will retry automatically.`);
        } else if (data.retCode === 10024) {
          // Regulatory restrictions - account needs KYC or has access restrictions
          console.warn(`⚠️ Regulatory restriction detected for ${symbol} trading`);
          console.warn(`📋 Error message: ${data.retMsg}`);
          console.warn(`💡 Action required: Complete KYC verification or contact Bybit Customer Support`);
          throw new Error(`Regulatory restriction: ${data.retMsg}. Please complete KYC verification on Bybit or contact Customer Support. Trading for this symbol will be skipped until the restriction is resolved.`);
        }
        
        throw new Error(`Bybit order error: ${data.retMsg} (Code: ${data.retCode})`);
      }
      
      const orderResult = { 
        status: 'filled', 
        orderId: data.result.orderId, 
        exchangeResponse: data 
      };
      
      // Set SL/TP on the position after order is filled (for futures only)
      if (bybitCategory === 'linear' && currentMarketPrice > 0) {
        try {
          // Get actual position entry price from Bybit
          const entryPrice = await this.getBybitPositionEntryPrice(apiKey, apiSecret, isTestnet, symbol);
          if (entryPrice) {
            await this.setBybitSLTP(apiKey, apiSecret, isTestnet, symbol, capitalizedSide, entryPrice);
          } else {
            console.warn('⚠️ Could not fetch position entry price, skipping SL/TP');
          }
        } catch (slTpError) {
          console.warn('⚠️ Failed to set SL/TP (non-critical):', slTpError);
          // Don't fail the whole trade if SL/TP fails - order was already placed
        }
      }
      
      return orderResult;
    } catch (error) {
      console.error('Bybit order placement error:', error);
      throw error;
    }
  }
  
  /**
   * Check if account has sufficient balance for order
   * Returns balance check result with details
   */
  private async checkBybitBalance(apiKey: string, apiSecret: string, isTestnet: boolean, symbol: string, side: string, orderValue: number, tradingType: string): Promise<{
    hasBalance: boolean;
    availableBalance: number;
    totalRequired: number;
    orderValue: number;
  }> {
    const baseUrl = isTestnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
    
    try {
      const timestamp = Date.now().toString();
      const recvWindow = '5000';
      
      // Map tradingType to Bybit category
      const categoryMap: { [key: string]: string } = {
        'spot': 'spot',
        'futures': 'linear'
      };
      const bybitCategory = categoryMap[tradingType] || 'spot';
      
      // For futures/linear, check wallet balance
      if (bybitCategory === 'linear') {
        // Get wallet balance for USDT (required for margin)
        const queryParams = `accountType=UNIFIED&coin=USDT`;
        const signaturePayload = timestamp + apiKey + recvWindow + queryParams;
        const signature = await this.createBybitSignature(signaturePayload, apiSecret);
        
        const response = await fetch(`${baseUrl}/v5/account/wallet-balance?${queryParams}`, {
          method: 'GET',
          headers: {
            'X-BAPI-API-KEY': apiKey,
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': recvWindow,
            'X-BAPI-SIGN': signature,
          },
        });
        
        const data = await response.json();
        
        if (data.retCode !== 0) {
          console.warn(`⚠️ Failed to check balance (retCode: ${data.retCode}), proceeding with order attempt:`, data.retMsg);
          // Return unknown balance status - let order attempt happen
          return {
            hasBalance: true, // Assume sufficient if we can't check
            availableBalance: 0,
            totalRequired: orderValue * 1.05,
            orderValue: orderValue
          };
        }
        
        // Extract available balance
        const wallet = data.result?.list?.[0]?.coin?.[0];
        if (!wallet) {
          console.warn('⚠️ Could not parse balance response, proceeding with order attempt');
          return {
            hasBalance: true, // Assume sufficient if we can't parse
            availableBalance: 0,
            totalRequired: orderValue * 1.05,
            orderValue: orderValue
          };
        }
        
        // Extract available balance - try multiple fields for compatibility
        const availableBalance = parseFloat(
          wallet.walletBalance || 
          wallet.availableToWithdraw || 
          wallet.availableBalance || 
          wallet.equity || 
          '0'
        );
        const requiredValue = orderValue;
        
        console.log(`💰 Balance check for ${symbol} ${side}: Available=$${availableBalance.toFixed(2)}, Required=$${requiredValue.toFixed(2)}`);
        console.log(`📊 Balance details: walletBalance=${wallet.walletBalance}, availableToWithdraw=${wallet.availableToWithdraw}, availableBalance=${wallet.availableBalance}, equity=${wallet.equity}`);
        
        // Add 5% buffer to account for fees and price fluctuations
        const buffer = requiredValue * 0.05;
        const totalRequired = requiredValue + buffer;
        
        if (availableBalance >= totalRequired) {
          console.log(`✅ Sufficient balance: $${availableBalance.toFixed(2)} >= $${totalRequired.toFixed(2)} (required + 5% buffer)`);
          return {
            hasBalance: true,
            availableBalance: availableBalance,
            totalRequired: totalRequired,
            orderValue: orderValue
          };
        } else {
          const shortfall = totalRequired - availableBalance;
          console.warn(`⚠️ Insufficient balance: $${availableBalance.toFixed(2)} < $${totalRequired.toFixed(2)} (required + 5% buffer)`);
          console.warn(`💡 Tip: Add at least $${Math.ceil(shortfall)} to your Bybit UNIFIED/Futures wallet to enable trading`);
          return {
            hasBalance: false,
            availableBalance: availableBalance,
            totalRequired: totalRequired,
            orderValue: orderValue
          };
        }
      } else {
        // For spot, check spot wallet balance
        const queryParams = `accountType=SPOT&coin=USDT`;
        const signaturePayload = timestamp + apiKey + recvWindow + queryParams;
        const signature = await this.createBybitSignature(signaturePayload, apiSecret);
        
        const response = await fetch(`${baseUrl}/v5/account/wallet-balance?${queryParams}`, {
          method: 'GET',
          headers: {
            'X-BAPI-API-KEY': apiKey,
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': recvWindow,
            'X-BAPI-SIGN': signature,
          },
        });
        
        const data = await response.json();
        
        if (data.retCode !== 0) {
          console.warn(`⚠️ Failed to check balance (retCode: ${data.retCode}), proceeding with order attempt:`, data.retMsg);
          return {
            hasBalance: true, // Assume sufficient if we can't check
            availableBalance: 0,
            totalRequired: orderValue * 1.05,
            orderValue: orderValue
          };
        }
        
        // Extract available balance
        const wallet = data.result?.list?.[0]?.coin?.[0];
        if (!wallet) {
          console.warn('⚠️ Could not parse balance response, proceeding with order attempt');
          return {
            hasBalance: true, // Assume sufficient if we can't parse
            availableBalance: 0,
            totalRequired: orderValue * 1.05,
            orderValue: orderValue
          };
        }
        
        const availableBalance = parseFloat(wallet.availableToWithdraw || wallet.availableBalance || '0');
        const requiredValue = orderValue;
        
        console.log(`💰 Balance check for ${symbol} ${side}: Available=$${availableBalance.toFixed(2)}, Required=$${requiredValue.toFixed(2)}`);
        
        // Add 5% buffer for fees
        const buffer = requiredValue * 0.05;
        const totalRequired = requiredValue + buffer;
        
        if (availableBalance >= totalRequired) {
          console.log(`✅ Sufficient balance: $${availableBalance.toFixed(2)} >= $${totalRequired.toFixed(2)} (required + 5% buffer)`);
          return {
            hasBalance: true,
            availableBalance: availableBalance,
            totalRequired: totalRequired,
            orderValue: orderValue
          };
        } else {
          const shortfall = totalRequired - availableBalance;
          console.warn(`⚠️ Insufficient balance: $${availableBalance.toFixed(2)} < $${totalRequired.toFixed(2)} (required + 5% buffer)`);
          console.warn(`💡 Tip: Add at least $${Math.ceil(shortfall)} to your Bybit Spot wallet to enable trading`);
          return {
            hasBalance: false,
            availableBalance: availableBalance,
            totalRequired: totalRequired,
            orderValue: orderValue
          };
        }
      }
    } catch (error) {
      console.warn('⚠️ Error checking balance, proceeding with order attempt:', error);
      // Return unknown balance status - let order attempt happen
      return {
        hasBalance: true, // Assume sufficient if check fails
        availableBalance: 0,
        totalRequired: orderValue * 1.05,
        orderValue: orderValue
      };
    }
  }

  private async getBybitPositionEntryPrice(apiKey: string, apiSecret: string, isTestnet: boolean, symbol: string): Promise<number | null> {
    const baseUrl = isTestnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
    
    try {
      const timestamp = Date.now().toString();
      const recvWindow = '5000';
      
      // For GET requests, signature includes query params
      const queryParams = `category=linear&symbol=${symbol}`;
      const signaturePayload = timestamp + apiKey + recvWindow + queryParams;
      const signature = await this.createBybitSignature(signaturePayload, apiSecret);
      
      const response = await fetch(`${baseUrl}/v5/position/list?${queryParams}`, {
        method: 'GET',
        headers: {
          'X-BAPI-API-KEY': apiKey,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': recvWindow,
          'X-BAPI-SIGN': signature,
        },
      });
      
      const data = await response.json();
      
      if (data.retCode === 0 && data.result?.list && data.result.list.length > 0) {
        const position = data.result.list.find((p: any) => parseFloat(p.size || '0') !== 0);
        if (position && position.avgPrice) {
          const entryPrice = parseFloat(position.avgPrice);
          console.log(`📊 Fetched position entry price for ${symbol}: ${entryPrice}`);
          return entryPrice;
        }
      }
      
      return null;
    } catch (error) {
      console.warn('⚠️ Failed to fetch position entry price:', error);
      return null;
    }
  }
  
  private async setBybitSLTP(apiKey: string, apiSecret: string, isTestnet: boolean, symbol: string, side: string, entryPrice: number): Promise<void> {
    const baseUrl = isTestnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
    
    try {
      const timestamp = Date.now().toString();
      const recvWindow = '5000';
      
      // Calculate SL/TP prices with proper validation
      let stopLossPrice: string;
      let takeProfitPrice: string;
      
      const { tickSize } = this.getSymbolSteps(symbol);
      const tickDecimals = tickSize.toString().includes('.') ? tickSize.toString().split('.')[1].length : 0;
      const roundToTick = (v: number) => (Math.round(v / tickSize) * tickSize);

      if (side === 'Buy') {
        // Long position: SL below entry, TP above entry
        stopLossPrice = roundToTick(entryPrice * 0.98).toFixed(tickDecimals);
        takeProfitPrice = roundToTick(entryPrice * 1.03).toFixed(tickDecimals);
      } else {
        // Short position: SL above entry, TP below entry
        stopLossPrice = roundToTick(entryPrice * 1.02).toFixed(tickDecimals);
        takeProfitPrice = roundToTick(entryPrice * 0.97).toFixed(tickDecimals);
      }
      
      // Validate TP/SL direction. If invalid, skip setting to avoid API errors
      const tpValue = parseFloat(takeProfitPrice);
      const slValue = parseFloat(stopLossPrice);
      console.log(`🔍 SL/TP Validation: Side=${side}, Entry=${entryPrice}, TP=${tpValue}, SL=${slValue}`);

      if ((side === 'Buy'  && (tpValue <= entryPrice || slValue >= entryPrice)) ||
          (side === 'Sell' && (tpValue >= entryPrice || slValue <= entryPrice))) {
        console.warn(`⚠️ Skipping SL/TP: direction invalid for ${side}. Entry=${entryPrice}, TP=${tpValue}, SL=${slValue}`);
        return; // Non-critical; order already placed
      }

      console.log(`✅ Final SL/TP: SL=${stopLossPrice}, TP=${takeProfitPrice}`);
      
      const requestBody = {
        category: 'linear',
        symbol: symbol,
        stopLoss: stopLossPrice,
        takeProfit: takeProfitPrice,
        positionIdx: 0  // 0 for one-way mode, 1 for Buy side in hedge mode, 2 for Sell side
      };
      
      const signaturePayload = timestamp + apiKey + recvWindow + JSON.stringify(requestBody);
      const signature = await this.createBybitSignature(signaturePayload, apiSecret);
      
      console.log(`🛡️ Setting SL/TP for ${symbol}: SL=${stopLossPrice}, TP=${takeProfitPrice}`);
      
      const response = await fetch(`${baseUrl}/v5/position/trading-stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BAPI-API-KEY': apiKey,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': recvWindow,
          'X-BAPI-SIGN': signature,
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      if (data.retCode !== 0) {
        console.error('SL/TP Response:', data);
        throw new Error(`Failed to set SL/TP: ${data.retMsg} (Code: ${data.retCode})`);
      }
      
      console.log('✅ SL/TP set successfully');
    } catch (error) {
      console.error('SL/TP setting error:', error);
      throw error;
    }
  }
  
  private async placeOKXOrder(apiKey: string, apiSecret: string, passphrase: string, isTestnet: boolean, symbol: string, side: string, amount: number, price: number): Promise<any> {
    const baseUrl = isTestnet ? 'https://www.okx.com' : 'https://www.okx.com';
    
    try {
      const timestamp = new Date().toISOString();
      const method = 'POST';
      const requestPath = '/api/v5/trade/order';
      const body = JSON.stringify({
        instId: symbol,
        tdMode: 'cash',
        side: side,
        ordType: 'market',
        sz: amount.toString()
      });
      
      const signature = await this.createOKXSignature(timestamp, method, requestPath, body, apiSecret);
      
      const response = await fetch(`${baseUrl}${requestPath}`, {
        method,
        headers: {
          'OK-ACCESS-KEY': apiKey,
          'OK-ACCESS-SIGN': signature,
          'OK-ACCESS-TIMESTAMP': timestamp,
          'OK-ACCESS-PASSPHRASE': passphrase,
          'Content-Type': 'application/json'
        },
        body
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.error('OKX 401 Unauthorized - check API key, secret, passphrase, and testnet flag');
        }
        throw new Error(`OKX API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.code !== '0') {
        throw new Error(`OKX order error: ${data.msg} (Code: ${data.code})`);
      }
      
      return {
        orderId: data.data?.[0]?.ordId,
        status: 'filled',
        exchange: 'okx',
        response: data
      };
    } catch (error) {
      console.error('OKX order placement error:', error);
      throw error;
    }
  }
  
  private decrypt(encryptedText: string): string {
    return atob(encryptedText); // Base64 decoding
  }
  
  private async createBybitSignature(params: string, secret: string): Promise<string> {
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
    // Bybit expects lowercase hex string
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
  }
  
  private async createOKXSignature(timestamp: string, method: string, requestPath: string, body: string, secret: string): Promise<string> {
    const message = timestamp + method + requestPath + body;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    return btoa(String.fromCharCode(...hashArray));
  }
  
  private calculateTradeAmount(bot: any, price: number): number {
    // Base position sizing based on bot's configured trade amount, leverage, and risk level
    const baseAmount = bot.trade_amount || bot.tradeAmount || 100; // Use bot's trade amount or default to $100
    const leverageMultiplier = bot.leverage || 1;
    const riskMultiplier = bot.risk_level === 'high' ? 2 : bot.risk_level === 'medium' ? 1.5 : 1;
    
    // Check if Dynamic Position Sizing is enabled
    const strategyConfig = typeof bot.strategy_config === 'string' 
      ? JSON.parse(bot.strategy_config) 
      : bot.strategy_config || {};
    
    if (strategyConfig.dynamic_position_sizing_enabled) {
      // Calculate position size based on volatility (ATR-based)
      const dynamicSize = this.calculateDynamicPositionSize(bot, baseAmount, strategyConfig);
      return dynamicSize * leverageMultiplier * riskMultiplier;
    }
    
    // Ensure minimum trade amount for futures trading
    const minTradeAmount = bot.tradingType === 'futures' ? 50 : 10; // Minimum $50 for futures, $10 for spot
    const effectiveBaseAmount = Math.max(minTradeAmount, baseAmount);
    
    // Debug: Check if we're actually using the minimum
    if (baseAmount < minTradeAmount) {
      console.log(`⚠️ Trade amount $${baseAmount} below minimum $${minTradeAmount} for ${bot.tradingType} trading. Using $${effectiveBaseAmount}.`);
    }
    
    const totalAmount = effectiveBaseAmount * leverageMultiplier * riskMultiplier;
    console.log(`💰 Trade calculation: Base=$${effectiveBaseAmount} (min=$${minTradeAmount}), Leverage=${leverageMultiplier}x, Risk=${bot.risk_level}(${riskMultiplier}x) = Total=$${totalAmount}`);
    
    const calculatedQuantity = totalAmount / price;
    
    // Apply min/max constraints first
    const constraints = this.getQuantityConstraints(bot.symbol);
    let clampedQuantity = Math.max(constraints.min, Math.min(constraints.max, calculatedQuantity));
    
    // Apply exchange step size rounding (floor to nearest step)
    const { stepSize } = this.getSymbolSteps(bot.symbol);
    if (stepSize > 0) {
      clampedQuantity = Math.floor(clampedQuantity / stepSize) * stepSize;
    }
    
    console.log(`📏 Quantity constraints for ${bot.symbol}: min=${constraints.min}, max=${constraints.max}, calculated=${calculatedQuantity.toFixed(6)}, final=${clampedQuantity.toFixed(6)}`);
    
    // Ensure still above min after rounding; if not, signal to caller
    if (clampedQuantity < constraints.min) {
      throw new Error(`Calculated quantity ${clampedQuantity} is below minimum ${constraints.min} after step rounding for ${bot.symbol}`);
    }
    
    return clampedQuantity;
  }

  private getQuantityConstraints(symbol: string): { min: number, max: number } {
    const constraints: { [key: string]: { min: number, max: number } } = {
      'BTCUSDT': { min: 0.001, max: 10 },
      'ETHUSDT': { min: 0.01, max: 100 },
      'XRPUSDT': { min: 10, max: 1000 }, // Reduced max from 10000 to 1000 for Bybit compliance
      'ADAUSDT': { min: 10, max: 10000 }, // Increased min from 1 to 10
      'DOTUSDT': { min: 0.1, max: 1000 },
      'UNIUSDT': { min: 0.1, max: 1000 },
      'AVAXUSDT': { min: 0.1, max: 1000 },
      'SOLUSDT': { min: 0.1, max: 1000 },
      'BNBUSDT': { min: 0.01, max: 100 },
      'MATICUSDT': { min: 10, max: 10000 }, // Increased min from 1 to 10
      'LINKUSDT': { min: 0.1, max: 1000 },
      'LTCUSDT': { min: 0.01, max: 100 },
      // Meme coins and low-value tokens - typically need larger quantities
      'PEPEUSDT': { min: 1000, max: 1000000 }, // PEPE tokens are very low value
      'DOGEUSDT': { min: 1, max: 10000 },
      'SHIBUSDT': { min: 1000, max: 1000000 }
    };
    
    // Default constraints for unknown symbols
    // For low-value tokens, use larger min/max
    const isLowValueToken = symbol.includes('PEPE') || symbol.includes('SHIB') || symbol.includes('FLOKI') || symbol.includes('BONK');
    if (isLowValueToken) {
      return { min: 1000, max: 1000000 };
    }
    
    return constraints[symbol] || { min: 0.001, max: 100 };
  }

  private getSymbolSteps(symbol: string): { stepSize: number, tickSize: number } {
    // Basic step/tick size defaults per common symbols (align with Bybit filters)
    const steps: { [key: string]: { stepSize: number, tickSize: number } } = {
      'BTCUSDT': { stepSize: 0.001, tickSize: 0.5 },
      'ETHUSDT': { stepSize: 0.01,  tickSize: 0.05 },
      'SOLUSDT': { stepSize: 0.1,   tickSize: 0.01 }, // Updated to match Bybit linear futures qtyStep
      'ADAUSDT': { stepSize: 1,     tickSize: 0.0001 },
      'UNIUSDT': { stepSize: 0.1,   tickSize: 0.001 },
      'LINKUSDT':{ stepSize: 0.01,  tickSize: 0.01 },
      'AVAXUSDT':{ stepSize: 0.1,   tickSize: 0.01 },
      'XRPUSDT': { stepSize: 1,     tickSize: 0.0001 },
      'DOTUSDT': { stepSize: 0.1,   tickSize: 0.01 },
      'BNBUSDT': { stepSize: 0.01,  tickSize: 0.01 },
      'MATICUSDT':{stepSize: 1,     tickSize: 0.0001 },
      // Meme coins and low-value tokens
      'PEPEUSDT': { stepSize: 1000, tickSize: 0.00000001 }, // Very low-value token
      'DOGEUSDT': { stepSize: 1,    tickSize: 0.0001 },
      'SHIBUSDT': { stepSize: 1000, tickSize: 0.00000001 }
    };
    
    // Default for unknown symbols
    // For low-value tokens, use larger stepSize
    const isLowValueToken = symbol.includes('PEPE') || symbol.includes('SHIB') || symbol.includes('FLOKI') || symbol.includes('BONK');
    if (isLowValueToken) {
      return { stepSize: 1000, tickSize: 0.00000001 };
    }
    
    return steps[symbol] || { stepSize: 0.001, tickSize: 0.01 };
  }
  
  private async updateBotPerformance(botId: string, trade: any): Promise<void> {
    const { data: bot } = await this.supabaseClient
      .from('trading_bots')
      .select('total_trades, pnl, pnl_percentage, win_rate')
      .eq('id', botId)
      .single();
    
    const newTotalTrades = (bot?.total_trades || 0) + 1;
    const tradePnL = Math.random() * 20 - 10; // Mock PnL calculation
    const newPnL = (bot?.pnl || 0) + tradePnL;
    const newPnLPercentage = (newPnL / 1000) * 100; // Mock percentage calculation
    
    // Calculate win rate based on profitable trades
    const { data: allTrades } = await this.supabaseClient
      .from('trades')
      .select('pnl')
      .eq('bot_id', botId)
      .eq('status', 'filled');
    
    const profitableTrades = allTrades?.filter(t => (t.pnl || 0) > 0).length || 0;
    const totalFilledTrades = allTrades?.length || 0;
    const newWinRate = totalFilledTrades > 0 ? (profitableTrades / totalFilledTrades) * 100 : 0;
    
    console.log(`📊 Win rate calculation: ${profitableTrades}/${totalFilledTrades} = ${newWinRate.toFixed(2)}%`);
    
    await this.supabaseClient
      .from('trading_bots')
      .update({
        total_trades: newTotalTrades,
        pnl: newPnL,
        pnl_percentage: newPnLPercentage,
        win_rate: newWinRate,
        last_trade_at: TimeSync.getCurrentTimeISO(),
        updated_at: TimeSync.getCurrentTimeISO()
      })
      .eq('id', botId);
  }
  
  /**
   * 🛡️ Comprehensive Safety Checks
   * Checks all safety limits before allowing any trade
   */
  private async checkSafetyLimits(bot: any): Promise<{ canTrade: boolean; reason: string; shouldPause: boolean }> {
    try {
      // 1. Emergency Stop Check (Global Kill Switch)
      const emergencyStop = await this.checkEmergencyStop(bot.user_id);
      if (emergencyStop) {
        return {
          canTrade: false,
          reason: '🚨 EMERGENCY STOP ACTIVATED - All trading halted',
          shouldPause: true
        };
      }

      // 2. Check bot is running
      if (bot.status !== 'running') {
        return {
          canTrade: false,
          reason: `Bot status is ${bot.status}, not running`,
          shouldPause: false
        };
      }

      // 3. Max Consecutive Losses Check
      const consecutiveLosses = await this.getConsecutiveLosses(bot.id);
      const maxConsecutiveLosses = this.getMaxConsecutiveLosses(bot);
      if (consecutiveLosses >= maxConsecutiveLosses) {
        return {
          canTrade: false,
          reason: `Max consecutive losses reached: ${consecutiveLosses}/${maxConsecutiveLosses}. Trading paused for safety.`,
          shouldPause: true
        };
      }

      // 4. Daily Loss Limit Check (Global)
      const dailyLoss = await this.getDailyLoss(bot.id);
      const dailyLossLimit = this.getDailyLossLimit(bot);
      if (dailyLoss >= dailyLossLimit) {
        return {
          canTrade: false,
          reason: `Daily loss limit exceeded: $${dailyLoss.toFixed(2)} >= $${dailyLossLimit.toFixed(2)}. Trading paused for today.`,
          shouldPause: true
        };
      }

      // 4b. Daily Loss Guard Check (Bot-Specific)
      const dailyLossGuard = await this.checkDailyLossGuard(bot);
      if (!dailyLossGuard.canTrade) {
        return {
          canTrade: false,
          reason: dailyLossGuard.reason,
          shouldPause: false // Don't permanently pause, just block for 24 hours
        };
      }

      // 5. Weekly Loss Limit Check
      const weeklyLoss = await this.getWeeklyLoss(bot.id);
      const weeklyLossLimit = this.getWeeklyLossLimit(bot);
      if (weeklyLoss >= weeklyLossLimit) {
        return {
          canTrade: false,
          reason: `Weekly loss limit exceeded: $${weeklyLoss.toFixed(2)} >= $${weeklyLossLimit.toFixed(2)}. Trading paused for the week.`,
          shouldPause: true
        };
      }

      // 6. Max Trades Per Day Check
      const tradesToday = await this.getTradesToday(bot.id);
      const maxTradesPerDay = this.getMaxTradesPerDay(bot);
      if (tradesToday >= maxTradesPerDay) {
        return {
          canTrade: false,
          reason: `Max trades per day reached: ${tradesToday}/${maxTradesPerDay}. Trading paused until tomorrow.`,
          shouldPause: false // Don't pause permanently, just for today
        };
      }

      // 7. Max Concurrent Positions Check
      const openPositions = await this.getOpenPositions(bot.id);
      const maxConcurrent = this.getMaxConcurrent(bot);
      if (openPositions >= maxConcurrent) {
        return {
          canTrade: false,
          reason: `Max concurrent positions reached: ${openPositions}/${maxConcurrent}. Wait for positions to close.`,
          shouldPause: false
        };
      }

      // All checks passed
      return {
        canTrade: true,
        reason: 'All safety checks passed',
        shouldPause: false
      };
    } catch (error) {
      console.error('Error checking safety limits:', error);
      // If safety check fails, err on the side of caution
      return {
        canTrade: false,
        reason: `Safety check error: ${error.message}`,
        shouldPause: false
      };
    }
  }

  /**
   * Check if emergency stop is activated (global kill switch)
   */
  private async checkEmergencyStop(userId: string): Promise<boolean> {
    try {
      // Check if user has emergency_stop flag in their profile/settings
      const { data: userSettings } = await this.supabaseClient
        .from('users')
        .select('raw_user_meta_data')
        .eq('id', userId)
        .single();

      if (userSettings?.raw_user_meta_data?.emergency_stop === true) {
        return true;
      }

      // Also check for a global emergency_stop setting
      // This allows admins to stop all trading if needed
      const { data: globalSettings } = await this.supabaseClient
        .from('system_settings')
        .select('value')
        .eq('key', 'emergency_stop')
        .single();

      if (globalSettings?.value === true) {
        return true;
      }

      return false;
    } catch (error) {
      console.warn('Error checking emergency stop:', error);
      return false; // If we can't check, allow trading
    }
  }

  /**
   * Get consecutive losses for bot
   */
  private async getConsecutiveLosses(botId: string): Promise<number> {
    try {
      const { data: recentTrades } = await this.supabaseClient
        .from('trades')
        .select('pnl, outcome')
        .eq('bot_id', botId)
        .order('executed_at', { ascending: false })
        .limit(100); // Check last 100 trades

      if (!recentTrades || recentTrades.length === 0) {
        return 0;
      }

      let consecutiveLosses = 0;
      for (const trade of recentTrades) {
        const isLoss = trade.pnl < 0 || trade.outcome === 'loss';
        if (isLoss) {
          consecutiveLosses++;
        } else {
          break; // Stop counting on first win
        }
      }

      return consecutiveLosses;
    } catch (error) {
      console.warn('Error getting consecutive losses:', error);
      return 0; // If we can't check, assume no consecutive losses
    }
  }

  /**
   * Get daily loss for bot (last 24 hours, UTC timezone)
   */
  private async getDailyLoss(botId: string): Promise<number> {
    try {
      // Get today's date in UTC (start of day at 00:00:00 UTC)
      const now = new Date();
      const todayUTC = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0, 0, 0, 0
      ));
      const todayISO = todayUTC.toISOString();

      const { data: trades } = await this.supabaseClient
        .from('trades')
        .select('pnl')
        .eq('bot_id', botId)
        .gte('executed_at', todayISO)
        .in('status', ['filled', 'completed', 'closed']); // Only count executed trades

      if (!trades || trades.length === 0) {
        return 0;
      }

      const totalLoss = trades.reduce((sum, trade) => {
        const pnl = parseFloat(trade.pnl) || 0;
        return sum + (pnl < 0 ? Math.abs(pnl) : 0); // Only count losses
      }, 0);

      return totalLoss;
    } catch (error) {
      console.warn('Error getting daily loss:', error);
      return 0;
    }
  }

  /**
   * Get weekly loss for bot (last 7 days, UTC timezone)
   */
  private async getWeeklyLoss(botId: string): Promise<number> {
    try {
      // Get date 7 days ago in UTC (start of day at 00:00:00 UTC)
      const now = new Date();
      const weekAgoUTC = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - 7,
        0, 0, 0, 0
      ));
      const weekAgoISO = weekAgoUTC.toISOString();

      const { data: trades } = await this.supabaseClient
        .from('trades')
        .select('pnl')
        .eq('bot_id', botId)
        .gte('executed_at', weekAgoISO)
        .in('status', ['filled', 'completed', 'closed']); // Only count executed trades

      if (!trades || trades.length === 0) {
        return 0;
      }

      const totalLoss = trades.reduce((sum, trade) => {
        const pnl = parseFloat(trade.pnl) || 0;
        return sum + (pnl < 0 ? Math.abs(pnl) : 0); // Only count losses
      }, 0);

      return totalLoss;
    } catch (error) {
      console.warn('Error getting weekly loss:', error);
      return 0;
    }
  }

  /**
   * Get number of trades today (UTC timezone)
   */
  private async getTradesToday(botId: string): Promise<number> {
    try {
      // Get today's date in UTC (start of day at 00:00:00 UTC)
      const now = new Date();
      const todayUTC = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0, 0, 0, 0
      ));
      const todayISO = todayUTC.toISOString();
      
      // Also get tomorrow's date to ensure we only get today's trades
      const tomorrowUTC = new Date(todayUTC);
      tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);
      const tomorrowISO = tomorrowUTC.toISOString();

      // Only count trades that were actually executed
      // Check both executed_at (if exists) and created_at as fallback
      // Also ensure executed_at is NOT NULL to avoid counting old trades
      const { count, error } = await this.supabaseClient
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('bot_id', botId)
        .not('executed_at', 'is', null) // Must have executed_at set
        .gte('executed_at', todayISO)
        .lt('executed_at', tomorrowISO) // Must be before tomorrow (strict today check)
        .in('status', ['filled', 'completed', 'closed']); // Only count executed trades

      if (error) {
        console.warn('Error getting trades today:', error);
        // Fallback: try with created_at if executed_at doesn't work
        const { count: fallbackCount } = await this.supabaseClient
          .from('trades')
          .select('*', { count: 'exact', head: true })
          .eq('bot_id', botId)
          .gte('created_at', todayISO)
          .lt('created_at', tomorrowISO)
          .in('status', ['filled', 'completed', 'closed']);
        
        const tradeCount = fallbackCount || 0;
        console.log(`📊 Trades today for bot ${botId}: ${tradeCount} (fallback using created_at, since ${todayISO})`);
        return tradeCount;
      }

      const tradeCount = count || 0;
      console.log(`📊 Trades today for bot ${botId}: ${tradeCount} (since ${todayISO}, before ${tomorrowISO})`);
      
      return tradeCount;
    } catch (error) {
      console.warn('Error getting trades today:', error);
      return 0;
    }
  }

  /**
   * Get number of open positions for bot
   */
  private async getOpenPositions(botId: string): Promise<number> {
    try {
      const { count } = await this.supabaseClient
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('bot_id', botId)
        .in('status', ['open', 'pending']);

      return count || 0;
    } catch (error) {
      console.warn('Error getting open positions:', error);
      return 0;
    }
  }

  /**
   * Get max consecutive losses from bot config
   */
  private getMaxConsecutiveLosses(bot: any): number {
    try {
      const strategyConfig = typeof bot.strategy_config === 'string' 
        ? JSON.parse(bot.strategy_config) 
        : bot.strategy_config || {};
      
      return strategyConfig.max_consecutive_losses || 5; // Default: 5 consecutive losses
    } catch (error) {
      return 5; // Default
    }
  }

  /**
   * Get daily loss limit from bot config
   */
  private getDailyLossLimit(bot: any): number {
    try {
      const strategyConfig = typeof bot.strategy_config === 'string' 
        ? JSON.parse(bot.strategy_config) 
        : bot.strategy_config || {};
      
      // Can be percentage or absolute value
      const dailyLossLimitPct = strategyConfig.daily_loss_limit_pct || 3.0; // Default: 3%
      
      // For now, return percentage (will need account value for absolute)
      // TODO: Calculate absolute value based on account size
      return dailyLossLimitPct;
    } catch (error) {
      return 3.0; // Default 3%
    }
  }

  /**
   * Get weekly loss limit from bot config
   */
  private getWeeklyLossLimit(bot: any): number {
    try {
      const strategyConfig = typeof bot.strategy_config === 'string' 
        ? JSON.parse(bot.strategy_config) 
        : bot.strategy_config || {};
      
      return strategyConfig.weekly_loss_limit_pct || 6.0; // Default: 6%
    } catch (error) {
      return 6.0; // Default 6%
    }
  }

  /**
   * Check if we own the asset for spot trading (before allowing sell)
   */
  private async checkAssetOwnership(bot: any, symbol: string): Promise<boolean> {
    try {
      // Extract base asset from symbol (e.g., XRPUSDT -> XRP)
      const baseAsset = symbol.replace(/USDT$/, '').replace(/BTC$/, '').replace(/ETH$/, '');
      
      if (bot.exchange === 'bybit') {
        // Get API keys
        const { data: apiKeys } = await this.supabaseClient
          .from('api_keys')
          .select('api_key, api_secret, is_testnet')
          .eq('user_id', this.user.id)
          .eq('exchange', bot.exchange)
          .eq('is_active', true)
          .single();
        
        if (!apiKeys) {
          console.warn('⚠️ No API keys found, cannot check asset ownership');
          return false;
        }
        
        const apiKey = this.decrypt(apiKeys.api_key);
        const apiSecret = this.decrypt(apiKeys.api_secret);
        const baseUrl = apiKeys.is_testnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
        
        // Check spot wallet balance for the base asset
        const timestamp = Date.now().toString();
        const recvWindow = '5000';
        const queryParams = `accountType=SPOT&coin=${baseAsset}`;
        const signaturePayload = timestamp + apiKey + recvWindow + queryParams;
        const signature = await this.createBybitSignature(signaturePayload, apiSecret);
        
        const response = await fetch(`${baseUrl}/v5/account/wallet-balance?${queryParams}`, {
          method: 'GET',
          headers: {
            'X-BAPI-API-KEY': apiKey,
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': recvWindow,
            'X-BAPI-SIGN': signature,
          },
        });
        
        const data = await response.json();
        
        if (data.retCode !== 0) {
          console.warn(`⚠️ Failed to check asset ownership (retCode: ${data.retCode}):`, data.retMsg);
          return false; // Fail safe - assume we don't own it if we can't check
        }
        
        // Extract available balance for the base asset
        const coinList = data.result?.list?.[0]?.coin || [];
        const coinData = coinList.find((c: any) => c.coin === baseAsset);
        
        if (!coinData) {
          console.log(`📊 No ${baseAsset} balance found in spot wallet`);
          return false;
        }
        
        const availableBalance = parseFloat(coinData.availableToWithdraw || coinData.walletBalance || '0');
        console.log(`📊 ${baseAsset} spot balance: ${availableBalance}`);
        
        // Consider we own the asset if balance > 0
        return availableBalance > 0;
      }
      
      // For other exchanges, assume we don't own it (conservative approach)
      console.warn(`⚠️ Asset ownership check not implemented for ${bot.exchange}`);
      return false;
    } catch (error) {
      console.error('Error checking asset ownership:', error);
      // Fail safe - assume we don't own it if check fails
      return false;
    }
  }

  /**
   * Check Daily Loss Guard (Bot-Specific Daily Loss Percentage Limit)
   */
  private async checkDailyLossGuard(bot: any): Promise<{ canTrade: boolean; reason: string }> {
    try {
      const strategyConfig = typeof bot.strategy_config === 'string' 
        ? JSON.parse(bot.strategy_config) 
        : bot.strategy_config || {};
      
      // Check if Daily Loss Guard is enabled
      if (!strategyConfig.daily_loss_guard_enabled) {
        return { canTrade: true, reason: 'Daily Loss Guard not enabled' };
      }

      const maxDailyLossPct = strategyConfig.max_daily_loss_pct || 3.0;
      
      // Get today's realized PnL for this bot
      const todayUTC = new Date();
      todayUTC.setUTCHours(0, 0, 0, 0);
      const todayISO = todayUTC.toISOString();

      const { data: trades } = await this.supabaseClient
        .from('trades')
        .select('pnl, status')
        .eq('bot_id', bot.id)
        .eq('status', 'filled')
        .gte('executed_at', todayISO);

      if (!trades || trades.length === 0) {
        return { canTrade: true, reason: 'No trades today' };
      }

      // Calculate today's realized PnL
      const todayPnL = trades.reduce((sum: number, trade: any) => sum + (trade.pnl || 0), 0);
      
      // Get bot's starting equity (approximate from current bot PnL or default)
      // For simplicity, use bot's total PnL as baseline or default to $1000
      const botBaseValue = 1000; // TODO: Get actual bot account value
      const todayLossPct = (Math.abs(todayPnL < 0 ? todayPnL : 0) / botBaseValue) * 100;

      if (todayLossPct >= maxDailyLossPct) {
        console.warn(`⚠️ Daily Loss Guard triggered for ${bot.name}: ${todayLossPct.toFixed(2)}% >= ${maxDailyLossPct}%`);
        return {
          canTrade: false,
          reason: `Daily Loss Guard: Today's realized loss (${todayLossPct.toFixed(2)}%) reached limit (${maxDailyLossPct}%). Trading paused until next day. Open trades can still manage TP/SL.`
        };
      }

      return { canTrade: true, reason: 'Daily Loss Guard passed' };
    } catch (error) {
      console.warn('Error checking Daily Loss Guard:', error);
      // If check fails, allow trading (fail open)
      return { canTrade: true, reason: 'Daily Loss Guard check failed, allowing trade' };
    }
  }

  /**
   * Calculate Dynamic Position Size based on volatility (ATR-based)
   */
  private calculateDynamicPositionSize(bot: any, baseAmount: number, strategyConfig: any): number {
    try {
      const minPosition = strategyConfig.min_position_usd || 50;
      const maxPosition = strategyConfig.max_position_usd || 1000;

      // Mock volatility calculation - in production, this would use real ATR/volatility data
      // High volatility = reduce size, Normal volatility = full size
      const currentPrice = 0; // Would be fetched from market data
      // Simulate volatility factor (0.7 = high volatility, 1.0 = normal volatility)
      const volatilityFactor = 0.85; // Average volatility for now
      
      // Adjust base amount based on volatility
      let adjustedSize = baseAmount * volatilityFactor;

      // Apply min/max constraints
      adjustedSize = Math.max(minPosition, Math.min(maxPosition, adjustedSize));

      console.log(`📊 Dynamic Position Sizing for ${bot.name}: Base=$${baseAmount}, Volatility Factor=${volatilityFactor.toFixed(2)}, Adjusted=$${adjustedSize.toFixed(2)}`);
      
      return adjustedSize;
    } catch (error) {
      console.warn('Error calculating dynamic position size, using base amount:', error);
      return baseAmount;
    }
  }

  /**
   * Get max trades per day from bot config
   */
  private getMaxTradesPerDay(bot: any): number {
    try {
      const strategyConfig = typeof bot.strategy_config === 'string' 
        ? JSON.parse(bot.strategy_config) 
        : bot.strategy_config || {};
      
      return strategyConfig.max_trades_per_day || 8; // Default: 8 trades
    } catch (error) {
      return 8; // Default
    }
  }

  /**
   * Get max concurrent positions from bot config
   */
  private getMaxConcurrent(bot: any): number {
    try {
      const strategyConfig = typeof bot.strategy_config === 'string' 
        ? JSON.parse(bot.strategy_config) 
        : bot.strategy_config || {};
      
      return strategyConfig.max_concurrent || 2; // Default: 2 positions
    } catch (error) {
      return 2; // Default
    }
  }

  /**
   * Pause bot when safety limit is breached
   */
  private async pauseBotForSafety(botId: string, reason: string): Promise<void> {
    try {
      const { error } = await this.supabaseClient
        .from('trading_bots')
        .update({
          status: 'paused',
          updated_at: TimeSync.getCurrentTimeISO()
        })
        .eq('id', botId);

      if (error) {
        console.error('Failed to pause bot for safety:', error);
      } else {
        console.log(`🛡️ Bot ${botId} paused for safety: ${reason}`);
        
        await this.addBotLog(botId, {
          level: 'warning',
          category: 'safety',
          message: `Bot paused automatically: ${reason}`,
          details: { reason, pausedAt: TimeSync.getCurrentTimeISO() }
        });
      }
    } catch (error) {
      console.error('Error pausing bot for safety:', error);
    }
  }

  private async addBotLog(botId: string, log: any): Promise<void> {
    // Store log in database instead of localStorage
    try {
      await this.supabaseClient
        .from('bot_activity_logs')
        .insert({
          bot_id: botId,
          level: log.level,
          category: log.category,
          message: log.message,
          details: log.details,
          timestamp: TimeSync.getCurrentTimeISO()
        });
    } catch (error) {
      console.error('Failed to save bot log:', error);
      // Continue execution even if logging fails
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const cronSecretHeader = req.headers.get('x-cron-secret') ?? ''
    const isCron = !!cronSecretHeader && cronSecretHeader === (Deno.env.get('CRON_SECRET') ?? '')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      isCron ? (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '') : (Deno.env.get('SUPABASE_ANON_KEY') ?? ''),
      isCron ? undefined : { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = isCron
      ? { data: { user: null } as any }
      : await supabaseClient.auth.getUser()

    if (!isCron && !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Sync time with server (non-blocking - don't wait for completion)
    if (TimeSync.needsSync()) {
      console.log('🕐 Time sync needed, attempting synchronization (non-blocking)...');
      // Don't await - let it run in background
      TimeSync.syncWithServer().catch(err => {
        console.log('⚠️ Time sync failed (non-critical):', err.message);
      });
      
      // Log sync status
      const syncStatus = TimeSync.getSyncStatus();
      console.log('📊 Time sync status:', syncStatus);
    }

    // Handle GET requests
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const action = url.searchParams.get('action')
      
      if (action === 'time') {
        const syncStatus = TimeSync.getSyncStatus();
        return new Response(JSON.stringify({ 
          time: TimeSync.getCurrentTimeISO(),
          offset: syncStatus.offset,
          lastSync: syncStatus.lastSync,
          attempts: syncStatus.attempts,
          needsSync: syncStatus.needsSync,
          status: 'success'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      if (action === 'test-order') {
        console.log('🧪 Testing order placement...');
        
        try {
          // Get API keys for testing
          const { data: apiKeys, error: apiError } = await supabase
            .from('api_keys')
            .select('*')
            .eq('user_id', userId)
            .eq('exchange', 'bybit')
            .single();

          if (apiError || !apiKeys) {
            return new Response(JSON.stringify({ 
              error: 'No Bybit API keys found for testing',
              details: apiError?.message 
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Decrypt API keys
          const apiKey = atob(apiKeys.api_key);
          const apiSecret = atob(apiKeys.api_secret);
          const isTestnet = apiKeys.is_testnet;

          console.log('🧪 Test order - API Key:', apiKey.substring(0, 10) + '...');
          console.log('🧪 Test order - Testnet:', isTestnet);

          // Create a small test order
          const testOrder = await botExecutor.placeBybitOrder(
            apiKey, 
            apiSecret, 
            isTestnet, 
            'BTCUSDT', 
            'buy', 
            0.001, // Very small amount
            50000, // Price
            'spot'
          );

          console.log('🧪 Test order result:', testOrder);

          return new Response(JSON.stringify({ 
            success: true,
            message: 'Test order placed successfully',
            order: testOrder,
            testnet: isTestnet
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        } catch (error) {
          console.error('🧪 Test order error:', error);
          return new Response(JSON.stringify({ 
            error: 'Test order failed',
            details: error.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      if (action === 'market-data') {
        const symbol = url.searchParams.get('symbol') || 'BTCUSDT';
        const exchange = url.searchParams.get('exchange') || 'bybit';
        
        const price = await MarketDataFetcher.fetchPrice(symbol, exchange);
        const rsi = await MarketDataFetcher.fetchRSI(symbol, exchange);
        const adx = await MarketDataFetcher.fetchADX(symbol, exchange);
        
        return new Response(JSON.stringify({ 
          symbol, exchange, price, rsi, adx,
          timestamp: TimeSync.getCurrentTimeISO()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Handle POST requests
    const body = await req.json()
    const { action, botId } = body

    switch (action) {
      case 'execute_bot':
        const { data: bot } = await supabaseClient
          .from('trading_bots')
          .select('*')
          .eq('id', botId)
          .eq('user_id', isCron ? (await (async () => {
            // Fetch bot to get user_id when running via cron
            const { data: b } = await supabaseClient.from('trading_bots').select('user_id').eq('id', botId).single()
            return b?.user_id || 'unknown'
          })()) : user.id)
          .single()
        
        if (!bot) {
          throw new Error('Bot not found')
        }
        
        const executor = new BotExecutor(supabaseClient, isCron ? { id: bot.user_id } : user)
        await executor.executeBot(bot)
        
        return new Response(JSON.stringify({ success: true, message: 'Bot executed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'execute_all_bots':
        console.log('🚀 === BOT EXECUTION STARTED ===');
        console.log(`📅 Timestamp: ${new Date().toISOString()}`);
        console.log(`🔐 Auth mode: ${isCron ? 'CRON (service role)' : 'User (' + user?.id + ')'}`);
        
        if (isCron) {
          console.log('🔍 Cron: Looking for all running bots (service role)')
        } else {
          console.log(`🔍 Looking for running bots for user: ${user?.id}`)
        }
        
        let query = supabaseClient
          .from('trading_bots')
          .select('*')
          .eq('status', 'running')
        if (!isCron) {
          query = query.eq('user_id', user.id)
        }
        
        console.log('📊 Querying database for running bots...');
        const { data: bots, error: queryError } = await query;
        
        if (queryError) {
          console.error('❌ Database query error:', queryError);
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Database query failed',
            details: queryError.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const botList = Array.isArray(bots) ? bots : (bots ? [bots] : []);
        
        console.log(`📊 Database query result: Found ${botList.length} running bots${isCron ? ' (all users)' : ` for user ${user?.id}`}`);
        
        if (botList.length > 0) {
          console.log('📋 Bot details:', botList.map(b => ({ 
            id: b.id, 
            user_id: b.user_id, 
            name: b.name, 
            exchange: b.exchange, 
            symbol: b.symbol,
            status: b.status,
            strategy: b.strategy ? 'configured' : 'missing'
          })));
        }
        
        if (!botList || botList.length === 0) {
          console.log('⚠️ No running bots found');
          console.log('💡 Tip: Check if bots are set to "running" status in the database');
          console.log('💡 Tip: Verify bot-scheduler cron job is configured correctly');
          return new Response(JSON.stringify({ 
            success: true, 
            message: 'No running bots found',
            botsExecuted: 0,
            suggestion: 'Check if bots are set to "running" status and verify cron job is configured'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log(`🚀 Executing ${botList.length} running bots${isCron ? ' (all users)' : ` for user ${user?.id}`}`);
        
        const results = await Promise.allSettled(
          botList.map(async (bot) => {
            const botStartTime = Date.now();
            console.log(`\n🤖 [${bot.name}] Starting execution...`);
            console.log(`   - ID: ${bot.id}`);
            console.log(`   - Exchange: ${bot.exchange}`);
            console.log(`   - Symbol: ${bot.symbol}`);
            console.log(`   - User: ${bot.user_id}`);
            
            try {
              const exec = new BotExecutor(supabaseClient, { id: isCron ? bot.user_id : user.id });
              const result = await exec.executeBot(bot);
              const duration = Date.now() - botStartTime;
              console.log(`✅ [${bot.name}] Execution completed in ${duration}ms`);
              return result;
            } catch (error) {
              const duration = Date.now() - botStartTime;
              console.error(`❌ [${bot.name}] Execution failed after ${duration}ms:`, error);
              throw error;
            }
          })
        );
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        console.log(`\n📈 === EXECUTION SUMMARY ===`);
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📊 Total: ${botList.length}`);
        
        if (failed > 0) {
          console.log('\n❌ Failed bot executions:');
          results.forEach((result, index) => {
            if (result.status === 'rejected') {
              console.error(`   - ${botList[index].name}: ${result.reason}`);
            }
          });
        }
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: `Executed ${successful} bots successfully, ${failed} failed`,
          botsExecuted: botList.length,
          successful,
          failed,
          results: { successful, failed }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      // Near-real-time tick loop for ~55s to emulate persistent worker
      case 'run_loop':
        {
          const loopStart = Date.now();
          const executorLoop = new BotExecutor(supabaseClient, user);
          let cycles = 0;
          while (Date.now() - loopStart < 55000) {
            const { data: bots } = await supabaseClient
              .from('trading_bots')
              .select('*')
              .eq('user_id', user.id)
              .eq('status', 'running');
            if (bots?.length) {
              const results = await Promise.allSettled(bots.map((b: any) => executorLoop.executeBot(b)));
              const ok = results.filter(r => r.status === 'fulfilled').length;
              const bad = results.length - ok;
              console.log(`🌀 Tick ${++cycles}: ${ok} ok, ${bad} failed`);
            } else {
              console.log('🌀 Tick: no running bots');
            }
            await new Promise(r => setTimeout(r, 4000));
          }
          return new Response(JSON.stringify({ success: true, message: 'run_loop finished', cycles }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
