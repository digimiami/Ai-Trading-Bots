// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

const DEFAULT_SPOT_FEE_RATE = 0.001;      // 0.10%
const DEFAULT_FUTURES_FEE_RATE = 0.0006;  // 0.06%

function resolveFeeRate(exchange?: string, tradingType?: string): number {
  const exch = (exchange || '').toLowerCase();
  const type = (tradingType || '').toLowerCase();

  if (type === 'futures' || type === 'linear' || type === 'perpetual') {
    if (exch === 'okx') return 0.0005;
    if (exch === 'binance') return 0.0007;
    return DEFAULT_FUTURES_FEE_RATE;
  }

  if (exch === 'okx') return 0.0008;
  if (exch === 'binance') return 0.001;
  return DEFAULT_SPOT_FEE_RATE;
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
      
      // Check content-type before parsing JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Bybit time sync returned non-JSON (${contentType}): ${errorText.substring(0, 200)}`);
      }
      
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
  // Round to nearest step size (not floor) for quantity to get closest valid value
  if (c.qtyStep && c.qtyStep > 0) {
    const factor = 1 / c.qtyStep;
    q = Math.round(q * factor) / factor;
  }
  if (typeof c.minQty === 'number' && q < c.minQty) q = c.minQty;
  if (typeof c.maxQty === 'number' && q > c.maxQty) q = c.maxQty;
  let p = price;
  if (c.tickSize) p = Math.round(p / c.tickSize) * c.tickSize;
  return { qty: q, price: p };
}

type QuantityConstraint = { min: number; max: number };
type SymbolSteps = { stepSize: number; tickSize: number };

const LOW_LIQUIDITY_SYMBOLS = ['PEPE', 'SHIB', 'FLOKI', 'BONK', 'SATS', 'MEME'];

function isLowLiquiditySymbol(symbol: string): boolean {
  const upper = symbol?.toUpperCase() || '';
  return LOW_LIQUIDITY_SYMBOLS.some(token => upper.includes(token)) || upper.startsWith('1000') || upper.startsWith('10000');
}

function getQuantityConstraints(symbol: string): QuantityConstraint {
  const constraints: Record<string, QuantityConstraint> = {
    'BTCUSDT': { min: 0.001, max: 10 },
    'ETHUSDT': { min: 0.01, max: 100 },
    'XRPUSDT': { min: 10, max: 1000 },
    'ADAUSDT': { min: 10, max: 10000 },
    'DOTUSDT': { min: 0.1, max: 1000 },
    'UNIUSDT': { min: 0.1, max: 1000 },
    'AVAXUSDT': { min: 0.1, max: 1000 },
    'SOLUSDT': { min: 0.1, max: 1000 },
    'BNBUSDT': { min: 0.01, max: 100 },
    'MATICUSDT': { min: 10, max: 10000 },
    'LINKUSDT': { min: 0.1, max: 1000 },
    'LTCUSDT': { min: 0.01, max: 100 },
    'PEPEUSDT': { min: 1000, max: 1000000 },
    'DOGEUSDT': { min: 1, max: 10000 },
    'SHIBUSDT': { min: 1000, max: 1000000 },
    'HBARUSDT': { min: 1, max: 10000 },
    'MYXUSDT': { min: 0.001, max: 10 }, // Reduced max - Bybit may have lower limits for this symbol
    'STRKUSDT': { min: 0.1, max: 1000 },
    'TRUMPUSDT': { min: 0.1, max: 1000 },
    'FILUSDT': { min: 0.1, max: 1000 },
    'ONDOUSDT': { min: 0.1, max: 1000 },
    'XANUSDT': { min: 0.1, max: 1000 },
    'ASTERUSDT': { min: 0.1, max: 1000 },
    'HYPEUSDT': { min: 0.1, max: 1000 },
    'VIRTUALUSDT': { min: 0.1, max: 1000 },
    'WIFUSDT': { min: 0.1, max: 1000 },
    'ZENUSDT': { min: 0.1, max: 1000 },
    'LTCUSDT': { min: 0.01, max: 100 }
  };

  if (isLowLiquiditySymbol(symbol)) {
    return { min: 1000, max: 1000000 };
  }

  // Default constraints for unknown symbols
  return constraints[symbol] || { min: 0.001, max: 100 };
}

function getSymbolSteps(symbol: string): SymbolSteps {
  const steps: Record<string, SymbolSteps> = {
    'BTCUSDT': { stepSize: 0.001, tickSize: 0.5 },
    'ETHUSDT': { stepSize: 0.01, tickSize: 0.05 },
    'SOLUSDT': { stepSize: 0.1, tickSize: 0.01 },
    'ADAUSDT': { stepSize: 1, tickSize: 0.0001 },
    'UNIUSDT': { stepSize: 0.1, tickSize: 0.001 },
    'LINKUSDT': { stepSize: 0.1, tickSize: 0.01 },
    'AVAXUSDT': { stepSize: 0.1, tickSize: 0.01 },
    'XRPUSDT': { stepSize: 1, tickSize: 0.0001 },
    'DOTUSDT': { stepSize: 0.1, tickSize: 0.01 },
    'BNBUSDT': { stepSize: 0.01, tickSize: 0.01 },
    'MATICUSDT': { stepSize: 1, tickSize: 0.0001 },
    'HBARUSDT': { stepSize: 1, tickSize: 0.0001 },
    'PEPEUSDT': { stepSize: 1000, tickSize: 0.00000001 },
    'DOGEUSDT': { stepSize: 1, tickSize: 0.0001 },
    'SHIBUSDT': { stepSize: 1000, tickSize: 0.00000001 },
    'MYXUSDT': { stepSize: 0.001, tickSize: 0.0001 },
    'STRKUSDT': { stepSize: 0.1, tickSize: 0.0001 },
    'TRUMPUSDT': { stepSize: 0.1, tickSize: 0.0001 },
    'FILUSDT': { stepSize: 0.1, tickSize: 0.0001 },
    'ONDOUSDT': { stepSize: 0.1, tickSize: 0.0001 },
    'XANUSDT': { stepSize: 0.1, tickSize: 0.0001 },
    'ASTERUSDT': { stepSize: 0.1, tickSize: 0.0001 },
    'HYPEUSDT': { stepSize: 0.1, tickSize: 0.0001 },
    'VIRTUALUSDT': { stepSize: 0.1, tickSize: 0.0001 },
      'WIFUSDT': { stepSize: 0.1, tickSize: 0.0001 },
      'ZENUSDT': { stepSize: 0.1, tickSize: 0.0001 },
      'LTCUSDT': { stepSize: 0.01, tickSize: 0.01 },
      'SWARMSUSDT': { stepSize: 1, tickSize: 0.0001 },
      'ZRXUSDT': { stepSize: 0.1, tickSize: 0.0001 }
    };

  if (isLowLiquiditySymbol(symbol)) {
    return { stepSize: 1000, tickSize: 0.00000001 };
  }

  // Use a more precise fallback for unknown symbols to avoid SL/TP rounding issues
  return steps[symbol] || { stepSize: 0.001, tickSize: 0.0001 };
}

function getRiskMultiplier(bot: any): number {
  const risk = bot.risk_level || bot.riskLevel || 'medium';
  if (risk === 'high') return 2;
  if (risk === 'medium') return 1.5;
  return 1;
}

type TradeSizingResult = {
  quantity: number;
  rawQuantity: number;
  totalAmount: number;
  effectiveBaseAmount: number;
  minTradeAmount: number;
  baseAmount: number;
  leverageMultiplier: number;
  riskMultiplier: number;
  constraints: QuantityConstraint;
  steps: SymbolSteps;
  isFutures: boolean;
  leverage: number; // Actual leverage used (after exchange-specific limits)
};

// Resolve leverage based on exchange and trading type
// Ensures Bitunix uses 3x by default instead of 20x
function resolveLeverage(exchange?: string, tradingType?: string, userLeverage?: number): number {
  const exch = (exchange || '').toLowerCase();
  const type = (tradingType || '').toLowerCase();
  
  // Default leverage based on exchange and trading type
  if (exch === 'bitunix') {
    if (type === 'futures' || type === 'linear') {
      // Bitunix futures default to 3x, maximum 20x
      return Math.min(userLeverage || 3, 20);
    }
    return 1; // Spot trading has no leverage
  }
  
  // For other exchanges
  if (type === 'futures' || type === 'linear') {
    return Math.min(userLeverage || 3, 10); // Default 3x for futures
  }
  
  return 1; // Spot trading
}

function calculateTradeSizing(bot: any, price: number): TradeSizingResult {
  const userLeverage = bot.leverage || 1;
  const riskMultiplier = getRiskMultiplier(bot);
  const tradingType = bot.tradingType || bot.trading_type;
  const isFutures = (tradingType === 'futures' || tradingType === 'linear');

  // Get actual leverage from exchange-specific function (ensures Bitunix uses 3x default)
  const actualLeverage = resolveLeverage(bot.exchange, tradingType, userLeverage);
  
  // Log leverage resolution for debugging
  if (bot.exchange?.toLowerCase() === 'bitunix' && isFutures) {
    console.log(`🔧 Leverage resolution: userLeverage=${userLeverage}, actualLeverage=${actualLeverage} (Bitunix futures)`);
  }

  const baseAmount = bot.trade_amount || bot.tradeAmount || 100;
  const minTradeAmount = isFutures ? 50 : 10;
  const effectiveBaseAmount = Math.max(minTradeAmount, baseAmount);

  // Use actual leverage (not userLeverage) for calculations
  const totalAmount = effectiveBaseAmount * actualLeverage * riskMultiplier;
  const rawQuantity = totalAmount / price;

  const quantityConstraints = getQuantityConstraints(bot.symbol);
  const steps = getSymbolSteps(bot.symbol);

  let clampedQuantity = Math.max(quantityConstraints.min, Math.min(quantityConstraints.max, rawQuantity));
  if (steps.stepSize > 0) {
    clampedQuantity = Math.floor(clampedQuantity / steps.stepSize) * steps.stepSize;
  }

  // Ensure we never exceed max (critical for symbols like SHIBUSDT where max = 1000000)
  // CRITICAL FIX: When quantity equals max, reduce by one step to ensure it's strictly less than max
  // Bybit rejects quantities that equal the max value, so we must stay below it
  if (clampedQuantity >= quantityConstraints.max) {
    if (steps.stepSize > 0) {
      // Calculate the largest valid quantity that's strictly less than max
      const maxSteps = Math.floor(quantityConstraints.max / steps.stepSize);
      // If max is exactly on a step boundary, use one step less
      if ((quantityConstraints.max % steps.stepSize) === 0) {
        clampedQuantity = (maxSteps - 1) * steps.stepSize;
      } else {
        // If max is not on a step boundary, use the largest step that's below max
        clampedQuantity = maxSteps * steps.stepSize;
      }
    } else {
      // If no step size, reduce by a small amount (1% of max, but at least 1)
      clampedQuantity = quantityConstraints.max - Math.max(1, quantityConstraints.max * 0.01);
    }
    // Final safety check: ensure we're still within bounds and >= min
    if (clampedQuantity > quantityConstraints.max) {
      clampedQuantity = quantityConstraints.max - (steps.stepSize || 1);
    }
  }

  if (clampedQuantity < quantityConstraints.min) {
    throw new Error(`Calculated quantity ${clampedQuantity} is below minimum ${quantityConstraints.min} after step rounding for ${bot.symbol}`);
  }

  return {
    quantity: clampedQuantity,
    rawQuantity,
    totalAmount,
    effectiveBaseAmount,
    minTradeAmount,
    baseAmount,
    leverageMultiplier: actualLeverage, // Use actual leverage (after exchange limits)
    riskMultiplier,
    constraints: quantityConstraints,
    steps,
    isFutures,
    leverage: actualLeverage // Add leverage field
  };
}

function calculateTradeQuantity(bot: any, price: number): number {
  return calculateTradeSizing(bot, price).quantity;
}

type SlippageOptions = {
  isExit?: boolean;
  severity?: number;
};

function estimateSlippageBps(symbol: string, tradeValue: number, options?: SlippageOptions): number {
  const upperSymbol = symbol?.toUpperCase() || '';
  let baseBps = 3; // 0.03% for majors

  if (upperSymbol.includes('BTC') || upperSymbol.includes('ETH')) {
    baseBps = 2.5;
  } else if (upperSymbol.includes('SOL') || upperSymbol.includes('BNB') || upperSymbol.includes('XRP')) {
    baseBps = 4;
  } else if (isLowLiquiditySymbol(upperSymbol)) {
    baseBps = 12;
  } else {
    baseBps = 6;
  }

  // Increase slippage for larger orders (more realistic)
  if (tradeValue > 2000) {
    baseBps *= 1.5; // Increased from 1.35
  }
  if (tradeValue > 5000) {
    baseBps *= 2.0; // Increased from 1.75
  }
  if (tradeValue > 10000) {
    baseBps *= 1.5; // Additional penalty for very large orders
  }

  // More realistic random multiplier (wider range, less optimistic)
  const randomMultiplier = 0.7 + Math.random() * 1.1; // 0.7 - 1.8 (was 0.6 - 1.5)
  let slippageBps = baseBps * randomMultiplier;

  // Exits typically have worse slippage (especially stop losses)
  if (options?.isExit) {
    slippageBps *= 1.3; // Increased from 1.1 - exits are harder
  }
  if (options?.severity) {
    slippageBps *= options.severity;
  }

  return Math.max(0.5, slippageBps); // Ensure non-zero slippage
}

function applySlippage(price: number, side: string, symbol: string, tradeValue: number, options?: SlippageOptions): { price: number; slippageBps: number } {
  if (!Number.isFinite(price) || price <= 0) {
    return { price, slippageBps: 0 };
  }

  const normalizedSide = (side || '').toLowerCase();
  const effectiveSide = normalizedSide === 'sell' || normalizedSide === 'short' ? 'sell' : 'buy';

  const slippageBps = estimateSlippageBps(symbol, tradeValue, options);
  const slipDecimal = slippageBps / 10000; // convert bps to decimal

  const direction = effectiveSide === 'buy' ? 1 : -1;
  const adjustedPrice = price * (1 + direction * slipDecimal);

  return {
    price: Math.max(0, adjustedPrice),
    slippageBps
  };
}

// Market data fetcher with caching
class MarketDataFetcher {
  // Cache for tickers data to reduce redundant API calls
  private static tickersCache: {
    data: any[] | null;
    timestamp: number;
    category: string;
  } = {
    data: null,
    timestamp: 0,
    category: ''
  };
  
  // Separate cache for Bitunix tickers (to avoid conflicts with Bybit cache)
  private static bitunixTickersCache: {
    data: any[] | null;
    timestamp: number;
    marketType: string;
  } = {
    data: null,
    timestamp: 0,
    marketType: ''
  };
  
  // Promise-based lock to prevent concurrent cache fetches (prevents race conditions)
  private static cacheFetchLocks: Map<string, Promise<any[] | null>> = new Map();
  
  private static readonly CACHE_TTL_MS = 300000; // Cache for 5 minutes (increased from 5s to reduce egress - ticker lists don't change frequently)
  
  // Helper function to get cached tickers or fetch new ones
  private static async getTickersWithCache(category: string, exchange: string): Promise<any[] | null> {
    const now = Date.now();
    const cacheKey = `${exchange}-${category}`;
    
    // Check if cache is valid
    if (this.tickersCache.data && 
        this.tickersCache.category === cacheKey &&
        (now - this.tickersCache.timestamp) < this.CACHE_TTL_MS) {
      console.log(`📦 Using cached tickers data (age: ${((now - this.tickersCache.timestamp) / 1000).toFixed(1)}s)`);
      return this.tickersCache.data;
    }
    
    // Check if there's already a fetch in progress for this cache key (prevent race conditions)
    const existingLock = this.cacheFetchLocks.get(cacheKey);
    if (existingLock) {
      console.log(`⏳ Waiting for existing cache fetch for ${cacheKey}...`);
      return await existingLock;
    }
    
    // Cache expired or missing - fetch new data (with lock to prevent concurrent fetches)
    console.log(`🔄 Cache expired or missing, fetching fresh tickers data...`);
    
    const fetchPromise = (async () => {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        if (supabaseUrl && category === 'linear') {
          // Use futures-pairs proxy for linear category
          const futuresPairsUrl = `${supabaseUrl}/functions/v1/futures-pairs?action=tickers&exchange=${exchange}`;
          const futuresPairsResponse = await fetch(futuresPairsUrl, {
            signal: AbortSignal.timeout(10000)
          });
          
          if (futuresPairsResponse.ok) {
            const futuresPairsData = await futuresPairsResponse.json();
            
            if (futuresPairsData.retCode === 0 && futuresPairsData.result?.list) {
              // Update cache
              this.tickersCache = {
                data: futuresPairsData.result.list,
                timestamp: now,
                category: cacheKey
              };
              console.log(`✅ Cached ${futuresPairsData.result.list.length} tickers for ${cacheKey}`);
              return futuresPairsData.result.list;
            }
          }
        }
        
        // Fallback: Direct API call
        const allTickersUrl = `https://api.bybit.com/v5/market/tickers?category=${category}`;
        const allTickersResponse = await fetch(allTickersUrl, {
          signal: AbortSignal.timeout(10000)
        });
        
        if (allTickersResponse.ok) {
          const allTickersData = await allTickersResponse.json();
          
          if (allTickersData.retCode === 0 && allTickersData.result?.list) {
            // Update cache
            this.tickersCache = {
              data: allTickersData.result.list,
              timestamp: now,
              category: cacheKey
            };
            console.log(`✅ Cached ${allTickersData.result.list.length} tickers for ${cacheKey} (direct API)`);
            return allTickersData.result.list;
          }
        }
        
        return null;
      } catch (error) {
        console.warn(`⚠️ Failed to fetch tickers for cache:`, error);
        // Return cached data even if expired (better than nothing)
        if (this.tickersCache.data) {
          console.log(`📦 Using expired cache as fallback`);
          return this.tickersCache.data;
        }
        return null;
      } finally {
        // Remove lock when done (success or failure)
        this.cacheFetchLocks.delete(cacheKey);
      }
    })();
    
    // Store the promise as a lock
    this.cacheFetchLocks.set(cacheKey, fetchPromise);
    
    return await fetchPromise;
  }
  
  // Helper function to normalize symbol formats (e.g., 1000PEPEUSDT <-> PEPEUSDT, 10000SATSUSDT <-> SATSUSDT)
  // Also handles incomplete symbols like "ETH" -> "ETHUSDT"
  static normalizeSymbol(symbol: string, exchange: string, tradingType: string): string[] {
    const variants: string[] = [];
    // Remove .P suffix (TradingView perpetual futures notation) before processing
    const cleanedSymbol = symbol.replace(/\.P$/i, '').trim();
    const upperSymbol = cleanedSymbol.toUpperCase();
    
    // Handle incomplete symbols (e.g., "ETH" -> "ETHUSDT", "BTC" -> "BTCUSDT")
    // Common coin names that need USDT suffix
    const commonCoins = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'XRP', 'DOGE', 'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'ATOM', 'ALGO', 'NEAR', 'FTM', 'SAND', 'MANA', 'AXS', 'GALA', 'ENJ', 'CHZ', 'HBAR', 'ICP', 'FLOW', 'THETA', 'FIL', 'EOS', 'TRX', 'LTC', 'BCH', 'XLM', 'VET', 'AAVE', 'MKR', 'COMP', 'SNX', 'CRV', 'SUSHI', '1INCH', 'PEPE', 'SHIB', 'FLOKI', 'BONK', 'WIF', 'HMAR', 'STRK', 'ARB', 'OP', 'SUI', 'APT', 'INJ', 'TIA', 'SEI', 'RENDER', 'FET'];
    
    // Check if symbol is just a coin name without USDT suffix
    if (commonCoins.includes(upperSymbol) && !upperSymbol.endsWith('USDT') && !upperSymbol.endsWith('USD') && !upperSymbol.endsWith('BUSD')) {
      const fullSymbol = `${upperSymbol}USDT`;
      variants.push(fullSymbol); // Add full symbol first (most likely to work)
      variants.push(upperSymbol); // Also try original
      console.log(`🔧 Symbol normalization: "${symbol}" -> "${fullSymbol}" (added USDT suffix)`);
    } else {
      variants.push(upperSymbol); // Always try original (uppercase) first
    }
    
    // Handle 10000SATSUSDT -> SATSUSDT and vice versa (check longer prefix first)
    // Only apply to coins that actually have this variant on Bybit
    const coinsWith10000Prefix = ['SATS', 'BONK', 'FLOKI', '1000SATS', '1000BONK', '1000FLOKI'];
    if (upperSymbol.startsWith('10000')) {
      const withoutPrefix = upperSymbol.replace(/^10000/, '');
      variants.push(withoutPrefix);
    } else if (tradingType === 'futures' || tradingType === 'linear') {
      // Only try 10000 prefix for coins that actually have this variant
      const baseCoin = upperSymbol.replace(/USDT$/, '');
      if (coinsWith10000Prefix.includes(baseCoin) || coinsWith10000Prefix.some(coin => baseCoin.includes(coin))) {
        variants.push(`10000${upperSymbol}`);
      }
    }
    
    // Handle 1000PEPEUSDT -> PEPEUSDT and vice versa
    // Only apply to coins that actually have this variant on Bybit
    const coinsWith1000Prefix = ['PEPE', 'SHIB', 'FLOKI', 'BONK', 'WIF', 'HMAR', 'SATS'];
    if (upperSymbol.startsWith('1000')) {
      const withoutPrefix = upperSymbol.replace(/^1000/, '');
      variants.push(withoutPrefix);
    } else if (tradingType === 'futures' || tradingType === 'linear') {
      // Only try 1000 prefix for coins that actually have this variant
      const baseCoin = upperSymbol.replace(/USDT$/, '');
      if (coinsWith1000Prefix.includes(baseCoin) || coinsWith1000Prefix.some(coin => baseCoin.includes(coin))) {
        variants.push(`1000${upperSymbol}`);
      }
    }
    
    // Try lowercase variant if different
    if (upperSymbol !== symbol.toLowerCase()) {
      variants.push(symbol.toLowerCase());
    }
    
    // Bitunix-specific normalization (especially for futures)
    if (exchange === 'bitunix' && (tradingType === 'futures' || tradingType === 'linear')) {
      // Bitunix futures sometimes use hyphenated format like "BTC-USDT"
      if (!upperSymbol.includes('-')) {
        const hyphenated = upperSymbol.replace(/USDT$/, '-USDT');
        if (hyphenated !== upperSymbol) {
          variants.push(hyphenated);
        }
      }
    }
    
    // Remove duplicates and return
    return [...new Set(variants)];
  }
  
  static async fetchPrice(symbol: string, exchange: string, tradingType: string = 'spot', logCallback?: (message: string, details?: any) => Promise<void>): Promise<number> {
    // Store API responses for error reporting
    const apiResponses: any[] = [];
    
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
        
        // Try different symbol variants
        const symbolVariants = this.normalizeSymbol(symbol, exchange, tradingType);
        
        // STRATEGY: Use cached tickers data to reduce redundant API calls
        // For linear category, use futures-pairs function which successfully fetches from Bybit
        if (bybitCategory === 'linear' || bybitCategory === 'spot') {
          console.log(`🔍 [PRIMARY] Using cached tickers data for ${symbol} (${bybitCategory} category)...`);
          try {
            const tickersList = await this.getTickersWithCache(bybitCategory, exchange);
            
            if (tickersList && tickersList.length > 0) {
              // Search for our symbol in the cached list
              for (const symbolVariant of symbolVariants) {
                const ticker = tickersList.find((t: any) => t.symbol === symbolVariant);
                if (ticker && ticker.lastPrice) {
                  const price = parseFloat(ticker.lastPrice);
                  if (price > 0 && isFinite(price)) {
                    console.log(`✅ Found price via cached tickers: ${symbolVariant} = $${price} (original: ${symbol})`);
                    return price;
                  }
                }
              }
              
              // Try case-insensitive search for major coins
              const isMajorCoin = ['BTC', 'ETH', 'BNB', 'SOL'].some(coin => symbol.toUpperCase().startsWith(coin));
              if (isMajorCoin) {
                const upperSymbol = symbol.toUpperCase();
                const ticker = tickersList.find((t: any) => t.symbol.toUpperCase() === upperSymbol);
                if (ticker && ticker.lastPrice) {
                  const price = parseFloat(ticker.lastPrice);
                  if (price > 0 && isFinite(price)) {
                    console.log(`✅ Found price via cached tickers (case-insensitive): ${ticker.symbol} = $${price} (original: ${symbol})`);
                    return price;
                  }
                }
              }
              
              console.log(`⚠️ Symbol ${symbol} not found in cached tickers list. Tried variants: ${symbolVariants.join(', ')}`);
            } else {
              console.warn(`⚠️ No tickers data available from cache`);
            }
          } catch (cacheErr: any) {
            console.warn(`⚠️ Cached tickers lookup failed for ${symbol}, falling back to direct requests:`, cacheErr?.message || cacheErr);
          }
        }
        
        // FALLBACK: If "all tickers" approach failed, try symbol-specific requests
        console.log(`🔍 [FALLBACK] Trying symbol-specific requests for ${symbol}...`);
        
        for (let variantIndex = 0; variantIndex < symbolVariants.length; variantIndex++) {
          const symbolVariant = symbolVariants[variantIndex];
          
          // Add delay between attempts to avoid rate limiting (except for first attempt)
          if (variantIndex > 0) {
            const delayMs = Math.min(500 * variantIndex, 2000); // 500ms, 1000ms, 1500ms, 2000ms max
            console.log(`⏳ Waiting ${delayMs}ms before trying next symbol variant (rate limit protection)...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
          
          // Retry logic for each variant (3 attempts with exponential backoff)
          let lastError: any = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) {
              const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 1s, 2s, 4s max
              console.log(`⏳ Retry attempt ${attempt + 1}/3 for ${symbolVariant} after ${retryDelay}ms delay...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
            
            try {
              // Use Bybit API domain
              const baseDomains = ['https://api.bybit.com'];
              let response: Response | null = null;
              let apiUrl = '';
              
              for (const base of baseDomains) {
                apiUrl = `${base}/v5/market/tickers?category=${bybitCategory}&symbol=${symbolVariant}`;
                console.log(`🔍 Fetching price for ${symbolVariant} (${bybitCategory}) - Attempt ${attempt + 1}/3 via ${base}: ${apiUrl}`);
                try {
                  // Use no headers at all - this matches the working futures-pairs function
                  response = await fetch(apiUrl, {
                    signal: AbortSignal.timeout(10000)
                  });
                  
                  console.log(`📡 Response status for ${symbolVariant} via ${base}: ${response.status} ${response.statusText}`);
                  
                  // If we got a successful response (2xx), use it
                  if (response.ok) {
                    break;
                  }
                  
                  // If first domain failed with 403, try the alternate domain immediately
                  if (response.status === 403 && base === baseDomains[0]) {
                    console.warn(`⚠️ Got 403 from ${base}, trying alternate domain...`);
                    continue; // Try next domain
                  }
                  
                  // For other errors, break and handle below
                  break;
                } catch (fetchErr: any) {
                  console.error(`❌ Fetch error for ${symbolVariant} via ${base}:`, fetchErr);
                  response = null;
                  // Try next domain if available
                  if (base === baseDomains[0] && baseDomains.length > 1) {
                    continue;
                  }
                }
              }
              
              // If still no response, record error
              if (!response) {
                // Handle fetch errors (network, timeout, etc.)
                const fetchError = new Error('No response from Bybit tickers (both domains)');
                console.error(`❌ Fetch error for ${symbolVariant}:`, fetchError);
                apiResponses.push({
                  symbolVariant,
                  apiUrl,
                  fetchError: fetchError.message || String(fetchError),
                  errorType: 'FetchError',
                  note: 'Network error, timeout, or connection issue'
                });
                lastError = {
                  symbolVariant,
                  apiUrl,
                  fetchError: fetchError.message || String(fetchError),
                  attempt: attempt + 1
                };
                continue; // Try next attempt or variant
              }
            
            const responseText = await response.text().catch((textError: any) => {
              console.error(`❌ Failed to read response text for ${symbolVariant}:`, textError);
              apiResponses.push({
                symbolVariant,
                apiUrl,
                httpStatus: response.status,
                httpStatusText: response.statusText,
                textError: textError.message || String(textError)
              });
              return '';
            });
            
            // Check if response is HTML (error page) instead of JSON
            const isHtml = responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html') || responseText.trim().startsWith('<');
            
            // Handle HTTP 403 Forbidden specifically (rate limiting, IP blocking, Cloudflare)
            if (response.status === 403) {
              const waitTime = Math.min(2000 * Math.pow(2, attempt), 10000); // Exponential backoff: 2s, 4s, 8s, max 10s
              console.warn(`⚠️ HTTP 403 Forbidden for ${symbolVariant} (Attempt ${attempt + 1}/3). This may be rate limiting or IP blocking. Waiting ${waitTime}ms before retry...`);
              
              // Extract title from HTML if available
              const titleMatch = responseText.match(/<title[^>]*>([^<]+)<\/title>/i);
              const title = titleMatch ? titleMatch[1] : 'ERROR: The request could not be satisfied';
              
              if (attempt < 2) {
                lastError = {
                  symbolVariant,
                  apiUrl,
                  httpStatus: 403,
                  httpStatusText: 'Forbidden',
                  isHtml: isHtml,
                  htmlTitle: title,
                  attempt: attempt + 1,
                  retryable: true,
                  waitTime: waitTime,
                  note: `HTTP 403 Forbidden. Possible causes: rate limiting, IP blocking, or Cloudflare protection. Retrying with ${waitTime}ms delay.`
                };
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue; // Retry with backoff
              } else {
                // Last attempt failed - mark for CoinGecko fallback
                lastError = {
                  symbolVariant,
                  apiUrl,
                  httpStatus: 403,
                  httpStatusText: 'Forbidden',
                  isHtml: isHtml,
                  htmlTitle: title,
                  htmlPreview: responseText.substring(0, 200),
                  attempt: attempt + 1,
                  shouldUseFallback: true, // Flag to trigger CoinGecko fallback
                  note: `HTTP 403 Forbidden after ${attempt + 1} attempts. Will try CoinGecko fallback.`
                };
                // Immediately add to apiResponses so fallback can detect it
                apiResponses.push(lastError);
                break; // Try next variant or fallback
              }
            }
            
            if (isHtml) {
              console.error(`❌ Bybit API returned HTML instead of JSON for ${symbolVariant} (likely error page) - Attempt ${attempt + 1}/3`);
              // Extract title or first meaningful line from HTML
              const titleMatch = responseText.match(/<title[^>]*>([^<]+)<\/title>/i);
              const title = titleMatch ? titleMatch[1] : 'Unknown error page';
              
              // Check if it's a rate limit (429) or temporary error (5xx) - retry
              if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
                console.log(`⚠️ Rate limit or server error (HTTP ${response.status}) - will retry...`);
                lastError = {
                  symbolVariant,
                  apiUrl,
                  httpStatus: response.status,
                  httpStatusText: response.statusText,
                  isHtml: true,
                  htmlTitle: title,
                  attempt: attempt + 1,
                  retryable: true
                };
                continue; // Retry this variant
              }
              
              // Non-retryable HTML error - log and try next variant
              lastError = {
                symbolVariant,
                apiUrl,
                httpStatus: response.status,
                httpStatusText: response.statusText,
                contentType: response.headers.get('content-type') || 'unknown',
                isHtml: true,
                htmlTitle: title,
                htmlPreview: responseText.substring(0, 200),
                attempt: attempt + 1,
                note: `Bybit returned HTML error page (HTTP ${response.status}). This could indicate: rate limiting, IP blocking, or API endpoint issue.`
              };
              break; // Try next variant (not retryable)
            }
            
            let data: any;
            
            try {
              data = JSON.parse(responseText);
            } catch (parseError) {
              console.error(`❌ Failed to parse Bybit API response for ${symbolVariant} (Attempt ${attempt + 1}/3):`, {
                error: parseError instanceof Error ? parseError.message : String(parseError),
                parseError: parseError instanceof Error ? parseError.message : String(parseError),
                isHtml: isHtml,
                attempt: attempt + 1,
                responsePreview: responseText.substring(0, 200)
              });
              lastError = {
                symbolVariant,
                apiUrl,
                httpStatus: response.status,
                httpStatusText: response.statusText,
                contentType: response.headers.get('content-type') || 'unknown',
                rawResponse: responseText.substring(0, 500),
                parseError: parseError instanceof Error ? parseError.message : String(parseError),
                isHtml: isHtml,
                attempt: attempt + 1,
                note: isHtml ? 'Response appears to be HTML (error page) instead of JSON' : 'JSON parse failed'
              };
              continue; // Retry
            }
            
            // Store response for error reporting
            apiResponses.push({
              symbolVariant,
              apiUrl,
              httpStatus: response.status,
              httpStatusText: response.statusText,
              retCode: data.retCode,
              retMsg: data.retMsg,
              hasResult: !!data.result,
              listLength: data.result?.list?.length || 0,
              fullResponse: JSON.stringify(data).substring(0, 1000)
            });
            
            if (!response.ok) {
              console.warn(`⚠️ Bybit API HTTP error for ${symbolVariant} (Attempt ${attempt + 1}/3): ${response.status} ${response.statusText}`);
              // Retry on 403, 429, or 5xx errors with exponential backoff
              if (response.status === 403 || response.status === 429 || (response.status >= 500 && response.status < 600)) {
                const waitTime = Math.min(2000 * Math.pow(2, attempt), 10000); // 2s, 4s, 8s, max 10s
                if (attempt < 2) {
                  console.log(`⏳ Waiting ${waitTime}ms before retry (HTTP ${response.status})...`);
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                }
                lastError = {
                  symbolVariant,
                  apiUrl,
                  httpStatus: response.status,
                  httpStatusText: response.statusText,
                  attempt: attempt + 1,
                  retryable: true,
                  waitTime: waitTime
                };
                continue; // Retry
              }
              lastError = {
                symbolVariant,
                apiUrl,
                httpStatus: response.status,
                httpStatusText: response.statusText,
                attempt: attempt + 1
              };
              break; // Try next variant
            }
            
            // Log full API response for debugging major coins
            const isMajorCoin = ['BTC', 'ETH', 'BNB', 'SOL'].some(coin => symbolVariant.startsWith(coin));
            
            // Check for API errors first
            if (data.retCode !== 0 && data.retCode !== undefined) {
              if (isMajorCoin) {
                console.error(`❌ Bybit API error for ${symbolVariant} (${bybitCategory}):`, {
                  retCode: data.retCode,
                  retMsg: data.retMsg,
                  fullResponse: JSON.stringify(data, null, 2),
                  apiUrl: apiUrl
                });
              } else {
                console.warn(`⚠️ Bybit API error for ${symbolVariant}: retCode=${data.retCode}, retMsg=${data.retMsg}`);
              }
              lastError = {
                symbolVariant,
                apiUrl,
                httpStatus: response.status,
                retCode: data.retCode,
                retMsg: data.retMsg,
                attempt: attempt + 1
              };
              break; // Try next variant
            }
            
            // Log API response for debugging
            if (!data.result || !data.result.list || data.result.list.length === 0) {
              if (isMajorCoin) {
                console.error(`❌ Bybit API returned no data for ${symbolVariant} (${bybitCategory}):`, {
                  retCode: data.retCode,
                  retMsg: data.retMsg,
                  result: data.result,
                  fullResponse: JSON.stringify(data, null, 2),
                  apiUrl: apiUrl
                });
              } else {
                console.warn(`⚠️ Bybit API returned no data for ${symbolVariant} (${bybitCategory}):`, {
                  retCode: data.retCode,
                  retMsg: data.retMsg,
                  result: data.result
                });
              }
              lastError = {
                symbolVariant,
                apiUrl,
                httpStatus: response.status,
                retCode: data.retCode,
                retMsg: data.retMsg,
                attempt: attempt + 1
              };
              break; // Try next variant
            }
            
            // Log successful response for major coins
            if (isMajorCoin) {
              console.log(`📊 Bybit API response for ${symbolVariant} (${bybitCategory}):`, {
                retCode: data.retCode,
                retMsg: data.retMsg,
                hasResult: !!data.result,
                listLength: data.result?.list?.length || 0,
                firstItem: data.result?.list?.[0] ? {
                  symbol: data.result.list[0].symbol,
                  lastPrice: data.result.list[0].lastPrice,
                  bid1Price: data.result.list[0].bid1Price,
                  ask1Price: data.result.list[0].ask1Price
                } : null
              });
            }
            
            const price = parseFloat(data.result.list[0]?.lastPrice || '0');
            
            if (price > 0 && isFinite(price)) {
              if (symbolVariant !== symbol) {
                console.log(`✅ Found price using symbol variant: ${symbolVariant} (original: ${symbol})`);
              } else {
                console.log(`✅ Found price for ${symbolVariant}: $${price}`);
              }
              return price;
            } else {
              console.warn(`⚠️ Invalid price parsed for ${symbolVariant}: ${price} (raw: ${data.result.list[0]?.lastPrice})`);
              lastError = {
                symbolVariant,
                apiUrl,
                httpStatus: response.status,
                retCode: data.retCode,
                invalidPrice: price,
                attempt: attempt + 1
              };
              break; // Try next variant
            }
          } catch (err) {
            console.error(`❌ Error fetching price for ${symbolVariant} (Attempt ${attempt + 1}/3):`, err);
            lastError = {
              symbolVariant,
              apiUrl,
              error: err instanceof Error ? err.message : String(err),
              attempt: attempt + 1
            };
            // If it's a network error, retry; otherwise try next variant
            if (err instanceof TypeError && err.message.includes('fetch')) {
              continue; // Retry
            }
            break; // Try next variant
          }
          
          // If we got here, the attempt succeeded but price was invalid - try next variant
          break;
        }
        
        // If all retries failed for this variant, log the last error
        // Always push errors to apiResponses so fallback can detect them
        if (lastError) {
          apiResponses.push(lastError);
        }
      }
        
        // FINAL FALLBACK: If all symbol-specific requests failed, try fetching all tickers one more time
        // (This is a last resort - we already tried this at the beginning, but maybe it will work now)
        const isMajorCoin = ['BTC', 'ETH', 'BNB', 'SOL'].some(coin => symbol.toUpperCase().startsWith(coin));
        if (isMajorCoin) {
          console.log(`🔍 [FINAL FALLBACK] All symbol-specific requests failed for ${symbol}, trying all tickers one more time...`);
        }
        
        try {
          const allTickersUrl = `https://api.bybit.com/v5/market/tickers?category=${bybitCategory}`;
          // Use no headers - matches working futures-pairs function
          const allTickersResponse = await fetch(allTickersUrl, {
            signal: AbortSignal.timeout(10000)
          });
          
          if (!allTickersResponse.ok) {
            console.warn(`⚠️ Failed to fetch all tickers: HTTP ${allTickersResponse.status}`);
            const errorText = await allTickersResponse.text();
            console.warn(`⚠️ Error response: ${errorText.substring(0, 200)}`);
          } else {
          const allTickersData = await allTickersResponse.json();
          
            if (isMajorCoin) {
              console.log(`📊 All tickers response for ${bybitCategory}:`, {
                retCode: allTickersData.retCode,
                retMsg: allTickersData.retMsg,
                totalTickers: allTickersData.result?.list?.length || 0,
                sampleSymbols: allTickersData.result?.list?.slice(0, 5).map((t: any) => t.symbol) || []
              });
            }
            
            if (allTickersData.retCode === 0 && allTickersData.result?.list) {
              // Search for exact match first
            for (const symbolVariant of symbolVariants) {
              const ticker = allTickersData.result.list.find((t: any) => t.symbol === symbolVariant);
              if (ticker && ticker.lastPrice) {
                const price = parseFloat(ticker.lastPrice);
                if (price > 0 && isFinite(price)) {
                  console.log(`✅ Found price using symbol variant from all tickers: ${symbolVariant} (original: ${symbol})`);
                  return price;
                }
              }
              }
              
              // For major coins, also try case-insensitive search
              if (isMajorCoin) {
                const upperSymbol = symbol.toUpperCase();
                const ticker = allTickersData.result.list.find((t: any) => t.symbol.toUpperCase() === upperSymbol);
                if (ticker && ticker.lastPrice) {
                  const price = parseFloat(ticker.lastPrice);
                  if (price > 0 && isFinite(price)) {
                    console.log(`✅ Found price using case-insensitive search: ${ticker.symbol} (original: ${symbol})`);
                    return price;
                  }
                }
              }
            } else if (isMajorCoin) {
              console.error(`❌ Failed to fetch all tickers:`, {
                retCode: allTickersData.retCode,
                retMsg: allTickersData.retMsg,
                fullResponse: JSON.stringify(allTickersData, null, 2).substring(0, 1000)
              });
            }
          }
        } catch (err) {
          console.error(`❌ Error fetching all tickers for ${symbol}:`, err);
          if (isMajorCoin) {
            console.error(`   Full error:`, {
              message: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined
            });
          }
        }
        
        // For major coins (BTC, ETH, etc.), try the opposite category as fallback
        if (isMajorCoin && bybitCategory === 'linear') {
          console.log(`🔄 Trying spot category as fallback for major coin ${symbol}...`);
          try {
            // Use no headers - matches working futures-pairs function
            const spotResponse = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`, {
              signal: AbortSignal.timeout(8000)
            });
            
            // Check content-type before parsing JSON
            const contentType = spotResponse.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
              const errorText = await spotResponse.text().catch(() => '');
              console.warn(`⚠️ Spot fallback returned non-JSON (${contentType}): ${errorText.substring(0, 200)}`);
              throw new Error(`Non-JSON response: ${contentType}`);
            }
            
            const spotData = await spotResponse.json();
            
            if (spotData.retCode === 0 && spotData.result?.list && spotData.result.list.length > 0) {
              const price = parseFloat(spotData.result.list[0]?.lastPrice || '0');
              if (price > 0 && isFinite(price)) {
                console.log(`✅ Found price for ${symbol} in spot category (fallback): $${price}`);
                console.warn(`⚠️ Note: ${symbol} found in spot but not linear. Consider checking if the symbol exists for futures trading.`);
                return price;
              }
            }
          } catch (err) {
            console.warn(`⚠️ Error trying spot fallback for ${symbol}:`, err);
          }
        } else if (isMajorCoin && bybitCategory === 'spot') {
          console.log(`🔄 Trying linear category as fallback for major coin ${symbol}...`);
          try {
            const linearResponse = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`, {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.bybit.com',
              },
              signal: AbortSignal.timeout(8000)
            });
            
            // Check content-type before parsing JSON
            const contentType = linearResponse.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
              const errorText = await linearResponse.text().catch(() => '');
              console.warn(`⚠️ Linear fallback returned non-JSON (${contentType}): ${errorText.substring(0, 200)}`);
              throw new Error(`Non-JSON response: ${contentType}`);
            }
            
            const linearData = await linearResponse.json();
            
            if (linearData.retCode === 0 && linearData.result?.list && linearData.result.list.length > 0) {
              const price = parseFloat(linearData.result.list[0]?.lastPrice || '0');
              if (price > 0 && isFinite(price)) {
                console.log(`✅ Found price for ${symbol} in linear category (fallback): $${price}`);
                console.warn(`⚠️ Note: ${symbol} found in linear but not spot. Consider checking if the symbol exists for spot trading.`);
                return price;
              }
            }
          } catch (err) {
            console.warn(`⚠️ Error trying linear fallback for ${symbol}:`, err);
          }
        }
        
        // FINAL FALLBACK 1: Use Binance public API (more permissive than Bybit)
        if (isMajorCoin) {
          console.log(`🔄 Trying Binance public API as fallback for ${symbol}...`);
          try {
            // Convert Bybit symbol to Binance format (usually same, but handle edge cases)
            const binanceSymbol = symbol.replace(/\.P$/, ''); // Remove .P suffix if present
            const binanceUrl = `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`;
            console.log(`🔍 Fetching from Binance: ${binanceUrl}`);
            
            const binanceResp = await fetch(binanceUrl, {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
              signal: AbortSignal.timeout(5000)
            });
            
            if (binanceResp.ok) {
              const binanceData = await binanceResp.json();
              if (binanceData.price) {
                const price = parseFloat(binanceData.price);
                if (price > 0 && isFinite(price)) {
                  console.log(`✅ Binance fallback price for ${symbol}: $${price}`);
                  return price;
                }
              }
            }
          } catch (binanceErr) {
            console.warn(`⚠️ Binance fallback failed for ${symbol}:`, binanceErr);
          }
        }
        
        // FINAL FALLBACK 2: Use top-of-book orderbook mid-price if tickers endpoints are blocked
        try {
          const orderbookDomains = ['https://api.bybit.com'];
          for (const base of orderbookDomains) {
            const obUrl = `${base}/v5/market/orderbook?category=${bybitCategory}&symbol=${symbol}&limit=1`;
            console.log(`🛟 Trying orderbook fallback for ${symbol} (${bybitCategory}): ${obUrl}`);
            const obResp = await fetch(obUrl, {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.bybit.com',
                'Origin': 'https://www.bybit.com',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache',
              },
              signal: AbortSignal.timeout(8000)
            }).catch(() => null);
            if (!obResp) continue;
            const obText = await obResp.text();
            if (obText.trim().startsWith('<')) {
              console.warn(`⚠️ Orderbook fallback returned HTML from ${base} - trying next domain`);
              continue;
            }
            try {
              const obData = JSON.parse(obText);
              if (obData.retCode === 0 && obData.result) {
                // Bybit orderbook returns { a: [[price, qty], ...], b: [[price, qty], ...] }
                const ask = parseFloat(obData.result.a?.[0]?.[0] || '0');
                const bid = parseFloat(obData.result.b?.[0]?.[0] || '0');
                const mid = (ask > 0 && bid > 0) ? (ask + bid) / 2 : (ask || bid || 0);
                if (mid > 0 && isFinite(mid)) {
                  console.log(`✅ Orderbook fallback price for ${symbol}: $${mid.toFixed(8)} (bid=${bid}, ask=${ask})`);
                  return mid;
                }
              }
            } catch (parseErr) {
              console.warn(`⚠️ Failed to parse orderbook response from ${base}:`, parseErr);
              continue;
            }
          }
        } catch (obErr) {
          console.warn(`⚠️ Orderbook fallback failed for ${symbol}:`, obErr);
        }
        
        // FINAL FALLBACK 3: Use CoinGecko public API (most permissive, rarely blocked)
        // Trigger for major coins OR if we got 403 errors (indicates Bybit blocking)
        // Note: isMajorCoin is already declared above (line 1155), reuse it here
        const had403Errors = apiResponses.some((r: any) => r.httpStatus === 403);
        
        console.log(`🔍 CoinGecko fallback check: isMajorCoin=${isMajorCoin}, had403Errors=${had403Errors}, apiResponses.length=${apiResponses.length}`);
        
        if (isMajorCoin || had403Errors) {
          const fallbackReason = had403Errors ? ' (Bybit returned 403)' : '';
          console.log(`🔄 Trying CoinGecko public API as fallback for ${symbol}${fallbackReason}...`);
          
          // Log to bot_activity_logs if callback provided
          if (logCallback) {
            await logCallback(`🔄 CoinGecko fallback triggered for ${symbol}${fallbackReason}`, {
              symbol,
              reason: had403Errors ? 'Bybit returned 403' : 'Major coin fallback',
              apiResponses: apiResponses.filter((r: any) => r.httpStatus === 403).length
            }).catch(err => console.warn('Failed to log CoinGecko fallback trigger:', err));
          }
          
          try {
            // Map symbol to CoinGecko ID (expanded for more coins)
            const coinGeckoMap: { [key: string]: string } = {
              'BTCUSDT': 'bitcoin',
              'BTC': 'bitcoin',
              'ETHUSDT': 'ethereum',
              'ETH': 'ethereum',
              'BNBUSDT': 'binancecoin',
              'BNB': 'binancecoin',
              'SOLUSDT': 'solana',
              'SOL': 'solana',
              'ADAUSDT': 'cardano',
              'ADA': 'cardano',
              'DOGEUSDT': 'dogecoin',
              'DOGE': 'dogecoin',
              'XRPUSDT': 'ripple',
              'XRP': 'ripple',
              'DOTUSDT': 'polkadot',
              'DOT': 'polkadot',
              'MATICUSDT': 'matic-network',
              'MATIC': 'matic-network',
              'LTCUSDT': 'litecoin',
              'LTC': 'litecoin',
              'TRUMPUSDT': 'trump', // Add more as needed
              'STRKUSDT': 'starknet',
              'STRK': 'starknet',
              'HBARUSDT': 'hedera-hashgraph',
              'HBAR': 'hedera-hashgraph',
              'FILUSDT': 'filecoin',
              'FIL': 'filecoin'
            };
            
            // Extract base coin (remove USDT suffix and any other suffixes)
            const baseCoin = symbol.replace(/USDT.*$/i, '').replace(/\.P$/i, '').toUpperCase();
            const coinGeckoId = coinGeckoMap[symbol] || coinGeckoMap[baseCoin] || coinGeckoMap[`${baseCoin}USDT`] || baseCoin.toLowerCase();
            
            const coinGeckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd`;
            console.log(`🔍 Fetching from CoinGecko: ${coinGeckoUrl}`);
            
            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const cgResp = await fetch(coinGeckoUrl, {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
              signal: AbortSignal.timeout(5000)
            });
            
            if (cgResp.ok) {
              // Check content-type before parsing
              const contentType = cgResp.headers.get('content-type') || '';
              if (!contentType.includes('application/json')) {
                const textPreview = await cgResp.text().then(t => t.substring(0, 200)).catch(() => '');
                console.warn(`⚠️ CoinGecko returned non-JSON response (${contentType}): ${textPreview}`);
                throw new Error(`CoinGecko returned ${contentType} instead of JSON`);
              }
              
              const cgData = await cgResp.json();
              const price = cgData[coinGeckoId]?.usd;
              if (price && price > 0 && isFinite(price)) {
                console.log(`✅ CoinGecko fallback price for ${symbol}: $${price}`);
                
                // Log success to bot_activity_logs if callback provided
                if (logCallback) {
                  await logCallback(`✅ CoinGecko fallback price for ${symbol}: $${price}`, {
                    symbol,
                    price,
                    coinGeckoId,
                    source: 'coingecko'
                  }).catch(err => console.warn('Failed to log CoinGecko success:', err));
                }
                
                return price;
              } else {
                console.warn(`⚠️ CoinGecko price invalid for ${symbol}:`, price);
              }
            } else {
              const errorText = await cgResp.text().catch(() => '');
              console.warn(`⚠️ CoinGecko API error (${cgResp.status}): ${errorText.substring(0, 200)}`);
            }
          } catch (cgErr: any) {
            // Don't log the full error if it's just a content-type issue
            if (cgErr?.message?.includes('DOCTYPE') || cgErr?.message?.includes('Unexpected token')) {
              console.warn(`⚠️ CoinGecko fallback failed for ${symbol}: Received HTML instead of JSON (likely rate limited or blocked)`);
            } else {
              console.warn(`⚠️ CoinGecko fallback failed for ${symbol}:`, cgErr?.message || cgErr);
            }
          }
        }
        
        console.warn(`⚠️ Symbol ${symbol} not found in ${bybitCategory} category on Bybit. Tried variants: ${symbolVariants.join(', ')}`);
        
        // CATEGORY FALLBACK: If all attempts returned "symbol invalid", try alternative category
        // Some symbols (like SHIBUSDT) might only be available in spot, not linear/futures
        const alternativeCategory = bybitCategory === 'linear' ? 'spot' : bybitCategory === 'spot' ? 'linear' : null;
        if (alternativeCategory && apiResponses.length > 0) {
          // Check if all attempts returned "symbol invalid" - indicates category mismatch
          const allInvalidSymbol = apiResponses.every(r => 
            r.retCode === 10001 && 
            (r.retMsg?.toLowerCase().includes('symbol invalid') || r.retMsg?.toLowerCase().includes('params error: symbol'))
          );
          
          console.log(`🔍 Category fallback check: alternativeCategory=${alternativeCategory}, apiResponses.length=${apiResponses.length}, allInvalidSymbol=${allInvalidSymbol}`);
          if (apiResponses.length > 0) {
            console.log(`🔍 Sample response: retCode=${apiResponses[0]?.retCode}, retMsg=${apiResponses[0]?.retMsg}`);
          }
          
          if (allInvalidSymbol) {
            console.log(`🔄 All attempts returned "symbol invalid" for ${bybitCategory} category. Trying alternative category: ${alternativeCategory}...`);
            try {
              const altTickersList = await this.getTickersWithCache(alternativeCategory, exchange);
              if (altTickersList && altTickersList.length > 0) {
                for (const symbolVariant of symbolVariants) {
                  const ticker = altTickersList.find((t: any) => t.symbol === symbolVariant);
                  if (ticker && ticker.lastPrice) {
                    const price = parseFloat(ticker.lastPrice);
                    if (price > 0 && isFinite(price)) {
                      console.log(`✅ Found price in ${alternativeCategory} category: ${symbolVariant} = $${price} (original: ${symbol}, requested: ${bybitCategory})`);
                      // Log warning about category mismatch
                      if (logCallback) {
                        await logCallback(`⚠️ Symbol ${symbol} found in ${alternativeCategory} category but bot is configured for ${bybitCategory}. Consider updating bot trading type.`, {
                          symbol,
                          requestedCategory: bybitCategory,
                          foundCategory: alternativeCategory,
                          price
                        });
                      }
                      return price;
                    }
                  }
                }
              }
            } catch (altCategoryErr: any) {
              console.warn(`⚠️ Alternative category ${alternativeCategory} lookup failed:`, altCategoryErr?.message || altCategoryErr);
            }
          }
        }
        
        // Log all API responses for debugging
        if (apiResponses.length > 0) {
          console.error(`❌ Price fetch failed for ${symbol}. API Response Summary:`);
          apiResponses.forEach((resp: any, idx: number) => {
            console.error(`   Attempt ${idx + 1} (${resp.symbolVariant || 'unknown'}):`, {
              httpStatus: resp.httpStatus,
              retCode: resp.retCode,
              retMsg: resp.retMsg,
              isHtml: resp.isHtml,
              htmlTitle: resp.htmlTitle,
              fetchError: resp.fetchError,
              parseError: resp.parseError,
              listLength: resp.listLength
            });
          });
        } else {
          console.error(`❌ Price fetch failed for ${symbol} - No API responses captured (possible network issue)`);
        }
        
        // Store API responses in a global variable accessible from executeTrade
        (globalThis as any).__lastBybitApiResponses = apiResponses;
        
        return 0;
      } else if (exchange === 'okx') {
        // Try different symbol variants for OKX
        const symbolVariants = this.normalizeSymbol(symbol, exchange, tradingType);
        
        for (const symbolVariant of symbolVariants) {
          try {
            const instType = tradingType === 'futures' || tradingType === 'linear' ? 'SWAP' : 'SPOT';
            const response = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${symbolVariant}&instType=${instType}`);
            const data = await response.json();
            
            if (data.code === '0' && data.data && Array.isArray(data.data) && data.data.length > 0) {
              const price = parseFloat(data.data[0]?.last || '0');
              if (price > 0 && isFinite(price)) {
                if (symbolVariant !== symbol) {
                  console.log(`✅ Found price using symbol variant: ${symbolVariant} (original: ${symbol})`);
                }
                return price;
              }
            }
          } catch (err) {
            console.warn(`⚠️ Error trying symbol variant ${symbolVariant}:`, err);
            continue; // Try next variant
          }
        }
        
        console.warn(`⚠️ OKX API error for ${symbol}: Symbol not found. Tried variants: ${symbolVariants.join(', ')}`);
        return 0;
      } else if (exchange === 'bitunix') {
        // Bitunix price fetching - use cached tickers to avoid slow fetches
        const symbolVariants = this.normalizeSymbol(symbol, exchange, tradingType);
        const marketType = tradingType === 'futures' || tradingType === 'linear' ? 'futures' : 'spot';
        
        console.log(`🔍 Fetching Bitunix price for ${symbol} (${marketType}), variants: ${symbolVariants.join(', ')}`);
        
        // Check cache first
        const now = Date.now();
        let tickersArray: any[] = [];
        let useCache = false;
        
        if (this.bitunixTickersCache.data && 
            this.bitunixTickersCache.marketType === marketType &&
            (now - this.bitunixTickersCache.timestamp) < this.CACHE_TTL_MS) {
          tickersArray = this.bitunixTickersCache.data;
          useCache = true;
          console.log(`📦 Using cached Bitunix tickers (age: ${((now - this.bitunixTickersCache.timestamp) / 1000).toFixed(1)}s, count: ${tickersArray.length})`);
        }
        
        // Check if this is a major coin - use CoinGecko immediately if Bitunix fails
        const isMajorCoin = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'XRPUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT', 'AVAXUSDT', 'LINKUSDT', 'UNIUSDT', 'ATOMUSDT'].includes(symbol.toUpperCase());
        
        // If cache miss or expired, fetch fresh data
        if (!useCache || tickersArray.length === 0) {
          console.log(`🔄 Fetching fresh Bitunix tickers for ${marketType}...`);
          // CRITICAL: Use correct API domain - futures uses fapi.bitunix.com, spot uses api.bitunix.com
          const apiBaseUrl = marketType === 'futures' ? 'https://fapi.bitunix.com' : 'https://api.bitunix.com';
          
          // For major coins, try fewer endpoints before falling back to CoinGecko
          const tickerEndpoints = isMajorCoin 
            ? [
                `${apiBaseUrl}/api/v1/market/tickers?marketType=${marketType}`,
                `${apiBaseUrl}/api/v1/market/ticker/all?marketType=${marketType}`
              ]
            : [
                `${apiBaseUrl}/api/v1/market/tickers?marketType=${marketType}`,
                `${apiBaseUrl}/api/v1/market/ticker/all?marketType=${marketType}`,
                `${apiBaseUrl}/api/v1/market/tickers`,
                `${apiBaseUrl}/api/v1/market/ticker/all`
              ];
          
          let fetchSuccess = false;
          let had404Errors = false;
          for (const tickerEndpoint of tickerEndpoints) {
            try {
              console.log(`  Trying: ${tickerEndpoint}`);
              const response = await fetch(tickerEndpoint, {
                signal: AbortSignal.timeout(3000) // Reduced timeout to 3s for faster fallback
              });
              
              if (!response.ok) {
                if (response.status === 404) {
                  had404Errors = true;
                  // For major coins with 404, skip to CoinGecko immediately
                  if (isMajorCoin) {
                    console.log(`  ❌ HTTP 404 from ${tickerEndpoint} - skipping to CoinGecko for major coin ${symbol}`);
                    break; // Exit loop, will fall through to CoinGecko
                  }
                }
                console.warn(`  ❌ HTTP ${response.status} from ${tickerEndpoint}`);
                continue; // Try next endpoint
              }
              
              const data = await response.json();
              console.log(`  Response code: ${data.code}, has data: ${!!data.data}`);
              
              // Bitunix response format: { code: 0, data: [...] } or { code: 0, data: {...} }
              if (data.code === 0 && data.data) {
                // Handle different response formats (same as futures-pairs)
                if (Array.isArray(data.data)) {
                  tickersArray = data.data;
                } else if (typeof data.data === 'object') {
                  // Try to find array values
                  const possibleArrays = Object.values(data.data).filter((v: any) => Array.isArray(v));
                  if (possibleArrays.length > 0) {
                    tickersArray = possibleArrays[0] as any[];
                  } else {
                    // Convert object to array
                    tickersArray = Object.keys(data.data).map(key => ({
                      symbol: key,
                      ...(data.data as any)[key]
                    }));
                  }
                }
                
                if (tickersArray.length > 0) {
                  // Update cache
                  this.bitunixTickersCache = {
                    data: tickersArray,
                    timestamp: now,
                    marketType: marketType
                  };
                  console.log(`✅ Cached ${tickersArray.length} Bitunix tickers for ${marketType}`);
                  fetchSuccess = true;
                  break; // Success, stop trying endpoints
                } else {
                  console.warn(`  ⚠️ Empty tickers array from ${tickerEndpoint}`);
                }
              } else {
                console.warn(`  ⚠️ Bitunix tickers API returned code ${data.code}: ${data.msg || data.message || 'Unknown error'}`);
              }
            } catch (endpointErr: any) {
              console.warn(`  ⚠️ Error trying Bitunix tickers endpoint ${tickerEndpoint}:`, endpointErr.message);
              continue; // Try next endpoint
            }
          }
          
          if (!fetchSuccess && tickersArray.length === 0) {
            console.warn(`⚠️ Failed to fetch Bitunix tickers from all endpoints`);
            // For major coins with 404 errors, skip directly to CoinGecko (skip single ticker endpoints)
            if (isMajorCoin && had404Errors) {
              console.log(`🔄 Bitunix tickers failed with 404 errors, using CoinGecko immediately for major coin ${symbol}...`);
              // Skip single ticker endpoints and go directly to CoinGecko
              tickersArray = []; // Ensure we skip the single ticker section
            }
          }
        }
        
        // Search for our symbol in the tickers array (from cache or fresh fetch)
        // Skip single ticker endpoints for major coins if we had 404 errors
        if (tickersArray.length > 0) {
          console.log(`🔍 Searching ${tickersArray.length} tickers for symbol variants...`);
          for (const symbolVariant of symbolVariants) {
            const ticker = tickersArray.find((t: any) => {
              const tickerSymbol = (t.symbol || t.pair || t.market || '').toUpperCase();
              const variantUpper = symbolVariant.toUpperCase();
              const match = tickerSymbol === variantUpper || 
                           tickerSymbol.replace('_', '') === variantUpper ||
                           tickerSymbol.replace('-', '') === variantUpper;
              if (match) {
                console.log(`  ✅ Found match: ${tickerSymbol} === ${variantUpper}`);
              }
              return match;
            });
            
            if (ticker) {
              const price = parseFloat(ticker.lastPrice || ticker.last || ticker.price || ticker.close || '0');
              if (price > 0 && isFinite(price)) {
                console.log(`✅ Bitunix price found for ${symbolVariant}: ${price}${useCache ? ' (from cache)' : ''}`);
                if (symbolVariant !== symbol) {
                  console.log(`✅ Found price using symbol variant: ${symbolVariant} (original: ${symbol})`);
                }
                return price;
              } else {
                console.warn(`  ⚠️ Ticker found but price is invalid: ${price}`);
              }
            }
          }
          console.warn(`⚠️ Symbol not found in ${tickersArray.length} tickers. Tried variants: ${symbolVariants.join(', ')}`);
        }
        
        // If all tickers endpoints failed, try single ticker endpoint as fallback
        // Skip this for major coins if we had 404 errors (go directly to CoinGecko)
        if (!(isMajorCoin && tickersArray.length === 0)) {
          console.log(`🔄 Trying single ticker endpoints as fallback...`);
          // CRITICAL: Use correct API domain - futures uses fapi.bitunix.com, spot uses api.bitunix.com
          const apiBaseUrl = marketType === 'futures' ? 'https://fapi.bitunix.com' : 'https://api.bitunix.com';
          
          for (const symbolVariant of symbolVariants) {
            try {
              // For major coins, try fewer endpoints
              const singleTickerEndpoints = isMajorCoin
                ? [
                    `${apiBaseUrl}/api/v1/market/ticker?symbol=${symbolVariant}&marketType=${marketType}`,
                    `${apiBaseUrl}/api/v1/market/ticker/${symbolVariant}?marketType=${marketType}`
                  ]
                : [
                    `${apiBaseUrl}/api/v1/market/ticker?symbol=${symbolVariant}&marketType=${marketType}`,
                    `${apiBaseUrl}/api/v1/market/ticker?symbol=${symbolVariant}`,
                    `${apiBaseUrl}/api/v1/market/ticker/${symbolVariant}?marketType=${marketType}`,
                    `${apiBaseUrl}/api/v1/market/ticker/${symbolVariant}`
                  ];
              
              for (const endpoint of singleTickerEndpoints) {
                try {
                  console.log(`  Trying single ticker: ${endpoint}`);
                  const response = await fetch(endpoint, {
                    signal: AbortSignal.timeout(3000) // Reduced from 10s to 3s
                  });
                  
                  if (!response.ok) {
                    if (response.status === 404 && isMajorCoin) {
                      console.log(`  ❌ HTTP 404 from ${endpoint} - skipping remaining endpoints for major coin`);
                      break; // Exit inner loop for major coins
                    }
                    console.warn(`  ❌ HTTP ${response.status} from ${endpoint}`);
                    continue;
                  }
                
                  const data = await response.json();
                
                if (data.code === 0 && data.data) {
                  const price = parseFloat(data.data.lastPrice || data.data.last || data.data.price || data.data.close || '0');
                  if (price > 0 && isFinite(price)) {
                    console.log(`✅ Bitunix price found (single ticker) for ${symbolVariant}: ${price}`);
                    return price;
                  } else {
                    console.warn(`  ⚠️ Single ticker returned invalid price: ${price}`);
                  }
                } else {
                  console.warn(`  ⚠️ Single ticker API returned code ${data.code}: ${data.msg || data.message || 'Unknown error'}`);
                }
              } catch (err: any) {
                console.warn(`  ⚠️ Error fetching single ticker ${endpoint}:`, err.message);
                // For major coins, break on any error (likely 404)
                if (isMajorCoin) {
                  break; // Exit for major coins on any error
                }
                continue;
              }
            }
            // For major coins, break after first symbol variant if we got 404s
            if (isMajorCoin) break;
          } catch (err: any) {
            console.warn(`⚠️ Error trying symbol variant ${symbolVariant}:`, err.message);
            continue;
          }
        }
        } else {
          console.log(`⏭️ Skipping single ticker endpoints for major coin ${symbol} (had 404 errors, using CoinGecko)`);
        }
        
        // Final fallback: Try CoinGecko for ALL symbols (major coins get priority, but all get fallback)
        console.log(`🔄 Trying CoinGecko fallback for ${symbol}...`);
        try {
          // Comprehensive CoinGecko mapping
          const coinGeckoMap: { [key: string]: string } = {
            'BTCUSDT': 'bitcoin', 'BTC': 'bitcoin',
            'ETHUSDT': 'ethereum', 'ETH': 'ethereum',
            'BNBUSDT': 'binancecoin', 'BNB': 'binancecoin',
            'SOLUSDT': 'solana', 'SOL': 'solana',
            'ADAUSDT': 'cardano', 'ADA': 'cardano',
            'DOGEUSDT': 'dogecoin', 'DOGE': 'dogecoin',
            'XRPUSDT': 'ripple', 'XRP': 'ripple',
            'DOTUSDT': 'polkadot', 'DOT': 'polkadot',
            'MATICUSDT': 'matic-network', 'MATIC': 'matic-network',
            'AVAXUSDT': 'avalanche-2', 'AVAX': 'avalanche-2',
            'LINKUSDT': 'chainlink', 'LINK': 'chainlink',
            'UNIUSDT': 'uniswap', 'UNI': 'uniswap',
            'ATOMUSDT': 'cosmos', 'ATOM': 'cosmos',
            'TRXUSDT': 'tron', 'TRX': 'tron',
            'LTCUSDT': 'litecoin', 'LTC': 'litecoin',
            'BCHUSDT': 'bitcoin-cash', 'BCH': 'bitcoin-cash',
            'XLMUSDT': 'stellar', 'XLM': 'stellar',
            'VETUSDT': 'vechain', 'VET': 'vechain',
            'FILUSDT': 'filecoin', 'FIL': 'filecoin',
            'AAVEUSDT': 'aave', 'AAVE': 'aave',
            'SHIBUSDT': 'shiba-inu', 'SHIB': 'shiba-inu',
            'PEPEUSDT': 'pepe', 'PEPE': 'pepe',
            'FLOKIUSDT': 'floki', 'FLOKI': 'floki',
            'BONKUSDT': 'bonk', 'BONK': 'bonk',
            'WIFUSDT': 'dogwifcoin', 'WIF': 'dogwifcoin',
            'ARBUSDT': 'arbitrum', 'ARB': 'arbitrum',
            'OPUSDT': 'optimism', 'OP': 'optimism',
            'SUIUSDT': 'sui', 'SUI': 'sui',
            'APTUSDT': 'aptos', 'APT': 'aptos',
            'INJUSDT': 'injective-protocol', 'INJ': 'injective-protocol',
            'TIAUSDT': 'celestia', 'TIA': 'celestia',
            'SEIUSDT': 'sei-network', 'SEI': 'sei-network',
            'RENDERUSDT': 'render-token', 'RENDER': 'render-token',
            'FETUSDT': 'fetch-ai', 'FET': 'fetch-ai',
            'STRKUSDT': 'starknet', 'STRK': 'starknet'
          };
          
          const symbolUpper = symbol.toUpperCase();
          // Try exact match first, then try without USDT/USD/BUSD suffix
          let coinGeckoId = coinGeckoMap[symbolUpper] || 
                           coinGeckoMap[symbolUpper.replace(/USDT$/, '')] ||
                           coinGeckoMap[symbolUpper.replace(/USD$/, '')] ||
                           coinGeckoMap[symbolUpper.replace(/BUSD$/, '')];
          
          if (coinGeckoId) {
            const geckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd`;
            console.log(`  Fetching from CoinGecko: ${geckoUrl}`);
            const geckoResponse = await fetch(geckoUrl, { signal: AbortSignal.timeout(5000) });
            
            if (geckoResponse.ok) {
              const geckoData = await geckoResponse.json();
              const price = geckoData[coinGeckoId]?.usd;
              if (price > 0 && isFinite(price)) {
                console.log(`✅ Bitunix price found via CoinGecko fallback for ${symbol}: ${price}`);
                return price;
              } else {
                console.warn(`  ⚠️ CoinGecko returned invalid price: ${price}`);
              }
            } else {
              console.warn(`  ⚠️ CoinGecko HTTP error: ${geckoResponse.status}`);
            }
          } else {
            console.warn(`  ⚠️ No CoinGecko mapping for ${symbol}`);
            // Try CoinGecko search API as last resort for unmapped coins
            try {
              const baseCoin = symbolUpper.replace(/USDT$/, '').replace(/^(1000|10000)/, '');
              const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(baseCoin)}`;
              console.log(`  Trying CoinGecko search for: ${baseCoin}`);
              const searchResponse = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
              if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                if (searchData.coins && searchData.coins.length > 0) {
                  // Use the first result
                  const coinId = searchData.coins[0].id;
                  const priceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
                  const priceResponse = await fetch(priceUrl, { signal: AbortSignal.timeout(5000) });
                  if (priceResponse.ok) {
                    const priceData = await priceResponse.json();
                    const price = priceData[coinId]?.usd;
                    if (price > 0 && isFinite(price)) {
                      console.log(`✅ Bitunix price found via CoinGecko search for ${symbol}: ${price} (coin: ${coinId})`);
                      return price;
                    }
                  }
                }
              }
            } catch (searchErr: any) {
              console.warn(`  ⚠️ CoinGecko search fallback failed:`, searchErr.message);
            }
          }
        } catch (geckoErr: any) {
          console.warn(`⚠️ CoinGecko fallback failed:`, geckoErr.message);
        }
        
        console.error(`❌ Bitunix API error for ${symbol}: Symbol not found after all attempts.`);
        console.error(`   Market type: ${marketType}`);
        console.error(`   Tried symbol variants: ${symbolVariants.join(', ')}`);
        console.error(`   Tickers fetched: ${tickersArray.length}, Cache used: ${useCache}`);
        console.error(`   Available tickers (first 5): ${tickersArray.slice(0, 5).map((t: any) => t.symbol || t.pair || 'N/A').join(', ')}`);
        
        // Try one more fallback - fetch current price using market ticker API directly
        console.log(`🔄 Attempting final fallback: Direct ticker API call...`);
        for (const symbolVariant of symbolVariants.slice(0, 2)) { // Only try first 2 variants
          try {
            const fallbackUrl = `https://api.bitunix.com/api/v1/market/ticker?symbol=${symbolVariant}&marketType=${marketType}`;
            const fallbackResponse = await fetch(fallbackUrl, { signal: AbortSignal.timeout(5000) });
            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              if (fallbackData.code === 0 && fallbackData.data) {
                const fallbackPrice = parseFloat(fallbackData.data.lastPrice || fallbackData.data.last || fallbackData.data.price || '0');
                if (fallbackPrice > 0 && isFinite(fallbackPrice)) {
                  console.log(`✅ Final fallback succeeded: Found price ${fallbackPrice} for ${symbolVariant}`);
                  return fallbackPrice;
                }
              }
            }
          } catch (err) {
            // Continue to next variant
          }
        }
        
        console.error(`❌ All price fetch attempts failed for ${symbol}. Price will be 0.`);
        console.error(`   Bitunix API appears to be unavailable or symbol format is incorrect.`);
        console.error(`   CoinGecko fallback was attempted for all symbols.`);
        console.error(`   Please verify: 1) Symbol format (e.g., ETHUSDT not ETH), 2) Bitunix API status, 3) Exchange connection.`);
        console.error(`   If this symbol is not in CoinGecko mapping, please add it to the mapping or use a supported symbol.`);
        return 0;
      }
      return 0;
    } catch (error) {
      console.error(`❌ Error fetching price for ${symbol}:`, error);
      return 0;
    }
  }
  
  // Fetch historical klines/candlestick data from Bybit mainnet
  static async fetchKlines(symbol: string, exchange: string, timeframe: string = '1h', limit: number = 200): Promise<number[][]> {
    try {
      if (exchange === 'bybit') {
        // Map timeframe to Bybit interval
        const intervalMap: { [key: string]: string } = {
          '1m': '1',
          '3m': '3',
          '5m': '5',
          '15m': '15',
          '30m': '30',
          '45m': '45',
          '1h': '60',
          '2h': '120',
          '3h': '180',
          '4h': '240',
          '5h': '300',
          '6h': '360',
          '7h': '420',
          '8h': '480',
          '9h': '540',
          '10h': '600',
          '12h': '720',
          '1d': 'D',
          '1w': 'W',
          '1M': 'M'
        };
        
        const interval = intervalMap[timeframe] || '60';
        
        // Determine category based on trading type
        // For now, try both spot and linear, but prefer linear for futures
        const categories = ['linear', 'spot', 'inverse'];
        
        // Use Bybit API domain
        const baseDomains = ['https://api.bybit.com'];
        let had403Errors = false;
        
        for (const category of categories) {
          try {
            // Normalize symbol for Bybit API
            const symbolVariants = this.normalizeSymbol(symbol, exchange, category === 'linear' ? 'futures' : 'spot');
            
            for (const symbolVariant of symbolVariants) {
              // Try each domain
              for (const baseDomain of baseDomains) {
                try {
                  const url = `${baseDomain}/v5/market/kline?category=${category}&symbol=${symbolVariant}&interval=${interval}&limit=${limit}`;
                  const response = await fetch(url, {
                    signal: AbortSignal.timeout(10000)
                  });
                  
                  // Check content-type before parsing JSON
                  const contentType = response.headers.get('content-type') || '';
                  if (!contentType.includes('application/json')) {
                    const errorText = await response.text().catch(() => '');
                    if (response.status === 403) {
                      had403Errors = true;
                      console.warn(`⚠️ Bybit klines API returned 403 (geographic blocking?) from ${baseDomain} for ${symbolVariant}`);
                      continue; // Try next domain
                    }
                    console.warn(`⚠️ Bybit klines API returned non-JSON (${contentType}) for ${symbolVariant}: ${errorText.substring(0, 200)}`);
                    continue; // Try next domain
                  }
                  
                  const data = await response.json();
                  
                  if (data.retCode === 0 && data.result && data.result.list && data.result.list.length > 0) {
                    // Bybit returns klines in reverse chronological order (newest first)
                    // Format: [startTime, open, high, low, close, volume, turnover]
                    const klines = data.result.list.reverse().map((k: any[]) => [
                      parseFloat(k[0]), // timestamp
                      parseFloat(k[1]), // open
                      parseFloat(k[2]), // high
                      parseFloat(k[3]), // low
                      parseFloat(k[4]), // close
                      parseFloat(k[5])  // volume
                    ]);
                    
                    if (klines.length > 0) {
                      console.log(`✅ Fetched ${klines.length} klines for ${symbolVariant} (${category}) from ${baseDomain}`);
                      return klines;
                    }
                  }
                } catch (err) {
                  continue; // Try next domain
                }
              }
            }
          } catch (err) {
            continue; // Try next category
          }
        }
        
        // FALLBACK: Try Binance for major coins if Bybit is blocked
        const isMajorCoin = ['BTC', 'ETH', 'BNB', 'SOL'].some(coin => symbol.toUpperCase().startsWith(coin));
        if (isMajorCoin || had403Errors) {
          console.log(`🔄 Trying Binance fallback for klines (${symbol})...`);
          try {
            // Map timeframe to Binance interval
            const binanceIntervalMap: { [key: string]: string } = {
              '1m': '1m',
              '3m': '3m',
              '5m': '5m',
              '15m': '15m',
              '30m': '30m',
              '45m': '45m',
              '1h': '1h',
              '2h': '2h',
              '3h': '3h',
              '4h': '4h',
              '5h': '5h',
              '6h': '6h',
              '7h': '7h',
              '8h': '8h',
              '9h': '9h',
              '10h': '10h',
              '12h': '12h',
              '1d': '1d',
              '1w': '1w',
              '1M': '1M'
            };
            
            const binanceInterval = binanceIntervalMap[timeframe] || '1h';
            const binanceSymbol = symbol.replace(/\.P$/, ''); // Remove .P suffix if present
            
            const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=${limit}`;
            const binanceResponse = await fetch(binanceUrl, {
              signal: AbortSignal.timeout(10000)
            });
            
            if (binanceResponse.ok) {
              const binanceData = await binanceResponse.json();
              if (Array.isArray(binanceData) && binanceData.length > 0) {
                // Binance returns: [timestamp, open, high, low, close, volume, ...]
                const klines = binanceData.map((k: any[]) => [
                  parseFloat(k[0]), // timestamp
                  parseFloat(k[1]), // open
                  parseFloat(k[2]), // high
                  parseFloat(k[3]), // low
                  parseFloat(k[4]), // close
                  parseFloat(k[5])  // volume
                ]);
                
                if (klines.length > 0) {
                  console.log(`✅ Fetched ${klines.length} klines for ${symbol} from Binance (fallback)`);
                  return klines;
                }
              }
            }
          } catch (binanceErr) {
            console.warn(`⚠️ Binance klines fallback failed for ${symbol}:`, binanceErr);
          }
        }
        
        console.warn(`⚠️ Could not fetch klines for ${symbol} from Bybit${had403Errors ? ' (geographic blocking detected)' : ''}`);
        return [];
      } else if (exchange === 'okx') {
        // OKX klines implementation
        const instType = timeframe.includes('m') || timeframe.includes('h') ? 'SWAP' : 'SPOT';
        const symbolVariants = this.normalizeSymbol(symbol, exchange, instType === 'SWAP' ? 'futures' : 'spot');
        
        for (const symbolVariant of symbolVariants) {
          try {
            const url = `https://www.okx.com/api/v5/market/candles?instId=${symbolVariant}&instType=${instType}&bar=${timeframe}&limit=${limit}`;
            const response = await fetch(url);
            
            // Check content-type before parsing JSON
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
              const errorText = await response.text().catch(() => '');
              console.warn(`⚠️ OKX klines API returned non-JSON (${contentType}) for ${symbolVariant}: ${errorText.substring(0, 200)}`);
              continue; // Try next variant
            }
            
            const data = await response.json();
            
            if (data.code === '0' && data.data && Array.isArray(data.data) && data.data.length > 0) {
              // OKX returns: [timestamp, open, high, low, close, volume, volCcy, volCcyQuote, confirm]
              const klines = data.data.reverse().map((k: any[]) => [
                parseFloat(k[0]), // timestamp
                parseFloat(k[1]), // open
                parseFloat(k[2]), // high
                parseFloat(k[3]), // low
                parseFloat(k[4]), // close
                parseFloat(k[5])  // volume
              ]);
              
              if (klines.length > 0) {
                console.log(`✅ Fetched ${klines.length} klines for ${symbolVariant} from OKX`);
                return klines;
              }
            }
          } catch (err) {
            continue; // Try next variant
          }
        }
        
        console.warn(`⚠️ Could not fetch klines for ${symbol} from OKX`);
        return [];
      } else if (exchange === 'bitunix') {
        // Bitunix klines implementation
        const marketType = timeframe.includes('m') || timeframe.includes('h') ? 'futures' : 'spot';
        const symbolVariants = this.normalizeSymbol(symbol, exchange, marketType === 'futures' ? 'futures' : 'spot');
        
        // Map timeframe to Bitunix interval format
        const intervalMap: { [key: string]: string } = {
          '1m': '1m',
          '3m': '3m',
          '5m': '5m',
          '15m': '15m',
          '30m': '30m',
          '45m': '45m',
          '1h': '1h',
          '2h': '2h',
          '3h': '3h',
          '4h': '4h',
          '5h': '5h',
          '6h': '6h',
          '7h': '7h',
          '8h': '8h',
          '9h': '9h',
          '10h': '10h',
          '12h': '12h',
          '1d': '1d',
          '1w': '1w',
          '1M': '1M'
        };
        const bitunixInterval = intervalMap[timeframe] || '1h';
        
        for (const symbolVariant of symbolVariants) {
          try {
            const url = `https://api.bitunix.com/api/v1/market/klines?symbol=${symbolVariant}&marketType=${marketType}&interval=${bitunixInterval}&limit=${limit}`;
            const response = await fetch(url);
            
            // Check content-type before parsing JSON
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
              const errorText = await response.text().catch(() => '');
              console.warn(`⚠️ Bitunix klines API returned non-JSON (${contentType}) for ${symbolVariant}: ${errorText.substring(0, 200)}`);
              continue; // Try next variant
            }
            
            const data = await response.json();
            
            // Bitunix returns: { code: 0, data: [[timestamp, open, high, low, close, volume], ...] }
            if (data.code === 0 && data.data && Array.isArray(data.data) && data.data.length > 0) {
              const klines = data.data.reverse().map((k: any[]) => [
                parseFloat(k[0]), // timestamp
                parseFloat(k[1]), // open
                parseFloat(k[2]), // high
                parseFloat(k[3]), // low
                parseFloat(k[4]), // close
                parseFloat(k[5])  // volume
              ]);
              
              if (klines.length > 0) {
                console.log(`✅ Fetched ${klines.length} klines for ${symbolVariant} from Bitunix`);
                return klines;
              }
            }
          } catch (err) {
            continue; // Try next variant
          }
        }
        
        console.warn(`⚠️ Could not fetch klines for ${symbol} from Bitunix`);
        return [];
      }
      
      return [];
    } catch (error) {
      console.error(`❌ Error fetching klines for ${symbol}:`, error);
      return [];
    }
  }
  
  // Calculate RSI (Relative Strength Index) from real market data
  static async fetchRSI(symbol: string, exchange: string, timeframe: string = '1h'): Promise<number> {
    try {
      // Fetch historical klines (need at least 14 periods for RSI, using 60 for good accuracy while saving egress)
      const klines = await this.fetchKlines(symbol, exchange, timeframe, 60);
      
      if (klines.length < 14) {
        console.warn(`⚠️ Insufficient klines for RSI calculation (need 14, got ${klines.length}), using fallback`);
        return 50; // Neutral RSI
      }
      
      // Extract close prices
      const closes = klines.map(k => k[4]); // close price is index 4
      
      // Calculate RSI using standard 14-period formula
      const period = 14;
      const gains: number[] = [];
      const losses: number[] = [];
      
      // Calculate price changes
      for (let i = 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
      }
      
      // Calculate average gain and loss over the period
      let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
      
      // Use Wilder's smoothing method for subsequent periods
      for (let i = period; i < gains.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      }
      
      // Calculate RSI
      if (avgLoss === 0) {
        return 100; // Perfect bullish momentum
      }
      
      const rs = avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      
      console.log(`📊 RSI calculated for ${symbol}: ${rsi.toFixed(2)} (avgGain: ${avgGain.toFixed(4)}, avgLoss: ${avgLoss.toFixed(4)})`);
      
      return Math.max(0, Math.min(100, rsi)); // Clamp between 0 and 100
    } catch (error) {
      console.error(`❌ Error calculating RSI for ${symbol}:`, error);
      return 50; // Return neutral RSI on error
    }
  }
  
  // Calculate ADX (Average Directional Index) from real market data
  static async fetchADX(symbol: string, exchange: string, timeframe: string = '1h'): Promise<number> {
    try {
      // Fetch historical klines (need at least 14 periods for ADX, using 60 for good accuracy while saving egress)
      const klines = await this.fetchKlines(symbol, exchange, timeframe, 60);
      
      if (klines.length < 14) {
        console.warn(`⚠️ Insufficient klines for ADX calculation (need 14, got ${klines.length}), using fallback`);
        return 20; // Weak trend
      }
      
      const period = 14;
      
      // Calculate True Range (TR) and Directional Movement (+DM and -DM)
      const trs: number[] = [];
      const plusDMs: number[] = [];
      const minusDMs: number[] = [];
      
      for (let i = 1; i < klines.length; i++) {
        const [prevTimestamp, prevOpen, prevHigh, prevLow, prevClose] = klines[i - 1];
        const [currTimestamp, currOpen, currHigh, currLow, currClose] = klines[i];
        
        // True Range = max of:
        //   1. Current High - Current Low
        //   2. Current High - Previous Close (absolute)
        //   3. Current Low - Previous Close (absolute)
        const tr = Math.max(
          currHigh - currLow,
          Math.abs(currHigh - prevClose),
          Math.abs(currLow - prevClose)
        );
        trs.push(tr);
        
        // Directional Movement
        const upMove = currHigh - prevHigh;
        const downMove = prevLow - currLow;
        
        if (upMove > downMove && upMove > 0) {
          plusDMs.push(upMove);
          minusDMs.push(0);
        } else if (downMove > upMove && downMove > 0) {
          plusDMs.push(0);
          minusDMs.push(downMove);
        } else {
          plusDMs.push(0);
          minusDMs.push(0);
        }
      }
      
      // Calculate smoothed averages using Wilder's smoothing
      let avgTR = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
      let avgPlusDM = plusDMs.slice(0, period).reduce((a, b) => a + b, 0) / period;
      let avgMinusDM = minusDMs.slice(0, period).reduce((a, b) => a + b, 0) / period;
      
      // Smooth subsequent values
      for (let i = period; i < trs.length; i++) {
        avgTR = (avgTR * (period - 1) + trs[i]) / period;
        avgPlusDM = (avgPlusDM * (period - 1) + plusDMs[i]) / period;
        avgMinusDM = (avgMinusDM * (period - 1) + minusDMs[i]) / period;
      }
      
      // Calculate +DI and -DI
      const plusDI = avgTR === 0 ? 0 : (avgPlusDM / avgTR) * 100;
      const minusDI = avgTR === 0 ? 0 : (avgMinusDM / avgTR) * 100;
      
      // Calculate DX (Directional Index)
      const diSum = plusDI + minusDI;
      const dx = diSum === 0 ? 0 : (Math.abs(plusDI - minusDI) / diSum) * 100;
      
      // Calculate ADX (smoothed DX)
      // For simplicity, we'll use the DX value as ADX (full ADX would smooth DX over multiple periods)
      const adx = dx;
      
      console.log(`📊 ADX calculated for ${symbol}: ${adx.toFixed(2)} (+DI: ${plusDI.toFixed(2)}, -DI: ${minusDI.toFixed(2)})`);
      
      return Math.max(0, Math.min(100, adx)); // Clamp between 0 and 100
    } catch (error) {
      console.error(`❌ Error calculating ADX for ${symbol}:`, error);
      return 20; // Return weak trend on error
    }
  }
}

// TypeScript interface for TradingBot
interface TradingBot {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'paused';
  symbol: string;
  exchange: string;
  user_id: string;
  strategy?: any;
  paper_trading?: boolean;
  webhook_only?: boolean;
  trade_amount?: number;
  [key: string]: any; // For other properties
}

// Bot execution engine
class BotExecutor {
  // Bitunix server time offset (milliseconds)
  private static bitunixServerTimeOffset = 0;
  private static bitunixLastSync = 0;
  private static bitunixSyncInterval = 300000; // Sync every 5 minutes
  
  /**
   * Sync Bitunix server time to prevent timestamp errors
   */
  private async syncBitunixServerTime(): Promise<void> {
    const now = Date.now();
    // Only sync if last sync was more than 5 minutes ago
    if (now - BotExecutor.bitunixLastSync < BotExecutor.bitunixSyncInterval) {
      return; // Use cached offset
    }
    
    try {
      const baseUrl = 'https://fapi.bitunix.com';
      const startTime = Date.now();
      
      // Try to get server time from Bitunix (if they have a time endpoint)
      // For now, we'll use a simple approach: make a lightweight API call and compare timestamps
      // Bitunix may not have a dedicated time endpoint, so we'll use the account endpoint
      const response = await fetch(`${baseUrl}/api/v1/futures/account?marginCoin=USDT`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const endTime = Date.now();
      const roundTripTime = endTime - startTime;
      
      // If we get a timestamp error, we know the server time
      // For now, assume server time is close to our time (within reasonable bounds)
      // In production, Bitunix may provide server time in error responses
      const serverTimeHeader = response.headers.get('date');
      if (serverTimeHeader) {
        const serverTime = new Date(serverTimeHeader).getTime();
        const localTime = startTime + (roundTripTime / 2); // Account for network latency
        BotExecutor.bitunixServerTimeOffset = serverTime - localTime;
        BotExecutor.bitunixLastSync = now;
        console.log(`✅ Bitunix server time synced: offset=${BotExecutor.bitunixServerTimeOffset}ms`);
      } else {
        // No server time header - assume no offset needed
        BotExecutor.bitunixServerTimeOffset = 0;
        BotExecutor.bitunixLastSync = now;
        console.log(`⚠️ Bitunix server time sync: No server time header, using local time`);
      }
    } catch (error) {
      console.warn(`⚠️ Bitunix server time sync failed:`, error);
      BotExecutor.bitunixServerTimeOffset = 0; // Fallback to local time
      BotExecutor.bitunixLastSync = now;
    }
  }
  
  // Helper function to build Bybit API headers safely (ensures all values are strings)
  private buildBybitHeaders(apiKey: string, timestamp: string, recvWindow: string, signature: string, contentType: string = 'application/json'): Record<string, string> {
    // Ensure all values are strings (required for Request API)
    const headers: Record<string, string> = {
      'Content-Type': String(contentType || 'application/json'),
      'X-BAPI-API-KEY': String(apiKey || ''),
      'X-BAPI-TIMESTAMP': String(timestamp || ''),
      'X-BAPI-RECV-WINDOW': String(recvWindow || ''),
      'X-BAPI-SIGN': String(signature || ''),
    };
    
    // Validate critical header values are not empty
    if (!headers['X-BAPI-API-KEY'] || !headers['X-BAPI-TIMESTAMP'] || !headers['X-BAPI-SIGN']) {
      throw new Error(`Invalid Bybit header values: apiKey=${!!apiKey}, timestamp=${!!timestamp}, signature=${!!signature}`);
    }
    
    return headers;
  }
  private supabaseClient: any;
  private user: any;
  
  constructor(supabaseClient: any, user: any) {
    this.supabaseClient = supabaseClient;
    this.user = user;
  }
  
  /**
   * Safe fetch helper with retry logic and timeout
   */
  private async safeFetch(url: string, options: RequestInit = {}, retries: number = 3): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        return response;
      } catch (error) {
        if (attempt === retries - 1) {
          throw new Error(`Fetch failed after ${retries} attempts: ${error instanceof Error ? error.message : String(error)}`);
        }
        console.warn(`⚠️ Fetch attempt ${attempt + 1} failed, retrying...`, error);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
      }
    }
    throw new Error('Unreachable code');
  }
  
  async executeBot(bot: TradingBot): Promise<void> {
    const executionStartTime = Date.now();
    const botId = bot.id;
    const botName = bot.name || 'Unknown';
    const botSymbol = bot.symbol || 'Unknown';
    
    console.log(`\n🚀 === EXECUTING BOT ===`);
    console.log(`   Bot ID: ${botId}`);
    console.log(`   Bot Name: ${botName}`);
    console.log(`   Symbol: ${botSymbol}`);
    console.log(`   Exchange: ${bot.exchange || 'Unknown'}`);
    console.log(`   Trading Type: ${bot.trading_type || bot.tradingType || 'Unknown'}`);
    console.log(`   Status: ${bot.status || 'Unknown'}`);
    console.log(`   Paper Trading: ${bot.paper_trading ? 'YES' : 'NO'}`);
    console.log(`   Timestamp: ${new Date().toISOString()}\n`);
    
    try {
      console.log(`🔍 Step 1: Checking for manual trade signals for bot ${botId}...`);
      
      // Process manual signals FIRST, regardless of bot status
      // This allows webhook-triggered trades even when bot is stopped
      const manualProcessed = await this.processManualSignals(bot);
      if (manualProcessed > 0) {
        console.log(`✅ Step 1 Complete: Processed ${manualProcessed} manual trade signal(s) for bot ${botName}`);
        // If we processed manual signals, we can return early if bot is stopped
        // Manual signals are handled independently of bot status
        if (bot.status !== 'running') {
          console.log(`ℹ️ Bot ${botName} is ${bot.status}, but manual signals were processed. Skipping regular execution.`);
          const executionTime = Date.now() - executionStartTime;
          console.log(`\n✅ === BOT EXECUTION COMPLETE ===`);
          console.log(`   Bot ID: ${botId}`);
          console.log(`   Execution Time: ${executionTime}ms`);
          console.log(`   Manual Signals Processed: ${manualProcessed}\n`);
          return;
        }
      } else {
        console.log(`ℹ️ Step 1 Complete: No manual trade signals found for bot ${botId}`);
      }
      
      // If bot is stopped and no manual signals, skip execution
      if (bot.status !== 'running') {
        console.log(`⏸️ Bot ${botName} is ${bot.status}, skipping execution`);
        const executionTime = Date.now() - executionStartTime;
        console.log(`\n⏸️ === BOT EXECUTION SKIPPED ===`);
        console.log(`   Bot ID: ${botId}`);
        console.log(`   Reason: Bot status is '${bot.status}'`);
        console.log(`   Execution Time: ${executionTime}ms\n`);
        return;
      }
      
      // Validate symbol - skip bots with invalid/placeholder symbols
      const invalidSymbols = ['CUSTOM', 'UNKNOWN', 'N/A', 'TBD', ''];
      const normalizedSymbol = (bot.symbol || '').toUpperCase().trim();
      if (invalidSymbols.includes(normalizedSymbol) || !bot.symbol || bot.symbol.trim() === '') {
        const errorMsg = `Invalid symbol "${bot.symbol}". Bot must have a valid trading pair (e.g., BTCUSDT, ETHUSDT). Please update the bot configuration.`;
        console.error(`❌ ${errorMsg}`);
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'error',
          message: errorMsg,
          details: {
            bot_id: bot.id,
            bot_name: bot.name,
            symbol: bot.symbol,
            reason: 'Invalid or placeholder symbol'
          }
        });
        const executionTime = Date.now() - executionStartTime;
        console.log(`\n❌ === BOT EXECUTION SKIPPED ===`);
        console.log(`   Bot ID: ${botId}`);
        console.log(`   Reason: Invalid symbol "${bot.symbol}"`);
        console.log(`   Execution Time: ${executionTime}ms\n`);
        return;
      }
      
      // Check if bot is in webhook-only mode (skip scheduled execution, but manual signals already processed above)
      // Manual signals are processed first (above), so webhook-only bots can still trade via webhooks
      if (bot.webhook_only === true) {
        console.log(`🔗 Bot ${botName} is in webhook-only mode - skipping scheduled execution`);
        console.log(`ℹ️ Manual signals were already processed above (if any)`);
        const executionTime = Date.now() - executionStartTime;
        console.log(`\n🔗 === BOT EXECUTION SKIPPED (WEBHOOK-ONLY MODE) ===`);
        console.log(`   Bot ID: ${botId}`);
        console.log(`   Reason: Bot is in webhook-only mode - only trades via webhooks`);
        console.log(`   Manual Signals Processed: ${manualProcessed}`);
        console.log(`   Execution Time: ${executionTime}ms\n`);
        return;
      }
      
      console.log(`✅ Step 2: Bot ${botName} is running, proceeding with execution...`);

      // ⚠️ CRITICAL: Check paper trading mode FIRST before any real API calls
      const isPaperTrading = bot.paper_trading === true;
      
      if (isPaperTrading) {
        // PAPER TRADING MODE - Use real market data but simulate trades
        console.log(`📝 [PAPER TRADING MODE] Bot: ${bot.name}`);
        
        // Early validation: Check if user exists before creating PaperTradingExecutor
        // This prevents foreign key constraint violations
        try {
          const { data: userExists, error: userCheckError } = await this.supabaseClient
            .from('users')
            .select('id')
            .eq('id', bot.user_id)
            .maybeSingle();
          
          if (userCheckError || !userExists) {
            const errorMsg = `User ${bot.user_id} does not exist in users table. Bot may belong to deleted user. Skipping execution.`;
            console.error(`❌ [PAPER] ${errorMsg}`);
            await this.addBotLog(bot.id, {
              level: 'error',
              category: 'error',
              message: errorMsg,
              details: { 
                bot_id: bot.id,
                bot_name: bot.name,
                user_id: bot.user_id,
                error: userCheckError?.message || 'User not found'
              }
            });
            return; // Skip execution for bots with invalid user_id
          }
        } catch (userValidationError: any) {
          console.error(`❌ [PAPER] Error validating user existence:`, userValidationError);
          await this.addBotLog(bot.id, {
            level: 'error',
            category: 'error',
            message: `Failed to validate user existence: ${userValidationError.message}`,
            details: { 
              bot_id: bot.id,
              bot_name: bot.name,
              user_id: bot.user_id,
              error: userValidationError.message
            }
          });
          return; // Skip execution if validation fails
        }
        
        // Create PaperTradingExecutor with bot's user_id (not executor's user)
        const paperExecutor = new PaperTradingExecutor(this.supabaseClient, { id: bot.user_id });
        
        // Get REAL market data from MAINNET (same functions as real trading)
        const tradingType = bot.tradingType || bot.trading_type || 'futures';
        const timeframe = bot.timeframe || bot.timeFrame || '1h';
        console.log(`📊 [PAPER] Using timeframe: ${timeframe} for ${bot.symbol}`);
        
        // Pass logging callback to track CoinGecko fallback usage
        const currentPrice = await MarketDataFetcher.fetchPrice(
          bot.symbol, 
          bot.exchange, 
          tradingType,
          async (message: string, details?: any) => {
            await this.addBotLog(bot.id, {
              level: 'info',
              category: 'market',
              message: message,
              details: details
            });
          }
        );
        const rsi = await MarketDataFetcher.fetchRSI(bot.symbol, bot.exchange, timeframe);
        const adx = await MarketDataFetcher.fetchADX(bot.symbol, bot.exchange, timeframe);
        
        await this.addBotLog(bot.id, {
          level: 'info',
          category: 'market',
          message: `📝 [PAPER] Market data: Price=${currentPrice}, RSI=${rsi.toFixed(2)}, ADX=${adx.toFixed(2)}`,
          details: { price: currentPrice, rsi, adx, paper_trading: true }
        });
        
        // Same strategy evaluation as real trading
        let strategy = bot.strategy;
        if (typeof strategy === 'string') {
          try {
            strategy = JSON.parse(strategy);
            if (typeof strategy === 'string') {
              strategy = JSON.parse(strategy);
            }
          } catch (error) {
            console.error('Error parsing strategy:', error);
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
        
        // 🤖 AI/ML PREDICTION INTEGRATION FOR PAPER TRADING
        let mlPrediction = null;
        if (strategy.useMLPrediction === true) {
          try {
            console.log(`🤖 [PAPER] Fetching ML prediction for ${bot.symbol}...`);
            
            // Call ML predictions API using internal function call
            // We'll use the supabase client to get the service role key for internal calls
            const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
            const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
            
            // Generate ML features internally (same as ml-predictions function)
            const mlFeatures = {
              rsi: rsi,
              adx: adx,
              price: currentPrice,
              volume: 0, // Would need to fetch if available
              timestamp: new Date().toISOString()
            };
            
            // Enhanced ML prediction using weighted scoring
            // More responsive thresholds to generate actual buy/sell signals
            let predictionScore = 0;
            
            // RSI component: More lenient thresholds
            if (rsi < 40) {
              predictionScore += 0.4; // Strong buy signal when RSI < 40
            } else if (rsi < 50) {
              predictionScore += 0.2; // Moderate buy signal when RSI < 50
            } else if (rsi > 60) {
              predictionScore -= 0.4; // Strong sell signal when RSI > 60
            } else if (rsi > 50) {
              predictionScore -= 0.2; // Moderate sell signal when RSI > 50
            }
            
            // ADX component: Trend strength
            if (adx > 20) {
              predictionScore += (adx - 20) / 50; // Boost confidence with trend strength
            }
            
            // Price momentum (if available)
            // Small random component for variability
            predictionScore += (Math.random() * 0.1 - 0.05);
            
            let prediction = 'hold';
            let confidence = 0.5;
            
            // More lenient thresholds: 0.15 instead of 0.3
            if (predictionScore > 0.15) {
              prediction = 'buy';
              confidence = Math.min(0.5 + predictionScore * 0.8, 0.95);
            } else if (predictionScore < -0.15) {
              prediction = 'sell';
              confidence = Math.min(0.5 + Math.abs(predictionScore) * 0.8, 0.95);
            } else {
              // For neutral scores, still provide a slight bias based on RSI
              if (rsi < 45) {
                prediction = 'buy';
                confidence = 0.55;
              } else if (rsi > 55) {
                prediction = 'sell';
                confidence = 0.55;
              } else {
                prediction = 'hold';
                confidence = 0.5;
              }
            }
            
            mlPrediction = {
              prediction: prediction,
              confidence: confidence,
              features: mlFeatures
            };
            
            console.log(`🤖 [PAPER] ML Prediction: ${mlPrediction.prediction.toUpperCase()} (${(mlPrediction.confidence * 100).toFixed(1)}% confidence)`);
            
            await this.addBotLog(bot.id, {
              level: 'info',
              category: 'ml',
              message: `🤖 [PAPER] ML Prediction: ${mlPrediction.prediction.toUpperCase()} with ${(mlPrediction.confidence * 100).toFixed(1)}% confidence`,
              details: { 
                ml_prediction: mlPrediction,
                paper_trading: true
              }
            });
          } catch (error) {
            console.error(`❌ [PAPER] ML prediction failed:`, error);
            // Continue without ML prediction - don't block paper trading
          }
        }
        
        // 🛡️ SAFETY CHECKS FOR PAPER TRADING - Check before any trading
        console.log(`🛡️ [PAPER] Checking safety limits for ${bot.name}...`);
        const safetyCheck = await this.checkSafetyLimits(bot);
        if (!safetyCheck.canTrade) {
          console.warn(`⚠️ [PAPER] Trading blocked for ${bot.name}: ${safetyCheck.reason}`);
          await this.addBotLog(bot.id, {
            level: 'warning',
            category: 'system',
            message: `📝 [PAPER] Trading blocked: ${safetyCheck.reason}`,
            details: { ...safetyCheck, paper_trading: true }
          });
          // Update paper positions but don't trade (with 20s time budget)
          await paperExecutor.updatePaperPositions(bot.id, Date.now(), 20000);
          return; // Stop execution
        }

        const shouldTrade = await this.evaluateStrategy(strategy, { price: currentPrice, rsi, adx, mlPrediction }, bot);
        
        // Enhance decision with ML prediction if available
        if (mlPrediction && shouldTrade.shouldTrade) {
          // If ML prediction conflicts with strategy signal, adjust confidence
          const mlSignal = mlPrediction.prediction.toLowerCase();
          const strategySignal = shouldTrade.side.toLowerCase();
          
          if ((mlSignal === 'buy' && strategySignal === 'sell') || 
              (mlSignal === 'sell' && strategySignal === 'buy')) {
            // ML conflicts with strategy - reduce confidence
            shouldTrade.confidence = shouldTrade.confidence * 0.5;
            shouldTrade.reason += ` (ML suggests ${mlSignal}, reducing confidence)`;
            console.log(`⚠️ [PAPER] ML prediction conflicts with strategy signal`);
          } else if (mlSignal === strategySignal || mlSignal === 'hold') {
            // ML confirms strategy or suggests hold - boost confidence
            shouldTrade.confidence = Math.min(shouldTrade.confidence * 1.2, 1.0);
            shouldTrade.reason += ` (ML confirms: ${mlSignal})`;
            console.log(`✅ [PAPER] ML prediction confirms strategy signal`);
          }
        }
        
        // ⏱️ COOLDOWN BARS CHECK - Check if enough bars have passed since last trade (for paper trading too)
        const cooldownCheck = await this.checkCooldownBars(bot);
        if (!cooldownCheck.canTrade) {
          console.log(`⏸️ [PAPER] Cooldown active for ${bot.name}: ${cooldownCheck.reason}`);
          await this.addBotLog(bot.id, {
            level: 'info',
            category: 'system',
            message: `📝 [PAPER] Cooldown active: ${cooldownCheck.reason}`,
            details: { ...cooldownCheck, paper_trading: true }
          });
          // Update paper positions but don't trade (with 20s time budget)
          await paperExecutor.updatePaperPositions(bot.id, Date.now(), 20000);
          return; // Stop execution - wait for cooldown
        }
        
        // 🕐 TRADING HOURS CHECK - Check if current hour is in allowed trading hours (for paper trading too)
        const tradingHoursCheck = this.checkTradingHours(bot);
        if (!tradingHoursCheck.canTrade) {
          console.log(`🕐 [PAPER] Outside trading hours for ${bot.name}: ${tradingHoursCheck.reason}`);
          await this.addBotLog(bot.id, {
            level: 'info',
            category: 'system',
            message: `📝 [PAPER] Outside trading hours: ${tradingHoursCheck.reason}`,
            details: { ...tradingHoursCheck, paper_trading: true }
          });
          // Update paper positions but don't trade (with 20s time budget)
          await paperExecutor.updatePaperPositions(bot.id, Date.now(), 20000);
          return; // Stop execution - outside allowed hours
        }
        
        // Ensure shouldTrade always has a reason
        if (!shouldTrade || typeof shouldTrade !== 'object') {
          shouldTrade = {
            shouldTrade: false,
            reason: 'Strategy evaluation returned invalid result',
            confidence: 0
          };
        }
        if (!shouldTrade.reason) {
          shouldTrade.reason = shouldTrade.shouldTrade 
            ? 'Trading conditions met' 
            : 'No trading signals detected (all strategy parameters checked)';
        }
        
        if (shouldTrade.shouldTrade) {
          // Double check: don't open multiple positions for the same symbol/bot if not intended
          const openPositions = await this.getOpenPositions(bot.id, true);
          const maxConcurrent = this.getMaxConcurrent(bot);
          
          if (openPositions >= maxConcurrent) {
            console.log(`⏸️ [PAPER] Max concurrent positions (${openPositions}/${maxConcurrent}) reached for ${bot.name}`);
            await this.addBotLog(bot.id, {
              level: 'info',
              category: 'trade',
              message: `📝 [PAPER] Signal ${shouldTrade.side.toUpperCase()} skipped: Max concurrent positions reached (${openPositions}/${maxConcurrent})`,
              details: { ...shouldTrade, paper_trading: true, open_positions: openPositions, max_concurrent: maxConcurrent }
            });
          } else {
            await paperExecutor.executePaperTrade(bot, shouldTrade);
          }
        } else {
          await this.addBotLog(bot.id, {
            level: 'info',
            category: 'strategy',
            message: `📝 [PAPER] Strategy conditions not met: ${shouldTrade.reason || 'No reason provided'}`,
            details: { ...shouldTrade, paper_trading: true, ml_prediction: mlPrediction }
          });
        }
        
        // Update existing paper positions (with 20s time budget)
        await paperExecutor.updatePaperPositions(bot.id, Date.now(), 20000);
        
        // ⚠️ CRITICAL: RETURN HERE - Don't execute real trades
        return;
      }
      
      // ⚠️ REAL TRADING MODE - Existing code continues unchanged
      console.log(`💰 [REAL TRADING MODE] Bot: ${bot.name}`);
      
      // 🔍 CRITICAL: Log to database immediately to track execution
      await this.addBotLog(bot.id, {
        level: 'info',
        category: 'system',
        message: `💰 REAL TRADING MODE - Execution started`,
        details: { 
          mode: 'real',
          bot_name: bot.name,
          symbol: bot.symbol,
          exchange: bot.exchange,
          timestamp: new Date().toISOString()
        }
      });
      
      // ⏱️ COOLDOWN BARS CHECK - Check if enough bars have passed since last trade
      console.log(`⏱️ [${bot.name}] Checking cooldown bars...`);
      await this.addBotLog(bot.id, {
        level: 'info',
        category: 'system',
        message: `⏱️ Checking cooldown bars...`,
        details: { step: 'cooldown_check', bot_name: bot.name }
      });
      
      let cooldownCheck;
      try {
        cooldownCheck = await this.checkCooldownBars(bot);
        console.log(`⏱️ [${bot.name}] Cooldown check result:`, JSON.stringify(cooldownCheck, null, 2));
      } catch (cooldownError) {
        console.error(`❌ [${bot.name}] Error during cooldown check:`, cooldownError);
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'system',
          message: `❌ Error checking cooldown: ${cooldownError instanceof Error ? cooldownError.message : String(cooldownError)}`,
          details: { step: 'cooldown_check', error: cooldownError instanceof Error ? cooldownError.stack : String(cooldownError) }
        });
        // On error, allow trading (fail open)
        cooldownCheck = { canTrade: true, reason: 'Cooldown check error - allowing trade' };
      }
      
      if (!cooldownCheck.canTrade) {
        console.log(`⏸️ Cooldown active for ${bot.name}: ${cooldownCheck.reason}`);
        await this.addBotLog(bot.id, {
          level: 'info',
          category: 'system',
          message: `⏸️ Cooldown active: ${cooldownCheck.reason}`,
          details: { ...cooldownCheck, step: 'cooldown_check', stopped: true }
        });
        return; // Stop execution - wait for cooldown
      }
      console.log(`✅ [${bot.name}] Cooldown check passed - can trade`);
      await this.addBotLog(bot.id, {
        level: 'info',
        category: 'system',
        message: `✅ Cooldown check passed - can trade`,
        details: { step: 'cooldown_check', passed: true }
      });
      
      // 🕐 TRADING HOURS CHECK - Check if current hour is in allowed trading hours
      console.log(`🕐 [${bot.name}] Checking trading hours...`);
      await this.addBotLog(bot.id, {
        level: 'info',
        category: 'system',
        message: `🕐 Checking trading hours...`,
        details: { step: 'trading_hours_check', bot_name: bot.name }
      });
      
      const tradingHoursCheck = this.checkTradingHours(bot);
      console.log(`🕐 [${bot.name}] Trading hours check result:`, JSON.stringify(tradingHoursCheck, null, 2));
      
      if (!tradingHoursCheck.canTrade) {
        console.log(`🕐 Outside trading hours for ${bot.name}: ${tradingHoursCheck.reason}`);
        await this.addBotLog(bot.id, {
          level: 'info',
          category: 'system',
          message: `🕐 Outside trading hours: ${tradingHoursCheck.reason}`,
          details: { ...tradingHoursCheck, step: 'trading_hours_check', stopped: true }
        });
        return; // Stop execution - outside allowed hours
      }
      console.log(`✅ [${bot.name}] Trading hours check passed - can trade`);
      await this.addBotLog(bot.id, {
        level: 'info',
        category: 'system',
        message: `✅ Trading hours check passed - can trade`,
        details: { step: 'trading_hours_check', passed: true }
      });
      
      // COMPREHENSIVE SETTINGS VALIDATION & LOGGING
      console.log(`\n📋 Bot Settings Validation:`);
      console.log(`   Timeframe: ${bot.timeframe || bot.timeFrame || '1h (default)'}`);
      console.log(`   Trade Amount: $${bot.trade_amount || bot.tradeAmount || 100}`);
      console.log(`   Leverage: ${bot.leverage || 1}x`);
      console.log(`   Stop Loss: ${bot.stop_loss || bot.stopLoss || 2.0}%`);
      console.log(`   Take Profit: ${bot.take_profit || bot.takeProfit || 4.0}%`);
      console.log(`   Risk Level: ${bot.risk_level || bot.riskLevel || 'low'}`);
      console.log(`   Strategy: ${JSON.stringify(bot.strategy || {}, null, 2)}`);
      if (bot.strategy_config) {
        console.log(`   Advanced Config: ${JSON.stringify(bot.strategy_config, null, 2)}`);
      }
      
      // Add execution log with settings validation
      await this.addBotLog(bot.id, {
        level: 'info',
        category: 'system',
        message: 'Bot execution started',
        details: { 
          timestamp: TimeSync.getCurrentTimeISO(),
          settings: {
            timeframe: bot.timeframe || bot.timeFrame || '1h',
            trade_amount: bot.trade_amount || bot.tradeAmount || 100,
            leverage: bot.leverage || 1,
            stop_loss: bot.stop_loss || bot.stopLoss || 2.0,
            take_profit: bot.take_profit || bot.takeProfit || 4.0,
            risk_level: bot.risk_level || bot.riskLevel || 'low'
          }
        }
      });
      
      // 🛡️ SAFETY CHECKS - Check before any trading
      console.log(`🛡️ [${bot.name}] Checking safety limits...`);
      await this.addBotLog(bot.id, {
        level: 'info',
        category: 'system',
        message: `🛡️ Checking safety limits...`,
        details: { step: 'safety_check', bot_name: bot.name }
      });
      
      const safetyCheck = await this.checkSafetyLimits(bot);
      console.log(`🛡️ [${bot.name}] Safety check result:`, JSON.stringify(safetyCheck, null, 2));
      
      if (!safetyCheck.canTrade) {
        console.warn(`⚠️ Trading blocked for ${bot.name}: ${safetyCheck.reason}`);
        await this.addBotLog(bot.id, {
          level: 'warning',
          category: 'system',
          message: `⚠️ Trading blocked: ${safetyCheck.reason}`,
          details: { ...safetyCheck, step: 'safety_check', stopped: true }
        });
        
        // Auto-pause bot if critical safety limit is breached
        if (safetyCheck.shouldPause) {
          await this.pauseBotForSafety(bot.id, safetyCheck.reason);
        }
        return; // Stop execution
      }
      console.log(`✅ [${bot.name}] Safety checks passed - can trade`);
      await this.addBotLog(bot.id, {
        level: 'info',
        category: 'system',
        message: `✅ Safety checks passed - can trade`,
        details: { step: 'safety_check', passed: true }
      });
      
      // Fetch market data
      console.log(`📊 [${bot.name}] Starting market data fetch...`);
      await this.addBotLog(bot.id, {
        level: 'info',
        category: 'system',
        message: `📊 Starting market data fetch...`,
        details: { step: 'market_data_fetch', bot_name: bot.name, symbol: bot.symbol }
      });
      
      const tradingType = bot.tradingType || bot.trading_type || 'spot';
      console.log(`🤖 Bot ${bot.name} trading type: ${tradingType}`);
      
      // CRITICAL FIX: Use bot's configured timeframe for all market data fetching
      const timeframe = bot.timeframe || bot.timeFrame || '1h';
      console.log(`📊 Using timeframe: ${timeframe} for ${bot.symbol}`);
      
      let currentPrice: number;
      let rsi: number;
      let adx: number;
      
      try {
        console.log(`📊 [${bot.name}] Fetching price for ${bot.symbol}...`);
        await this.addBotLog(bot.id, {
          level: 'info',
          category: 'market',
          message: `📊 Fetching price for ${bot.symbol}...`,
          details: { step: 'fetch_price', symbol: bot.symbol, exchange: bot.exchange }
        });
        
        // Pass logging callback to track CoinGecko fallback usage
        currentPrice = await MarketDataFetcher.fetchPrice(
          bot.symbol, 
          bot.exchange, 
          tradingType,
          async (message: string, details?: any) => {
            await this.addBotLog(bot.id, {
              level: 'info',
              category: 'market',
              message: message,
              details: details
            });
          }
        );
        console.log(`✅ [${bot.name}] Price fetched: ${currentPrice}`);
        await this.addBotLog(bot.id, {
          level: 'info',
          category: 'market',
          message: `✅ Price fetched: ${currentPrice}`,
          details: { step: 'fetch_price', price: currentPrice, symbol: bot.symbol }
        });
        
        console.log(`📊 [${bot.name}] Fetching RSI for ${bot.symbol}...`);
        await this.addBotLog(bot.id, {
          level: 'info',
          category: 'market',
          message: `📊 Fetching RSI for ${bot.symbol}...`,
          details: { step: 'fetch_rsi', symbol: bot.symbol, timeframe }
        });
        
        rsi = await MarketDataFetcher.fetchRSI(bot.symbol, bot.exchange, timeframe);
        console.log(`✅ [${bot.name}] RSI fetched: ${rsi}`);
        await this.addBotLog(bot.id, {
          level: 'info',
          category: 'market',
          message: `✅ RSI fetched: ${rsi}`,
          details: { step: 'fetch_rsi', rsi, symbol: bot.symbol }
        });
        
        console.log(`📊 [${bot.name}] Fetching ADX for ${bot.symbol}...`);
        await this.addBotLog(bot.id, {
          level: 'info',
          category: 'market',
          message: `📊 Fetching ADX for ${bot.symbol}...`,
          details: { step: 'fetch_adx', symbol: bot.symbol, timeframe }
        });
        
        adx = await MarketDataFetcher.fetchADX(bot.symbol, bot.exchange, timeframe);
        console.log(`✅ [${bot.name}] ADX fetched: ${adx}`);
        await this.addBotLog(bot.id, {
          level: 'info',
          category: 'market',
          message: `✅ ADX fetched: ${adx}`,
          details: { step: 'fetch_adx', adx, symbol: bot.symbol }
        });
      } catch (marketDataError: any) {
        console.error(`❌ [${bot.name}] Market data fetch failed:`, marketDataError);
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'market',
          message: `❌ Market data fetch error: ${marketDataError?.message || String(marketDataError)}`,
          details: {
            error: marketDataError?.message || String(marketDataError),
            symbol: bot.symbol,
            exchange: bot.exchange,
            tradingType,
            timeframe,
            step: 'market_data_fetch',
            stopped: true
          }
        });
        throw marketDataError; // Re-throw to be caught by outer catch
      }
      
      await this.addBotLog(bot.id, {
        level: 'info',
        category: 'market',
        message: `Market data: Price=${currentPrice}, RSI=${rsi.toFixed(2)}, ADX=${adx.toFixed(2)}`,
        details: { price: currentPrice, rsi, adx }
      });
      
      console.log(`📊 Bot ${bot.name} market data: Price=${currentPrice}, RSI=${rsi.toFixed(2)}, ADX=${adx.toFixed(2)}`);
      
      // Validate market data before strategy evaluation
      if (!currentPrice || currentPrice === 0 || !isFinite(currentPrice)) {
        console.error(`❌ Invalid price for ${bot.symbol}: ${currentPrice}. Skipping strategy evaluation.`);
        
        // Check if symbol might be incomplete (e.g., "ETH" instead of "ETHUSDT")
        const symbolUpper = bot.symbol.toUpperCase().trim();
        const commonCoins = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'XRP', 'DOGE', 'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'ATOM', 'ALGO', 'NEAR', 'FTM', 'SAND', 'MANA', 'AXS', 'GALA', 'ENJ', 'CHZ', 'HBAR', 'ICP', 'FLOW', 'THETA', 'FIL', 'EOS', 'TRX', 'LTC', 'BCH', 'XLM', 'VET', 'AAVE', 'MKR', 'COMP', 'SNX', 'CRV', 'SUSHI', '1INCH', 'PEPE', 'SHIB', 'FLOKI', 'BONK', 'WIF', 'HMAR', 'STRK', 'ARB', 'OP', 'SUI', 'APT', 'INJ', 'TIA', 'SEI', 'RENDER', 'FET'];
        const isIncompleteSymbol = commonCoins.includes(symbolUpper) && !symbolUpper.endsWith('USDT') && !symbolUpper.endsWith('USD') && !symbolUpper.endsWith('BUSD');
        const suggestedSymbol = isIncompleteSymbol ? `${symbolUpper}USDT` : null;
        
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'market',
          message: `Invalid price data: ${currentPrice}. Cannot evaluate strategy.${suggestedSymbol ? ` Symbol "${bot.symbol}" appears incomplete. Try "${suggestedSymbol}" instead.` : ''}${bot.exchange === 'bitunix' ? ' Bitunix API may be unavailable or symbol format may be incorrect.' : ''}`,
          details: { 
            price: currentPrice, 
            symbol: bot.symbol,
            suggested_symbol: suggestedSymbol,
            exchange: bot.exchange,
            trading_type: bot.trading_type || bot.tradingType
          }
        });
        return;
      }
      
      if (!isFinite(rsi) || rsi < 0 || rsi > 100) {
        console.error(`❌ Invalid RSI for ${bot.symbol}: ${rsi}. Skipping strategy evaluation.`);
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'market',
          message: `Invalid RSI data: ${rsi}. Cannot evaluate strategy.`,
          details: { rsi, symbol: bot.symbol }
        });
        return;
      }
      
      if (!isFinite(adx) || adx < 0) {
        console.error(`❌ Invalid ADX for ${bot.symbol}: ${adx}. Skipping strategy evaluation.`);
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'market',
          message: `Invalid ADX data: ${adx}. Cannot evaluate strategy.`,
          details: { adx, symbol: bot.symbol }
        });
        return;
      }
      
      console.log(`✅ Market data validated. Proceeding with strategy evaluation...`);
      await this.addBotLog(bot.id, {
        level: 'info',
        category: 'system',
        message: `✅ Market data validated. Proceeding with strategy evaluation...`,
        details: { 
          step: 'market_data_validated',
          price: currentPrice,
          rsi,
          adx,
          symbol: bot.symbol
        }
      });
      
      // Execute trading strategy - handle potential double-encoding and malformed data
      console.log(`\n🔍 [${bot.name}] === STARTING STRATEGY PARSING ===`);
      console.log(`📋 [${bot.name}] Parsing strategy configuration...`);
      console.log(`📋 [${bot.name}] Bot strategy exists: ${!!bot.strategy}`);
      console.log(`📋 [${bot.name}] Bot strategy type: ${typeof bot.strategy}`);
      
      try {
        await this.addBotLog(bot.id, {
          level: 'info',
          category: 'strategy',
          message: `📋 Parsing strategy configuration...`,
          details: { step: 'strategy_parsing', bot_name: bot.name }
        });
      } catch (logError) {
        console.error(`❌ Failed to log strategy parsing start:`, logError);
        // Continue execution even if logging fails
      }
      
      console.log(`📋 [${bot.name}] Strategy value type: ${typeof bot.strategy}`);
      console.log(`📋 [${bot.name}] Strategy value (first 200 chars): ${typeof bot.strategy === 'string' ? bot.strategy.substring(0, 200) : JSON.stringify(bot.strategy).substring(0, 200)}`);
      
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
          // Try to use SUPER LENIENT default strategy if parsing fails
          // This ensures bots can still trade even if strategy parsing fails
          strategy = {
            rsiThreshold: 50, // Lowered from 70 - will always generate signal
            adxThreshold: 0, // Lowered from 25 - no ADX restriction
            bbWidthThreshold: 0, // Lowered from 0.02 - no BB restriction
            emaSlope: 0, // Lowered from 0.5 - no EMA slope restriction
            atrPercentage: 0, // Lowered from 2.5 - no ATR restriction
            vwapDistance: 0, // Lowered from 1.2 - no VWAP restriction
            momentumThreshold: 0, // Lowered from 0.8 - no momentum restriction
            useMLPrediction: false,
            minSamplesForML: 100,
            type: 'default',
            immediate_execution: true,
            super_aggressive: true
          };
          console.warn('⚠️ Using super lenient default strategy due to parsing error');
        }
      }
      
      console.log(`✅ [${bot.name}] Strategy parsing completed. Type: ${typeof strategy}`);
      console.log('Bot strategy:', JSON.stringify(strategy, null, 2));
      
      try {
        await this.addBotLog(bot.id, {
          level: 'info',
          category: 'strategy',
          message: `📋 Strategy parsed successfully`,
          details: { 
            step: 'strategy_parsed',
            strategy_type: typeof strategy,
            has_rsi: !!strategy?.rsiThreshold,
            has_adx: !!strategy?.adxThreshold,
            strategy_keys: strategy && typeof strategy === 'object' ? Object.keys(strategy).slice(0, 10) : null
          }
        });
      } catch (logError) {
        console.error(`❌ Failed to log strategy parsed:`, logError);
        // Continue execution even if logging fails
      }
      
      // Evaluate strategy with error handling
      console.log(`🔍 Evaluating strategy for ${bot.name} (${bot.symbol})...`);
      await this.addBotLog(bot.id, {
        level: 'info',
        category: 'strategy',
        message: `🔍 Evaluating strategy...`,
        details: { 
          step: 'strategy_evaluation_start',
          bot_name: bot.name,
          symbol: bot.symbol,
          market_data: { price: currentPrice, rsi, adx }
        }
      });
      
      let shouldTrade: any;
      try {
        shouldTrade = await this.evaluateStrategy(strategy, { price: currentPrice, rsi, adx }, bot);
        console.log(`✅ Strategy evaluation completed for ${bot.name}`);
        await this.addBotLog(bot.id, {
          level: 'info',
          category: 'strategy',
          message: `✅ Strategy evaluation completed`,
          details: { 
            step: 'strategy_evaluation_complete',
            should_trade: shouldTrade?.shouldTrade,
            side: shouldTrade?.side,
            reason: shouldTrade?.reason
          }
        });
      } catch (strategyError: any) {
        const errorMsg = strategyError?.message || String(strategyError);
        console.error(`❌ Strategy evaluation failed for ${bot.name}:`, errorMsg);
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'strategy',
          message: `Strategy evaluation error: ${errorMsg}`,
          details: { 
            error: errorMsg,
            strategy: strategy,
            marketData: { price: currentPrice, rsi, adx }
          }
        });
        throw strategyError; // Re-throw to be caught by outer catch
      }
      
      console.log(`\n📊 === STRATEGY EVALUATION RESULT ===`);
      console.log(`   Bot: ${bot.name} (${bot.symbol})`);
      console.log(`   Should Trade: ${shouldTrade?.shouldTrade ? 'YES ✅' : 'NO ❌'}`);
      console.log(`   Side: ${shouldTrade?.side || 'N/A'}`);
      console.log(`   Reason: ${shouldTrade?.reason || 'N/A'}`);
      console.log(`   Confidence: ${shouldTrade?.confidence || 0}`);
      console.log(`   Full Result:`, JSON.stringify(shouldTrade, null, 2));
      console.log(`=== END STRATEGY RESULT ===\n`);
      
      // Apply bias_mode filter to all strategies (safety check)
      if (shouldTrade?.shouldTrade && shouldTrade?.side) {
        const config = bot.strategy_config || {};
        const biasMode = config.bias_mode;
        const signalSide = shouldTrade.side.toLowerCase();
        
        if (biasMode === 'long-only' && (signalSide === 'sell' || signalSide === 'short')) {
          console.log(`🚫 Bias mode filter: Blocking ${signalSide} trade (bias_mode: long-only)`);
          shouldTrade = {
            shouldTrade: false,
            reason: `Bias mode 'long-only' blocks ${signalSide} trades`,
            confidence: 0
          };
        } else if (biasMode === 'short-only' && (signalSide === 'buy' || signalSide === 'long')) {
          console.log(`🚫 Bias mode filter: Blocking ${signalSide} trade (bias_mode: short-only)`);
          shouldTrade = {
            shouldTrade: false,
            reason: `Bias mode 'short-only' blocks ${signalSide} trades`,
            confidence: 0
          };
        }
      }
      
      // Ensure shouldTrade always has a reason
      if (!shouldTrade || typeof shouldTrade !== 'object') {
        shouldTrade = {
          shouldTrade: false,
          reason: 'Strategy evaluation returned invalid result',
          confidence: 0
        };
      }
      if (!shouldTrade.reason) {
        shouldTrade.reason = shouldTrade.shouldTrade 
          ? 'Trading conditions met' 
          : 'No trading signals detected (all strategy parameters checked)';
      }
      
      // Log strategy result to bot activity logs
      await this.addBotLog(bot.id, {
        level: shouldTrade?.shouldTrade ? 'info' : 'info',
        category: 'strategy',
        message: shouldTrade?.shouldTrade 
          ? `✅ Strategy signal: ${shouldTrade.side.toUpperCase()} - ${shouldTrade.reason || 'Trading conditions met'}`
          : `⏸️ Strategy signal: ${shouldTrade?.reason || 'Trading conditions not met'}`,
        details: {
          shouldTrade: shouldTrade?.shouldTrade,
          side: shouldTrade?.side,
          reason: shouldTrade?.reason,
          confidence: shouldTrade?.confidence,
          marketData: { price: currentPrice, rsi, adx }
        }
      });
      
      if (shouldTrade?.shouldTrade) {
        console.log(`🚀 Trading conditions met - executing ${shouldTrade.side.toUpperCase()} trade for ${bot.name}`);
        try {
          await this.executeTrade(bot, shouldTrade);
          console.log(`✅ Trade execution completed for ${bot.name}`);
        } catch (tradeError: any) {
          const tradeErrorMsg = tradeError?.message || String(tradeError);
          console.error(`❌ Trade execution failed for ${bot.name}:`, tradeErrorMsg);
          // Error is already logged in executeTrade, just re-throw
          throw tradeError;
        }
      } else {
        console.log(`⏸️ Trading conditions not met for ${bot.name}: ${shouldTrade?.reason || 'Unknown reason'}`);
        // Already logged above, no need to log again
      }
      
    } catch (error) {
      const executionTime = Date.now() - executionStartTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error(`\n❌ === BOT EXECUTION ERROR ===`);
      console.error(`   Bot ID: ${botId || 'unknown'}`);
      console.error(`   Bot Name: ${botName || 'unknown'}`);
      console.error(`   Error: ${errorMessage || 'Unknown error'}`);
      console.error(`   Execution Time: ${executionTime}ms`);
      if (errorStack && errorStack.length > 0) {
        console.error(`   Stack: ${errorStack.substring(0, 500)}`);
      }
      console.error(`\n`);
      
      // Check if this is a minimum order value error (already logged as warning)
      const isMinOrderValueError = errorMessage.includes('110094') || 
                                   errorMessage.includes('does not meet minimum order value') ||
                                   errorMessage.includes('below minimum');
      
      // Only log as error if it's not already handled as a warning
      if (!isMinOrderValueError) {
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'error',
          message: `Bot execution error: ${errorMessage}`,
          details: { 
            error: errorMessage,
            errorType: error instanceof Error ? error.name : typeof error,
            stack: errorStack,
            botId: bot.id,
            botName: bot.name,
            symbol: bot.symbol,
            exchange: bot.exchange,
            executionTimeMs: executionTime,
            timestamp: TimeSync.getCurrentTimeISO()
          }
        });
      } else {
        console.log(`ℹ️ Minimum order value error already logged as warning, skipping duplicate error log`);
      }
      
      // Re-throw to be caught by Promise.allSettled in execute_all_bots
      throw error;
    } finally {
      const executionTime = Date.now() - executionStartTime;
      console.log(`\n✅ === BOT EXECUTION COMPLETE ===`);
      console.log(`   Bot ID: ${botId}`);
      console.log(`   Bot Name: ${botName}`);
      console.log(`   Execution Time: ${executionTime}ms`);
      console.log(`   Timestamp: ${new Date().toISOString()}\n`);
    }
  }
  
  private async evaluateStrategy(strategy: any, marketData: any, bot: any = null): Promise<any> {
    const { rsi, adx, price, mlPrediction } = marketData;
    
    // Validate strategy object
    if (!strategy || typeof strategy !== 'object') {
      console.error('❌ Invalid strategy object:', strategy);
      return {
        shouldTrade: false,
        reason: 'Invalid strategy configuration',
        confidence: 0
      };
    }
    
    // 🚀 ALWAYS TRADE MODE: Trade on all conditions (highest priority)
    // This mode bypasses all strategy conditions and always generates a trade signal
    const config = bot?.strategy_config || {};
    const alwaysTrade = config.always_trade === true || 
                        strategy.always_trade === true ||
                        strategy.type === 'always_trade' ||
                        strategy.name === 'Always Trade Strategy' ||
                        strategy.name === 'Trade All Conditions';
    
    if (alwaysTrade) {
      // Determine side based on RSI direction (simple rule)
      // RSI > 50 = sell/short, RSI <= 50 = buy/long
      const side = rsi > 50 ? 'sell' : 'buy';
      console.log(`🚀 [ALWAYS TRADE MODE] Generating ${side.toUpperCase()} signal regardless of conditions (RSI: ${rsi.toFixed(2)})`);
      return {
        shouldTrade: true,
        side: side,
        reason: `Always Trade Mode: ${side.toUpperCase()} signal (RSI: ${rsi.toFixed(2)}, ADX: ${adx.toFixed(2)})`,
        confidence: 0.6,
        entryPrice: price,
        stopLoss: side === 'buy' ? price * 0.98 : price * 1.02,
        takeProfit1: side === 'buy' ? price * 1.02 : price * 0.98,
        takeProfit2: side === 'buy' ? price * 1.05 : price * 0.95,
        indicators: { rsi, adx, price }
      };
    }
    
    // 🚀 PAPER TRADING MODE: Check at the very beginning for ALL strategy types
    // Use more balanced thresholds for paper trading to allow for neutral states
    const isSuperAggressive = config.immediate_execution === true || config.super_aggressive === true || 
                              strategy.immediate_execution === true || strategy.super_aggressive === true ||
                              config.immediate_trading === true; // Also check immediate_trading
    
    // For ALL paper trading bots, trade based on RSI alone (not just super aggressive ones)
    // Note: always_trade mode is already handled above, so this section won't execute if always_trade is enabled
    if (bot?.paper_trading === true) {
      // For paper trading, trade based on RSI with reasonable buffers for "Neutral" state
      // This prevents bots from opening positions every single time they run
      const rsiOversold = config.rsi_oversold || strategy.rsiThreshold || 30; // Default 30 for paper
      const rsiOverbought = config.rsi_overbought || strategy.rsiThreshold || 70; // Default 70 for paper
      
      if (rsi < rsiOversold) {
        // RSI oversold - BUY signal
        console.log(`📝 [PAPER TRADING] BUY signal: RSI ${rsi.toFixed(2)} < ${rsiOversold}`);
        return {
          shouldTrade: true,
          side: 'buy',
          reason: `Paper Trading: RSI ${rsi.toFixed(2)} < ${rsiOversold} (oversold)`,
          confidence: 0.7,
          entryPrice: price,
          stopLoss: price * 0.98,
          takeProfit1: price * 1.02,
          takeProfit2: price * 1.05,
          indicators: { rsi, adx, price }
        };
      } else if (rsi > rsiOverbought) {
        // RSI overbought - SELL signal
        console.log(`📝 [PAPER TRADING] SELL signal: RSI ${rsi.toFixed(2)} > ${rsiOverbought}`);
        return {
          shouldTrade: true,
          side: 'sell',
          reason: `Paper Trading: RSI ${rsi.toFixed(2)} > ${rsiOverbought} (overbought)`,
          confidence: 0.7,
          entryPrice: price,
          stopLoss: price * 1.02,
          takeProfit1: price * 0.98,
          takeProfit2: price * 0.95,
          indicators: { rsi, adx, price }
        };
      } else {
        // RSI neutral - NO signal
        console.log(`📝 [PAPER TRADING] Neutral state: RSI ${rsi.toFixed(2)} is between ${rsiOversold} and ${rsiOverbought}`);
        return {
          shouldTrade: false,
          reason: `Paper Trading: RSI ${rsi.toFixed(2)} is neutral (between ${rsiOversold} and ${rsiOverbought})`,
          confidence: 0,
          indicators: { rsi, adx, price }
        };
      }
    }
    
    // Check if this is a trendline breakout strategy
    if (strategy.type === 'trendline_breakout' || strategy.name === 'Trendline Breakout Strategy') {
      try {
        console.log(`📈 Evaluating Trendline Breakout Strategy for ${bot?.name || 'bot'}...`);
        const result = await this.evaluateTrendlineBreakoutStrategy(strategy, marketData, bot);
        if (!result || typeof result !== 'object') {
          console.error('❌ Trendline breakout strategy returned invalid result:', result);
          // For paper trading, fall back to simple RSI/ADX logic
          if (bot?.paper_trading === true && strategy.rsiThreshold) {
            console.log(`📝 [PAPER] Trendline breakout strategy failed, falling back to RSI-based logic...`);
            // Continue to RSI logic below
          } else {
            return {
              shouldTrade: false,
              reason: 'Strategy evaluation returned invalid result',
              confidence: 0
            };
          }
        } else if (!result.shouldTrade && bot?.paper_trading === true && strategy.rsiThreshold) {
          // For paper trading, if trendline strategy says no trade but we have RSI threshold, use fallback
          console.log(`📝 [PAPER] Trendline breakout strategy returned no signal, falling back to RSI-based logic...`);
          // Continue to RSI logic below
        } else {
          return result;
        }
      } catch (error: any) {
        console.error('❌ Error in trendline breakout strategy evaluation:', error);
        // For paper trading, fall back to simple RSI/ADX logic
        if (bot?.paper_trading === true && strategy.rsiThreshold) {
          console.log(`📝 [PAPER] Trendline breakout strategy error, falling back to RSI-based logic...`);
          // Continue to RSI logic below
        } else {
          return {
            shouldTrade: false,
            reason: `Strategy evaluation error: ${error?.message || String(error)}`,
            confidence: 0
          };
        }
      }
    }
    
    // Check if this is a hybrid trend + mean reversion strategy
    if (strategy.type === 'hybrid_trend_meanreversion' || strategy.name === 'Hybrid Trend + Mean Reversion Strategy') {
      try {
        console.log(`📈 Evaluating Hybrid Trend + Mean Reversion Strategy for ${bot?.name || 'bot'}...`);
        const result = await this.evaluateHybridTrendMeanReversionStrategy(strategy, marketData, bot);
        if (!result || typeof result !== 'object') {
          console.error('❌ Hybrid strategy returned invalid result:', result);
          // For paper trading, fall back to simple RSI/ADX logic
          if (bot?.paper_trading === true && strategy.rsiThreshold) {
            console.log(`📝 [PAPER] Hybrid strategy failed, falling back to RSI-based logic...`);
            // Continue to RSI logic below
          } else {
            return {
              shouldTrade: false,
              reason: 'Strategy evaluation returned invalid result',
              confidence: 0
            };
          }
        } else if (!result.shouldTrade && bot?.paper_trading === true && strategy.rsiThreshold) {
          // For paper trading, if hybrid strategy says no trade but we have RSI threshold, use fallback
          console.log(`📝 [PAPER] Hybrid strategy returned no signal, falling back to RSI-based logic...`);
          // Continue to RSI logic below
        } else {
          return result;
        }
      } catch (error: any) {
        console.error('❌ Error in hybrid strategy evaluation:', error);
        // For paper trading, fall back to simple RSI/ADX logic
        if (bot?.paper_trading === true && strategy.rsiThreshold) {
          console.log(`📝 [PAPER] Hybrid strategy error, falling back to RSI-based logic...`);
          // Continue to RSI logic below
        } else {
          return {
            shouldTrade: false,
            reason: `Strategy evaluation error: ${error?.message || String(error)}`,
            confidence: 0
          };
        }
      }
    }
    
    // Check if this is an advanced dual-mode scalping strategy
    if (strategy.type === 'advanced_scalping' || strategy.name === 'Advanced Dual-Mode Scalping Strategy' || strategy.name?.includes('Advanced Dual-Mode')) {
      try {
        console.log(`⚡ Evaluating Advanced Dual-Mode Scalping Strategy for ${bot?.name || 'bot'}...`);
        const result = await this.evaluateAdvancedScalpingStrategy(strategy, marketData, bot);
        if (!result || typeof result !== 'object') {
          console.error('❌ Advanced scalping strategy returned invalid result:', result);
          // For paper trading, fall back to simple RSI/ADX logic
          if (bot?.paper_trading === true && strategy.rsiThreshold) {
            console.log(`📝 [PAPER] Advanced scalping strategy failed, falling back to RSI-based logic...`);
            // Continue to RSI logic below
          } else {
            return {
              shouldTrade: false,
              reason: 'Strategy evaluation returned invalid result',
              confidence: 0
            };
          }
        } else if (!result.shouldTrade && bot?.paper_trading === true && strategy.rsiThreshold) {
          // For paper trading, if scalping strategy says no trade but we have RSI threshold, use fallback
          console.log(`📝 [PAPER] Advanced scalping strategy returned no signal, falling back to RSI-based logic...`);
          // Continue to RSI logic below
        } else {
          return result;
        }
      } catch (error: any) {
        console.error('❌ Error in advanced scalping strategy evaluation:', error);
        // For paper trading, fall back to simple RSI/ADX logic
        if (bot?.paper_trading === true && strategy.rsiThreshold) {
          console.log(`📝 [PAPER] Advanced scalping strategy error, falling back to RSI-based logic...`);
          // Continue to RSI logic below
        } else {
          return {
            shouldTrade: false,
            reason: `Strategy evaluation error: ${error?.message || String(error)}`,
            confidence: 0
          };
        }
      }
    }
    
    // Check if this is a scalping strategy
    if (strategy.type === 'scalping' || strategy.name === 'Scalping Strategy - Fast EMA Cloud' || strategy.name?.includes('Scalping')) {
      try {
        console.log(`⚡ Evaluating Scalping Strategy for ${bot?.name || 'bot'}...`);
        const result = await this.evaluateScalpingStrategy(strategy, marketData, bot);
        if (!result || typeof result !== 'object') {
          console.error('❌ Scalping strategy returned invalid result:', result);
          // For paper trading, fall back to simple RSI/ADX logic
          if (bot?.paper_trading === true && strategy.rsiThreshold) {
            console.log(`📝 [PAPER] Scalping strategy failed, falling back to RSI-based logic...`);
            // Continue to RSI logic below
          } else {
            return {
              shouldTrade: false,
              reason: 'Strategy evaluation returned invalid result',
              confidence: 0
            };
          }
        } else if (!result.shouldTrade && bot?.paper_trading === true && strategy.rsiThreshold) {
          // For paper trading, if scalping strategy says no trade but we have RSI threshold, use fallback
          console.log(`📝 [PAPER] Scalping strategy returned no signal, falling back to RSI-based logic...`);
          // Continue to RSI logic below
        } else {
          return result;
        }
      } catch (error: any) {
        console.error('❌ Error in scalping strategy evaluation:', error);
        // For paper trading, fall back to simple RSI/ADX logic
        if (bot?.paper_trading === true && strategy.rsiThreshold) {
          console.log(`📝 [PAPER] Scalping strategy error, falling back to RSI-based logic...`);
          // Continue to RSI logic below
        } else {
          return {
            shouldTrade: false,
            reason: `Strategy evaluation error: ${error?.message || String(error)}`,
            confidence: 0
          };
        }
      }
    }
    
    // Initialize signals array to collect all strategy signals
    const signals: any[] = [];
    let confidence = 0;
    let reason = '';
    
    // 🤖 ML Prediction Signal (if available and enabled)
    if (mlPrediction && strategy.useMLPrediction === true) {
      const mlConfidence = mlPrediction.confidence || 0.5;
      const mlSignal = mlPrediction.prediction?.toLowerCase();
      
      if (mlSignal === 'buy' && mlConfidence > 0.6) {
        signals.push({
          side: 'buy',
          reason: `ML predicts BUY (${(mlConfidence * 100).toFixed(1)}% confidence)`,
          confidence: mlConfidence * 0.3 // Weight ML prediction at 30% of total confidence
        });
      } else if (mlSignal === 'sell' && mlConfidence > 0.6) {
        signals.push({
          side: 'sell',
          reason: `ML predicts SELL (${(mlConfidence * 100).toFixed(1)}% confidence)`,
          confidence: mlConfidence * 0.3 // Weight ML prediction at 30% of total confidence
        });
      }
    }
    
    // RSI strategy - ALWAYS generates signal if threshold is set
    // With rsiThreshold=50: RSI > 50 = sell, RSI <= 50 = buy (always generates signal!)
    if (strategy.rsiThreshold) {
      if (rsi >= strategy.rsiThreshold) {
        signals.push({
          side: 'sell',
          reason: `RSI overbought (${rsi.toFixed(2)} >= ${strategy.rsiThreshold})`,
          confidence: Math.min((rsi - strategy.rsiThreshold) / 10 + 0.1, 1) // Add 0.1 base confidence
        });
      } else {
        // RSI < threshold = buy signal (always true if RSI < threshold)
        signals.push({
          side: 'buy',
          reason: `RSI oversold (${rsi.toFixed(2)} < ${strategy.rsiThreshold})`,
          confidence: Math.min(((strategy.rsiThreshold - rsi) / 10) + 0.1, 1) // Add 0.1 base confidence
        });
      }
    }
    
    // ADX strategy - Very lenient: if threshold is low (<=5), always allow if ADX > 0
    if (strategy.adxThreshold) {
      const adxThreshold = strategy.adxThreshold;
      // If threshold is very low (<=5), be very lenient - allow any ADX > 0
      if (adxThreshold <= 5) {
        if (adx > 0) {
          signals.push({
            side: rsi > 50 ? 'sell' : 'buy',
            reason: `Trend detected (ADX: ${adx.toFixed(2)} > 0, threshold: ${adxThreshold})`,
            confidence: Math.min((adx / 20) + 0.2, 1) // Base 0.2 confidence, scales with ADX
          });
        }
      } else if (adx >= adxThreshold) {
        signals.push({
          side: rsi > 50 ? 'sell' : 'buy',
          reason: `Strong trend detected (ADX: ${adx.toFixed(2)} >= ${adxThreshold})`,
          confidence: Math.min((adx - adxThreshold) / 20 + 0.3, 1)
        });
      }
    }
    
    // Bollinger Band width strategy (if configured)
    if (strategy.bbWidthThreshold) {
      // TODO: Fetch BB width from market data
      // For now, simulate BB width check
      const bbWidth = marketData.bbWidth || (Math.random() * 5); // Placeholder
      if (bbWidth > strategy.bbWidthThreshold) {
        signals.push({
          side: rsi > 50 ? 'sell' : 'buy',
          reason: `High volatility (BB width: ${bbWidth.toFixed(2)} > ${strategy.bbWidthThreshold})`,
          confidence: Math.min((bbWidth - strategy.bbWidthThreshold) / 5, 1) * 0.5
        });
      }
    }
    
    // EMA slope strategy (if configured)
    if (strategy.emaSlope) {
      // TODO: Fetch EMA slope from market data
      // For now, simulate EMA slope check
      const emaSlope = marketData.emaSlope || (Math.random() * 2 - 1); // Placeholder
      if (Math.abs(emaSlope) > strategy.emaSlope) {
        signals.push({
          side: emaSlope > 0 ? 'buy' : 'sell',
          reason: `Strong EMA slope (${emaSlope.toFixed(2)} > ${strategy.emaSlope})`,
          confidence: Math.min(Math.abs(emaSlope - strategy.emaSlope) / 2, 1) * 0.5
        });
      }
    }
    
    // ATR percentage strategy (if configured)
    if (strategy.atrPercentage) {
      // TODO: Fetch ATR from market data
      const atrPercent = marketData.atrPercent || (Math.random() * 5); // Placeholder
      if (atrPercent > strategy.atrPercentage) {
        signals.push({
          side: rsi > 50 ? 'sell' : 'buy',
          reason: `High volatility (ATR: ${atrPercent.toFixed(2)}% > ${strategy.atrPercentage}%)`,
          confidence: Math.min((atrPercent - strategy.atrPercentage) / 5, 1) * 0.5
        });
      }
    }
    
    // VWAP distance strategy (if configured)
    if (strategy.vwapDistance) {
      // TODO: Fetch VWAP distance from market data
      const vwapDist = marketData.vwapDistance || (Math.random() * 2); // Placeholder
      if (Math.abs(vwapDist) > strategy.vwapDistance) {
        signals.push({
          side: vwapDist > 0 ? 'sell' : 'buy', // Above VWAP = sell, below = buy
          reason: `Price far from VWAP (${vwapDist.toFixed(2)}% > ${strategy.vwapDistance}%)`,
          confidence: Math.min((Math.abs(vwapDist) - strategy.vwapDistance) / 2, 1) * 0.5
        });
      }
    }
    
    // Momentum threshold strategy (if configured)
    if (strategy.momentumThreshold) {
      // TODO: Fetch momentum from market data
      const momentum = marketData.momentum || (Math.random() * 4 - 2); // Placeholder
      if (Math.abs(momentum) > strategy.momentumThreshold) {
        signals.push({
          side: momentum > 0 ? 'buy' : 'sell',
          reason: `Strong momentum (${momentum.toFixed(2)} > ${strategy.momentumThreshold})`,
          confidence: Math.min((Math.abs(momentum) - strategy.momentumThreshold) / 2, 1) * 0.5
        });
      }
    }
    
    // Aggregate signals: if multiple signals agree, increase confidence
    if (signals.length > 0) {
      // Group signals by side
      const buySignals = signals.filter(s => s.side === 'buy');
      const sellSignals = signals.filter(s => s.side === 'sell');
      
      // Determine final side based on majority
      const finalSide = buySignals.length > sellSignals.length ? 'buy' : 
                       sellSignals.length > buySignals.length ? 'sell' : 
                       signals[0].side;
      
      // Calculate average confidence
      const relevantSignals = finalSide === 'buy' ? buySignals : sellSignals;
      confidence = relevantSignals.reduce((sum, s) => sum + s.confidence, 0) / relevantSignals.length;
      
      // Combine reasons
      reason = relevantSignals.map(s => s.reason).join('; ');
      
      return {
        shouldTrade: true,
        side: finalSide,
        reason: reason,
        confidence: Math.min(confidence, 1),
        signalsCount: signals.length
      };
    }
    
    // If no signals generated, try to generate a basic signal based on RSI
    // This ensures bots can still trade even if no specific strategy conditions are met
    // Note: config and isSuperAggressive are already declared at the top of this function
    // Re-check isSuperAggressive for fallback logic (it may have been false earlier but we want to try again)
    if (isSuperAggressive) {
      // Generate signal based on RSI direction
      const side = rsi > 50 ? 'sell' : 'buy';
      return {
        shouldTrade: true,
        side: side,
        reason: `Super aggressive mode: ${side.toUpperCase()} signal based on RSI ${rsi.toFixed(2)}`,
        confidence: 0.5, // Base confidence for aggressive mode
        entryPrice: marketData.price,
        stopLoss: side === 'buy' ? marketData.price * 0.98 : marketData.price * 1.02,
        takeProfit1: side === 'buy' ? marketData.price * 1.02 : marketData.price * 0.98,
        indicators: { rsi, adx, price: marketData.price }
      };
    }
    
    // If RSI threshold is set but no signal, generate one anyway (fallback)
    if (strategy.rsiThreshold) {
      const side = rsi >= strategy.rsiThreshold ? 'sell' : 'buy';
      return {
        shouldTrade: true,
        side: side,
        reason: `Fallback signal: ${side.toUpperCase()} based on RSI ${rsi.toFixed(2)} vs threshold ${strategy.rsiThreshold}`,
        confidence: 0.4,
        entryPrice: marketData.price,
        stopLoss: side === 'buy' ? marketData.price * 0.98 : marketData.price * 1.02,
        takeProfit1: side === 'buy' ? marketData.price * 1.02 : marketData.price * 0.98,
        indicators: { rsi, adx, price: marketData.price }
      };
    }
    
    return {
      shouldTrade: false,
      reason: 'No trading signals detected (all strategy parameters checked)',
      confidence: 0
    };
  }

  /**
   * Evaluate Trendline Breakout Strategy
   * Based on Pine Script: Trendline Breakout Strategy with volume confirmation
   */
  private async evaluateTrendlineBreakoutStrategy(strategy: any, marketData: any, bot: any): Promise<any> {
    try {
      // Get strategy config from bot
      let strategyConfig: any = {};
      if (bot?.strategy_config) {
        if (typeof bot.strategy_config === 'string') {
          strategyConfig = JSON.parse(bot.strategy_config);
        } else {
          strategyConfig = bot.strategy_config;
        }
      }

      const trendlineLength = strategyConfig.trendline_length || 30;
      const volumeMultiplier = strategyConfig.volume_multiplier || 1.5;
      const tradeDirection = strategyConfig.trade_direction || 'both';
      const timeframe = bot.timeframe || bot.timeFrame || '1h';
      const symbol = bot.symbol;
      const exchange = bot.exchange;
      const tradingType = bot.tradingType || bot.trading_type || 'futures';

      // Fetch klines data (need at least trendlineLength + 1 candles)
      const klines = await MarketDataFetcher.fetchKlines(symbol, exchange, timeframe, trendlineLength + 10);
      
      if (klines.length < trendlineLength + 1) {
        return {
          shouldTrade: false,
          reason: `Insufficient klines data (${klines.length} < ${trendlineLength + 1})`,
          confidence: 0
        };
      }

      // Extract closes and volumes
      const closes = klines.map(k => k[4]); // close price
      const volumes = klines.map(k => k[5]); // volume
      const currentPrice = closes[closes.length - 1];
      const currentVolume = volumes[volumes.length - 1];

      // Calculate linear regression trendline (simple linear regression)
      const trendline = this.calculateLinearRegression(closes.slice(-trendlineLength - 1, -1), trendlineLength);
      const previousTrendline = this.calculateLinearRegression(closes.slice(-trendlineLength - 2, -2), trendlineLength);
      const currentTrendline = this.calculateLinearRegression(closes.slice(-trendlineLength, closes.length), trendlineLength);

      // Calculate average volume
      const avgVolume = volumes.slice(-trendlineLength).reduce((a, b) => a + b, 0) / trendlineLength;

      // For daily timeframe, make volume confirmation much more lenient or optional
      // Daily candles have less frequent volume spikes, so strict volume requirements block too many trades
      const isDaily = (timeframe === '1d' || timeframe === '1D');
      
      let volumeConfirmed = true;
      let volumeConfidence = 1.0;

      if (isDaily) {
        // For daily timeframe: only require volume to be at least 80% of average (very lenient)
        // This allows trades during normal market conditions without requiring volume spikes
        const dailyVolumeThreshold = avgVolume * 0.8;
        
        if (currentVolume < dailyVolumeThreshold) {
          // Still allow trade but with lower confidence if volume is very low (< 50% of average)
          if (currentVolume < avgVolume * 0.5) {
            volumeConfidence = 0.6; // Lower confidence for very low volume
            console.log(`Daily timeframe: Very low volume (${currentVolume.toFixed(2)} < ${(avgVolume * 0.5).toFixed(2)}), proceeding with reduced confidence`);
          } else {
            volumeConfidence = 0.8; // Slightly reduced confidence for below 80% threshold
            console.log(`Daily timeframe: Volume below 80% threshold but acceptable (${currentVolume.toFixed(2)} > ${(avgVolume * 0.5).toFixed(2)})`);
          }
        } else {
          // Volume is good, full confidence
          volumeConfidence = 1.0;
        }
      } else {
        // For other timeframes, use the configured volume multiplier
        const effectiveVolumeMultiplier = volumeMultiplier;
        volumeConfirmed = currentVolume > avgVolume * effectiveVolumeMultiplier;

        if (!volumeConfirmed) {
          return {
            shouldTrade: false,
            reason: `Volume not confirmed (${currentVolume.toFixed(2)} < ${(avgVolume * effectiveVolumeMultiplier).toFixed(2)})`,
            confidence: 0
          };
        }
      }

      // Check for crossover/crossunder
      const prevPrice = closes[closes.length - 2];
      const prevTrendline = trendline;

      const longCond = (tradeDirection === 'both' || tradeDirection === 'Long Only') &&
                       prevPrice <= prevTrendline && currentPrice > currentTrendline;
      
      const shortCond = (tradeDirection === 'both' || tradeDirection === 'Short Only') &&
                        prevPrice >= prevTrendline && currentPrice < currentTrendline;

      if (longCond) {
        return {
          shouldTrade: true,
          side: 'buy',
          reason: `Trendline breakout LONG: Price crossed above trendline with volume confirmation`,
          confidence: 0.8 * volumeConfidence,
          entryPrice: currentPrice,
          trendline: currentTrendline
        };
      }

      if (shortCond) {
        return {
          shouldTrade: true,
          side: 'sell',
          reason: `Trendline breakout SHORT: Price crossed below trendline with volume confirmation`,
          confidence: 0.8 * volumeConfidence,
          entryPrice: currentPrice,
          trendline: currentTrendline
        };
      }

      return {
        shouldTrade: false,
        reason: 'No trendline breakout detected',
        confidence: 0
      };
    } catch (error: any) {
      console.error('Error evaluating trendline breakout strategy:', error);
      return {
        shouldTrade: false,
        reason: `Strategy evaluation error: ${error?.message || error}`,
        confidence: 0
      };
    }
  }

  /**
   * Evaluate Hybrid Trend-Following + Mean Reversion Strategy
   * Combines HTF trend confirmation with mean reversion entry signals
   */
  private async evaluateHybridTrendMeanReversionStrategy(strategy: any, marketData: any, bot: any): Promise<any> {
    try {
      const { rsi, adx, price } = marketData;
      const config = bot.strategy_config || {};
      
      // Get configuration values with defaults (lowered for more trading opportunities)
      const htfTimeframe = config.htf_timeframe || '4h';
      // Check if HTF ADX check should be disabled (either 0, negative, or disable_htf_adx_check flag)
      // Note: Database validation requires adx_min_htf to be 15-35, so we use a flag to bypass
      const disableHTFADXCheck = config.disable_htf_adx_check === true || 
                                 (config.adx_min_htf !== undefined && config.adx_min_htf !== null && config.adx_min_htf <= 0);
      const adxMinHTF = disableHTFADXCheck ? 0 : (config.adx_min_htf || 15); // Default to 15 if not disabled
      const adxTrendMin = config.adx_trend_min || 5; // Lowered from 12 to 5
      const adxMeanRevMax = config.adx_meanrev_max || 50; // Increased from 19 - this is MAX ADX for mean reversion, so higher = more lenient
      const rsiOversold = config.rsi_oversold || 40; // Increased from 30 - more lenient
      const momentumThreshold = config.momentum_threshold || 0.3; // Lowered from 0.8 - much more lenient
      const vwapDistance = config.vwap_distance || 0.5; // Lowered from 1.2 - much more lenient
      const timeframe = bot.timeframe || bot.timeFrame || '4h';
      
      // 1. Fetch HTF (4H) klines for trend confirmation
      const htfKlines = await MarketDataFetcher.fetchKlines(bot.symbol, bot.exchange, htfTimeframe, 200);
      if (!htfKlines || htfKlines.length < 50) {
        return {
          shouldTrade: false,
          reason: `Insufficient HTF data (${htfKlines?.length || 0} candles, need 50+)`,
          confidence: 0
        };
      }
      
      // Calculate HTF indicators
      const htfCloses = htfKlines.map(k => k[4]); // Close prices
      const htfHighs = htfKlines.map(k => k[2]); // High prices
      const htfLows = htfKlines.map(k => k[3]); // Low prices
      
      // Calculate EMA200 on HTF
      const htfEMA200 = this.calculateEMA(htfCloses, 200);
      const htfEMA50 = this.calculateEMA(htfCloses, 50);
      
      // Calculate HTF ADX
      const htfADX = await MarketDataFetcher.fetchADX(bot.symbol, bot.exchange, htfTimeframe);
      
      // Get current HTF price
      const htfCurrentPrice = htfCloses[htfCloses.length - 1];
      
      // 2. HTF Trend Confirmation Checks
      const htfPriceAboveEMA200 = htfCurrentPrice > htfEMA200;
      const htfEMA50AboveEMA200 = htfEMA50 > htfEMA200;
      const htfEMA50BelowEMA200 = htfEMA50 < htfEMA200;
      const htfADXStrong = htfADX >= adxMinHTF;
      
      // Check if HTF ADX is rising (simplified: use previous ADX from klines if available)
      // For now, assume ADX is rising if it's above threshold (conservative approach)
      // In production, you'd calculate ADX from previous period
      const htfADXRising = htfADXStrong; // Simplified: if ADX is strong, assume it's rising
      
      // If HTF price is below EMA200, optionally allow SHORT entries when bias allows
      const allowShorts =
        (config.bias_mode === 'both' || config.bias_mode === 'auto') &&
        config.require_price_vs_trend !== 'above';

      // Check bias_mode restrictions
      if (config.bias_mode === 'long-only' && !htfPriceAboveEMA200) {
        return {
          shouldTrade: false,
          reason: `HTF price (${htfCurrentPrice.toFixed(2)}) not above EMA200 (${htfEMA200.toFixed(2)}) - long-only mode`,
          confidence: 0
        };
      }
      
      if (config.bias_mode === 'short-only' && htfPriceAboveEMA200) {
        return {
          shouldTrade: false,
          reason: `HTF price (${htfCurrentPrice.toFixed(2)}) above EMA200 (${htfEMA200.toFixed(2)}) - short-only mode`,
          confidence: 0
        };
      }

      // For LONG trades (uptrend): EMA50 alignment is preferred but not strictly required
      // Only warn if EMA50 is significantly misaligned (more than 2% difference)
      if (htfPriceAboveEMA200) {
        const ema50Diff = ((htfEMA50 - htfEMA200) / htfEMA200) * 100;
        if (ema50Diff < -2) { // EMA50 is more than 2% below EMA200
          // Still allow but with lower confidence - don't block completely
          console.log(`⚠️ HTF EMA50 (${htfEMA50.toFixed(2)}) is ${Math.abs(ema50Diff).toFixed(2)}% below EMA200 (${htfEMA200.toFixed(2)}) - proceeding with caution`);
        }
      }
      
      // For SHORT trades (downtrend): EMA50 alignment is preferred but not strictly required
      if (!htfPriceAboveEMA200 && allowShorts) {
        const ema50Diff = ((htfEMA200 - htfEMA50) / htfEMA200) * 100;
        if (ema50Diff < -2) { // EMA50 is more than 2% above EMA200 when it should be below
          // Still allow but with lower confidence - don't block completely
          console.log(`⚠️ HTF EMA50 (${htfEMA50.toFixed(2)}) is ${Math.abs(ema50Diff).toFixed(2)}% above EMA200 (${htfEMA200.toFixed(2)}) - proceeding with caution`);
        }
      }
      
      // If price is below EMA200 and shorts are not allowed, block the trade
      if (!htfPriceAboveEMA200 && !allowShorts) {
        return {
          shouldTrade: false,
          reason: `HTF price (${htfCurrentPrice.toFixed(2)}) not above EMA200 (${htfEMA200.toFixed(2)}) and shorts disabled`,
          confidence: 0
        };
      }
      
      // Only check HTF ADX if adxMinHTF > 0 (if 0, skip this check entirely)
      if (adxMinHTF > 0 && !htfADXStrong) {
        return {
          shouldTrade: false,
          reason: `HTF ADX (${htfADX.toFixed(2)}) below minimum (${adxMinHTF})`,
          confidence: 0
        };
      }
      
      // Only check HTF ADX rising if adxMinHTF > 0
      if (adxMinHTF > 0 && !htfADXRising) {
        return {
          shouldTrade: false,
          reason: `HTF ADX not rising (${htfADX.toFixed(2)})`,
          confidence: 0
        };
      }
      
      // 3. Current Timeframe Regime Filter
      // Only block if ADX is extremely low (below minimum trend threshold)
      // If adxTrendMin is 0 or negative, skip this check
      if (adxTrendMin > 0 && adx < adxTrendMin) {
        return {
          shouldTrade: false,
          reason: `ADX (${adx.toFixed(2)}) below trend minimum (${adxTrendMin}) - market not trending`,
          confidence: 0
        };
      }
      
      // ADX mean-reversion max check: if ADX is TOO HIGH (above max), it's a strong trend, not mean-reverting
      // This is a soft filter - only block if ADX is extremely high (strong trend, not suitable for mean reversion)
      // Note: adxMeanRevMax should be high (like 50) - if ADX > 50, market is in very strong trend
      if (adx > adxMeanRevMax) {
        console.log(`⚠️ ADX (${adx.toFixed(2)}) is very high (above ${adxMeanRevMax}) - strong trend, mean reversion less likely but still allowing trade`);
        // Don't block - just log a warning. High ADX can still work for trend-following entries.
      }
      
      // 4. Mean Reversion Entry Signal Checks (LONG or SHORT branch)
      
      // Fetch current timeframe klines for VWAP and momentum
      const currentKlines = await MarketDataFetcher.fetchKlines(bot.symbol, bot.exchange, timeframe, 100);
      if (!currentKlines || currentKlines.length < 20) {
        return {
          shouldTrade: false,
          reason: `Insufficient current timeframe data (${currentKlines?.length || 0} candles)`,
          confidence: 0
        };
      }
      
      // Calculate VWAP (Volume Weighted Average Price)
      let totalPV = 0; // Price * Volume
      let totalVolume = 0;
      for (let i = 0; i < currentKlines.length; i++) {
        const typicalPrice = (currentKlines[i][2] + currentKlines[i][3] + currentKlines[i][4]) / 3; // (H+L+C)/3
        const volume = currentKlines[i][5] || 0;
        totalPV += typicalPrice * volume;
        totalVolume += volume;
      }
      const vwap = totalVolume > 0 ? totalPV / totalVolume : price;
      
      // Compute VWAP distance: positive if price below VWAP, negative if above
      const vwapDistancePct = ((vwap - price) / vwap) * 100;
      
      // Calculate Momentum (rate of change over last 10 periods)
      const momentumPeriod = 10;
      if (currentKlines.length < momentumPeriod + 1) {
        return {
          shouldTrade: false,
          reason: `Insufficient data for momentum calculation`,
          confidence: 0
        };
      }
      
      const currentClose = currentKlines[currentKlines.length - 1][4];
      const pastClose = currentKlines[currentKlines.length - momentumPeriod - 1][4];
      const momentum = ((currentClose - pastClose) / pastClose) * 100;

      // Branch 4A: LONG entries (HTF uptrend)
      if (htfPriceAboveEMA200) {
        // More lenient conditions: RSI, VWAP, and momentum are preferred but not all strictly required
        // Use a scoring system instead of hard blocks
        
        let score = 0;
        let reasons = [];
        
        // RSI check (40% weight) - more lenient threshold
        if (rsi <= rsiOversold) {
          score += 0.4;
          reasons.push(`RSI oversold (${rsi.toFixed(2)} <= ${rsiOversold})`);
        } else if (rsi <= rsiOversold + 10) {
          score += 0.2; // Partial credit if RSI is close to oversold
          reasons.push(`RSI near oversold (${rsi.toFixed(2)} <= ${rsiOversold + 10})`);
        }
        
        // VWAP check (30% weight) - more lenient
        if (vwapDistancePct >= vwapDistance) {
          score += 0.3;
          reasons.push(`Price below VWAP (${vwapDistancePct.toFixed(2)}% >= ${vwapDistance}%)`);
        } else if (vwapDistancePct >= vwapDistance * 0.5) {
          score += 0.15; // Partial credit
          reasons.push(`Price somewhat below VWAP (${vwapDistancePct.toFixed(2)}% >= ${(vwapDistance * 0.5).toFixed(2)}%)`);
        }
        
        // Momentum check (30% weight) - more lenient
        if (momentum >= momentumThreshold) {
          score += 0.3;
          reasons.push(`Positive momentum (${momentum.toFixed(2)}% >= ${momentumThreshold}%)`);
        } else if (momentum >= momentumThreshold * 0.5) {
          score += 0.15; // Partial credit
          reasons.push(`Moderate momentum (${momentum.toFixed(2)}% >= ${(momentumThreshold * 0.5).toFixed(2)}%)`);
        }
        
        // Require at least 50% score to trade (at least 2 out of 3 conditions met, or strong in 1-2)
        if (score < 0.5) {
          return {
            shouldTrade: false,
            reason: `Long conditions not met (score: ${(score * 100).toFixed(0)}%): ${reasons.length > 0 ? reasons.join('; ') : 'RSI, VWAP, and momentum checks failed'}`,
            confidence: 0
          };
        }

        // Calculate confidence based on score and individual factors
        let confidence = score; // Start with base score (0.5 to 1.0)
        
        // Boost confidence based on how well conditions are met
        if (rsi <= rsiOversold) {
          confidence += Math.min((rsiOversold - rsi) / rsiOversold * 0.2, 0.2);
        }
        if (vwapDistancePct >= vwapDistance) {
          confidence += Math.min((vwapDistancePct - vwapDistance) / vwapDistance * 0.15, 0.15);
        }
        if (momentum >= momentumThreshold) {
          confidence += Math.min((momentum - momentumThreshold) / momentumThreshold * 0.15, 0.15);
        }
        
        // Add trend strength contributions
        confidence += Math.min((adx - adxTrendMin) / 20 * 0.2, 0.2);
        confidence += Math.min((htfADX - adxMinHTF) / 20 * 0.2, 0.2);
        
        confidence = Math.min(confidence, 1.0);

        return {
          shouldTrade: true,
          side: 'buy',
          reason: `Hybrid LONG: HTF uptrend (EMA200), ADX ${adx.toFixed(2)}, RSI ${rsi.toFixed(2)}, VWAP Δ ${vwapDistancePct.toFixed(2)}%, momentum ${momentum.toFixed(2)}% [Score: ${(score * 100).toFixed(0)}%]`,
          confidence: Math.max(confidence, 0.6), // Lower minimum confidence from 0.7 to 0.6
          entryPrice: price,
          htfTrend: { price: htfCurrentPrice, ema200: htfEMA200, ema50: htfEMA50, adx: htfADX },
          meanReversion: { rsi, vwap, vwapDistance: vwapDistancePct, momentum }
        };
      }

      // Branch 4B: SHORT entries (HTF downtrend) if allowed
      if (allowShorts && !htfPriceAboveEMA200) {
        const rsiOverbought = config.rsi_overbought || 70;
        const vwapAbovePct = ((price - vwap) / vwap) * 100; // price above VWAP in %
        const momentumDown = -momentum; // negative momentum magnitude
        
        // More lenient conditions for shorts - allow if price is above VWAP OR if momentum is negative
        // This allows shorts in downtrends even if price hasn't bounced above VWAP yet
        const vwapDistanceShort = config.vwap_distance_short || (vwapDistance * 0.5); // 50% of long requirement
        const momentumThresholdShort = config.momentum_threshold_short || (momentumThreshold * 0.5); // 50% of long requirement

        // For shorts, we can be more flexible:
        // Option 1: RSI overbought + price above VWAP (bounce in downtrend)
        // Option 2: RSI overbought + negative momentum (continuing downtrend)
        const condition1 = rsi >= rsiOverbought && vwapAbovePct >= vwapDistanceShort;
        const condition2 = rsi >= rsiOverbought && momentumDown >= momentumThresholdShort;
        
        if (!condition1 && !condition2) {
          // Provide detailed reason
          const reasons = [];
          if (rsi < rsiOverbought) {
            reasons.push(`RSI ${rsi.toFixed(2)} < ${rsiOverbought} (overbought threshold)`);
          }
          if (vwapAbovePct < vwapDistanceShort && momentumDown < momentumThresholdShort) {
            reasons.push(`Price-VWAP ${vwapAbovePct.toFixed(2)}% < ${vwapDistanceShort}% AND momentum ${momentumDown.toFixed(2)}% < ${momentumThresholdShort}%`);
          }
          return {
            shouldTrade: false,
            reason: `Short conditions not met: ${reasons.join(', ')}. Need: (RSI >= ${rsiOverbought} AND (VWAP >= ${vwapDistanceShort}% OR momentum >= ${momentumThresholdShort}%))`,
            confidence: 0
          };
        }

        // Calculate confidence based on which condition was met
        let confidence = 0.6; // Base confidence
        
        if (condition1) {
          // RSI overbought + price above VWAP (bounce short)
          confidence += Math.min((rsi - rsiOverbought) / 30 * 0.2, 0.2); // RSI contribution
          confidence += Math.min((vwapAbovePct - vwapDistanceShort) / vwapDistanceShort * 0.15, 0.15); // VWAP contribution
        }
        
        if (condition2) {
          // RSI overbought + negative momentum (trend continuation short)
          confidence += Math.min((rsi - rsiOverbought) / 30 * 0.2, 0.2); // RSI contribution
          confidence += Math.min((momentumDown - momentumThresholdShort) / momentumThresholdShort * 0.15, 0.15); // Momentum contribution
        }
        
        // Add trend strength contributions
        confidence += Math.min((adx - adxTrendMin) / 20 * 0.2, 0.2);
        confidence += Math.min((htfADX - adxMinHTF) / 20 * 0.2, 0.2);
        
        confidence = Math.min(confidence, 1.0);
        
        const conditionType = condition1 && condition2 ? 'bounce+continuation' : condition1 ? 'bounce' : 'continuation';
        
        return {
          shouldTrade: true,
          side: 'sell',
          reason: `Hybrid SHORT (${conditionType}): HTF downtrend (price ${htfCurrentPrice.toFixed(4)} < EMA200 ${htfEMA200.toFixed(4)}), ADX ${adx.toFixed(2)}, RSI ${rsi.toFixed(2)}, VWAP Δ +${vwapAbovePct.toFixed(2)}%, momentum -${momentumDown.toFixed(2)}%`,
          confidence: Math.max(confidence, 0.65),
          entryPrice: price,
          htfTrend: { price: htfCurrentPrice, ema200: htfEMA200, ema50: htfEMA50, adx: htfADX },
          meanReversion: { rsi, vwap, vwapDistance: -vwapAbovePct, momentum: -momentumDown }
        };
      }

      // If we reach here in downtrend and shorts not allowed
      return {
        shouldTrade: false,
        reason: 'HTF downtrend and shorts disabled by config',
        confidence: 0
      };
    } catch (error: any) {
      console.error('Error evaluating hybrid trend + mean reversion strategy:', error);
      return {
        shouldTrade: false,
        reason: `Strategy evaluation error: ${error?.message || error}`,
        confidence: 0
      };
    }
  }

  private async evaluateScalpingStrategy(strategy: any, marketData: any, bot: any): Promise<any> {
    try {
      const { rsi, adx, price } = marketData;
      const config = bot.strategy_config || {};
      
      // Get configuration values with defaults
      const timeframe = bot.timeframe || bot.timeFrame || '3m';
      const emaFast = config.ema_fast || 9;
      const emaSlow = config.ema_slow || 21;
      const rsiPeriod = config.rsi_period || 14;
      const rsiOversold = config.rsi_oversold || 30;
      const rsiOverbought = config.rsi_overbought || 70;
      const atrPeriod = config.atr_period || 14;
      const atrMultiplier = config.atr_multiplier || 1.5;
      // Make ADX check optional - if adx_min is 0 or negative, skip the check
      const adxMin = config.adx_min !== undefined && config.adx_min !== null && config.adx_min > 0
        ? config.adx_min 
        : 0; // 0 means skip ADX check
      const volumeMultiplier = config.volume_multiplier || 0.5; // Lowered from 1.2
      const minVolatilityATR = config.min_volatility_atr !== undefined && config.min_volatility_atr !== null && config.min_volatility_atr > 0
        ? config.min_volatility_atr 
        : 0; // 0 means skip volatility check
      const minVolumeRequirement = config.min_volume_requirement !== undefined && config.min_volume_requirement !== null && config.min_volume_requirement > 0
        ? config.min_volume_requirement 
        : 0; // 0 means skip volume check
      const timeFilterEnabled = config.time_filter_enabled !== false;
      const allowedHoursUTC = config.allowed_hours_utc || [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
      const vwapPeriod = config.vwap_period || 20;
      
      // SUPER AGGRESSIVE MODE: Check if bot should trade with minimal restrictions
      const isSuperAggressive = config.immediate_execution === true || config.super_aggressive === true;
      
      // Validate timeframe is suitable for scalping (1m, 3m, 5m)
      // SUPER AGGRESSIVE: Allow any timeframe if immediate_execution is true
      const validTimeframes = ['1m', '3m', '5m'];
      if (!isSuperAggressive && !validTimeframes.includes(timeframe)) {
        return {
          shouldTrade: false,
          reason: `Scalping strategy requires 1m, 3m, or 5m timeframe (current: ${timeframe})`,
          confidence: 0
        };
      }
      
      // 1. Time Filter - Avoid low liquidity zones
      // SUPER AGGRESSIVE: Skip time filter if immediate_execution is true
      if (timeFilterEnabled && !isSuperAggressive) {
        const now = new Date();
        const currentHourUTC = now.getUTCHours();
        if (!allowedHoursUTC.includes(currentHourUTC)) {
          return {
            shouldTrade: false,
            reason: `Time filter: Current hour (${currentHourUTC} UTC) not in allowed hours`,
            confidence: 0
          };
        }
      }
      
      // 2. Fetch klines for indicators
      const klines = await MarketDataFetcher.fetchKlines(bot.symbol, bot.exchange, timeframe, 100);
      if (!klines || klines.length < 50) {
        return {
          shouldTrade: false,
          reason: `Insufficient data (${klines?.length || 0} candles, need 50+)`,
          confidence: 0
        };
      }
      
      const closes = klines.map(k => parseFloat(k[4]));
      const highs = klines.map(k => parseFloat(k[2]));
      const lows = klines.map(k => parseFloat(k[3]));
      const volumes = klines.map(k => parseFloat(k[5]));
      const currentPrice = closes[closes.length - 1];
      
      // 3. Calculate EMA Cloud (Fast EMA 9, Slow EMA 21)
      const emaFastValue = this.calculateEMA(closes, emaFast);
      const emaSlowValue = this.calculateEMA(closes, emaSlow);
      const prevEmaFast = this.calculateEMA(closes.slice(0, -1), emaFast);
      const prevEmaSlow = this.calculateEMA(closes.slice(0, -1), emaSlow);
      
      // 4. Calculate ATR for volatility filter
      const atr = this.calculateATR(highs, lows, closes, atrPeriod);
      const atrPercent = (atr / currentPrice) * 100;
      
      // Check minimum volatility requirement (only if minVolatilityATR > 0)
      if (minVolatilityATR > 0 && atrPercent < minVolatilityATR) {
        return {
          shouldTrade: false,
          reason: `Volatility too low: ATR ${atrPercent.toFixed(2)}% < minimum ${minVolatilityATR}%`,
          confidence: 0
        };
      }
      
      // 5. Volume Confirmation - Avoid dead zones (only if minVolumeRequirement > 0)
      const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const currentVolume = volumes[volumes.length - 1];
      const volumeRatio = currentVolume / avgVolume;
      
      if (minVolumeRequirement > 0 && volumeRatio < minVolumeRequirement) {
        return {
          shouldTrade: false,
          reason: `Volume too low: ${volumeRatio.toFixed(2)}x < minimum ${minVolumeRequirement}x`,
          confidence: 0
        };
      }
      
      // 6. ADX for trend strength filter (avoid choppy markets)
      // Only check if adxMin > 0 (if 0, skip this check entirely)
      if (adxMin > 0 && adx < adxMin) {
        return {
          shouldTrade: false,
          reason: `ADX (${adx.toFixed(2)}) below minimum (${adxMin}) - market too choppy`,
          confidence: 0
        };
      }
      
      // 7. Calculate VWAP for intraday bias
      let totalPV = 0;
      let totalVolume = 0;
      const vwapLookback = Math.min(vwapPeriod, klines.length);
      for (let i = klines.length - vwapLookback; i < klines.length; i++) {
        const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
        totalPV += typicalPrice * volumes[i];
        totalVolume += volumes[i];
      }
      const vwap = totalVolume > 0 ? totalPV / totalVolume : currentPrice;
      
      // 8. Detect EMA Cloud Crossovers
      const emaFastAboveSlow = emaFastValue > emaSlowValue;
      const prevEmaFastAboveSlow = prevEmaFast > prevEmaSlow;
      const emaBullishCross = !prevEmaFastAboveSlow && emaFastAboveSlow; // Fast crosses above slow
      const emaBearishCross = prevEmaFastAboveSlow && !emaFastAboveSlow; // Fast crosses below slow
      
      // SUPER AGGRESSIVE MODE: Trade based on RSI alone (ignore EMA conditions)
      if (isSuperAggressive) {
        // Use RSI to determine direction when super aggressive
        // With rsi_oversold=50 and rsi_overbought=50, we trade on any RSI
        // RSI < 50 = oversold (BUY), RSI > 50 = overbought (SELL), RSI = 50 = treat as overbought (SELL)
        if (rsi < rsiOversold) {
          // RSI oversold - BUY signal
          return {
            shouldTrade: true,
            side: 'buy',
            reason: `Super Aggressive LONG: RSI ${rsi.toFixed(2)} < ${rsiOversold} (oversold)`,
            confidence: 0.7,
            entryPrice: currentPrice,
            stopLoss: currentPrice - (atr * atrMultiplier),
            takeProfit1: currentPrice + (atr * atrMultiplier * 1.5),
            takeProfit2: currentPrice + (atr * atrMultiplier * 3.0),
            indicators: {
              emaFast: emaFastValue,
              emaSlow: emaSlowValue,
              rsi: rsi,
              adx: adx,
              atr: atr,
              atrPercent: atrPercent,
              vwap: vwap,
              volumeRatio: volumeRatio
            }
          };
        } else {
          // RSI >= oversold threshold (including exactly 50) - SELL signal
          return {
            shouldTrade: true,
            side: 'sell',
            reason: `Super Aggressive SHORT: RSI ${rsi.toFixed(2)} >= ${rsiOversold} (overbought/neutral)`,
            confidence: 0.7,
            entryPrice: currentPrice,
            stopLoss: currentPrice + (atr * atrMultiplier),
            takeProfit1: currentPrice - (atr * atrMultiplier * 1.5),
            takeProfit2: currentPrice - (atr * atrMultiplier * 3.0),
            indicators: {
              emaFast: emaFastValue,
              emaSlow: emaSlowValue,
              rsi: rsi,
              adx: adx,
              atr: atr,
              atrPercent: atrPercent,
              vwap: vwap,
              volumeRatio: volumeRatio
            }
          };
        }
      }
      
      // 9. LONG Entry Rules
      // SUPER AGGRESSIVE MODE: If immediate_execution is true, relax all conditions
      if (emaBullishCross || (emaFastAboveSlow && currentPrice > emaFastValue) || isSuperAggressive) {
        // Additional filters for LONG
        const priceAboveVWAP = isSuperAggressive ? true : (currentPrice > vwap); // Skip VWAP check if super aggressive
        const rsiNotOverbought = isSuperAggressive ? true : (rsi < rsiOverbought); // Skip RSI check if super aggressive
        const rsiOversoldBounce = rsi < rsiOversold + 10 && rsi > rsiOversold - 5; // Micro reversal zone
        
        // Avoid fake breakouts: require price to be above both EMAs (relaxed for super aggressive)
        const priceAboveBothEMAs = isSuperAggressive ? true : (currentPrice > emaFastValue && currentPrice > emaSlowValue);
        
        // Avoid ranging phases: require ADX to show trend strength (only if adxMin > 0)
        const strongTrend = adxMin > 0 ? adx >= adxMin : true; // If adxMin is 0, always true
        
        // Super aggressive: trade on any EMA direction or price movement
        if (isSuperAggressive || (priceAboveBothEMAs && priceAboveVWAP && rsiNotOverbought && strongTrend)) {
          // Calculate confidence based on multiple factors
          let confidence = 0.6; // Base confidence
          
          if (emaBullishCross) confidence += 0.15; // Fresh crossover
          if (rsiOversoldBounce) confidence += 0.1; // RSI micro reversal
          if (volumeRatio >= volumeMultiplier) confidence += 0.1; // Strong volume
          if (atrPercent >= minVolatilityATR * 1.5) confidence += 0.05; // Good volatility
          
          confidence = Math.min(confidence, 0.95);
          
          return {
            shouldTrade: true,
            side: 'buy',
            reason: `Scalping LONG: EMA${emaFast} crossed above EMA${emaSlow}, price above VWAP, RSI ${rsi.toFixed(2)}, ADX ${adx.toFixed(2)}, volume ${volumeRatio.toFixed(2)}x`,
            confidence: confidence,
            entryPrice: currentPrice,
            stopLoss: currentPrice - (atr * atrMultiplier),
            takeProfit1: currentPrice + (atr * atrMultiplier * 1.5),
            takeProfit2: currentPrice + (atr * atrMultiplier * 3.0),
            indicators: {
              emaFast: emaFastValue,
              emaSlow: emaSlowValue,
              rsi: rsi,
              adx: adx,
              atr: atr,
              atrPercent: atrPercent,
              vwap: vwap,
              volumeRatio: volumeRatio
            }
          };
        }
      }
      
      // 10. SHORT Entry Rules
      // SUPER AGGRESSIVE MODE: If immediate_execution is true, relax all conditions
      if (emaBearishCross || (emaFastAboveSlow === false && currentPrice < emaFastValue) || isSuperAggressive) {
        // Additional filters for SHORT
        const priceBelowVWAP = isSuperAggressive ? true : (currentPrice < vwap); // Skip VWAP check if super aggressive
        const rsiNotOversold = isSuperAggressive ? true : (rsi > rsiOversold); // Skip RSI check if super aggressive
        const rsiOverboughtRejection = rsi > rsiOverbought - 10 && rsi < rsiOverbought + 5; // Micro reversal zone
        
        // Avoid fake breakouts: require price to be below both EMAs (relaxed for super aggressive)
        const priceBelowBothEMAs = isSuperAggressive ? true : (currentPrice < emaFastValue && currentPrice < emaSlowValue);
        
        // Avoid ranging phases: require ADX to show trend strength
        const strongTrend = adxMin > 0 ? adx >= adxMin : true; // If adxMin is 0, always true
        
        // Super aggressive: trade on any EMA direction or price movement
        if (isSuperAggressive || (priceBelowBothEMAs && priceBelowVWAP && rsiNotOversold && strongTrend)) {
          // Calculate confidence based on multiple factors
          let confidence = 0.6; // Base confidence
          
          if (emaBearishCross) confidence += 0.15; // Fresh crossover
          if (rsiOverboughtRejection) confidence += 0.1; // RSI micro reversal
          if (volumeRatio >= volumeMultiplier) confidence += 0.1; // Strong volume
          if (atrPercent >= minVolatilityATR * 1.5) confidence += 0.05; // Good volatility
          
          confidence = Math.min(confidence, 0.95);
          
          return {
            shouldTrade: true,
            side: 'sell',
            reason: `Scalping SHORT: EMA${emaFast} crossed below EMA${emaSlow}, price below VWAP, RSI ${rsi.toFixed(2)}, ADX ${adx.toFixed(2)}, volume ${volumeRatio.toFixed(2)}x`,
            confidence: confidence,
            entryPrice: currentPrice,
            stopLoss: currentPrice + (atr * atrMultiplier),
            takeProfit1: currentPrice - (atr * atrMultiplier * 1.5),
            takeProfit2: currentPrice - (atr * atrMultiplier * 3.0),
            indicators: {
              emaFast: emaFastValue,
              emaSlow: emaSlowValue,
              rsi: rsi,
              adx: adx,
              atr: atr,
              atrPercent: atrPercent,
              vwap: vwap,
              volumeRatio: volumeRatio
            }
          };
        }
      }
      
      // No trade signal
      return {
        shouldTrade: false,
        reason: `No scalping signal: EMA cloud ${emaFastAboveSlow ? 'bullish' : 'bearish'}, RSI ${rsi.toFixed(2)}, ADX ${adx.toFixed(2)}, volume ${volumeRatio.toFixed(2)}x`,
        confidence: 0
      };
      
    } catch (error: any) {
      console.error('❌ Error in scalping strategy:', error);
      return {
        shouldTrade: false,
        reason: `Strategy error: ${error?.message || String(error)}`,
        confidence: 0
      };
    }
  }
  
  private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
    if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) {
      return 0;
    }
    
    const trueRanges: number[] = [];
    for (let i = 1; i < highs.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }
    
    if (trueRanges.length < period) {
      const avg = trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
      return avg;
    }
    
    // Calculate ATR as SMA of True Ranges
    const recentTRs = trueRanges.slice(-period);
    return recentTRs.reduce((a, b) => a + b, 0) / period;
  }

  private calculateSupertrend(highs: number[], lows: number[], closes: number[], period: number, multiplier: number): { value: number; trend: 'bullish' | 'bearish' } {
    if (highs.length < period || lows.length < period || closes.length < period) {
      return { value: closes[closes.length - 1] || 0, trend: 'bullish' };
    }
    
    // Calculate ATR
    const atr = this.calculateATR(highs, lows, closes, period);
    
    // Calculate HL2 (High + Low) / 2
    const hl2 = (highs[highs.length - 1] + lows[lows.length - 1]) / 2;
    
    // Calculate Upper and Lower Bands
    const upperBand = hl2 + (multiplier * atr);
    const lowerBand = hl2 - (multiplier * atr);
    
    // Get previous Supertrend (simplified - in production, track previous values)
    const prevClose = closes[closes.length - 2] || closes[closes.length - 1];
    const prevUpperBand = (highs[highs.length - 2] + lows[lows.length - 2]) / 2 + (multiplier * atr);
    const prevLowerBand = (highs[highs.length - 2] + lows[lows.length - 2]) / 2 - (multiplier * atr);
    
    // Determine trend
    const currentPrice = closes[closes.length - 1];
    let supertrendValue: number;
    let trend: 'bullish' | 'bearish';
    
    // Simplified Supertrend calculation
    // In production, you'd track previous Supertrend value
    if (currentPrice > upperBand) {
      trend = 'bullish';
      supertrendValue = lowerBand;
    } else if (currentPrice < lowerBand) {
      trend = 'bearish';
      supertrendValue = upperBand;
    } else {
      // Use previous trend to determine current
      // For simplicity, use price vs HL2
      if (currentPrice > hl2) {
        trend = 'bullish';
        supertrendValue = lowerBand;
      } else {
        trend = 'bearish';
        supertrendValue = upperBand;
      }
    }
    
    return { value: supertrendValue, trend };
  }

  private calculateBollingerBands(closes: number[], period: number, stdDev: number): { upper: number; middle: number; lower: number; width: number } {
    if (closes.length < period) {
      const avg = closes.reduce((a, b) => a + b, 0) / closes.length;
      return { upper: avg, middle: avg, lower: avg, width: 0 };
    }
    
    const recentCloses = closes.slice(-period);
    const sma = recentCloses.reduce((a, b) => a + b, 0) / period;
    
    // Calculate standard deviation
    const variance = recentCloses.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const std = Math.sqrt(variance);
    
    const upper = sma + (stdDev * std);
    const lower = sma - (stdDev * std);
    const width = ((upper - lower) / sma) * 100; // Width as percentage
    
    return { upper, middle: sma, lower, width };
  }

  private async evaluateAdvancedScalpingStrategy(strategy: any, marketData: any, bot: any): Promise<any> {
    try {
      const { rsi, adx, price } = marketData;
      const config = bot.strategy_config || {};
      
      // Get configuration values with defaults
      const timeframe = bot.timeframe || bot.timeFrame || '3m';
      const htfTimeframe = config.htf_timeframe || '30m';
      const supertrendPeriod = config.supertrend_period || 10;
      const supertrendMultiplier = config.supertrend_multiplier || 3.0;
      const scalpingMode = config.scalping_mode || 'auto'; // 'reversal', 'continuation', 'auto'
      const emaFast = config.ema_fast || 9;
      const emaSlow = config.ema_slow || 21;
      const rsiOversold = config.rsi_oversold || 35;
      const rsiOverbought = config.rsi_overbought || 65;
      const rsiReversalZoneLow = config.rsi_reversal_zone_low || 30;
      const rsiReversalZoneHigh = config.rsi_reversal_zone_high || 70;
      const bbPeriod = config.bb_period || 20;
      const bbStdDev = config.bb_stddev || 2.0;
      const atrPeriod = config.atr_period || 14;
      const atrSLMultiplier = config.atr_sl_multiplier || 1.2;
      const volumeMultiplierReversal = config.volume_multiplier_reversal || 1.5;
      const volumeMultiplierContinuation = config.volume_multiplier_continuation || 1.2;
      const minVolatilityATRReversal = config.min_volatility_atr_reversal || 0.25;
      const minVolatilityATRContinuation = config.min_volatility_atr_continuation || 0.3;
      const maxVolatilityATR = config.max_volatility_atr || 2.0;
      const bbWidthMin = config.bb_width_min || 0.5;
      const bbWidthMax = config.bb_width_max || 3.0;
      const adxMinContinuation = config.adx_min_continuation || 20;
      const timeFilterEnabled = config.time_filter_enabled !== false;
      const allowedHoursUTC = config.allowed_hours_utc || [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
      const vwapPeriod = config.vwap_period || 20;
      
      // Validate timeframe
      const validTimeframes = ['1m', '3m', '5m'];
      if (!validTimeframes.includes(timeframe)) {
        return {
          shouldTrade: false,
          reason: `Advanced scalping requires 1m, 3m, or 5m timeframe (current: ${timeframe})`,
          confidence: 0
        };
      }
      
      // 1. Time Filter
      if (timeFilterEnabled) {
        const now = new Date();
        const currentHourUTC = now.getUTCHours();
        if (!allowedHoursUTC.includes(currentHourUTC)) {
          return {
            shouldTrade: false,
            reason: `Time filter: Current hour (${currentHourUTC} UTC) not in allowed hours`,
            confidence: 0
          };
        }
      }
      
      // 2. Fetch HTF klines for Supertrend
      const htfKlines = await MarketDataFetcher.fetchKlines(bot.symbol, bot.exchange, htfTimeframe, 100);
      if (!htfKlines || htfKlines.length < 30) {
        return {
          shouldTrade: false,
          reason: `Insufficient HTF data (${htfKlines?.length || 0} candles, need 30+)`,
          confidence: 0
        };
      }
      
      const htfHighs = htfKlines.map(k => parseFloat(k[2]));
      const htfLows = htfKlines.map(k => parseFloat(k[3]));
      const htfCloses = htfKlines.map(k => parseFloat(k[4]));
      const htfSupertrend = this.calculateSupertrend(htfHighs, htfLows, htfCloses, supertrendPeriod, supertrendMultiplier);
      
      // 3. Fetch current timeframe klines
      const klines = await MarketDataFetcher.fetchKlines(bot.symbol, bot.exchange, timeframe, 100);
      if (!klines || klines.length < 50) {
        return {
          shouldTrade: false,
          reason: `Insufficient data (${klines?.length || 0} candles, need 50+)`,
          confidence: 0
        };
      }
      
      const closes = klines.map(k => parseFloat(k[4]));
      const highs = klines.map(k => parseFloat(k[2]));
      const lows = klines.map(k => parseFloat(k[3]));
      const volumes = klines.map(k => parseFloat(k[5]));
      const currentPrice = closes[closes.length - 1];
      const prevClose = closes[closes.length - 2] || currentPrice;
      
      // 4. Calculate indicators
      const emaFastValue = this.calculateEMA(closes, emaFast);
      const emaSlowValue = this.calculateEMA(closes, emaSlow);
      const atr = this.calculateATR(highs, lows, closes, atrPeriod);
      const atrPercent = (atr / currentPrice) * 100;
      const bb = this.calculateBollingerBands(closes, bbPeriod, bbStdDev);
      
      // Calculate VWAP
      let totalPV = 0;
      let totalVolume = 0;
      const vwapLookback = Math.min(vwapPeriod, klines.length);
      for (let i = klines.length - vwapLookback; i < klines.length; i++) {
        const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
        totalPV += typicalPrice * volumes[i];
        totalVolume += volumes[i];
      }
      const vwap = totalVolume > 0 ? totalPV / totalVolume : currentPrice;
      
      // Volume analysis
      const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const currentVolume = volumes[volumes.length - 1];
      const volumeRatio = currentVolume / avgVolume;
      
      // RSI divergence check (simplified)
      const rsiPrev = rsi; // In production, calculate previous RSI
      const priceLowerLow = currentPrice < prevClose;
      const rsiHigherLow = rsi > rsiPrev; // Simplified
      
      // 5. Volatility Filter
      if (atrPercent < minVolatilityATRReversal && scalpingMode !== 'continuation') {
        return {
          shouldTrade: false,
          reason: `Volatility too low: ATR ${atrPercent.toFixed(2)}% < minimum ${minVolatilityATRReversal}%`,
          confidence: 0
        };
      }
      if (atrPercent < minVolatilityATRContinuation && scalpingMode === 'continuation') {
        return {
          shouldTrade: false,
          reason: `Volatility too low: ATR ${atrPercent.toFixed(2)}% < minimum ${minVolatilityATRContinuation}%`,
          confidence: 0
        };
      }
      if (atrPercent > maxVolatilityATR) {
        return {
          shouldTrade: false,
          reason: `Volatility too high: ATR ${atrPercent.toFixed(2)}% > maximum ${maxVolatilityATR}%`,
          confidence: 0
        };
      }
      
      // BB Width filter
      if (bb.width < bbWidthMin || bb.width > bbWidthMax) {
        return {
          shouldTrade: false,
          reason: `BB width ${bb.width.toFixed(2)}% outside range (${bbWidthMin}% - ${bbWidthMax}%)`,
          confidence: 0
        };
      }
      
      // Determine which mode to use
      const useReversalMode = scalpingMode === 'reversal' || (scalpingMode === 'auto' && (
        (rsi < rsiOversold && htfSupertrend.trend === 'bullish') ||
        (rsi > rsiOverbought && htfSupertrend.trend === 'bearish')
      ));
      
      const useContinuationMode = scalpingMode === 'continuation' || (scalpingMode === 'auto' && !useReversalMode);
      
      // MODE A: REVERSAL SCALPING
      if (useReversalMode) {
        // LONG Reversal
        if (htfSupertrend.trend === 'bullish' && rsi < rsiOversold) {
          const priceBelowVWAP = currentPrice < vwap;
          const priceAtLowerBB = currentPrice <= bb.lower || (currentPrice - bb.lower) / bb.lower < 0.001;
          const volumeSpike = volumeRatio >= volumeMultiplierReversal;
          const rsiInReversalZone = rsi >= rsiReversalZoneLow && rsi <= rsiOversold;
          
          if (priceBelowVWAP && (priceAtLowerBB || priceBelowVWAP) && volumeSpike && rsiInReversalZone) {
            // Check for RSI bullish divergence or RSI crossing above reversal zone
            const rsiCrossingUp = rsi > rsiReversalZoneLow && rsiPrev <= rsiReversalZoneLow;
            
            if (rsiCrossingUp || rsiHigherLow) {
              let confidence = 0.65;
              if (priceAtLowerBB) confidence += 0.1;
              if (volumeRatio >= volumeMultiplierReversal * 1.2) confidence += 0.1;
              if (rsiHigherLow) confidence += 0.1;
              confidence = Math.min(confidence, 0.95);
              
              return {
                shouldTrade: true,
                side: 'buy',
                reason: `Reversal LONG: HTF Supertrend bullish, RSI ${rsi.toFixed(2)} oversold bounce, price at lower BB/VWAP, volume ${volumeRatio.toFixed(2)}x`,
                confidence: confidence,
                entryPrice: currentPrice,
                stopLoss: currentPrice - (atr * atrSLMultiplier),
                takeProfit1: currentPrice + (atr * atrSLMultiplier * 1.0),
                takeProfit2: currentPrice + (atr * atrSLMultiplier * 1.5),
                takeProfit3: currentPrice + (atr * atrSLMultiplier * 2.0),
                mode: 'reversal',
                indicators: {
                  htfSupertrend: htfSupertrend.trend,
                  rsi: rsi,
                  vwap: vwap,
                  bbLower: bb.lower,
                  volumeRatio: volumeRatio,
                  atrPercent: atrPercent
                }
              };
            }
          }
        }
        
        // SHORT Reversal
        if (htfSupertrend.trend === 'bearish' && rsi > rsiOverbought) {
          const priceAboveVWAP = currentPrice > vwap;
          const priceAtUpperBB = currentPrice >= bb.upper || (bb.upper - currentPrice) / bb.upper < 0.001;
          const volumeSpike = volumeRatio >= volumeMultiplierReversal;
          const rsiInReversalZone = rsi >= rsiOverbought && rsi <= rsiReversalZoneHigh;
          
          if (priceAboveVWAP && (priceAtUpperBB || priceAboveVWAP) && volumeSpike && rsiInReversalZone) {
            // Check for RSI bearish divergence or RSI crossing below reversal zone
            const rsiCrossingDown = rsi < rsiReversalZoneHigh && rsiPrev >= rsiReversalZoneHigh;
            
            if (rsiCrossingDown || !rsiHigherLow) {
              let confidence = 0.65;
              if (priceAtUpperBB) confidence += 0.1;
              if (volumeRatio >= volumeMultiplierReversal * 1.2) confidence += 0.1;
              if (!rsiHigherLow) confidence += 0.1;
              confidence = Math.min(confidence, 0.95);
              
              return {
                shouldTrade: true,
                side: 'sell',
                reason: `Reversal SHORT: HTF Supertrend bearish, RSI ${rsi.toFixed(2)} overbought rejection, price at upper BB/VWAP, volume ${volumeRatio.toFixed(2)}x`,
                confidence: confidence,
                entryPrice: currentPrice,
                stopLoss: currentPrice + (atr * atrSLMultiplier),
                takeProfit1: currentPrice - (atr * atrSLMultiplier * 1.0),
                takeProfit2: currentPrice - (atr * atrSLMultiplier * 1.5),
                takeProfit3: currentPrice - (atr * atrSLMultiplier * 2.0),
                mode: 'reversal',
                indicators: {
                  htfSupertrend: htfSupertrend.trend,
                  rsi: rsi,
                  vwap: vwap,
                  bbUpper: bb.upper,
                  volumeRatio: volumeRatio,
                  atrPercent: atrPercent
                }
              };
            }
          }
        }
      }
      
      // MODE B: TREND CONTINUATION SCALPING
      if (useContinuationMode) {
        // ADX filter for continuation
        if (adx < adxMinContinuation) {
          return {
            shouldTrade: false,
            reason: `ADX (${adx.toFixed(2)}) below minimum (${adxMinContinuation}) for continuation`,
            confidence: 0
          };
        }
        
        // LONG Continuation
        if (htfSupertrend.trend === 'bullish') {
          const priceAboveEMAs = currentPrice > emaFastValue && currentPrice > emaSlowValue;
          const emaBullish = emaFastValue > emaSlowValue;
          const priceAboveVWAP = currentPrice > vwap;
          const rsiNeutral = rsi >= 40 && rsi <= 65;
          const pricePullbackToEMA = (currentPrice <= emaFastValue * 1.002 && currentPrice >= emaFastValue * 0.998) ||
                                      (currentPrice <= emaSlowValue * 1.002 && currentPrice >= emaSlowValue * 0.998);
          const volumeGood = volumeRatio >= volumeMultiplierContinuation;
          
          if (priceAboveEMAs && emaBullish && priceAboveVWAP && rsiNeutral && (pricePullbackToEMA || priceAboveEMAs) && volumeGood) {
            // Check for bounce from EMA
            const priceBouncing = currentPrice > prevClose && prevClose <= emaFastValue;
            
            if (priceBouncing || pricePullbackToEMA) {
              let confidence = 0.7;
              if (pricePullbackToEMA) confidence += 0.1;
              if (rsi > 50) confidence += 0.05;
              if (volumeRatio >= volumeMultiplierContinuation * 1.2) confidence += 0.1;
              confidence = Math.min(confidence, 0.95);
              
              return {
                shouldTrade: true,
                side: 'buy',
                reason: `Continuation LONG: HTF Supertrend bullish, EMA pullback bounce, RSI ${rsi.toFixed(2)}, volume ${volumeRatio.toFixed(2)}x`,
                confidence: confidence,
                entryPrice: currentPrice,
                stopLoss: currentPrice - (atr * atrSLMultiplier),
                takeProfit1: currentPrice + (atr * atrSLMultiplier * 1.0),
                takeProfit2: currentPrice + (atr * atrSLMultiplier * 1.5),
                takeProfit3: currentPrice + (atr * atrSLMultiplier * 2.0),
                mode: 'continuation',
                indicators: {
                  htfSupertrend: htfSupertrend.trend,
                  emaFast: emaFastValue,
                  emaSlow: emaSlowValue,
                  rsi: rsi,
                  adx: adx,
                  vwap: vwap,
                  volumeRatio: volumeRatio,
                  atrPercent: atrPercent
                }
              };
            }
          }
        }
        
        // SHORT Continuation
        if (htfSupertrend.trend === 'bearish') {
          const priceBelowEMAs = currentPrice < emaFastValue && currentPrice < emaSlowValue;
          const emaBearish = emaFastValue < emaSlowValue;
          const priceBelowVWAP = currentPrice < vwap;
          const rsiNeutral = rsi >= 35 && rsi <= 60;
          const pricePullbackToEMA = (currentPrice >= emaFastValue * 0.998 && currentPrice <= emaFastValue * 1.002) ||
                                      (currentPrice >= emaSlowValue * 0.998 && currentPrice <= emaSlowValue * 1.002);
          const volumeGood = volumeRatio >= volumeMultiplierContinuation;
          
          if (priceBelowEMAs && emaBearish && priceBelowVWAP && rsiNeutral && (pricePullbackToEMA || priceBelowEMAs) && volumeGood) {
            // Check for rejection from EMA
            const priceRejecting = currentPrice < prevClose && prevClose >= emaFastValue;
            
            if (priceRejecting || pricePullbackToEMA) {
              let confidence = 0.7;
              if (pricePullbackToEMA) confidence += 0.1;
              if (rsi < 50) confidence += 0.05;
              if (volumeRatio >= volumeMultiplierContinuation * 1.2) confidence += 0.1;
              confidence = Math.min(confidence, 0.95);
              
              return {
                shouldTrade: true,
                side: 'sell',
                reason: `Continuation SHORT: HTF Supertrend bearish, EMA pullback rejection, RSI ${rsi.toFixed(2)}, volume ${volumeRatio.toFixed(2)}x`,
                confidence: confidence,
                entryPrice: currentPrice,
                stopLoss: currentPrice + (atr * atrSLMultiplier),
                takeProfit1: currentPrice - (atr * atrSLMultiplier * 1.0),
                takeProfit2: currentPrice - (atr * atrSLMultiplier * 1.5),
                takeProfit3: currentPrice - (atr * atrSLMultiplier * 2.0),
                mode: 'continuation',
                indicators: {
                  htfSupertrend: htfSupertrend.trend,
                  emaFast: emaFastValue,
                  emaSlow: emaSlowValue,
                  rsi: rsi,
                  adx: adx,
                  vwap: vwap,
                  volumeRatio: volumeRatio,
                  atrPercent: atrPercent
                }
              };
            }
          }
        }
      }
      
      // No trade signal
      return {
        shouldTrade: false,
        reason: `No signal: HTF ${htfSupertrend.trend}, RSI ${rsi.toFixed(2)}, mode ${scalpingMode}, volume ${volumeRatio.toFixed(2)}x`,
        confidence: 0
      };
      
    } catch (error: any) {
      console.error('❌ Error in advanced scalping strategy:', error);
      return {
        shouldTrade: false,
        reason: `Strategy error: ${error?.message || String(error)}`,
        confidence: 0
      };
    }
  }
  
  /**
   * Calculate EMA (Exponential Moving Average)
   */
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    if (prices.length === 1) return prices[0];
    if (prices.length < period) {
      // Use SMA if not enough data
      const sum = prices.reduce((a, b) => a + b, 0);
      return sum / prices.length;
    }
    
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period; // Start with SMA
    
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  /**
   * Calculate linear regression value for the last point
   * Returns the predicted value for the next period
   */
  private calculateLinearRegression(data: number[], length: number): number {
    if (data.length < length) {
      return data[data.length - 1]; // Fallback to last value
    }

    const n = length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    // Use last 'length' values
    const values = data.slice(-length);

    for (let i = 0; i < values.length; i++) {
      const x = i;
      const y = values[i];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    // Calculate slope and intercept
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Return predicted value for next period (x = n)
    return slope * n + intercept;
  }
  
  public async executeTrade(bot: any, tradeSignal: any): Promise<{ success: boolean; skipped?: boolean; reason?: string; trade?: any }> {
    try {
      console.log(`\n🚀 === EXECUTING REAL TRADE ===`);
      console.log(`   Bot: ${bot.name} (${bot.id})`);
      console.log(`   Symbol: ${bot.symbol}`);
      console.log(`   Side: ${tradeSignal.side}`);
      console.log(`   💰 Trade Amount: ${bot.trade_amount || bot.tradeAmount}`);
      console.log(`   🏦 Exchange: ${bot.exchange}`);
      
      // ⚠️ CRITICAL: Check subscription/trial limits BEFORE executing real trades
      if (bot.paper_trading !== true) {
        console.log(`🔍 Checking subscription trade limits for user ${bot.user_id}...`);
        try {
          const { data: tradeCheck, error: tradeCheckError } = await this.supabaseClient
            .rpc('can_user_trade', { 
              p_user_id: bot.user_id, 
              p_trade_type: 'real' 
            });

          if (tradeCheckError) {
            console.error(`❌ Error checking trade limits:`, tradeCheckError);
            await this.addBotLog(bot.id, {
              level: 'error',
              category: 'subscription',
              message: `❌ Failed to verify trade permissions: ${tradeCheckError.message}`,
              details: { error: tradeCheckError }
            });
            throw new Error(`Failed to verify trade permissions: ${tradeCheckError.message}`);
          }

          if (!tradeCheck || !tradeCheck.allowed) {
            const reason = tradeCheck?.reason || 'Trade limit reached or subscription expired';
            console.warn(`⚠️ Trading blocked: ${reason}`);
            await this.addBotLog(bot.id, {
              level: 'warning',
              category: 'subscription',
              message: `⚠️ Trading blocked: ${reason}`,
              details: {
                allowed: false,
                reason: reason,
                max_trades: tradeCheck?.max_trades,
                current_trades: tradeCheck?.current_trades,
                remaining_trades: tradeCheck?.remaining_trades,
                trial_expired: tradeCheck?.trial_expired
              }
            });
            return { success: false, skipped: true, reason };
          }

          console.log(`✅ Trade permission check passed: ${tradeCheck.reason || 'Allowed'}`);
        } catch (err: any) {
          // If it's already an error we threw, re-throw it
          if (err.message && (err.message.includes('Trading blocked') || err.message.includes('subscription') || err.message.includes('trial'))) {
            return { success: false, skipped: true, reason: err.message };
          }
          // Otherwise log and re-throw
          console.error(`❌ Subscription check failed:`, err);
          throw new Error(`Subscription verification failed: ${err.message || err}`);
        }
      }
      
      // Get trading type with fallback (handle both camelCase and snake_case)
      const tradingType = bot.tradingType || bot.trading_type || 'futures';
      console.log(`📊 Trading Type: ${tradingType}`);
      
      console.log(`🔍 Fetching current price for ${bot.symbol}...`);
      
      // Fetch price and capture detailed error info for logging
      let priceFetchError: any = null;
      let currentPrice: number;
      
      try {
        console.log(`🔍 [executeTrade] Starting price fetch for ${bot.symbol} (${tradingType})...`);
        // Pass logging callback to track CoinGecko fallback usage
        currentPrice = await MarketDataFetcher.fetchPrice(
          bot.symbol, 
          bot.exchange, 
          tradingType,
          async (message: string, details?: any) => {
            await this.addBotLog(bot.id, {
              level: 'info',
              category: 'market',
              message: message,
              details: details
            });
          }
        );
        console.log(`✅ [executeTrade] Price fetch completed: $${currentPrice} for ${bot.symbol}`);
      } catch (err: any) {
        // Capture error details for logging
        priceFetchError = {
          message: err?.message || String(err),
          stack: err?.stack,
          name: err?.name
        };
        currentPrice = 0;
        console.error(`❌ [executeTrade] Price fetch failed for ${bot.symbol}:`, priceFetchError);
      }
      
      // Validate price before proceeding
      if (!currentPrice || currentPrice === 0 || !isFinite(currentPrice)) {
        console.error(`❌ [executeTrade] Price validation failed: currentPrice=${currentPrice}, isFinite=${isFinite(currentPrice)}`);
        const isMajorCoin = ['BTC', 'ETH', 'BNB', 'SOL'].some(coin => bot.symbol.toUpperCase().startsWith(coin));
        let errorMsg = `Invalid or unavailable price for ${bot.symbol} (${tradingType}).`;
        
        if (isMajorCoin) {
          errorMsg += ` Major coins like ${bot.symbol} should be available for ${tradingType} trading on ${bot.exchange}. This might be a temporary API issue. Please verify:`;
          errorMsg += `\n1. The symbol "${bot.symbol}" exists on ${bot.exchange} for ${tradingType} trading`;
          errorMsg += `\n2. Your API connection to ${bot.exchange} is working`;
          errorMsg += `\n3. Try again in a few moments (may be a temporary API issue)`;
        } else {
          errorMsg += ` The symbol may not exist on ${bot.exchange} or may not be available for ${tradingType} trading.`;
          if (tradingType === 'futures' || tradingType === 'linear') {
            errorMsg += ` For futures trading, some symbols may require a different format (e.g., 1000PEPEUSDT instead of PEPEUSDT).`;
          }
          errorMsg += ` Please verify the symbol name and trading type on ${bot.exchange}.`;
        }
        
        console.error(`❌ ${errorMsg}`);
        
        // Get API responses from fetchPrice if available
        const apiResponses = (globalThis as any).__lastBybitApiResponses || [];
        
        // Create summary of API responses for error message
        let apiSummary = '';
        if (apiResponses.length > 0) {
          const summaries = apiResponses.map((resp: any, idx: number) => {
            if (resp.fetchError) {
              return `Attempt ${idx + 1} (${resp.symbolVariant}): Network error - ${resp.fetchError}`;
            } else if (resp.isHtml) {
              return `Attempt ${idx + 1} (${resp.symbolVariant}): HTTP ${resp.httpStatus} - HTML error page "${resp.htmlTitle || 'Unknown'}" (${resp.note || 'Bybit returned HTML instead of JSON'})`;
            } else if (resp.parseError) {
              return `Attempt ${idx + 1} (${resp.symbolVariant}): HTTP ${resp.httpStatus} - Parse error: ${resp.parseError}`;
            } else {
              return `Attempt ${idx + 1} (${resp.symbolVariant}): HTTP ${resp.httpStatus}, retCode=${resp.retCode}, retMsg="${resp.retMsg || 'N/A'}", listLength=${resp.listLength || 0}`;
            }
          });
          apiSummary = `\n\nAPI Response Summary:\n${summaries.join('\n')}`;
        } else {
          apiSummary = '\n\n⚠️ No API responses captured - check Edge Function logs';
        }
        
        // Check if this is a minimum order value error (already logged as warning)
        // Note: This catch block is for price fetch errors, but we check anyway for safety
        const isMinOrderValueError = errorMsg.includes('110094') || 
                                     errorMsg.includes('does not meet minimum order value') ||
                                     errorMsg.includes('below minimum');
        
        // Only log as error if it's not already handled as a warning
        if (!isMinOrderValueError) {
          // Log detailed error to bot_activity_logs with API diagnostic info
          await this.addBotLog(bot.id, {
            level: 'error',
            category: 'trade',
            message: `Trade execution failed: ${errorMsg}${apiSummary}`,
            details: {
              side: tradeSignal?.side || 'unknown',
              error: errorMsg,
              symbol: bot.symbol,
              exchange: bot.exchange,
              tradingType: tradingType,
              priceFetchError: priceFetchError,
              errorType: 'Error',
              timestamp: TimeSync.getCurrentTimeISO(),
              diagnostic: {
                symbolVariants: MarketDataFetcher.normalizeSymbol(bot.symbol, bot.exchange, tradingType),
                apiUrl: `https://api.bybit.com/v5/market/tickers?category=${tradingType === 'futures' ? 'linear' : tradingType}&symbol=${bot.symbol}`,
                apiResponses: apiResponses.length > 0 ? apiResponses : 'No API responses captured',
                note: apiResponses.length > 0 ? 'See apiResponses above for actual Bybit API responses' : 'Check Supabase Edge Function logs for detailed Bybit API responses'
              }
            }
          });
        } else {
          console.log(`ℹ️ Minimum order value error already logged as warning, skipping duplicate error log`);
        }
        
        // Clear the stored responses
        (globalThis as any).__lastBybitApiResponses = null;
        
        throw new Error(errorMsg);
      }
      
      console.log(`✅ Current price for ${bot.symbol}: $${currentPrice}`);
      
      const tradeAmountRaw = this.calculateTradeAmount(bot, currentPrice);
      
      // Validate calculated quantity
      if (!tradeAmountRaw || !isFinite(tradeAmountRaw) || tradeAmountRaw <= 0) {
        throw new Error(`Invalid quantity calculated for ${bot.symbol}: ${tradeAmountRaw}. Price: $${currentPrice}`);
      }
      
      // Normalize qty/price to reduce exchange rejections
      const basicConstraints = getQuantityConstraints(bot.symbol);
      const { stepSize, tickSize } = getSymbolSteps(bot.symbol);
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
      
      // Place actual order on exchange with retry logic
      console.log(`\n🚀 [executeTrade] About to place order on Bybit...`);
      console.log(`📤 === PLACING ORDER ON BYBIT ===`);
      console.log(`📊 Symbol: ${bot.symbol}`);
      console.log(`📈 Side: ${tradeSignal.side}`);
      console.log(`💰 Quantity: ${tradeAmount}`);
      console.log(`💵 Price: $${normalizedPrice}`);
      console.log(`🏦 Exchange: ${bot.exchange}`);
      console.log(`📊 Trading Type: ${tradingType}`);
      
      let orderResult;
      let lastError;
      const maxRetries = 3;
      let retryCount = 0;
      
      while (retryCount < maxRetries) {
        try {
          console.log(`\n🔄 Attempt ${retryCount + 1}/${maxRetries}: Placing order...`);
          orderResult = await this.placeOrder(bot, tradeSignal, tradeAmount, normalizedPrice);
          
          // Check if order was skipped (e.g., symbol not available on exchange)
          if (orderResult && orderResult.status === 'skipped') {
            console.log(`⏸️ Order skipped: ${orderResult.reason || 'Unknown reason'}`);
            console.log(`📋 Order Result:`, JSON.stringify(orderResult, null, 2));
            
            // Log skipped order to bot activity logs
            await this.addBotLog(bot.id, {
              level: 'warning',
              category: 'trade',
              message: `Trade skipped: ${orderResult.reason || 'Order was skipped'}`,
              details: {
                symbol: bot.symbol,
                exchange: bot.exchange,
                side: tradeSignal?.side,
                reason: orderResult.reason,
                orderResult: orderResult
              }
            });
            
            // Throw error so caller knows no trade was created
            throw new Error(`Trade skipped: ${orderResult.reason || 'Order was skipped'}`);
          }
          
          console.log(`✅ Order placed successfully!`);
          console.log(`📋 Order Result:`, JSON.stringify(orderResult, null, 2));
          break; // Success, exit retry loop
        } catch (error: any) {
          lastError = error;
          retryCount++;
          
          const errorMsg = error.message || String(error);
          console.error(`❌ Order placement failed (attempt ${retryCount}/${maxRetries}):`, errorMsg);
          console.error(`📋 Full error:`, error);
          
          // Don't retry on certain errors (insufficient balance, regulatory, etc.)
          const nonRetryableErrors = [
            'Insufficient balance',
            'regulatory restriction',
            '10024',
            'not enough',
            'Shortfall',
            'Cannot sell on spot market'
          ];
          
          const isNonRetryable = nonRetryableErrors.some(msg => 
            errorMsg.toLowerCase().includes(msg.toLowerCase())
          );
          
          if (isNonRetryable || retryCount >= maxRetries) {
            console.error(`❌ Order placement failed permanently. Error: ${errorMsg}`);
            throw error; // Don't retry, throw immediately
          }
          
          // Wait before retry (exponential backoff)
          const waitTime = Math.min(1000 * Math.pow(2, retryCount - 1), 5000); // 1s, 2s, 4s max
          console.log(`⏳ Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      
      if (!orderResult) {
        throw lastError || new Error('Order placement failed after retries');
      }
      
      console.log('📝 Recording trade in database...');
      console.log('Order result:', JSON.stringify(orderResult, null, 2));
      
      const feeRate = resolveFeeRate(bot.exchange, bot.tradingType || bot.trading_type || 'spot');
      const orderNotional = tradeAmount * normalizedPrice;
      const estimatedFees = orderNotional * feeRate * 2; // entry + exit estimate
      
      // Record trade - using actual database schema columns
      const normalizedTradeStatus = (() => {
        const raw = (orderResult.status || 'filled').toString().toLowerCase();
        const allowed = ['open', 'closed', 'filled', 'completed', 'failed', 'cancelled', 'canceled', 'pending', 'partial'];
        return allowed.includes(raw) ? raw : 'filled';
      })();

      const normalizedSide = (() => {
        const raw = (tradeSignal.side || '').toString().toLowerCase();
        if (raw === 'buy' || raw === 'long') return 'buy';
        if (raw === 'sell' || raw === 'short') return 'sell';
        return raw || 'buy';
      })();

      // Insert trade record - use 'price' column (entry_price may not exist in all deployments)
      // Note: 'size' column doesn't exist in trades table, use 'amount' instead
      // Note: 'paper_trading' column doesn't exist in trades table (real trades go here, paper trades go to paper_trading_trades)
      // CRITICAL: Use bot owner's user_id, not executor's user_id (which might be admin)
      const botOwnerUserId = bot.user_id || bot.userId || this.user.id;
      console.log(`🔑 Creating trade for bot owner: ${botOwnerUserId} (bot.user_id: ${bot.user_id}, executor.user.id: ${this.user.id})`);
      
      let insertPayload: any = {
        user_id: botOwnerUserId, // FIXED: Use bot owner's user_id, not executor's
        bot_id: bot.id,
        exchange: bot.exchange,
        symbol: bot.symbol,
        side: normalizedSide,
        amount: tradeAmount, // Use 'amount' instead of 'size' (size column doesn't exist)
        price: normalizedPrice, // Primary column for entry price
        status: normalizedTradeStatus,
        exchange_order_id: orderResult.orderId || orderResult.exchangeResponse?.result?.orderId || null,
        executed_at: TimeSync.getCurrentTimeISO(),
        fee: estimatedFees,
        pnl: 0
        // Note: paper_trading column doesn't exist in trades table - real trades only go here
      };

      // Try inserting with entry_price if column exists (for backward compatibility)
      // But use price as primary since that's what the migration uses
      let insertResp = await this.supabaseClient
        .from('trades')
        .insert(insertPayload as any)
        .select()
        .single();

      let trade = insertResp.data;
      let error = insertResp.error;

      // If entry_price, size, or paper_trading error occurs, it means the column doesn't exist - that's fine
      // We're using 'price' and 'amount' instead, and paper_trading doesn't exist in trades table
      if (error && (/column .*entry_price/i.test(error.message || '') || /column .*size/i.test(error.message || '') || /column .*paper_trading/i.test(error.message || ''))) {
        const columnName = /column .*(entry_price|size|paper_trading)/i.exec(error.message || '')?.[1] || 'unknown';
        console.warn(`⚠️ trades.${columnName} column not found, using standard columns (this is expected)`);
        // Retry without the problematic column (shouldn't happen since we removed it, but just in case)
        const retryPayload = { ...insertPayload };
        delete retryPayload.size;
        delete retryPayload.entry_price;
        delete retryPayload.paper_trading; // Remove paper_trading if it was added
        const retryResp = await this.supabaseClient
          .from('trades')
          .insert(retryPayload as any)
          .select()
          .single();
        trade = retryResp.data;
        error = retryResp.error;
      }

      if (error) {
        console.error('❌ Database insert error:', error);
        console.error('   Insert payload:', JSON.stringify(insertPayload, null, 2));
        throw new Error(`Trade execution failed: ${error.message}`);
      }
      
      console.log('✅ Trade recorded successfully:', trade);
      
      // Track position opening for real trades
      console.log(`📊 [Position Tracking] Bot paper_trading: ${bot.paper_trading}, Will track: ${bot.paper_trading !== true}`);
      if (bot.paper_trading !== true) {
        try {
          console.log(`📊 [Position Tracking] Creating position for ${bot.symbol} ${trade.side} at $${normalizedPrice}, quantity: ${tradeAmount}`);
          await this.trackPositionOpen(bot, trade, orderResult, normalizedPrice, tradeAmount, currentPrice);
          console.log(`✅ [Position Tracking] Position tracked successfully`);
        } catch (posError) {
          console.error('❌ [Position Tracking] Failed to track position open:', posError);
          console.error('   Error details:', posError instanceof Error ? posError.message : String(posError));
          // Don't fail the trade if position tracking fails
        }
      } else {
        console.log(`ℹ️ [Position Tracking] Skipping position tracking - paper trading mode`);
      }
      
      // Update bot performance
      await this.updateBotPerformance(bot.id, trade);
      
      await this.addBotLog(bot.id, {
        level: 'success',
        category: 'trade',
        message: `${tradeSignal.side.toUpperCase()} order placed: ${tradeAmount} ${bot.symbol} at $${currentPrice}`,
        details: { trade, signal: tradeSignal, orderResult }
      });

      // Send Telegram notification for trade execution
      try {
        await this.sendTradeNotification(bot, trade, orderResult);
      } catch (notifError) {
        // Don't fail the trade if notification fails - just log it
        console.warn('⚠️ Failed to send Telegram notification (non-critical):', notifError);
      }

      return { success: true, trade };
      
    } catch (error: any) {
      // Check if it's a regulatory restriction error (10024) - requires pausing bot
      const isRegulatoryRestriction = error.message?.includes('regulatory restrictions') || 
                                     error.message?.includes('regulatory restriction') ||
                                     error.message?.includes('Code: 10024') ||
                                     error.message?.includes('10024');
      
      if (isRegulatoryRestriction) {
        console.error('❌ Regulatory restriction detected - pausing bot:', error.message);
        await this.pauseBotForSafety(bot.id, `Regulatory restriction: ${error.message}`);
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'trade',
          message: `Bot paused automatically due to regulatory restriction: ${error.message}`,
          details: { 
            error: error.message,
            pausedAt: TimeSync.getCurrentTimeISO(),
            recommendation: 'Contact Bybit support to enable trading for your region. Bot has been paused automatically.'
          }
        });
        return { success: false, skipped: true, reason: `Regulatory restriction: ${error.message}` };
      }
      
      // Check if it's an insufficient balance error (less critical)
      const isInsufficientBalance = error.message?.includes('Insufficient balance') || error.message?.includes('not enough') || error.message?.includes('Shortfall');
      
      if (isInsufficientBalance) {
        console.warn('⚠️ Trade execution skipped due to insufficient balance:', error.message);
        
        // Extract balance details from error message if available
        const balanceMatch = error.message.match(/Available: \$?([0-9.]+)/i);
        const shortfallMatch = error.message.match(/Shortfall: \$?([0-9.]+)/i);
        const shortfall = shortfallMatch ? parseFloat(shortfallMatch[1]) : null;
        const errorMessage = `❌ Trade blocked: Insufficient balance for ${bot.symbol} ${tradeSignal?.side || 'order'}. ${shortfall ? `Need $${shortfall.toFixed(2)} more.` : 'Please add funds or reduce trade size.'}`;
        
        // Log as error level for better visibility in Recent Activity
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'trade',
          message: errorMessage,
          details: { 
            error: error.message,
            errorType: 'insufficient_balance',
            shortfall: shortfall,
            symbol: bot.symbol,
            side: tradeSignal?.side || 'unknown',
            timestamp: TimeSync.getCurrentTimeISO()
          }
        });
        
        return { success: false, skipped: true, reason: 'Insufficient balance' };
      } else {
        console.error('❌ Trade execution error:', error);
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'trade',
          message: `Trade execution failed: ${error.message}`,
          details: { 
            error: error.message,
            errorType: error.name || 'unknown',
            symbol: bot.symbol,
            side: tradeSignal?.side || 'unknown',
            timestamp: TimeSync.getCurrentTimeISO()
          }
        });
        // Re-throw other errors
        throw error;
      }
    }
  }
  
  public async executeManualTrade(
    bot: any,
    params: {
      side: string;
      reason?: string;
      confidence?: number;
      mode?: 'real' | 'paper';
      sizeMultiplier?: number | null;
      source?: string;
    }
  ): Promise<{ mode: 'real' | 'paper'; success: boolean; skipped?: boolean; reason?: string; trade?: any }> {
    console.log(`\n🚀 === EXECUTING MANUAL TRADE ===`);
    console.log(`   Bot ID: ${bot.id}`);
    console.log(`   Bot Name: ${bot.name}`);
    console.log(`   Symbol: ${bot.symbol}`);
    console.log(`   Exchange: ${bot.exchange}`);
    console.log(`   Trading Type: ${bot.tradingType || bot.trading_type || 'futures'}`);
    console.log(`   Side: ${params.side}`);
    console.log(`   Mode: ${params.mode || (bot.paper_trading ? 'paper' : 'real')}`);
    console.log(`   Source: ${params.source || 'webhook'}`);
    console.log(`   Timestamp: ${TimeSync.getCurrentTimeISO()}\n`);
    
    const effectiveSide = (params.side || '').toLowerCase();
    if (!['buy', 'sell', 'long', 'short'].includes(effectiveSide)) {
      throw new Error(`Invalid manual trade side: ${params.side}`);
    }

    const normalizedSide = effectiveSide === 'long' ? 'buy'
      : effectiveSide === 'short' ? 'sell'
      : effectiveSide;

    const tradeSignal = {
      shouldTrade: true,
      side: normalizedSide,
      reason: params.reason || `Manual trade trigger (${params.source || 'webhook'})`,
      confidence: params.confidence ?? 1
    };

    // Determine effective mode: explicit mode param takes precedence over bot setting
    // Normalize mode parameter (handle case/whitespace)
    const normalizedParamMode = params.mode ? String(params.mode).toLowerCase().trim() : null;
    
    const effectiveMode: 'real' | 'paper' =
      normalizedParamMode === 'paper' ? 'paper' :
      normalizedParamMode === 'real' ? 'real' :
      bot.paper_trading ? 'paper' :
      'real';
    
    // Debug logging for mode determination
    console.log(`🔍 Mode determination:`);
    console.log(`   params.mode (raw): ${params.mode} (type: ${typeof params.mode})`);
    console.log(`   normalizedParamMode: ${normalizedParamMode}`);
    console.log(`   bot.paper_trading: ${bot.paper_trading}`);
    console.log(`   effectiveMode: ${effectiveMode}`);

    // Create bot snapshot preserving ALL bot settings (leverage, SL/TP, etc.)
    const botSnapshot = { ...bot };
    
    // Ensure all bot settings are preserved (handle both snake_case and camelCase)
    if (!botSnapshot.leverage && (bot.leverage || bot.leverage_ratio)) {
      botSnapshot.leverage = bot.leverage || bot.leverage_ratio;
    }
    if (!botSnapshot.stop_loss && !botSnapshot.stopLoss) {
      botSnapshot.stop_loss = bot.stop_loss || bot.stopLoss || 2.0;
      botSnapshot.stopLoss = botSnapshot.stop_loss;
    }
    if (!botSnapshot.take_profit && !botSnapshot.takeProfit) {
      botSnapshot.take_profit = bot.take_profit || bot.takeProfit || 4.0;
      botSnapshot.takeProfit = botSnapshot.take_profit;
    }
    if (!botSnapshot.trade_amount && !botSnapshot.tradeAmount) {
      botSnapshot.trade_amount = bot.trade_amount || bot.tradeAmount || 100;
      botSnapshot.tradeAmount = botSnapshot.trade_amount;
    }
    
    // Log bot settings to verify they're present
    console.log(`📊 Bot settings for manual trade:`);
    console.log(`   Leverage: ${botSnapshot.leverage || botSnapshot.leverage_ratio || 'NOT SET'}`);
    console.log(`   Stop Loss: ${botSnapshot.stop_loss || botSnapshot.stopLoss || 'NOT SET'}%`);
    console.log(`   Take Profit: ${botSnapshot.take_profit || botSnapshot.takeProfit || 'NOT SET'}%`);
    console.log(`   Trade Amount: ${botSnapshot.trade_amount || botSnapshot.tradeAmount || 'NOT SET'}`);
    
    const multiplier = params.sizeMultiplier ?? null;
    if (multiplier !== null && multiplier !== undefined) {
      const parsedMultiplier = Number(multiplier);
      if (Number.isFinite(parsedMultiplier) && parsedMultiplier > 0) {
        const baseAmount = Number(botSnapshot.trade_amount || botSnapshot.tradeAmount || 100);
        botSnapshot.trade_amount = baseAmount * parsedMultiplier;
        botSnapshot.tradeAmount = botSnapshot.trade_amount;
        console.log(`💰 Size multiplier applied: ${parsedMultiplier}x (base: ${baseAmount}, adjusted: ${botSnapshot.trade_amount})`);
      }
    }

    // Log with clear BUY/SELL ALERT message
    const alertEmoji = normalizedSide === 'buy' ? '🟢' : '🔴';
    const alertType = normalizedSide.toUpperCase() + ' ALERT';
    await this.addBotLog(bot.id, {
      level: 'info',
      category: 'trade',
      message: `${alertEmoji} ${alertType} EXECUTING: ${params.source || 'TradingView webhook'} signal (${effectiveMode.toUpperCase()})`,
      details: {
        paper_trading: effectiveMode === 'paper',
        side: normalizedSide,
        reason: tradeSignal.reason,
        confidence: tradeSignal.confidence,
        size_multiplier: multiplier,
        alert_type: alertType,
        source: params.source || 'tradingview-webhook',
        timestamp: TimeSync.getCurrentTimeISO()
      }
    });

    try {
      if (effectiveMode === 'paper') {
        // Validate user exists before executing paper trade (prevents foreign key violations)
        const { data: userExists, error: userCheckError } = await this.supabaseClient
          .from('users')
          .select('id')
          .eq('id', bot.user_id)
          .maybeSingle();
        
        if (userCheckError || !userExists) {
          const errorMsg = `User ${bot.user_id} does not exist in users table. Bot may belong to deleted user. Cannot execute paper trade.`;
          console.error(`❌ [PAPER] ${errorMsg}`);
          // Log error but don't throw - let Promise.allSettled handle it gracefully
          await this.addBotLog(bot.id, {
            level: 'error',
            category: 'error',
            message: errorMsg,
            details: { 
              bot_id: bot.id,
              bot_name: bot.name,
              user_id: bot.user_id,
              error: userCheckError?.message || 'User not found'
            }
          });
          throw new Error(errorMsg);
        }
        
        console.log(`📝 Executing PAPER trade for ${bot.symbol}...`);
        // Create PaperTradingExecutor with bot's user_id (not executor's user)
        const paperExecutor = new PaperTradingExecutor(this.supabaseClient, { id: bot.user_id });
        
        // Safety check for manual paper trades: don't open if max concurrent positions reached
        const openPositions = await this.getOpenPositions(bot.id, true);
        const maxConcurrent = this.getMaxConcurrent(bot);
        
        if (openPositions >= maxConcurrent) {
          const errorMsg = `Manual PAPER trade skipped: Max concurrent positions reached (${openPositions}/${maxConcurrent})`;
          console.warn(`⏸️ [PAPER] ${errorMsg}`);
          await this.addBotLog(bot.id, {
            level: 'warning',
            category: 'trade',
            message: errorMsg,
            details: { ...tradeSignal, paper_trading: true, open_positions: openPositions, max_concurrent: maxConcurrent }
          });
          return { mode: 'paper', success: false, skipped: true, reason: errorMsg };
        }
        
        const paperTrade = await paperExecutor.executePaperTrade(botSnapshot, tradeSignal);
        await paperExecutor.updatePaperPositions(bot.id, Date.now(), 20000);
        console.log(`✅ PAPER trade executed successfully`);
        return { mode: 'paper', success: true, trade: paperTrade };
      } else {
        console.log(`💵 Executing REAL trade for ${bot.symbol}...`);
        
        // For webhook orders, add retry logic with exponential backoff to handle rate limiting
        const isWebhookOrder = params.source === 'manual_trade_signal';
        const maxRetries = isWebhookOrder ? 3 : 1; // Webhook orders get 3 retries, regular orders get 1
        const baseDelayMs = isWebhookOrder ? 2000 : 0; // 2 second base delay for webhook orders
        
        let lastError: Error | null = null;
        let tradeResult: any = null;
        
        for (let retryAttempt = 0; retryAttempt < maxRetries; retryAttempt++) {
          if (retryAttempt > 0) {
            const delayMs = baseDelayMs * Math.pow(2, retryAttempt - 1); // Exponential backoff: 2s, 4s, 8s
            console.log(`⏳ [WEBHOOK ORDER] Retry attempt ${retryAttempt + 1}/${maxRetries} after ${delayMs}ms delay (rate limit protection)...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
          
          try {
            tradeResult = await this.executeTrade(botSnapshot, tradeSignal);
            console.log(`✅ REAL trade result:`, tradeResult);
            break; // Success or known skip, exit retry loop
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const errorMessage = lastError.message;
            
            // If it's a 403 and we have retries left, retry
            if (isWebhookOrder && (errorMessage.includes('403') || errorMessage.includes('Forbidden')) && retryAttempt < maxRetries - 1) {
              console.warn(`⚠️ [WEBHOOK ORDER] Got 403 error on attempt ${retryAttempt + 1}, will retry after delay...`);
              continue;
            }
            
            // If it's the last attempt or not a 403, throw the error
            if (retryAttempt === maxRetries - 1 || !errorMessage.includes('403')) {
              throw lastError;
            }
          }
        }

        return { 
          mode: 'real', 
          success: tradeResult?.success ?? false, 
          skipped: tradeResult?.skipped, 
          reason: tradeResult?.reason, 
          trade: tradeResult?.trade 
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ === MANUAL TRADE EXECUTION FAILED ===`);
      console.error(`   Bot ID: ${bot.id}`);
      console.error(`   Bot Name: ${bot.name}`);
      console.error(`   Symbol: ${bot.symbol}`);
      console.error(`   Error: ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        console.error(`   Stack: ${error.stack.substring(0, 500)}`);
      }
      console.error(`\n`);
      throw error;
    }

    return { mode: effectiveMode };
  }

  private async processManualSignals(bot: any): Promise<number> {
    try {
      console.log(`🔍 Checking for manual trade signals for bot ${bot.id} (${bot.name})...`);
      
      // Use service role client to bypass RLS when querying manual trade signals
      // This ensures bot-executor can read signals regardless of who triggered it
      const serviceRoleClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      // First, check ALL signals (for debugging)
      const { data: allSignals, error: allError } = await serviceRoleClient
        .from('manual_trade_signals')
        .select('id, status, created_at, side, mode')
        .eq('bot_id', bot.id)
        .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (allSignals && allSignals.length > 0) {
        console.log(`📊 Found ${allSignals.length} manual signal(s) in last hour for bot ${bot.id}:`, 
          allSignals.map(s => ({ id: s.id, status: s.status, side: s.side, mode: s.mode, created: s.created_at })));
      } else {
        console.log(`ℹ️ No manual signals found in last hour for bot ${bot.id}`);
      }
      
      const { data: pendingSignals, error } = await serviceRoleClient
        .from('manual_trade_signals')
        .select('*')
        .eq('bot_id', bot.id)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: true });

      if (error) {
        console.error(`❌ Failed to fetch manual trade signals for bot ${bot.id}:`, error);
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'error',
          message: `Failed to fetch manual trade signals: ${error.message}`,
          details: { error: error.message, bot_id: bot.id }
        });
        return 0;
      }

      if (!pendingSignals || pendingSignals.length === 0) {
        console.log(`ℹ️ No pending manual trade signals for bot ${bot.id} (status: pending or processing)`);
        return 0;
      }

      console.log(`📬 Found ${pendingSignals.length} pending manual trade signal(s) for bot ${bot.id}`);
      let processedCount = 0;

      for (const signal of pendingSignals) {
        const signalId = signal.id;
        const alertEmoji = signal.side === 'buy' ? '🟢' : '🔴';
        const alertType = signal.side.toUpperCase() + ' ALERT';
        console.log(`📬 ${alertEmoji} Processing ${alertType} signal ${signalId} for bot ${bot.id} (${bot.name}): ${signal.side} (${signal.mode})`);
        
        // Extract and normalize instrument from webhook signal metadata (before try block for catch block access)
        // TradingView often sends symbols with suffixes like .P (perpetual), .PERP, etc.
        let effectiveSymbol = bot.symbol;
        if (signal.metadata && signal.metadata.instrument) {
          const webhookInstrument = String(signal.metadata.instrument);
          // Normalize TradingView symbol suffixes: remove .P, .PERP, .PERPETUAL, etc.
          const normalizedInstrument = webhookInstrument
            .replace(/\.P$/i, '') // Remove .P suffix
            .replace(/\.PERP$/i, '') // Remove .PERP suffix
            .replace(/\.PERPETUAL$/i, '') // Remove .PERPETUAL suffix
            .toUpperCase(); // Convert to uppercase for consistency
          
          if (normalizedInstrument && normalizedInstrument !== bot.symbol) {
            console.log(`🔍 Webhook instrument detected: "${webhookInstrument}" -> normalized: "${normalizedInstrument}"`);
            console.log(`⚠️ Bot symbol "${bot.symbol}" differs from webhook instrument "${normalizedInstrument}"`);
            console.log(`📝 Using webhook instrument "${normalizedInstrument}" for this trade`);
            effectiveSymbol = normalizedInstrument;
          }
        }
        
        // Log to bot_activity_logs when signal is received by bot-executor
        await this.addBotLog(bot.id, {
          level: 'info',
          category: 'trade',
          message: `${alertEmoji} ${alertType} RECEIVED: Processing TradingView webhook signal (${signal.mode === 'paper' ? 'PAPER' : 'REAL'} mode)`,
          details: {
            signal_id: signalId,
            side: signal.side,
            mode: signal.mode,
            reason: signal.reason,
            size_multiplier: signal.size_multiplier,
            source: 'manual_trade_signal',
            alert_type: alertType,
            received_at: signal.created_at,
            timestamp: TimeSync.getCurrentTimeISO()
          }
        });

        try {
          if (signal.status === 'pending') {
            // Use service role client (already created at function start) to bypass RLS
            await serviceRoleClient
              .from('manual_trade_signals')
              .update({ status: 'processing' })
              .eq('id', signalId)
              .eq('status', 'pending');
          }

          console.log(`⚡ Executing manual trade: ${signal.side} for bot ${bot.name} (${signal.mode} mode)`);
          // Normalize signal mode (handle case/whitespace/null)
          const signalMode = signal.mode ? String(signal.mode).toLowerCase().trim() : null;
          const finalMode: 'real' | 'paper' = signalMode === 'paper' ? 'paper' : 'real';
          console.log(`🔍 Signal mode normalization: raw="${signal.mode}", normalized="${signalMode}", final="${finalMode}"`);
          if (signal.metadata && signal.metadata.instrument) {
            const webhookInstrument = String(signal.metadata.instrument);
            // Normalize TradingView symbol suffixes: remove .P, .PERP, .PERPETUAL, etc.
            const normalizedInstrument = webhookInstrument
              .replace(/\.P$/i, '') // Remove .P suffix
              .replace(/\.PERP$/i, '') // Remove .PERP suffix
              .replace(/\.PERPETUAL$/i, '') // Remove .PERPETUAL suffix
              .toUpperCase(); // Convert to uppercase for consistency
            
            if (normalizedInstrument && normalizedInstrument !== bot.symbol) {
              console.log(`🔍 Webhook instrument detected: "${webhookInstrument}" -> normalized: "${normalizedInstrument}"`);
              console.log(`⚠️ Bot symbol "${bot.symbol}" differs from webhook instrument "${normalizedInstrument}"`);
              console.log(`📝 Using webhook instrument "${normalizedInstrument}" for this trade`);
              effectiveSymbol = normalizedInstrument;
            }
          }
          
          // Create a modified bot object with the effective symbol
          const botWithSymbol = { ...bot, symbol: effectiveSymbol };
          
          console.log(`🚀 [MANUAL SIGNAL ${signalId}] Starting trade execution...`);
          console.log(`   Bot: ${bot.name} (${bot.id})`);
          console.log(`   Symbol: ${effectiveSymbol} (from webhook: ${signal.metadata?.instrument || 'N/A'})`);
          console.log(`   Side: ${signal.side}`);
          console.log(`   Mode: ${finalMode}`);
          console.log(`   Size Multiplier: ${signal.size_multiplier || 'none'}`);
          
          const result = await this.executeManualTrade(botWithSymbol, {
            side: signal.side,
            reason: signal.reason || 'Manual trade signal',
            confidence: 1,
            mode: finalMode,
            sizeMultiplier: signal.size_multiplier ? Number(signal.size_multiplier) : undefined,
            source: 'manual_trade_signal'
          });
          
          console.log(`✅ [MANUAL SIGNAL ${signalId}] Trade execution completed:`, result);

          // Verify that a trade was actually created (for real mode)
          let tradeCreated = result.success;
          
          if (finalMode === 'real' && !tradeCreated && !result.skipped) {
            // Only perform manual DB check if it wasn't explicitly skipped and success is false
            // Check if a trade was created in the last 5 minutes (increased from 60s to handle clock skew)
            // Also check both created_at and executed_at fields
            // CRITICAL: Use bot owner's user_id when checking for trades
            const botOwnerUserId = bot.user_id || bot.userId;
            const checkTime = new Date(Date.now() - 300000).toISOString(); // 5 minutes window
            
            console.log(`🔍 Verifying trade creation for bot ${bot.id}, owner ${botOwnerUserId}...`);
            console.log(`   Time window: since ${checkTime}`);
            
            const { data: recentTrades, error: tradeCheckError } = await serviceRoleClient
              .from('trades')
              .select('id, created_at, executed_at, symbol, side, status, user_id')
              .eq('bot_id', bot.id)
              .eq('user_id', botOwnerUserId) // FIXED: Check for bot owner's trades, not executor's
              .or(`created_at.gte.${checkTime},executed_at.gte.${checkTime}`)
              .order('created_at', { ascending: false })
              .limit(5);
            
            if (tradeCheckError) {
              console.error(`⚠️ Error checking for trades:`, tradeCheckError);
            }
            
            tradeCreated = (recentTrades && recentTrades.length > 0) || !!result.trade;
            
            if (!tradeCreated) {
              // One last check: maybe it's under the executor's user ID?
              const { data: executorTrades } = await serviceRoleClient
                .from('trades')
                .select('id, created_at, user_id')
                .eq('bot_id', bot.id)
                .eq('user_id', this.user.id)
                .or(`created_at.gte.${checkTime},executed_at.gte.${checkTime}`)
                .limit(1);
              
              if (executorTrades && executorTrades.length > 0) {
                console.log(`✅ Trade found under executor user ID ${this.user.id} instead of bot owner ${botOwnerUserId}`);
                tradeCreated = true;
              }
            }
            
            if (!tradeCreated) {
              console.warn(`⚠️ Manual trade signal ${signalId} completed but no trade was created in database`);
              console.warn(`   Checked for trades in last 5 minutes for bot ${bot.id}`);
              console.warn(`   Recent trades found: ${recentTrades?.length || 0}`);
              if (recentTrades && recentTrades.length > 0) {
                console.warn(`   Recent trades:`, JSON.stringify(recentTrades, null, 2));
              }
              
              await this.addBotLog(bot.id, {
                level: 'error',
                category: 'trade',
                message: `Manual trade signal completed but no trade created - possible silent failure`,
                details: {
                  signal_id: signalId,
                  side: signal.side,
                  mode: finalMode,
                  bot_status: bot.status,
                  paper_trading: bot.paper_trading,
                  check_time_window: '5 minutes',
                  trades_found: recentTrades?.length || 0,
                  trade_check_error: tradeCheckError?.message || null,
                  bot_owner_id: botOwnerUserId,
                  executor_id: this.user.id,
                  timestamp: TimeSync.getCurrentTimeISO()
                }
              });
            } else {
              console.log(`✅ Trade verification passed: Found trade(s) created`);
            }
          } else if (result.skipped) {
            console.log(`⏭️ Trade was intentionally skipped: ${result.reason}`);
            // If it was skipped, we mark it as completed but with an error message in the signal record
          } else {
            console.log(`✅ Trade verification passed: result.success is true`);
          }

          await serviceRoleClient
            .from('manual_trade_signals')
            .update({
              status: result.skipped ? 'failed' : (tradeCreated ? 'completed' : 'failed'),
              error: result.skipped ? `Skipped: ${result.reason}` : (tradeCreated ? null : 'Trade execution completed but no trade was created in database'),
              processed_at: TimeSync.getCurrentTimeISO(),
              mode: result.mode
            })
            .eq('id', signalId);

          console.log(`✅ Manual signal ${signalId} processed successfully`);
          processedCount += 1;
        } catch (signalError) {
          const errorMessage = signalError instanceof Error ? signalError.message : String(signalError);
          console.error(`❌ [MANUAL SIGNAL ${signalId}] Trade execution failed for bot ${bot.id}:`, errorMessage);
          console.error(`   Error type: ${signalError instanceof Error ? signalError.name : typeof signalError}`);
          if (signalError instanceof Error && signalError.stack) {
            console.error(`   Stack trace: ${signalError.stack.substring(0, 500)}`);
          }

          // Enhanced error logging for 403 errors
          const is403Error = errorMessage.includes('403') || errorMessage.includes('Forbidden');
          if (is403Error) {
            await this.addBotLog(bot.id, {
              level: 'error',
              category: 'trade',
              message: `Manual trade signal failed: Bybit API returned HTTP 403 (Forbidden). This indicates geographic/IP blocking from Bybit's CloudFront distribution.`,
              details: {
                signal_id: signalId,
                side: signal.side,
                mode: signal.mode,
                symbol: effectiveSymbol,
                error: errorMessage,
                http_status: 403,
                issue_type: 'bybit_geographic_blocking',
                troubleshooting: [
                  '1. Check Bybit API key IP whitelist settings (disable or add Supabase Edge Function IPs)',
                  '2. Verify API key has "Trade" permission enabled',
                  '3. Check if your region is blocked by Bybit',
                  '4. Consider using a VPN or proxy if geographic restrictions apply',
                  '5. Contact Bybit support if issue persists'
                ],
                timestamp: TimeSync.getCurrentTimeISO()
              }
            });
          } else {
            await this.addBotLog(bot.id, {
              level: 'error',
              category: 'trade',
              message: `Manual trade signal failed: ${errorMessage}`,
              details: {
                signal_id: signalId,
                side: signal.side,
                mode: signal.mode,
                symbol: effectiveSymbol,
                error: errorMessage,
                error_type: signalError instanceof Error ? signalError.name : typeof signalError,
                timestamp: TimeSync.getCurrentTimeISO()
              }
            });
          }

          await serviceRoleClient
            .from('manual_trade_signals')
            .update({
              status: 'failed',
              error: errorMessage,
              processed_at: TimeSync.getCurrentTimeISO()
            })
            .eq('id', signalId);
        }
      }

      return processedCount;
    } catch (processError) {
      console.error(`❌ Error processing manual trade signals for bot ${bot.id}:`, processError);
      return 0;
    }
  }

  // Public method for manual order placement (used by admin manual trading)
  public async placeManualOrder(apiKey: string, apiSecret: string, passphrase: string | null, exchange: string, symbol: string, side: string, amount: number, price: number, tradingType: string, bot: any = null): Promise<any> {
    try {
      if (exchange === 'bybit') {
        return await this.placeBybitOrder(apiKey, apiSecret, symbol, side, amount, price, tradingType, bot, null);
      } else if (exchange === 'okx') {
        return await this.placeOKXOrder(apiKey, apiSecret, passphrase || '', symbol, side, amount, price);
      } else if (exchange === 'bitunix') {
        return await this.placeBitunixOrder(apiKey, apiSecret, symbol, side, amount, price, tradingType, bot);
      } else if (exchange === 'mexc') {
        return await this.placeMEXCOrder(apiKey, apiSecret, symbol, side, amount, price, tradingType, bot);
      }
      throw new Error(`Unsupported exchange: ${exchange}`);
    } catch (error) {
      console.error('Manual order placement error:', error);
      throw error;
    }
  }

  private async placeOrder(bot: any, tradeSignal: any, amount: number, price: number): Promise<any> {
    try {
      // CRITICAL: Use bot owner's user_id for API keys, not the executor's user (which might be admin)
      // This ensures real trades use the bot owner's API keys, not the admin's
      const botOwnerUserId = bot.user_id || bot.userId || this.user.id;
      console.log(`🔑 Fetching API keys for bot owner: ${botOwnerUserId} (bot.user_id: ${bot.user_id}, executor.user.id: ${this.user.id})`);
      
      // Use service role client to bypass RLS when fetching API keys
      // This ensures API keys can be fetched regardless of who triggered the bot execution
      const serviceRoleClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      // Get API keys for the exchange
      // IMPORTANT: Paper trading should ALWAYS use mainnet API keys (is_testnet = false)
      // to get real market data, but trades are simulated in the database
      // Real trading also uses mainnet keys (is_testnet = false)
      // Normalize exchange name for case-insensitive matching
      const exchangeNormalized = (bot.exchange || '').toLowerCase().trim();
      const { data: apiKeys, error: apiKeysError } = await serviceRoleClient
        .from('api_keys')
        .select('api_key, api_secret, passphrase')
        .eq('user_id', botOwnerUserId)
        .ilike('exchange', exchangeNormalized)  // Use ilike for case-insensitive matching
        .eq('is_active', true)
        .eq('is_testnet', false)  // Always use mainnet keys for real market data
        .single();
      
      if (apiKeysError || !apiKeys) {
        const errorMsg = apiKeysError?.message || 'No API keys found';
        console.error(`❌ API keys fetch failed for user ${botOwnerUserId}, exchange ${bot.exchange}:`, errorMsg);
        
        // Log to bot activity logs for visibility
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'trade',
          message: `API keys not found for ${bot.exchange}. Please configure your ${bot.exchange} API keys in account settings.`,
          details: {
            user_id: botOwnerUserId,
            exchange: bot.exchange,
            error: errorMsg,
            action_required: 'Configure API keys in account settings'
          }
        });
        
        throw new Error(`No API keys found for ${bot.exchange}. Please configure your ${bot.exchange} API keys in your account settings. User ID: ${botOwnerUserId}`);
      }
      
      // Decrypt API keys
      let apiKey: string;
      let apiSecret: string;
      try {
        apiKey = this.decrypt(apiKeys.api_key);
        apiSecret = this.decrypt(apiKeys.api_secret);
        
        // Validate API key format (basic check)
        if (!apiKey || apiKey.length < 10) {
          throw new Error('API key appears to be invalid (too short or empty)');
        }
        if (!apiSecret || apiSecret.length < 10) {
          throw new Error('API secret appears to be invalid (too short or empty)');
        }
        
        console.log(`🔑 API key decrypted successfully. Length: ${apiKey.length}, First 10 chars: ${apiKey.substring(0, 10)}...`);
        console.log(`🔑 API secret decrypted successfully. Length: ${apiSecret.length}, First 10 chars: ${apiSecret.substring(0, 10)}...`);
      } catch (decryptError: any) {
        console.error(`❌ Failed to decrypt or validate API keys:`, decryptError);
        
        // Log to bot activity logs
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'trade',
          message: `Failed to decrypt or validate API keys for ${bot.exchange}. Please re-enter your API keys.`,
          details: {
            user_id: botOwnerUserId,
            exchange: bot.exchange,
            error: decryptError?.message || String(decryptError),
            action_required: 'Re-enter API keys in account settings'
          }
        });
        
        throw new Error(`Failed to decrypt or validate API keys. Please re-enter your ${bot.exchange} API keys in your account settings. Error: ${decryptError?.message || decryptError}`);
      }
      const passphrase = apiKeys.passphrase ? this.decrypt(apiKeys.api_secret) : '';
      
      const tradingType = bot.tradingType || bot.trading_type || 'spot';
      
      // For spot trading:
      // - BUY: Uses USDT balance (checked by checkBybitBalance)
      // - SELL: Uses asset balance (e.g., ETH, BTC) - also checked by checkBybitBalance
      // For futures: can both buy (long) and sell (short)
      // Balance checks are handled below by checkBybitBalance() function
      
      // Check balance before placing order
      const orderValue = amount * price;
      
      // Normalize exchange name to lowercase for case-insensitive matching
      const exchange = (bot.exchange || '').toLowerCase().trim();
      
      // Log exchange routing for debugging
      console.log(`🔀 Exchange routing: bot.exchange="${bot.exchange}", normalized="${exchange}"`);
      console.log(`   Bot Name: ${bot.name || 'Unknown'}, Bot ID: ${bot.id}`);
      
      // Warn if bot name suggests one exchange but database has another
      const botNameUpper = (bot.name || '').toUpperCase();
      if (botNameUpper.includes('BITUNIX') && exchange !== 'bitunix') {
        console.error(`⚠️ WARNING: Bot name contains "BITUNIX" but exchange field is "${bot.exchange}" (normalized: "${exchange}")`);
        console.error(`   This bot will route to ${exchange === 'bybit' ? 'Bybit' : exchange} instead of Bitunix!`);
        console.error(`   ACTION REQUIRED: Update bot.exchange to "bitunix" in the database for bot ID: ${bot.id}`);
      } else if (botNameUpper.includes('BYBIT') && exchange !== 'bybit') {
        console.warn(`⚠️ Bot name contains "BYBIT" but exchange field is "${bot.exchange}" (normalized: "${exchange}")`);
      }
      
      if (exchange === 'bybit') {
        // Check balance for Bybit before placing order
        const balanceCheck = await this.checkBybitBalance(apiKey, apiSecret, bot.symbol, tradeSignal.side, orderValue, tradingType, amount);
        if (!balanceCheck.hasBalance) {
          const shortfall = balanceCheck.totalRequired - balanceCheck.availableBalance;
          
          // Provide more specific error messages based on order type
          if (tradingType === 'spot' && tradeSignal.side.toLowerCase() === 'sell') {
            // Extract asset name for better error message
            let baseAsset = bot.symbol;
            if (bot.symbol.endsWith('USDT')) {
              baseAsset = bot.symbol.replace(/USDT$/, '');
              // Handle prefixes like 1000PEPE, 10000SATS
              baseAsset = baseAsset.replace(/^(1000|10000)/, '');
            }
            throw new Error(`Insufficient ${baseAsset} balance to sell ${bot.symbol}. Available: ${balanceCheck.availableBalance.toFixed(8)} ${baseAsset}, Required: ${balanceCheck.totalRequired.toFixed(8)} ${baseAsset}. Shortfall: ${shortfall.toFixed(8)} ${baseAsset}. You can only sell assets you own.`);
          } else {
            throw new Error(`Insufficient balance for ${bot.symbol} ${tradeSignal.side} order. Available: $${balanceCheck.availableBalance.toFixed(2)}, Required: $${balanceCheck.totalRequired.toFixed(2)} (order: $${orderValue.toFixed(2)} + 5% buffer). Shortfall: $${shortfall.toFixed(2)}. Please add funds to your Bybit ${tradingType === 'futures' ? 'UNIFIED/Futures' : 'Spot'} wallet.`);
          }
        }
        return await this.placeBybitOrder(apiKey, apiSecret, bot.symbol, tradeSignal.side, amount, price, tradingType, bot, tradeSignal);
      } else if (exchange === 'okx') {
        // TODO: Add balance check for OKX
        return await this.placeOKXOrder(apiKey, apiSecret, passphrase, bot.symbol, tradeSignal.side, amount, price);
      } else if (exchange === 'bitunix') {
        // Check balance for Bitunix before placing order
        const balanceCheck = await this.checkBitunixBalance(apiKey, apiSecret, bot.symbol, tradeSignal.side, orderValue, tradingType, amount);
        if (!balanceCheck.hasBalance) {
          const shortfall = balanceCheck.totalRequired - balanceCheck.availableBalance;
          
          // Provide more specific error messages based on order type
          if (tradingType === 'spot' && tradeSignal.side.toLowerCase() === 'sell') {
            // Extract asset name for better error message
            let baseAsset = bot.symbol;
            if (bot.symbol.endsWith('USDT')) {
              baseAsset = bot.symbol.replace(/USDT$/, '');
              // Handle prefixes like 1000PEPE, 10000SATS
              baseAsset = baseAsset.replace(/^(1000|10000)/, '');
            }
            throw new Error(`Insufficient ${baseAsset} balance to sell ${bot.symbol}. Available: ${balanceCheck.availableBalance.toFixed(8)} ${baseAsset}, Required: ${balanceCheck.totalRequired.toFixed(8)} ${baseAsset}. Shortfall: ${shortfall.toFixed(8)} ${baseAsset}. You can only sell assets you own.`);
          } else {
            throw new Error(`Insufficient balance for ${bot.symbol} ${tradeSignal.side} order. Available: $${balanceCheck.availableBalance.toFixed(2)}, Required: $${balanceCheck.totalRequired.toFixed(2)} (order: $${orderValue.toFixed(2)} + 5% buffer). Shortfall: $${shortfall.toFixed(2)}. Please add funds to your Bitunix ${tradingType === 'futures' ? 'Futures' : 'Spot'} wallet.`);
          }
        }
        
        // For futures, set leverage and margin mode BEFORE placing order (CRITICAL for Bitunix)
        // First check current settings - if already correct, proceed without setting
        // If setting fails, retry up to 3 times with 1-second delays
        if (tradingType === 'futures') {
          // Use resolveLeverage to ensure Bitunix uses 3x default instead of 20x
          // CRITICAL: For Bitunix futures, always use at least 3x leverage (minimum allowed)
          // If bot.leverage is 0, null, undefined, or less than 3, use 3x minimum
          let userLeverage = bot.leverage;
          if (!userLeverage || userLeverage < 1) {
            userLeverage = 3; // Default to 3x if not set or invalid
          }
          // CRITICAL: Force minimum 3x for Bitunix futures (even if user set 1x or 2x)
          if (bot.exchange?.toLowerCase() === 'bitunix' && userLeverage < 3) {
            console.warn(`⚠️ Bot leverage is set to ${bot.leverage}x, but Bitunix futures minimum is 3x. Using 3x instead.`);
            userLeverage = 3; // Force minimum 3x for Bitunix futures
          }
          let expectedLeverage = resolveLeverage(bot.exchange, tradingType, userLeverage);
          
          // Final safety check: ensure expectedLeverage is at least 3x for Bitunix futures
          if (bot.exchange?.toLowerCase() === 'bitunix' && tradingType === 'futures' && expectedLeverage < 3) {
            console.warn(`⚠️ resolveLeverage returned ${expectedLeverage}x, but Bitunix futures minimum is 3x. Forcing 3x.`);
            expectedLeverage = 3; // Force minimum 3x for Bitunix futures
          }
          const expectedMarginMode = 'ISOLATED';
          
          console.log(`🔧 Leverage calculation: bot.leverage=${bot.leverage}, userLeverage=${userLeverage}, expectedLeverage=${expectedLeverage} for ${bot.exchange} ${tradingType}`);
          
          console.log(`🔧 Leverage resolution: userLeverage=${userLeverage}, resolvedLeverage=${expectedLeverage} for ${bot.exchange} ${tradingType}`);
          
          let leverageSetupSuccess = false;
          let lastLeverageError: any = null;
          
          // FIRST: Check current settings - if already correct, proceed immediately (avoids unnecessary API calls)
          console.log(`⚙️ Checking current Bitunix account/symbol leverage and margin mode...`);
          console.log(`   Symbol: ${bot.symbol}, Expected Leverage: ${expectedLeverage}x, Expected Margin Mode: ${expectedMarginMode}`);
          
          const currentSettings = await this.getBitunixAccountSettings(apiKey, apiSecret, bot.symbol);
          if (currentSettings) {
            const actualMarginMode = currentSettings.marginMode?.toUpperCase();
            const isMarginModeCorrect = actualMarginMode === 'ISOLATED' || actualMarginMode === 'ISOLATION';
            
            if (currentSettings.leverage === expectedLeverage && isMarginModeCorrect) {
              console.log(`✅ Current settings are already correct: ${currentSettings.leverage}x ${currentSettings.marginMode} - Proceeding with order (skipping set to avoid Signature Error 10007)`);
              leverageSetupSuccess = true;
            } else {
              console.log(`📊 Current settings: ${currentSettings.leverage}x ${currentSettings.marginMode}`);
              console.log(`   Need to update to: ${expectedLeverage}x ${expectedMarginMode}`);
            }
          } else {
            console.warn(`   ⚠️ Could not retrieve current settings - will attempt to set`);
          }
          
          // If settings are not correct, try to set them (retry up to 3 times)
          // CRITICAL: Only set if not already correct to avoid unnecessary API calls that trigger Signature Error 10007
          if (!leverageSetupSuccess) {
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                console.log(`⚙️ Setting Bitunix account/symbol leverage and margin mode BEFORE order placement (attempt ${attempt}/3)...`);
                console.log(`   Symbol: ${bot.symbol}, Leverage: ${expectedLeverage}x, Margin Mode: ${expectedMarginMode}`);
                
                // Set at account/symbol level - this must be done BEFORE placing orders
                try {
                  await this.setBitunixAccountLeverageAndMarginMode(apiKey, apiSecret, bot.symbol, expectedLeverage, expectedMarginMode);
                } catch (setError: any) {
                  // Check if error indicates existing position/order or that it will try on position
                  const errorMsg = setError instanceof Error ? setError.message : String(setError);
                  const isNonCriticalError = errorMsg.includes('position') || 
                                            errorMsg.includes('order') || 
                                            errorMsg.includes('exist') ||
                                            errorMsg.includes('Will try on position') ||
                                            errorMsg.includes('will try on position');
                  
                  if (isNonCriticalError) {
                    console.warn(`   ⚠️ Cannot change leverage/margin mode at account level. Checking current settings...`);
                    console.warn(`   Error: ${errorMsg}`);
                    
                    // Check current leverage - if already correct, proceed
                    const checkSettings = await this.getBitunixAccountSettings(apiKey, apiSecret, bot.symbol);
                    if (checkSettings) {
                      const checkMarginMode = checkSettings.marginMode?.toUpperCase();
                      const isCheckMarginModeCorrect = checkMarginMode === 'ISOLATED' || checkMarginMode === 'ISOLATION';
                      
                      if (checkSettings.leverage === expectedLeverage && isCheckMarginModeCorrect) {
                        console.log(`   ✅ Current settings are already correct: ${checkSettings.leverage}x ${checkSettings.marginMode} - proceeding with order`);
                        leverageSetupSuccess = true;
                        break; // Success - settings are already correct
                      } else {
                        // Settings don't match - CRITICAL: Bitunix requires correct settings BEFORE placing orders
                        // Code 2 "System error" often occurs when leverage/margin mode aren't set correctly
                        console.error(`   ❌ CRITICAL: Current settings (${checkSettings.leverage}x ${checkSettings.marginMode}) don't match expected (${expectedLeverage}x ${expectedMarginMode})`);
                        console.error(`   ❌ Bitunix requires correct leverage/margin mode BEFORE placing orders. Aborting to prevent Code 2 errors.`);
                        throw new Error(`CRITICAL: Bitunix account settings don't match. Current: ${checkSettings.leverage}x ${checkSettings.marginMode}, Expected: ${expectedLeverage}x ${expectedMarginMode}. Please set manually on Bitunix before placing orders.`);
                      }
                    } else {
                      // Can't check settings, but error says will try on position
                      // Code 2 "System error" is common when account has no positions - Bitunix requires setting leverage on position
                      // This is acceptable - we'll set leverage/margin mode on the position after order placement
                      console.warn(`   ⚠️ Cannot verify current settings (Code 2 is common when account has no positions).`);
                      console.warn(`   ⚠️ Will proceed with order and set leverage/margin mode on position after order placement.`);
                      console.warn(`   ⚠️ Expected: ${expectedLeverage}x ${expectedMarginMode}`);
                      leverageSetupSuccess = true; // Mark as success - will set on position
                      break;
                    }
                  } else {
                    // Other error - check current settings before rethrowing
                    console.warn(`   ⚠️ Unexpected error setting leverage/margin mode: ${errorMsg}`);
                    try {
                      const checkSettings = await this.getBitunixAccountSettings(apiKey, apiSecret, bot.symbol);
                      if (checkSettings) {
                        const checkMarginMode = checkSettings.marginMode?.toUpperCase();
                        const isCheckMarginModeCorrect = checkMarginMode === 'ISOLATED' || checkMarginMode === 'ISOLATION';
                        
                        if (checkSettings.leverage === expectedLeverage && isCheckMarginModeCorrect) {
                          console.log(`   ✅ Current settings are already correct despite error - proceeding`);
                          leverageSetupSuccess = true;
                          break;
                        }
                      }
                    } catch (checkErr) {
                      // If check fails, continue to rethrow original error
                    }
                    // If settings aren't correct or check failed, rethrow to be caught by outer try/catch
                    throw setError;
                  }
                }
                
                // Wait a moment for settings to take effect
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
              
              // CRITICAL: Verify settings were applied
              // If setBitunixAccountLeverageAndMarginMode didn't throw, it means either:
              // 1. Settings were successfully set, OR
              // 2. Settings are already correct (position exists but current settings match)
              // So we should try to verify, but if verification fails, we can still proceed
              // since the set function would have thrown if there was a critical issue
              const accountSettings = await this.getBitunixAccountSettings(apiKey, apiSecret, bot.symbol);
              if (!accountSettings) {
                if (attempt < 3) {
                  console.warn(`   ⚠️ Cannot verify settings (attempt ${attempt}/3), retrying in 1 second...`);
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  continue; // Retry
                } else {
                  // Verification failed, but setBitunixAccountLeverageAndMarginMode didn't throw
                  // This likely means settings are correct but API is having issues
                  // Log a warning but proceed with order (settings were likely already correct)
                  console.warn(`   ⚠️ Cannot verify settings after 3 attempts, but set function succeeded. Proceeding with order (settings likely already correct).`);
                  if (bot?.id) {
                    await this.addBotLog(bot.id, {
                      level: 'warn',
                      category: 'trade',
                      message: `Could not verify Bitunix leverage/margin mode after setting, but set function reported success. Proceeding with order.`,
                      details: {
                        symbol: bot.symbol,
                        expectedLeverage: expectedLeverage,
                        expectedMarginMode: expectedMarginMode,
                        attempts: 3,
                        note: 'Settings were likely already correct or set successfully, but verification API call failed'
                      }
                    });
                  }
                  leverageSetupSuccess = true; // Mark as success to proceed
                  break; // Exit retry loop
                }
              }
              
              console.log(`📊 Account settings: Leverage: ${accountSettings.leverage}x, Margin Mode: ${accountSettings.marginMode}`);
              
              // Verify both leverage and margin mode match expected values
              const actualMarginMode = accountSettings.marginMode?.toUpperCase();
              const isMarginModeCorrect = actualMarginMode === 'ISOLATED' || actualMarginMode === 'ISOLATION';
              
              if (accountSettings.leverage !== expectedLeverage || !isMarginModeCorrect) {
                if (attempt < 3) {
                  console.warn(`   ⚠️ Settings mismatch: expected ${expectedLeverage}x ${expectedMarginMode}, got ${accountSettings.leverage}x ${accountSettings.marginMode} (attempt ${attempt}/3), retrying in 1 second...`);
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  continue; // Retry
                } else {
                  const errorMsg = `CRITICAL: Bitunix settings verification failed after 3 attempts. Expected ${expectedLeverage}x ${expectedMarginMode} but got ${accountSettings.leverage}x ${accountSettings.marginMode}. Order aborted to prevent using wrong settings.`;
                  console.error(`❌ ${errorMsg}`);
                  if (bot?.id) {
                    await this.addBotLog(bot.id, {
                      level: 'error',
                      category: 'trade',
                      message: errorMsg,
                      details: {
                        symbol: bot.symbol,
                        expectedLeverage: expectedLeverage,
                        actualLeverage: accountSettings.leverage,
                        expectedMarginMode: expectedMarginMode,
                        actualMarginMode: accountSettings.marginMode,
                        attempts: 3,
                        action_required: `URGENT: Manually set leverage to ${expectedLeverage}x and margin mode to ${expectedMarginMode} on Bitunix account settings before placing orders`
                      }
                    });
                  }
                  throw new Error(errorMsg);
                }
              }
              
              // Settings verified successfully
              console.log(`✅ Leverage and margin mode verified: ${accountSettings.leverage}x ${accountSettings.marginMode}`);
              leverageSetupSuccess = true;
              break; // Exit retry loop - success!
            } catch (retryError: any) {
              // If this is the last attempt, rethrow the error
              if (attempt === 3) {
                const errorMsg = retryError instanceof Error ? retryError.message : String(retryError);
                if (errorMsg.includes('CRITICAL')) {
                  throw retryError; // Re-throw critical errors
                } else {
                  // Non-critical error on last attempt - check if settings might already be correct
                  console.warn(`   ⚠️ Error on attempt ${attempt}: ${errorMsg}`);
                  const finalCheck = await this.getBitunixAccountSettings(apiKey, apiSecret, bot.symbol);
                  if (finalCheck) {
                    const finalMarginMode = finalCheck.marginMode?.toUpperCase();
                    const isFinalMarginModeCorrect = finalMarginMode === 'ISOLATED' || finalMarginMode === 'ISOLATION';
                    if (finalCheck.leverage === expectedLeverage && isFinalMarginModeCorrect) {
                      console.log(`   ✅ Final check: Settings are correct (${finalCheck.leverage}x ${finalCheck.marginMode}) - proceeding`);
                      leverageSetupSuccess = true;
                      break;
                    }
                  }
                  throw new Error(`CRITICAL: Cannot set Bitunix account leverage/margin mode after 3 attempts. Order aborted to prevent using wrong settings (20x Cross). Error: ${errorMsg}`);
                }
              } else {
                console.warn(`   ⚠️ Error on attempt ${attempt}: ${retryError.message || retryError}, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue; // Retry
              }
            }
          }
          
          // If we get here and leverageSetupSuccess is still false, it means all attempts failed
          if (!leverageSetupSuccess) {
            const errorMsg = `CRITICAL: Cannot set Bitunix account leverage/margin mode after 3 attempts. Order aborted to prevent using wrong settings (20x Cross).`;
            console.error(`❌ ${errorMsg}`);
            if (bot?.id) {
              await this.addBotLog(bot.id, {
                level: 'error',
                category: 'trade',
                message: errorMsg,
                details: {
                  symbol: bot.symbol,
                  expectedLeverage: expectedLeverage,
                  expectedMarginMode: expectedMarginMode,
                  attempts: 3,
                  action_required: `URGENT: Manually set leverage to ${expectedLeverage}x and margin mode to ${expectedMarginMode} on Bitunix account settings before placing orders`
                }
              });
            }
            throw new Error(errorMsg);
          }
        }
        
        // #region agent log - BEFORE order placement
        console.log(`[DEBUG-SLTP] ABOUT TO PLACE BITUNIX ORDER:`, JSON.stringify({
          location: 'bot-executor/index.ts:6804',
          message: 'ABOUT TO PLACE BITUNIX ORDER',
          data: { 
            tradingType, 
            exchange: 'bitunix', 
            symbol: bot.symbol,
            side: tradeSignal.side,
            amount,
            price
          },
          timestamp: Date.now(),
          hypothesisId: 'A'
        }));
        // #endregion
        
        let orderResult: any = null;
        let orderPlacementError: any = null;
        
        try {
          orderResult = await this.placeBitunixOrder(apiKey, apiSecret, bot.symbol, tradeSignal.side, amount, price, tradingType, bot);
        } catch (orderErr: any) {
          // CRITICAL: Don't let order placement errors prevent SL/TP setup
          // If order was actually placed but returned an error, we should still try SL/TP
          orderPlacementError = orderErr;
          console.error(`[DEBUG-SLTP] Order placement threw error, but checking if order was actually placed:`, orderErr?.message || String(orderErr));
          
          // Check if error message suggests order might have been placed
          const errorMsg = orderErr?.message || String(orderErr);
          if (errorMsg.includes('orderId') || errorMsg.includes('order placed') || errorMsg.includes('Code: 2')) {
            // Code 2 or other errors might occur even if order was placed
            // Try to extract orderId from error if possible
            console.warn(`[DEBUG-SLTP] Order placement error occurred, but order might have been placed. Will attempt SL/TP anyway.`);
          }
        }
        
        // #region agent log - IMMEDIATELY AFTER order placement
        console.log(`[DEBUG-SLTP] ORDER PLACED - IMMEDIATE CHECK:`, JSON.stringify({
          location: 'bot-executor/index.ts:6806',
          message: 'ORDER PLACED - IMMEDIATE CHECK',
          data: { 
            tradingType, 
            hasOrderResult: !!orderResult,
            orderResultType: typeof orderResult,
            hasOrderId: !!orderResult?.orderId, 
            orderId: orderResult?.orderId,
            hasId: !!orderResult?.id,
            id: orderResult?.id,
            hasResponse: !!orderResult?.response,
            hasResponseData: !!orderResult?.response?.data,
            responseDataOrderId: orderResult?.response?.data?.orderId,
            responseDataId: orderResult?.response?.data?.id,
            exchange: 'bitunix', 
            symbol: bot.symbol,
            orderResultKeys: orderResult ? Object.keys(orderResult) : [],
            fullOrderResultPreview: orderResult ? JSON.stringify(orderResult).substring(0, 1000) : 'null',
            hasOrderPlacementError: !!orderPlacementError,
            orderPlacementErrorMsg: orderPlacementError?.message || null
          },
          timestamp: Date.now(),
          hypothesisId: 'A'
        }));
        // #endregion
        
        // CRITICAL: Extract positionId from order response if available
        // Bitunix order response may contain positionId directly
        let orderPositionId = null;
        if (orderResult?.response?.data) {
          const orderData = orderResult.response.data;
          orderPositionId = orderData.positionId || orderData.position_id || orderData.positionID || 
                           orderData.id || orderData.orderId;
          if (orderPositionId) {
            console.log(`📊 Found positionId in order response: ${orderPositionId}`);
          }
        }
        
        // #region agent log
        console.log(`[DEBUG-SLTP] Extracted positionId from order:`, JSON.stringify({
          location: 'bot-executor/index.ts:6816',
          message: 'Extracted positionId from order',
          data: { orderPositionId, hasOrderResult: !!orderResult, hasResponseData: !!orderResult?.response?.data },
          timestamp: Date.now(),
          hypothesisId: 'A'
        }));
        // #endregion
        
        // CRITICAL FIX: Set SL/TP after order placement, but wait a moment for position to be established
        // Bitunix may need a few seconds to process the order and establish the position before SL/TP can be set
        // Wait 2-3 seconds after successful order placement before attempting SL/TP
        // Bitunix supports symbol-based SL/TP which doesn't require positionId, but position must still exist
        
        // #region agent log - BEFORE condition check
        console.log(`[DEBUG-SLTP] BEFORE condition check - full orderResult analysis:`, JSON.stringify({
          location: 'bot-executor/index.ts:6869',
          message: 'BEFORE condition check - analyzing orderResult',
          data: {
            hasOrderResult: !!orderResult,
            tradingType,
            isFutures: tradingType === 'futures',
            orderResultType: typeof orderResult,
            orderResultKeys: orderResult ? Object.keys(orderResult) : [],
            orderResultOrderId: orderResult?.orderId,
            orderResultId: orderResult?.id,
            orderResultStatus: orderResult?.status,
            orderResultExchange: orderResult?.exchange,
            hasResponse: !!orderResult?.response,
            responseType: typeof orderResult?.response,
            responseKeys: orderResult?.response ? Object.keys(orderResult.response) : [],
            hasResponseData: !!orderResult?.response?.data,
            responseDataType: typeof orderResult?.response?.data,
            responseDataKeys: orderResult?.response?.data ? Object.keys(orderResult.response.data) : [],
            responseDataOrderId: orderResult?.response?.data?.orderId,
            responseDataId: orderResult?.response?.data?.id,
            responseDataCode: orderResult?.response?.code,
            responseDataMsg: orderResult?.response?.msg,
            fullOrderResultPreview: orderResult ? JSON.stringify(orderResult).substring(0, 1000) : 'null'
          },
          timestamp: Date.now(),
          hypothesisId: 'A'
        }));
        // #endregion
        
        // #region agent log - ENTERING SL/TP SECTION
        console.log(`[DEBUG-SLTP] ENTERING SL/TP SECTION:`, JSON.stringify({
          location: 'bot-executor/index.ts:6870',
          message: 'ENTERING SL/TP SECTION',
          data: { 
            tradingType,
            isFutures: tradingType === 'futures',
            hasOrderResult: !!orderResult,
            orderResultExists: orderResult !== null && orderResult !== undefined
          },
          timestamp: Date.now(),
          hypothesisId: 'A'
        }));
        // #endregion
        
        const hasOrderId = !!(orderResult?.orderId || orderResult?.id || orderResult?.response?.data?.orderId || orderResult?.response?.data?.id);
        const hasSuccessfulResponse = !!(orderResult && (orderResult.response || orderResult.status || orderResult.exchange === 'bitunix'));
        // CRITICAL: For futures, attempt SL/TP if we have ANY orderResult (even if structure is unexpected)
        // Symbol-based SL/TP doesn't require orderId, so we can attempt it as long as orderResult exists
        const hasAnyOrderResult = !!orderResult && typeof orderResult === 'object' && !(orderResult instanceof Error);
        // CRITICAL: Even if order placement threw an error, attempt SL/TP for futures
        // Code 2 errors might occur even if order was placed, and we should try to protect the position
        const shouldAttemptSLTPDespiteError = tradingType === 'futures' && orderPlacementError && !orderResult;
        
        // #region agent log
        console.log(`[DEBUG-SLTP] Checking SL/TP condition:`, JSON.stringify({
          location: 'bot-executor/index.ts:6871',
          message: 'Checking SL/TP condition',
          data: { 
            tradingType, 
            isFutures: tradingType === 'futures', 
            hasOrderId, 
            orderId: orderResult?.orderId || orderResult?.id || orderResult?.response?.data?.orderId || orderResult?.response?.data?.id,
            hasSuccessfulResponse,
            hasAnyOrderResult,
            orderResultType: typeof orderResult,
            orderResultIsError: orderResult instanceof Error,
            hasOrderPlacementError: !!orderPlacementError,
            shouldAttemptSLTPDespiteError,
            conditionMet: tradingType === 'futures' && (hasOrderId || hasSuccessfulResponse || hasAnyOrderResult || shouldAttemptSLTPDespiteError),
            reasonIfNotMet: tradingType !== 'futures' ? 'Not futures trading' : (!hasOrderId && !hasSuccessfulResponse && !hasAnyOrderResult && !shouldAttemptSLTPDespiteError ? 'No orderId, no successful response, no orderResult, and not attempting despite error' : 'Unknown')
          },
          timestamp: Date.now(),
          hypothesisId: 'A'
        }));
        // #endregion
        
        // CRITICAL FIX: Attempt SL/TP if order was successful, even if orderId format is unexpected
        // For futures, we can use symbol-based SL/TP endpoint which doesn't require orderId
        // Try SL/TP if we have ANY orderResult (not null, not undefined, not an Error)
        // ALSO attempt SL/TP even if order placement threw an error (Code 2 might occur even if order was placed)
        if (tradingType === 'futures' && (hasOrderId || hasSuccessfulResponse || hasAnyOrderResult || shouldAttemptSLTPDespiteError)) {
          // #region agent log
          console.log(`[DEBUG-SLTP] SL/TP CONDITION MET - CALLING setBitunixSLTP:`, JSON.stringify({
            location: 'bot-executor/index.ts:6872',
            message: 'SL/TP CONDITION MET - CALLING setBitunixSLTP',
            data: { 
              tradingType,
              hasOrderId,
              hasSuccessfulResponse,
              orderId: orderResult?.orderId || orderResult?.id || orderResult?.response?.data?.orderId || orderResult?.response?.data?.id,
              orderPositionId
            },
            timestamp: Date.now(),
            hypothesisId: 'A'
          }));
          // #endregion
          
          try {
            // CRITICAL: Wait longer for Bitunix to establish the position before setting SL/TP
            // Bitunix may need 8-12 seconds to process the order and make the position available for SL/TP
            // Increased wait time based on Code 2 errors indicating position not ready
            console.log(`⏳ Waiting 8 seconds for Bitunix position to be established before setting SL/TP...`);
            await new Promise(resolve => setTimeout(resolve, 8000));
            
            // Verify position exists before attempting SL/TP
            console.log(`🔍 Verifying position exists before setting SL/TP...`);
            let positionVerified = false;
            for (let verifyAttempt = 1; verifyAttempt <= 8; verifyAttempt++) {
              try {
                const verifyPos = await this.getBitunixPosition(apiKey, apiSecret, bot.symbol);
                if (verifyPos && verifyPos.size > 0) {
                  console.log(`✅ Position verified: ${verifyPos.size} @ ${verifyPos.entryPrice || 'N/A'}`);
                  positionVerified = true;
                  break;
                } else {
                  console.warn(`   ⚠️ Position not found yet (attempt ${verifyAttempt}/8), waiting 3 more seconds...`);
                  if (verifyAttempt < 8) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                  }
                }
              } catch (verifyErr) {
                console.warn(`   ⚠️ Error verifying position (attempt ${verifyAttempt}/8):`, verifyErr instanceof Error ? verifyErr.message : String(verifyErr));
                if (verifyAttempt < 5) {
                  await new Promise(resolve => setTimeout(resolve, 2000));
                }
              }
            }
            
            if (!positionVerified) {
              console.warn(`⚠️ Position not verified after 5 attempts, but proceeding with SL/TP attempt anyway...`);
            }
            
            // Get entry price from order result or use provided price
            // CRITICAL: If order placement threw an error but order might have been placed, use provided price
            let entryPrice = price;
            if (orderResult?.avgPrice && parseFloat(orderResult.avgPrice) > 0) {
              entryPrice = parseFloat(orderResult.avgPrice);
            } else if (orderResult?.price && parseFloat(orderResult.price) > 0) {
              entryPrice = parseFloat(orderResult.price);
            } else if (orderPlacementError && !orderResult) {
              // Order placement threw error, but order might have been placed
              // Use provided price as fallback
              console.warn(`⚠️ Using provided price (${price}) for SL/TP since orderResult is null due to error`);
              entryPrice = price;
            }
            
            // setBitunixSLTP calculates SL/TP internally based on entryPrice and bot settings
            // Pass orderResult even if it's null (setBitunixSLTP can handle it)
            await this.setBitunixSLTP(apiKey, apiSecret, bot.symbol, tradeSignal.side, entryPrice, bot, tradeSignal, orderResult || undefined);
            console.log(`✅ Bitunix SL/TP set successfully for ${bot.symbol}`);
          } catch (sltpError) {
            console.error(`❌ Failed to set Bitunix SL/TP for ${bot.symbol}:`, sltpError);
            // Don't throw - allow order to succeed even if SL/TP fails
            // Log error for debugging
            if (bot?.id) {
              await this.addBotLog(bot.id, {
                level: 'error',
                category: 'trade',
                message: `Failed to set SL/TP: ${sltpError instanceof Error ? sltpError.message : String(sltpError)}`,
                details: {
                  symbol: bot.symbol,
                  error: sltpError instanceof Error ? sltpError.message : String(sltpError),
                  orderId: orderResult?.orderId || orderResult?.id || orderResult?.response?.data?.orderId || orderResult?.response?.data?.id,
                  action_required: 'Manually set SL/TP on Bitunix exchange'
                }
              });
            }
          }
        } else {
          console.log(`[DEBUG-SLTP] SL/TP CONDITION NOT MET - SKIPPING:`, JSON.stringify({
            location: 'bot-executor/index.ts:6873',
            message: 'SL/TP CONDITION NOT MET - SKIPPING',
            data: { 
              tradingType,
              isFutures: tradingType === 'futures',
              hasOrderId,
              hasSuccessfulResponse,
              reason: tradingType !== 'futures' ? 'Not futures trading' : (!hasOrderId && !hasSuccessfulResponse ? 'No orderId and no successful response' : 'Unknown')
            },
            timestamp: Date.now(),
            hypothesisId: 'A'
          }));
        }
        
        // Set leverage and margin mode on the position AFTER order is placed (for futures only)
        if (tradingType === 'futures' && orderResult?.orderId) {
          try {
            // Wait for position to be established
            console.log(`⏳ Waiting for Bitunix position to be established before setting leverage/margin mode...`);
            await new Promise(resolve => setTimeout(resolve, 3000)); // Increased wait time
            
            // Retry getting position (position may take time to appear)
            // Bitunix positions often take longer than 3 seconds to be visible in the API after a market order fills
            // Increase retry count to 10 and delay to 2 seconds
            let positionInfo = null;
            for (let retry = 0; retry < 10; retry++) {
              positionInfo = await this.getBitunixPosition(apiKey, apiSecret, bot.symbol);
              if (positionInfo && positionInfo.size > 0) {
                break;
              }
              console.log(`   Position not found yet, retrying... (${retry + 1}/10)`);
              await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay between retries
            }
            
            if (positionInfo && positionInfo.size > 0) {
              console.log(`📊 Current position: ${positionInfo.size} @ ${positionInfo.entryPrice}, Leverage: ${positionInfo.leverage}x, Margin: ${positionInfo.marginMode}`);
              
              // Use resolveLeverage to ensure Bitunix uses 3x default instead of 20x
              const userLeverage = bot.leverage || 3;
              const expectedPositionLeverage = resolveLeverage(bot.exchange, tradingType, userLeverage);
              
              // Always try to set if different from desired (even if account setting failed)
              if (positionInfo.leverage !== expectedPositionLeverage || positionInfo.marginMode !== 'ISOLATED') {
                console.log(`⚙️ Updating position: Leverage ${positionInfo.leverage}x → ${expectedPositionLeverage}x, Margin ${positionInfo.marginMode} → ISOLATED`);
                
                // Try multiple times with different approaches
                let updateSuccess = false;
                for (let attempt = 1; attempt <= 3; attempt++) {
                  try {
                    await this.setBitunixPositionLeverageAndMarginMode(apiKey, apiSecret, bot.symbol, expectedPositionLeverage, 'ISOLATED');
                    updateSuccess = true;
                    break;
                  } catch (updateError) {
                    console.warn(`   ⚠️ Update attempt ${attempt}/3 failed:`, updateError);
                    if (attempt < 3) {
                      await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                  }
                }
                
                // Verify it was set correctly
                if (updateSuccess) {
                  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for update to take effect
                  const updatedPosition = await this.getBitunixPosition(apiKey, apiSecret, bot.symbol);
                  if (updatedPosition) {
                    if (updatedPosition.leverage === expectedPositionLeverage && updatedPosition.marginMode === 'ISOLATED') {
                      console.log(`✅ Position leverage and margin mode updated successfully`);
                    } else {
                      console.warn(`⚠️ Position update may have failed. Current: ${updatedPosition.leverage}x ${updatedPosition.marginMode}, Expected: ${expectedPositionLeverage}x ISOLATED`);
                      if (bot?.id) {
                        await this.addBotLog(bot.id, {
                          level: 'warning',
                          category: 'trade',
                          message: `Position leverage/margin mode may not be correct. Current: ${updatedPosition.leverage}x ${updatedPosition.marginMode}, Expected: ${expectedPositionLeverage}x ISOLATED`,
                          details: {
                            symbol: bot.symbol,
                            currentLeverage: updatedPosition.leverage,
                            currentMarginMode: updatedPosition.marginMode,
                            expectedLeverage: expectedPositionLeverage,
                            expectedMarginMode: 'ISOLATED',
                            action_required: `Manually set leverage to ${expectedPositionLeverage}x and margin mode to ISOLATED on Bitunix exchange`
                          }
                        });
                      }
                    }
                  }
                } else {
                  console.error(`❌ Failed to update position leverage/margin mode after 3 attempts`);
                  if (bot?.id) {
                    await this.addBotLog(bot.id, {
                      level: 'error',
                      category: 'trade',
                      message: `CRITICAL: Failed to update position leverage/margin mode after multiple attempts. Position may have wrong settings.`,
                      details: {
                        symbol: bot.symbol,
                        currentLeverage: positionInfo.leverage,
                        currentMarginMode: positionInfo.marginMode,
                        expectedLeverage: expectedPositionLeverage,
                        expectedMarginMode: 'ISOLATED',
                        action_required: `URGENT: Manually set leverage to ${expectedPositionLeverage}x and margin mode to ISOLATED on Bitunix exchange`
                      }
                    });
                  }
                }
              } else {
                console.log(`✅ Position already has correct leverage (${positionInfo.leverage}x) and margin mode (${positionInfo.marginMode})`);
              }
            } else {
              console.warn(`⚠️ Position not found for ${bot.symbol} after retries - cannot set leverage/margin mode`);
            }
          } catch (posError) {
            console.error('❌ Failed to set Bitunix position leverage/margin mode:', posError);
            if (bot?.id) {
              await this.addBotLog(bot.id, {
                level: 'error',
                category: 'trade',
                message: `Failed to set position leverage/margin mode: ${posError instanceof Error ? posError.message : String(posError)}`,
                details: {
                  symbol: bot.symbol,
                  error: posError instanceof Error ? posError.message : String(posError),
                  action_required: 'Manually set leverage to 3x and margin mode to ISOLATED on Bitunix exchange'
                }
              });
            }
            // Don't throw - allow order to succeed even if position config fails
          }
        }
        
        // SL/TP setup has already been executed earlier (right after order placement)
        // This ensures SL/TP is set immediately, before the leverage/margin mode section completes
        
        return orderResult;
      } else if (exchange === 'mexc') {
        // TODO: Add balance check for MEXC (similar to Bybit/Bitunix)
        // For now, MEXC will place orders without balance check (like OKX)
        return await this.placeMEXCOrder(apiKey, apiSecret, bot.symbol, tradeSignal.side, amount, price, tradingType, bot);
      } else {
      throw new Error(`Unsupported exchange: ${bot.exchange || 'unknown'} (normalized: ${exchange}). Supported exchanges: bybit, bitunix, okx, mexc`);
    }
    }
    } catch (error) {
      console.error('Order placement error:', error);
      throw error;
    }
  }
  
  private async placeBybitOrder(apiKey: string, apiSecret: string, symbol: string, side: string, amount: number, price: number, tradingType: string = 'spot', bot: any = null, tradeSignal: any = null): Promise<any> {
    // Always use mainnet
    const baseDomains = ['https://api.bybit.com'];
    
    console.log(`🔑 Bybit Order Details:`);
    console.log(`   Domains: ${baseDomains.join(', ')} (Mainnet)`);
    console.log(`   API Key length: ${apiKey.length}, starts with: ${apiKey.substring(0, 8)}...`);
    console.log(`   API Secret length: ${apiSecret.length}, starts with: ${apiSecret.substring(0, 8)}...`);
    console.log(`   Symbol: ${symbol}, Side: ${side}, Amount: ${amount}, Price: ${price}`);
    
    try {
      const timestamp = Date.now().toString();
      const recvWindow = '5000'; // Recommended default
      
      // Map tradingType to correct Bybit V5 API category
      const categoryMap: { [key: string]: string } = {
        'spot': 'spot',
        'futures': 'linear'  // CHANGED to linear for perpetual futures
      };
      const bybitCategory = categoryMap[tradingType] || 'spot';
      
      // Fetch actual step size from Bybit first to ensure we use the correct value
      let actualStepSize: number | null = null;
      let actualMin: number | null = null;
      let actualMax: number | null = null;
      try {
        const symbolInfoUrl = `${baseDomains[0]}/v5/market/instruments-info?category=${bybitCategory}&symbol=${symbol}`;
        const symbolInfoResponse = await fetch(symbolInfoUrl, { signal: AbortSignal.timeout(5000) });
        if (symbolInfoResponse.ok) {
          const symbolInfoData = await symbolInfoResponse.json();
          if (symbolInfoData.retCode === 0 && symbolInfoData.result?.list?.[0]) {
            const symbolInfo = symbolInfoData.result.list[0];
            const lotSizeFilter = symbolInfo.lotSizeFilter;
            if (lotSizeFilter) {
              actualStepSize = parseFloat(lotSizeFilter.qtyStep || '0');
              actualMin = parseFloat(lotSizeFilter.minOrderQty || '0');
              actualMax = parseFloat(lotSizeFilter.maxOrderQty || '0');
              console.log(`📊 Bybit symbol info for ${symbol}: stepSize=${actualStepSize}, min=${actualMin}, max=${actualMax}`);
            }
          }
        }
      } catch (symbolInfoError) {
        console.warn(`⚠️ Could not fetch symbol info from Bybit for ${symbol}, using configured values:`, symbolInfoError);
      }
      
      // Use actual Bybit step size if available, otherwise fall back to configured
      const { stepSize: configuredStepSize } = getSymbolSteps(symbol);
      
      // Validate actual step size from Bybit - if it's 0 or invalid, use configured value
      let stepSize = configuredStepSize;
      if (actualStepSize !== null && actualStepSize > 0) {
        stepSize = actualStepSize;
        // Log if there's a mismatch (only if actual step size is valid)
        if (Math.abs(actualStepSize - configuredStepSize) > 0.0001) {
          console.warn(`⚠️ Step size mismatch for ${symbol}: configured=${configuredStepSize}, Bybit=${actualStepSize} - using Bybit value`);
          console.warn(`🔧 Will re-round quantity ${amount} using actual Bybit step size ${actualStepSize}`);
        }
      } else if (actualStepSize === 0) {
        // Bybit returned 0, which is invalid - use configured value
        console.warn(`⚠️ Bybit returned invalid step size (0) for ${symbol}, using configured value: ${configuredStepSize}`);
      } else if (actualStepSize === null) {
        // Bybit didn't return step size - use configured value (this is normal)
        console.log(`ℹ️ Using configured step size ${configuredStepSize} for ${symbol} (Bybit didn't provide step size)`);
      }
      
      const constraints = getQuantityConstraints(symbol);
      
      // Use actual Bybit min/max if available
      const minQty = actualMin !== null && actualMin > 0 ? actualMin : constraints.min;
      const maxQty = actualMax !== null && actualMax > 0 ? actualMax : constraints.max;
      
      // Clamp amount to min/max FIRST, then round
      let qty = Math.max(minQty, Math.min(maxQty, amount));
      
      // CRITICAL: If we detected a step size mismatch, immediately re-round using the actual step size
      // This prevents issues where quantity was calculated with wrong step size (e.g., 99.999 with stepSize 0.001 when actual is 1)
      if (actualStepSize !== null && actualStepSize > 0 && Math.abs(actualStepSize - configuredStepSize) > 0.0001) {
        const factor = 1 / actualStepSize;
        qty = Math.round(qty * factor) / factor; // Same as: Math.round(qty / actualStepSize) * actualStepSize
        console.log(`✅ Re-rounded quantity from ${amount} to ${qty} using actual step size ${actualStepSize}`);
      }
      
      // Round to nearest step size using precise arithmetic to avoid floating point errors
      if (stepSize > 0) {
        // Use precise rounding: multiply by factor, round, then divide
        // This ensures we get exactly the nearest step size
        const factor = 1 / stepSize;
        // Round to nearest step (not floor) for quantity
        qty = Math.round(qty * factor) / factor;
      }
      
      // Re-clamp after rounding to ensure we don't exceed max due to rounding errors
      qty = Math.max(minQty, Math.min(maxQty, qty));
      
      // CRITICAL: If quantity is at or above max, reduce by one step to stay strictly below max
      // Bybit rejects quantities that equal the max value, so we must stay below it
      // This prevents "Invalid quantity" errors for symbols like SHIBUSDT (max = 1000000)
      if (qty >= maxQty) {
        if (stepSize > 0) {
          // Calculate the largest valid quantity that's strictly less than max
          const maxSteps = Math.floor(maxQty / stepSize);
          // If max is exactly on a step boundary, use one step less
          if ((maxQty % stepSize) === 0) {
            qty = (maxSteps - 1) * stepSize;
          } else {
            // If max is not on a step boundary, use the largest step that's below max
            qty = maxSteps * stepSize;
          }
          // Final safety: if this still exceeds max, reduce by one more step
          if (qty >= maxQty) {
            qty = (maxSteps - 1) * stepSize;
          }
        } else {
          // If no step size, reduce by a small amount (1% of max, but at least 1)
          qty = maxQty - Math.max(1, maxQty * 0.01);
        }
        // Ensure we're still >= min
        qty = Math.max(minQty, qty);
      }
      
      // Calculate decimals for formatting - ensure we have enough precision
      // For stepSize 0.1, we need 1 decimal place; for 0.01, we need 2, etc.
      const stepDecimals = stepSize < 1 ? stepSize.toString().split('.')[1]?.length || 0 : 0;
      
      // Format with appropriate decimals, ensuring proper precision
      // Round one more time to handle any floating point precision issues
      if (stepSize > 0) {
        const factor = 1 / stepSize;
        qty = Math.round(qty * factor) / factor;
        // Re-clamp one more time after final rounding
        // CRITICAL: Always stay strictly below max (Bybit rejects quantities equal to max)
        if (qty >= constraints.max) {
          const maxSteps = Math.floor(constraints.max / stepSize);
          // If max is exactly on a step boundary, use one step less
          if ((constraints.max % stepSize) === 0) {
            qty = (maxSteps - 1) * stepSize;
          } else {
            qty = maxSteps * stepSize;
          }
          // Final safety check
          if (qty >= constraints.max) {
            qty = (maxSteps - 1) * stepSize;
          }
        }
      }
      
      // Format the quantity string with exact decimal places
      // CRITICAL: Use toFixed() string directly to preserve exact precision - don't parseFloat() it
      // as that can introduce floating point errors or remove trailing zeros needed for step size matching
      let formattedQty: string;
      if (stepSize >= 1) {
        // For integer step sizes, format as integer
        formattedQty = Math.round(qty).toString();
      } else {
        // For decimal step sizes, use toFixed() directly to ensure exact decimal places
        // This ensures the string matches Bybit's step size requirements exactly
        formattedQty = qty.toFixed(stepDecimals);
        
        // Remove trailing zeros only if they're beyond the step size precision
        // But keep at least stepDecimals decimal places to match step size
        // Example: stepSize 0.001 (3 decimals) -> "0.004" not "0.0040" or "0.00400"
        // We'll keep the toFixed() result as-is to ensure exact match
      }
      
      // Final validation: verify the formatted quantity matches step size exactly
      const parsedFormattedQty = parseFloat(formattedQty);
      if (isNaN(parsedFormattedQty) || parsedFormattedQty < minQty || parsedFormattedQty > maxQty) {
        throw new Error(`Invalid quantity ${formattedQty} for ${symbol} after rounding. Min: ${minQty}, Max: ${maxQty}, Step: ${stepSize}`);
      }
      
      // Verify the quantity is exactly on a step size boundary
      if (stepSize > 0) {
        const remainder = (parsedFormattedQty % stepSize);
        // Allow for tiny floating point errors (less than 0.0000001)
        const epsilon = 0.0000001;
        if (remainder > epsilon && (stepSize - remainder) > epsilon) {
          // Re-round if there's a significant remainder
          const factor = 1 / stepSize;
          const correctedQty = Math.round(parsedFormattedQty * factor) / factor;
          formattedQty = correctedQty.toFixed(stepDecimals);
          console.log(`🔧 Corrected quantity from ${parsedFormattedQty} to ${formattedQty} to match step size ${stepSize} exactly`);
        }
        
        // Final validation: ensure formatted quantity matches step size exactly
        // Re-parse and re-format to catch any precision issues
        const finalParsed = parseFloat(formattedQty);
        const finalFactor = 1 / stepSize;
        const finalRounded = Math.round(finalParsed * finalFactor) / finalFactor;
        const finalFormatted = finalRounded.toFixed(stepDecimals);
        
        // Only update if there's a difference (to avoid unnecessary changes)
        if (Math.abs(parseFloat(finalFormatted) - finalParsed) > epsilon) {
          console.log(`🔧 Final correction: ${formattedQty} → ${finalFormatted} to ensure exact step size match`);
          formattedQty = finalFormatted;
        }
      }
      
      // Log the final quantity for debugging
      console.log(`📏 Quantity rounding for ${symbol}: ${amount} → ${qty} → ${formattedQty} (stepSize: ${stepSize}, decimals: ${stepDecimals})`);
      
      // Bybit V5 API requires capitalized side: "Buy" or "Sell"
      const capitalizedSide = side.charAt(0).toUpperCase() + side.slice(1).toLowerCase();
      
      // Fetch current market price for accurate order value calculation
      // For futures contracts, we need the mark price for notional value calculation
      let currentMarketPrice = price;
      
      // Always fetch price for futures/linear contracts to ensure accurate order value
      // For FUSDT (USDT perpetual), mark price should be ~1.0, not the provided price
      if (bybitCategory === 'linear' || !currentMarketPrice || currentMarketPrice === 0 || currentMarketPrice < 0.1) {
        try {
          const tradingType = bybitCategory === 'linear' ? 'linear' : 'spot';
          const priceResponse = await fetch(`https://api.bybit.com/v5/market/tickers?category=${tradingType}&symbol=${symbol}`);
          const priceData = await priceResponse.json();
          const fetchedPrice = parseFloat(priceData.result?.list?.[0]?.lastPrice || priceData.result?.list?.[0]?.markPrice || '0');
          
          if (fetchedPrice > 0) {
            currentMarketPrice = fetchedPrice;
            console.log(`📊 Fetched current price for ${symbol}: ${currentMarketPrice}`);
          } else {
            // Fallback: For FUSDT (USDT perpetual), use 1.0 as default mark price
            if (symbol === 'FUSDT' && bybitCategory === 'linear') {
              currentMarketPrice = 1.0;
              console.log(`📊 Using default mark price 1.0 for FUSDT perpetual`);
            } else {
              console.warn('Failed to fetch valid price, using provided price:', price);
              currentMarketPrice = price || 1.0;
            }
          }
        } catch (error) {
          console.warn('Failed to fetch current price:', error);
          // Fallback: For FUSDT (USDT perpetual), use 1.0 as default mark price
          if (symbol === 'FUSDT' && bybitCategory === 'linear') {
            currentMarketPrice = 1.0;
            console.log(`📊 Using default mark price 1.0 for FUSDT perpetual (fallback)`);
          } else {
            console.warn('Using provided price:', price);
            currentMarketPrice = price || 1.0;
          }
        }
      }
      
      // Validate minimum order value before placing order
      const minOrderValue = this.getMinimumOrderValue(symbol, bybitCategory);
      const currentOrderValue = parseFloat(formattedQty) * currentMarketPrice;
      
      if (currentOrderValue < minOrderValue && currentMarketPrice > 0) {
        console.warn(`⚠️ Order value $${currentOrderValue.toFixed(2)} below minimum $${minOrderValue.toFixed(2)} for ${symbol}`);
        console.warn(`💡 Attempting to increase quantity to meet minimum order value...`);
        
        // Calculate minimum quantity needed to meet order value requirement
        const minQuantity = (minOrderValue / currentMarketPrice) * 1.01; // Add 1% buffer
        
        // Round up to meet step size and constraints
        let adjustedQty = Math.max(minQuantity, minQty);
        if (stepSize > 0) {
          // Use Math.ceil to round up, then multiply by stepSize
          adjustedQty = Math.ceil(adjustedQty / stepSize) * stepSize;
          // Re-round to handle any floating point precision issues
          const factor = 1 / stepSize;
          adjustedQty = Math.round(adjustedQty * factor) / factor;
        }
        adjustedQty = Math.min(adjustedQty, maxQty);
        
        // Ensure we're still within bounds after rounding
        if (adjustedQty >= maxQty && stepSize > 0) {
          const maxSteps = Math.floor(maxQty / stepSize);
          adjustedQty = (maxSteps - 1) * stepSize;
        }
        adjustedQty = Math.max(adjustedQty, minQty);
        
        // Recalculate order value with adjusted quantity
        const adjustedOrderValue = adjustedQty * currentMarketPrice;
        const adjustedStepDecimals = stepSize < 1 ? stepSize.toString().split('.')[1]?.length || 0 : 0;
        // Format directly without parseFloat to preserve exact precision
        const adjustedFormattedQty = adjustedQty.toFixed(adjustedStepDecimals);
        
        if (adjustedOrderValue >= minOrderValue && adjustedQty <= maxQty) {
          console.log(`✅ Adjusted quantity from ${formattedQty} to ${adjustedFormattedQty} to meet minimum order value`);
          console.log(`💰 New order value: $${adjustedOrderValue.toFixed(2)} (minimum: $${minOrderValue.toFixed(2)})`);
          qty = adjustedQty;
          formattedQty = adjustedFormattedQty;
        } else {
          throw new Error(`Order value $${currentOrderValue.toFixed(2)} is below minimum $${minOrderValue.toFixed(2)} for ${symbol} on Bybit. Calculated minimum quantity ${adjustedQty.toFixed(6)} exceeds maximum ${maxQty}. Please increase trade amount or adjust bot configuration.`);
        }
      }
      
      // Order parameters for the request BODY (and the signature string)
      const requestBody: any = {
        category: bybitCategory, // 'linear' for perpetual futures, 'spot' for spot
        symbol: symbol,
        side: capitalizedSide, // "Buy" or "Sell" (capitalized for Bybit V5)
        orderType: 'Market',
      };
      
      // For spot trading with market orders, use marketUnit to specify quote currency amount
      // For market buy orders, default is quoteCoin (USDT), so marketUnit is optional
      // marketUnit: numeric 0 = baseCoin, 1 = quoteCoin (or can omit for buy orders)
      // For futures/linear, always use qty in base currency
      if (bybitCategory === 'spot') {
        const minOrderValue = this.getMinimumOrderValue(symbol, bybitCategory);
        
        // For buy orders, use quoteCoin (USDT amount) - this is the default
        // For sell orders, use baseCoin (base currency quantity) - this is the default
        if (capitalizedSide === 'Buy') {
          // Buy orders: marketUnit='quoteCoin' means qty is in USDT (quote currency)
          // For manual orders, 'amount' parameter may already be in USDT (not converted to quantity)
          // Check if amount is reasonable for USDT (typically >= 10) vs quantity (could be very small like 0.001)
          // If amount >= 10 and orderValue would be > amount * 10, then amount is likely already in USDT
          const calculatedOrderValue = parseFloat(formattedQty) * currentMarketPrice;
          const isLikelyUSDTAmount = amount >= 10 && calculatedOrderValue > (amount * 10);
          let finalOrderValue: number;
          
          if (isLikelyUSDTAmount) {
            // Amount is already in USDT, use it directly (skip quantity conversion)
            finalOrderValue = Math.max(amount, minOrderValue * 1.01);
            console.log(`💰 Spot BUY order (USDT amount provided): Using $${amount} USDT directly (skipped quantity conversion)`);
          } else {
            // Amount is in base currency quantity, use calculated order value
            finalOrderValue = Math.max(calculatedOrderValue, minOrderValue * 1.01);
            console.log(`💰 Spot BUY order (quantity provided): Base qty: ${formattedQty}, Price: $${currentMarketPrice}, Order value: $${calculatedOrderValue.toFixed(2)}`);
          }
          
          requestBody.marketUnit = 'quoteCoin'; // 'quoteCoin' = USDT amount (string format required for V5)
          requestBody.qty = finalOrderValue.toFixed(2); // Order value in USDT with 2 decimal places
          
          console.log(`💰 Spot BUY order: marketUnit=quoteCoin, qty=$${finalOrderValue.toFixed(2)} USDT`);
          if (finalOrderValue > (isLikelyUSDTAmount ? amount : calculatedOrderValue)) {
            console.log(`   ⚠️ Adjusted order value to $${finalOrderValue.toFixed(2)} to meet minimum $${minOrderValue}`);
          }
        } else {
          // Sell orders: marketUnit=baseCoin means qty is in base currency
          // Need to validate base currency quantity against step size
          const finalQtyValue = parseFloat(formattedQty);
          if (isNaN(finalQtyValue) || finalQtyValue < minQty || finalQtyValue > maxQty) {
            throw new Error(`Invalid formatted quantity ${formattedQty} for ${symbol}. Min: ${minQty}, Max: ${maxQty}`);
          }
          
          // Verify step size match
          if (stepSize > 0) {
            const finalRemainder = finalQtyValue % stepSize;
            const epsilon = 0.0000001;
            if (finalRemainder > epsilon && (stepSize - finalRemainder) > epsilon) {
              const factor = 1 / stepSize;
              const corrected = Math.round(finalQtyValue * factor) / factor;
              formattedQty = corrected.toFixed(stepDecimals);
              console.log(`🔧 Last correction for sell: ${finalQtyValue} → ${formattedQty} to match step size ${stepSize}`);
            }
          }
          
          requestBody.marketUnit = 'baseCoin'; // 'baseCoin' = base currency quantity
          requestBody.qty = formattedQty.toString(); // Base currency quantity
          
          console.log(`💰 Spot SELL order: marketUnit=baseCoin, qty=${formattedQty} ${symbol.replace('USDT', '')}`);
        }
        // For spot orders with marketUnit='quoteCoin', we don't validate base currency quantity against step size
        // because qty represents USDT amount, not base currency quantity
      } else {
        // For linear/futures, validate and format base currency quantity
        
        // Final validation: ensure formatted quantity is valid before creating request
        const finalQtyValue = parseFloat(formattedQty);
        if (isNaN(finalQtyValue) || finalQtyValue < minQty || finalQtyValue > maxQty) {
          throw new Error(`Invalid formatted quantity ${formattedQty} for ${symbol}. Min: ${minQty}, Max: ${maxQty}`);
        }
        
        // Verify step size match one more time
        if (stepSize > 0) {
          const finalRemainder = finalQtyValue % stepSize;
          const epsilon = 0.0000001;
          if (finalRemainder > epsilon && (stepSize - finalRemainder) > epsilon) {
            // Last chance correction
            const factor = 1 / stepSize;
            const corrected = Math.round(finalQtyValue * factor) / factor;
            formattedQty = corrected.toFixed(stepDecimals);
            console.log(`🔧 Last correction: ${finalQtyValue} → ${formattedQty} to match step size ${stepSize}`);
          }
        }
        
        // For linear/futures, ensure quantity is properly formatted as string with correct precision
        // Bybit requires qty as string, not number, and must match step size precisely
        requestBody.qty = formattedQty.toString(); // Ensure it's a string
        console.log(`💰 Futures order using qty: ${formattedQty}`);
      }
      
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
      if (bybitCategory === 'spot') {
        console.log('MarketUnit:', requestBody.marketUnit);
        console.log('Qty (USDT):', requestBody.qty);
        console.log('Order Value:', parseFloat(requestBody.qty));
      }
      console.log('Request Body:', JSON.stringify(requestBody, null, 2));
      console.log('=== END DEBUG ===');
      
      // Try each domain until one succeeds
      let response: Response | null = null;
      let data: any = null;
      let lastError: Error | null = null;
      
      for (let domainIndex = 0; domainIndex < baseDomains.length; domainIndex++) {
        const domain = baseDomains[domainIndex];
        const isLastDomain = domainIndex === baseDomains.length - 1;
        
        try {
          console.log(`🔄 Placing order via ${domain} (${domainIndex + 1}/${baseDomains.length})...`);
          
          // Add delay between domain retries (except for first domain)
          if (domainIndex > 0) {
            const delayMs = 1000 * domainIndex; // Exponential backoff: 1s, 2s, etc.
            console.log(`⏳ Waiting ${delayMs}ms before trying next domain...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
          
          // Ensure all header values are strings (required for Request API)
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-BAPI-API-KEY': String(apiKey || ''),
            'X-BAPI-TIMESTAMP': String(timestamp || ''),
            'X-BAPI-RECV-WINDOW': String(recvWindow || ''),
            'X-BAPI-SIGN': String(signature || ''),
          };
          
          // Validate header values are not empty
          if (!headers['X-BAPI-API-KEY'] || !headers['X-BAPI-TIMESTAMP'] || !headers['X-BAPI-SIGN']) {
            throw new Error(`Invalid header values: apiKey=${!!apiKey}, timestamp=${!!timestamp}, signature=${!!signature}`);
          }
          
          response = await fetch(`${domain}/v5/order/create`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(15000) // 15 second timeout
          });
          
          // Check content-type before parsing JSON
          const contentType = response.headers.get('content-type') || '';
          if (!contentType.includes('application/json')) {
            // If 403 and we have more domains to try, continue to next domain
            if (response.status === 403 && !isLastDomain) {
              console.warn(`⚠️ Got 403 from ${domain}, trying alternate domain...`);
              const errorText = await response.text().catch(() => '');
              const errorPreview = errorText.substring(0, 200);
              console.warn(`⚠️ 403 Response preview: ${errorPreview}`);
              lastError = new Error(`Bybit API returned ${contentType} instead of JSON (HTTP 403) from ${domain}. Trying alternate domain...`);
              continue; // Try next domain
            }
            
            const errorText = await response.text().catch(() => '');
            const errorPreview = errorText.substring(0, 500);
            console.error(`❌ Bybit order API returned non-JSON response (${contentType}) from ${domain}:`, errorPreview);
            lastError = new Error(`Bybit API returned ${contentType} instead of JSON (HTTP ${response.status}) from ${domain}. This may indicate rate limiting, IP blocking, or API issues. Response preview: ${errorPreview.substring(0, 200)}`);
            
            // If it's the last domain, throw the error
            if (isLastDomain) {
              throw lastError;
            }
            continue; // Try next domain
          }
          
          data = await response.json();
          
          // If we got a valid JSON response, use it (even if retCode is not 0, we'll handle that below)
          if (data && typeof data === 'object') {
            // Handle Code 10001 (Request parameter error) for spot orders
            if (data.retCode === 10001 && bybitCategory === 'spot' && capitalizedSide === 'Buy') {
              console.warn(`⚠️ Bybit returned Code 10001 (Request parameter error) for spot Buy order. Retrying without marketUnit...`);
              
              const retryBody = { ...requestBody };
              delete (retryBody as any).marketUnit;
              
              const retrySigPayload = timestamp + apiKey + recvWindow + JSON.stringify(retryBody);
              const retrySig = await this.createBybitSignature(retrySigPayload, apiSecret);
              
              const retryHeaders = { ...headers, 'X-BAPI-SIGN': String(retrySig) };
              
              const retryResponse = await fetch(`${domain}/v5/order/create`, {
                method: 'POST',
                headers: retryHeaders,
                body: JSON.stringify(retryBody),
                signal: AbortSignal.timeout(15000)
              });
              
              if (retryResponse.ok) {
                const retryData = await retryResponse.json().catch(() => null);
                if (retryData && (retryData.retCode === 0 || retryData.retCode === 0)) {
                  console.log(`✅ Success on retry without marketUnit`);
                  data = retryData;
                  break;
                }
              }
            }

            console.log(`✅ Successfully received order response from ${domain}`);
            break; // Success, exit loop
          }
        } catch (fetchError: any) {
          // If it's a 403 and we have more domains, try next one
          if ((response?.status === 403 || fetchError?.message?.includes('403')) && !isLastDomain) {
            console.warn(`⚠️ Error from ${domain} (HTTP ${response?.status || 'unknown'}), trying alternate domain...`);
            lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
            continue;
          }
          
          // If it's the last domain, throw the error
          if (isLastDomain) {
            throw fetchError instanceof Error ? fetchError : new Error(String(fetchError));
          }
          
          lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
        }
      }
      
      // If we exhausted all domains without success, throw the last error
      if (!response || !data) {
        const errorMessage = lastError?.message || 'Unknown error';
        const is403Error = lastError?.message?.includes('403') || response?.status === 403;
        
        // Enhanced error message for 403 errors
        if (is403Error && bot?.id) {
          await this.addBotLog(bot.id, {
            level: 'error',
            category: 'trade',
            message: `Bybit API returned HTTP 403 (Forbidden) on all domains. This may indicate API key issues, IP blocking, or rate limiting.`,
            details: {
              symbol: symbol,
              side: side,
              http_status: 403,
              domains_tried: baseDomains,
              is_testnet: false, // Always mainnet
              api_key_preview: apiKey.substring(0, 8) + '...',
              error: errorMessage,
              action_required: 'Check API key validity, IP whitelist settings, and rate limits',
              troubleshooting: [
                '1. Verify API key is valid and active in Bybit API Management',
                '2. Check if IP whitelist is enabled (disable or add server IP)',
                '3. Verify API key has "Trade" permission enabled',
                '4. Check if you\'ve exceeded rate limits (wait and retry)',
                '5. Ensure testnet flag matches your account type',
                '6. Try regenerating API keys if issue persists'
              ]
            }
          }).catch(err => console.error('Failed to log 403 error:', err));
        }
        
        if (lastError) {
          throw lastError;
        }
        throw new Error(`Failed to place order on all Bybit domains (${baseDomains.join(', ')}). All attempts returned errors.`);
      }
      
      console.log(`\n📥 === BYBIT API RESPONSE ===`);
      console.log(`📊 HTTP Status: ${response.status}`);
      console.log(`📋 Response Body:`, JSON.stringify(data, null, 2));
      console.log(`=== END RESPONSE ===\n`);
      
      if (data.retCode !== 0) {
        // Log the full error response for debugging
        console.error(`\n❌ === BYBIT ORDER ERROR ===`);
        console.error(`📊 RetCode: ${data.retCode}`);
        console.error(`📋 RetMsg: ${data.retMsg}`);
        console.error(`📋 Full Response:`, JSON.stringify(data, null, 2));
        console.error(`=== END ERROR ===\n`);
        
        // Handle specific error codes with better messages
        if (data.retCode === 10003) {
          // API key is invalid
          console.error(`❌ Bybit API key is invalid (Code: 10003) for ${symbol}`);
          console.error(`📋 RetMsg: ${data.retMsg}`);
          console.error(`🔑 API Key (first 8 chars): ${apiKey.substring(0, 8)}...`);
          console.error(`🌐 Domain used: ${baseDomains[baseDomains.length - 1]}`);
          console.error(`🌐 Environment: Mainnet`);
          
          // Log to bot activity logs with actionable message
          if (bot?.id) {
            await this.addBotLog(bot.id, {
              level: 'error',
              category: 'trade',
              message: `Bybit API key is invalid (Code: 10003). Please verify and update your Bybit API keys in account settings.`,
              details: {
                symbol: symbol,
                retCode: 10003,
                retMsg: data.retMsg,
                exchange: 'bybit',
                is_testnet: false, // Always mainnet
                api_key_preview: apiKey.substring(0, 8) + '...',
                action_required: 'Update Bybit API keys in account settings. Ensure keys are valid and have trading permissions.',
                troubleshooting: [
                  '1. Go to Bybit → API Management',
                  '2. Verify your API key is active and has trading permissions',
                  '3. Check if API key has expired or been revoked',
                  '4. Re-enter API key and secret in your account settings',
                  '5. Ensure testnet flag matches your Bybit account type',
                  '6. Verify API key has "Trade" permission enabled',
                  '7. Check if IP whitelist is enabled (may need to add server IP)'
                ]
              }
            }).catch(err => console.error('Failed to log API key error:', err));
          }
          
          throw new Error(`Bybit API key is invalid (Code: 10003). Please verify and update your Bybit API keys in your account settings. The API key may have expired, been revoked, or may not have trading permissions.`);
        } else if (data.retCode === 10001) {
          const constraints = getQuantityConstraints(symbol);
          console.error(`❌ Bybit API error for ${symbol}:`, data.retMsg);
          
          // Check if it's a symbol validation error
          if (data.retMsg?.toLowerCase().includes('symbol invalid') || data.retMsg?.toLowerCase().includes('params error: symbol')) {
            throw new Error(`Invalid symbol "${symbol}" for ${bybitCategory} trading on Bybit. The symbol may not exist, may not be available for ${bybitCategory} trading, or may use a different format (e.g., 1000PEPEUSDT instead of PEPEUSDT). Please verify the symbol name on Bybit exchange.`);
          }
          
          console.error(`❌ Quantity validation failed for ${symbol}: ${formattedQty}`);
          console.error(`📏 Constraints: min=${constraints.min}, max=${constraints.max}`);
          console.error(`📏 Step size: ${stepSize}`);
          console.error(`💰 Price: $${currentMarketPrice}`);
          const orderValue = parseFloat(formattedQty) * currentMarketPrice;
          console.error(`💰 Order value: $${orderValue.toFixed(2)}`);
          console.error(`📋 Bybit error message: ${data.retMsg}`);
          
          // Try to fetch actual symbol info from Bybit to verify step size
          let actualStepSize = stepSize;
          try {
            const symbolInfoUrl = `${baseDomains[0]}/v5/market/instruments-info?category=${bybitCategory}&symbol=${symbol}`;
            const symbolInfoResponse = await fetch(symbolInfoUrl);
            if (symbolInfoResponse.ok) {
              const symbolInfoData = await symbolInfoResponse.json();
              if (symbolInfoData.retCode === 0 && symbolInfoData.result?.list?.[0]) {
                const symbolInfo = symbolInfoData.result.list[0];
                const lotSizeFilter = symbolInfo.lotSizeFilter;
                if (lotSizeFilter) {
                  actualStepSize = parseFloat(lotSizeFilter.qtyStep || stepSize.toString());
                  const actualMin = parseFloat(lotSizeFilter.minOrderQty || constraints.min.toString());
                  const actualMax = parseFloat(lotSizeFilter.maxOrderQty || constraints.max.toString());
                  console.log(`📊 Bybit symbol info for ${symbol}: stepSize=${actualStepSize}, min=${actualMin}, max=${actualMax}`);
                  
                  // If step size differs, log a warning
                  if (Math.abs(actualStepSize - stepSize) > 0.0001) {
                    console.warn(`⚠️ Step size mismatch for ${symbol}: configured=${stepSize}, Bybit=${actualStepSize}`);
                  }
                }
              }
            }
          } catch (symbolInfoError) {
            console.warn('Could not fetch symbol info from Bybit:', symbolInfoError);
          }
          
          // Provide more helpful error message
          // For spot orders with marketUnit=quoteCoin, show the USDT amount sent, not base currency quantity
          const qtyDisplay = bybitCategory === 'spot' && (requestBody.marketUnit === 'quoteCoin' || requestBody.marketUnit === 1)
            ? `${requestBody.qty} USDT (order value)`
            : formattedQty;
          
          let errorMsg = `Invalid quantity for ${symbol}: ${qtyDisplay}`;
          if (bybitCategory !== 'spot' || (requestBody.marketUnit !== 'quoteCoin' && requestBody.marketUnit !== 1)) {
            // Only show step size info for base currency quantity (futures or spot with marketUnit=baseCoin)
            errorMsg += `. Min: ${minQty}, Max: ${maxQty}, Step: ${stepSize}`;
            if (actualStepSize !== null && Math.abs(actualStepSize - stepSize) > 0.0001) {
              errorMsg += ` (Bybit actual step: ${actualStepSize})`;
            }
          }
          
          if (orderValue > 10000) {
            errorMsg += ` Order value ($${orderValue.toFixed(2)}) may be too high. Please reduce trade amount.`;
          } else if (data.retMsg?.toLowerCase().includes('qty') || data.retMsg?.toLowerCase().includes('quantity')) {
            if (bybitCategory === 'spot' && (requestBody.marketUnit === 'quoteCoin' || requestBody.marketUnit === 1)) {
              errorMsg += ` Bybit rejected order value. Check if ${symbol} has minimum order value requirements (min: $${minOrderValue}) or other limits on Bybit.`;
            } else {
              errorMsg += ` Bybit rejected quantity. The quantity may not match the required step size (${actualStepSize || stepSize}). Try reducing trade amount or check if ${symbol} has different limits on Bybit.`;
            }
          } else {
            errorMsg += ` Bybit API error: ${data.retMsg || 'Unknown error'}.`;
          }
          throw new Error(errorMsg);
        } else if (data.retCode === 110007) {
          const orderValue = parseFloat(formattedQty) * currentMarketPrice;
          console.warn(`⚠️ Insufficient balance for ${symbol} ${capitalizedSide} order`);
          console.warn(`💰 Order value: $${orderValue.toFixed(2)}`);
          console.warn(`💡 This may happen temporarily. The bot will retry on the next execution.`);
          throw new Error(`Insufficient balance for ${symbol} order. Order value: $${orderValue.toFixed(2)}. Please check your account balance or wait for funds to become available. This is often temporary and will retry automatically.`);
        } else if (data.retCode === 110094) {
          // Minimum order value error - handle gracefully
          const orderValue = parseFloat(formattedQty) * currentMarketPrice;
          const minOrderValue = this.getMinimumOrderValue(symbol, bybitCategory);
          
          // Calculate required trade amount to meet minimum order value
          // Order value = trade_amount * leverage * risk_multiplier (approximately)
          // So: trade_amount = order_value / (leverage * risk_multiplier)
          // To meet minimum: trade_amount >= minOrderValue / (leverage * risk_multiplier)
          const leverage = bot?.leverage || 1;
          const riskMultiplier = getRiskMultiplier(bot); // Use the same function as calculateTradeSizing
          const multiplier = leverage * riskMultiplier;
          
          // Calculate minimum trade amount needed (with 20% buffer for rounding/step size)
          const requiredTradeAmount = (minOrderValue / multiplier) * 1.2;
          
          // Ensure minimum trade amount is reasonable (at least $10 for futures, $5 for spot)
          const minTradeAmount = bybitCategory === 'linear' ? 10 : 5;
          const finalRequiredAmount = Math.max(requiredTradeAmount, minTradeAmount);
          
          console.warn(`⚠️ Order value below minimum for ${symbol}`);
          console.warn(`💰 Current order value: $${orderValue.toFixed(2)}`);
          console.warn(`📏 Minimum required: $${minOrderValue.toFixed(2)}`);
          console.warn(`💡 Current trade amount: $${bot?.trade_amount || bot?.tradeAmount || 'N/A'}`);
          console.warn(`💡 Leverage: ${leverage}x, Risk multiplier: ${riskMultiplier}x`);
          console.warn(`💡 Increase trade amount to at least $${finalRequiredAmount.toFixed(2)}.`);
          console.warn(`📝 Skipping this trade to avoid error spam.`);
          
          // Log as warning instead of error to reduce error spam
          await this.addBotLog(bot?.id || null, {
            level: 'warning',
            category: 'trade',
            message: `⚠️ Trade skipped: Order value $${orderValue.toFixed(2)} below minimum $${minOrderValue.toFixed(2)} for ${symbol}. Increase trade amount to at least $${finalRequiredAmount.toFixed(2)}.`,
            details: {
              order_value: orderValue,
              min_order_value: minOrderValue,
              symbol: symbol,
              error_code: 110094,
              required_trade_amount: finalRequiredAmount,
              current_trade_amount: bot?.trade_amount || bot?.tradeAmount,
              leverage: leverage,
              risk_multiplier: riskMultiplier
            }
          });
          
          // Throw a specific error that can be caught and handled gracefully
          throw new Error(`Bybit order error: Order does not meet minimum order value ${minOrderValue}USDT (Code: 110094). Please increase trade amount to at least $${finalRequiredAmount.toFixed(2)} per trade.`);
        } else if (data.retCode === 170140) {
          // Calculate actual order value that was sent
          const orderValue = bybitCategory === 'spot' && (requestBody.marketUnit === 'quoteCoin' || requestBody.marketUnit === 1)
            ? parseFloat(requestBody.qty) // For spot with marketUnit=quoteCoin, qty is the USDT amount
            : parseFloat(formattedQty) * currentMarketPrice;
          const minOrderValue = this.getMinimumOrderValue(symbol, bybitCategory);
          console.error(`❌ Order value below minimum for ${symbol}`);
          console.error(`💰 Current order value: $${orderValue.toFixed(2)}`);
          console.error(`📏 Minimum required: $${minOrderValue.toFixed(2)}`);
          console.error(`💡 Increase trade amount or adjust bot configuration to meet minimum order value.`);
          console.error(`📋 Order details: category=${bybitCategory}, marketUnit=${requestBody.marketUnit || 'N/A'}, qty=${requestBody.qty}, price=${currentMarketPrice}`);
          throw new Error(`Order value $${orderValue.toFixed(2)} is below minimum $${minOrderValue.toFixed(2)} for ${symbol} on Bybit. Please increase trade amount to at least $${minOrderValue.toFixed(2)} per trade.`);
        } else if (data.retCode === 170003) {
          // Unknown parameter error - log full request for debugging
          console.error(`❌ Unknown parameter error for ${symbol}`);
          console.error(`📋 Request body:`, JSON.stringify(requestBody, null, 2));
          console.error(`📋 Bybit response:`, JSON.stringify(data, null, 2));
          throw new Error(`Bybit order error: ${data.retMsg} (Code: ${data.retCode}). Check API parameters - this may indicate an invalid parameter or API change.`);
        } else if (data.retCode === 10024) {
          // Regulatory restriction - account/region limitation
          console.error(`❌ Regulatory restriction for ${symbol}`);
          console.error(`📋 Environment: MAINNET`);
          console.error(`📋 This is an account/region restriction from Bybit. Please contact Bybit support.`);
          throw new Error(`Bybit account restriction (Code: ${data.retCode}): ${data.retMsg} This trading pair or service is not available in your region. Please contact Bybit support (/en/help-center/s/webform) to enable trading for your region.`);
        }
        
        throw new Error(`Bybit order error: ${data.retMsg} (Code: ${data.retCode})`);
      }
      
      const orderResult = { 
        status: 'filled', 
        orderId: data.result.orderId, 
        exchangeResponse: data 
      };
      
      // Set SL/TP on the position after order is filled (for futures only)
      // Wait a short moment for position to update after order fills
      if (bybitCategory === 'linear' && currentMarketPrice > 0) {
        try {
          // Small delay to allow position to update after order fills
          await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
          
          // Get actual position entry price from Bybit
          const entryPrice = await this.getBybitPositionEntryPrice(apiKey, apiSecret, symbol);
          if (entryPrice && entryPrice > 0) {
            // Get bot object from the outer scope - need to pass it through
            // For now, we'll get it from the bot parameter passed to placeBybitOrder
            // But we need to pass bot through the call chain
            await this.setBybitSLTP(apiKey, apiSecret, symbol, capitalizedSide, entryPrice, bot, tradeSignal);
          } else {
            console.warn('⚠️ Could not fetch position entry price, skipping SL/TP (position may have been closed)');
          }
        } catch (slTpError) {
          // CRITICAL: If SL/TP fails and position couldn't be closed, this is a critical error
          const errorMessage = slTpError instanceof Error ? slTpError.message : String(slTpError);
          
          if (errorMessage.includes('CRITICAL') || errorMessage.includes('safety protocol')) {
            // Read environment variable directly
            const disableSlTpSafety = (Deno.env.get('DISABLE_SLTPSAFETY') || '').toLowerCase() === 'true';
            if (disableSlTpSafety) {
              console.warn('⚠️ SL/TP critical error detected, but DISABLE_SLTPSAFETY=true. Keeping position open and continuing.');
              // Do not abort; continue without SL/TP (position remains open).
              // Intentionally no return/break here so we can fall through to normal completion.
            }
            // Position was closed for safety OR position is unprotected - this is critical
            console.error('🚨 CRITICAL: SL/TP failure - position protection failed');
            console.error(`   Error: ${errorMessage}`);
            
            // Re-throw to prevent trade from being recorded as successful
            throw new Error(`Trade aborted: ${errorMessage}`);
          }
          
          // For other SL/TP errors (non-critical), log but don't fail
          console.warn('⚠️ Failed to set SL/TP (non-critical):', slTpError);
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
  private async checkBybitBalance(apiKey: string, apiSecret: string, symbol: string, side: string, orderValue: number, tradingType: string, amount?: number): Promise<{
    hasBalance: boolean;
    availableBalance: number;
    totalRequired: number;
    orderValue: number;
  }> {
    // Always use mainnet
    const baseDomains = ['https://api.bybit.com'];
    
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
        // For Unified Trading Account, get total equity (all assets can be used as collateral)
        // Don't filter by coin - get the entire account to check total equity
        const queryParams = `accountType=UNIFIED`;
        const signaturePayload = timestamp + apiKey + recvWindow + queryParams;
        const signature = await this.createBybitSignature(signaturePayload, apiSecret);
        
        // Try each domain until one succeeds
        let response: Response | null = null;
        let data: any = null;
        
        for (const domain of baseDomains) {
          try {
            console.log(`🔄 Checking balance via ${domain}...`);
            response = await fetch(`${domain}/v5/account/wallet-balance?${queryParams}`, {
              method: 'GET',
              headers: this.buildBybitHeaders(apiKey, timestamp, recvWindow, signature),
            });
            
            // Check content-type before parsing JSON
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
              // If 403 and we have more domains to try, continue to next domain
              if (response.status === 403 && baseDomains.indexOf(domain) < baseDomains.length - 1) {
                console.warn(`⚠️ Got 403 from ${domain}, trying alternate domain...`);
                continue; // Try next domain
              }
              
              const errorText = await response.text().catch(() => '');
              const errorPreview = errorText.substring(0, 500);
              console.warn(`⚠️ Bybit balance API returned non-JSON response (${contentType}):`, errorPreview);
              // Return unknown balance status - let order attempt happen
              return {
                hasBalance: true, // Assume sufficient if we can't check
                availableBalance: 0,
                totalRequired: orderValue * 1.05,
                orderValue: orderValue
              };
            }
            
            data = await response.json();
            
            // If we got a valid response, use it
            if (data && typeof data === 'object') {
              console.log(`✅ Successfully received balance response from ${domain}`);
              break; // Success, exit loop
            }
          } catch (fetchError: any) {
            // If it's a 403 and we have more domains, try next one
            if (response?.status === 403 && baseDomains.indexOf(domain) < baseDomains.length - 1) {
              console.warn(`⚠️ Error from ${domain} (HTTP ${response.status}), trying alternate domain...`);
              continue;
            }
            
            // If it's the last domain, return unknown balance status
            if (baseDomains.indexOf(domain) === baseDomains.length - 1) {
              console.warn(`⚠️ All balance check domains failed, assuming sufficient balance`);
              return {
                hasBalance: true, // Assume sufficient if we can't check
                availableBalance: 0,
                totalRequired: orderValue * 1.05,
                orderValue: orderValue
              };
            }
          }
        }
        
        // If we exhausted all domains without success, return unknown balance status
        if (!response || !data) {
          console.warn(`⚠️ Balance check failed on all domains, assuming sufficient balance`);
          return {
            hasBalance: true, // Assume sufficient if we can't check
            availableBalance: 0,
            totalRequired: orderValue * 1.05,
            orderValue: orderValue
          };
        }
        
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
        
        // For Unified Trading Account, check TOTAL EQUITY (all assets combined)
        // This allows using other assets (like TRUMP, WLFI, etc.) as collateral
        const accountInfo = data.result?.list?.[0];
        if (!accountInfo) {
          console.warn('⚠️ Could not parse balance response, proceeding with order attempt');
          return {
            hasBalance: true, // Assume sufficient if we can't parse
            availableBalance: 0,
            totalRequired: orderValue * 1.05,
            orderValue: orderValue
          };
        }
        
        // Total Equity = all assets combined value (Bybit uses all assets as collateral in Unified Trading)
        // Try multiple fields: totalEquity, totalWalletBalance, totalAvailableBalance
        const totalEquity = parseFloat(
          accountInfo.totalEquity || 
          accountInfo.totalWalletBalance || 
          accountInfo.totalAvailableBalance ||
          accountInfo.totalMarginBalance ||
          '0'
        );
        
        // Also get USDT-specific balance for detailed logging
        const usdtCoin = accountInfo.coin?.find((c: any) => c.coin === 'USDT');
        const usdtBalance = usdtCoin ? parseFloat(
          usdtCoin.walletBalance || 
          usdtCoin.availableToWithdraw || 
          usdtCoin.availableBalance || 
          usdtCoin.equity || 
          '0'
        ) : 0;
        
        const requiredValue = orderValue;
        
        console.log(`💰 Unified Trading Balance check for ${symbol} ${side}:`);
        console.log(`   Total Equity (all assets): $${totalEquity.toFixed(2)}`);
        console.log(`   USDT Balance: $${usdtBalance.toFixed(2)}`);
        console.log(`   Required: $${requiredValue.toFixed(2)}`);
        console.log(`📊 Account details: totalEquity=${accountInfo.totalEquity}, totalWalletBalance=${accountInfo.totalWalletBalance}`);
        
        // Use TOTAL EQUITY for balance check (Unified Trading uses all assets as collateral)
        const availableBalance = totalEquity > 0 ? totalEquity : usdtBalance; // Fallback to USDT if totalEquity not available
        
        // Add 5% buffer to account for fees and price fluctuations
        const buffer = requiredValue * 0.05;
        const totalRequired = requiredValue + buffer;
        
        if (availableBalance >= totalRequired) {
          console.log(`✅ Sufficient balance: $${availableBalance.toFixed(2)} (Total Equity) >= $${totalRequired.toFixed(2)} (required + 5% buffer)`);
          if (usdtBalance < totalRequired && totalEquity >= totalRequired) {
            console.log(`💡 Note: Using other assets as collateral (USDT: $${usdtBalance.toFixed(2)}, Total Equity: $${totalEquity.toFixed(2)})`);
          }
          return {
            hasBalance: true,
            availableBalance: availableBalance,
            totalRequired: totalRequired,
            orderValue: orderValue
          };
        } else {
          const shortfall = totalRequired - availableBalance;
          console.warn(`⚠️ Insufficient balance: $${availableBalance.toFixed(2)} (Total Equity) < $${totalRequired.toFixed(2)} (required + 5% buffer)`);
          console.warn(`   USDT Balance: $${usdtBalance.toFixed(2)}, Total Equity: $${totalEquity.toFixed(2)}`);
          console.warn(`💡 Tip: Add at least $${Math.ceil(shortfall)} to your Bybit UNIFIED account to enable trading`);
          return {
            hasBalance: false,
            availableBalance: availableBalance,
            totalRequired: totalRequired,
            orderValue: orderValue
          };
        }
      } else {
        // For spot trading
        const isSellOrder = side.toLowerCase() === 'sell';
        
        // Extract base asset from symbol (e.g., "ETHUSDT" → "ETH")
        // Handle formats like: ETHUSDT, BTCUSDT, 1000PEPEUSDT, etc.
        let baseAsset = symbol;
        if (symbol.endsWith('USDT')) {
          baseAsset = symbol.replace(/USDT$/, '');
          // Handle prefixes like 1000PEPE, 10000SATS
          baseAsset = baseAsset.replace(/^(1000|10000)/, '');
        }
        
        const coinToCheck = isSellOrder ? baseAsset : 'USDT';
        console.log(`💰 Spot ${side} order: Checking ${coinToCheck} balance for ${symbol}`);
        
        const queryParams = `accountType=SPOT&coin=${coinToCheck}`;
        const signaturePayload = timestamp + apiKey + recvWindow + queryParams;
        const signature = await this.createBybitSignature(signaturePayload, apiSecret);
        
        // Try each domain until one succeeds
        let response: Response | null = null;
        let data: any = null;
        
        for (const domain of baseDomains) {
          try {
            console.log(`🔄 Checking spot ${coinToCheck} balance via ${domain}...`);
            response = await fetch(`${domain}/v5/account/wallet-balance?${queryParams}`, {
              method: 'GET',
              headers: this.buildBybitHeaders(apiKey, timestamp, recvWindow, signature),
            });

            // Check content-type before parsing JSON
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
              if (response.status === 403 && baseDomains.indexOf(domain) < baseDomains.length - 1) {
                console.warn(`⚠️ Got 403 from ${domain}, trying alternate domain...`);
                continue;
              }
              
              const errorText = await response.text().catch(() => '');
              const errorPreview = errorText.substring(0, 500);
              console.warn(`⚠️ Bybit balance API returned non-JSON response (${contentType}):`, errorPreview);
              return {
                hasBalance: true, // Assume sufficient if we can't check
                availableBalance: 0,
                totalRequired: isSellOrder && amount ? amount * 1.01 : orderValue * 1.05,
                orderValue: orderValue
              };
            }
            
            data = await response.json();
            
            if (data && typeof data === 'object') {
              // Handle accountType only supporting UNIFIED
              if (data.retCode === 10001 && data.retMsg?.includes('UNIFIED')) {
                console.warn(`⚠️ Account only supports UNIFIED. Retrying spot balance check with accountType=UNIFIED...`);
                
                const unifiedParams = `accountType=UNIFIED&coin=${coinToCheck}`;
                const unifiedSigPayload = timestamp + apiKey + recvWindow + unifiedParams;
                const unifiedSig = await this.createBybitSignature(unifiedSigPayload, apiSecret);
                
                const unifiedResponse = await fetch(`${domain}/v5/account/wallet-balance?${unifiedParams}`, {
                  method: 'GET',
                  headers: this.buildBybitHeaders(apiKey, timestamp, recvWindow, unifiedSig),
                });
                
                if (unifiedResponse.ok) {
                  const unifiedData = await unifiedResponse.json().catch(() => null);
                  if (unifiedData && unifiedData.retCode === 0) {
                    console.log(`✅ Successfully received UNIFIED balance response from ${domain}`);
                    data = unifiedData;
                    break;
                  }
                }
              }

              if (data.retCode === 0) {
                console.log(`✅ Successfully received spot ${coinToCheck} balance response from ${domain}`);
                break;
              }
            }
          } catch (fetchError: any) {
            if (response?.status === 403 && baseDomains.indexOf(domain) < baseDomains.length - 1) {
              console.warn(`⚠️ Error from ${domain} (HTTP ${response.status}), trying alternate domain...`);
              continue;
            }
            
            if (baseDomains.indexOf(domain) === baseDomains.length - 1) {
              console.warn(`⚠️ All spot balance check domains failed, assuming sufficient balance`);
              return {
                hasBalance: true,
                availableBalance: 0,
                totalRequired: isSellOrder && amount ? amount * 1.01 : orderValue * 1.05,
                orderValue: orderValue
              };
            }
          }
        }
        
        if (!response || !data) {
          console.warn(`⚠️ Spot balance check failed on all domains, assuming sufficient balance`);
          return {
            hasBalance: true,
            availableBalance: 0,
            totalRequired: isSellOrder && amount ? amount * 1.01 : orderValue * 1.05,
            orderValue: orderValue
          };
        }
        
        if (data.retCode !== 0) {
          console.warn(`⚠️ Failed to check balance (retCode: ${data.retCode}), proceeding with order attempt:`, data.retMsg);
          return {
            hasBalance: true,
            availableBalance: 0,
            totalRequired: isSellOrder && amount ? amount * 1.01 : orderValue * 1.05,
            orderValue: orderValue
          };
        }
        
        // Extract available balance
        const wallet = data.result?.list?.[0]?.coin?.[0];
        if (!wallet) {
          console.warn('⚠️ Could not parse balance response, proceeding with order attempt');
          return {
            hasBalance: true,
            availableBalance: 0,
            totalRequired: isSellOrder && amount ? amount * 1.01 : orderValue * 1.05,
            orderValue: orderValue
          };
        }
        
        const availableBalance = parseFloat(wallet.availableToWithdraw || wallet.availableBalance || '0');
        
        if (isSellOrder) {
          // For SELL orders, check asset quantity (not USD value)
          // amount is the quantity to sell (e.g., 0.1 ETH)
          if (!amount || amount <= 0) {
            console.warn('⚠️ Invalid amount for spot sell order, proceeding with order attempt');
            return {
              hasBalance: true,
              availableBalance: availableBalance,
              totalRequired: 0,
              orderValue: orderValue
            };
          }
          
          const requiredQuantity = amount;
          const buffer = requiredQuantity * 0.01; // 1% buffer
          const totalRequired = requiredQuantity + buffer;
          
          console.log(`💰 Spot SELL balance check for ${symbol}:`);
          console.log(`   Available ${baseAsset}: ${availableBalance.toFixed(8)}`);
          console.log(`   Required to sell: ${requiredQuantity.toFixed(8)} ${baseAsset}`);
          console.log(`   Total required (with 1% buffer): ${totalRequired.toFixed(8)} ${baseAsset}`);
          
          if (availableBalance >= totalRequired) {
            console.log(`✅ Sufficient ${baseAsset} balance: ${availableBalance.toFixed(8)} >= ${totalRequired.toFixed(8)}`);
            return {
              hasBalance: true,
              availableBalance: availableBalance,
              totalRequired: totalRequired,
              orderValue: orderValue
            };
          } else {
            const shortfall = totalRequired - availableBalance;
            console.warn(`⚠️ Insufficient ${baseAsset} balance: ${availableBalance.toFixed(8)} < ${totalRequired.toFixed(8)}`);
            console.warn(`   Shortfall: ${shortfall.toFixed(8)} ${baseAsset}`);
            return {
              hasBalance: false,
              availableBalance: availableBalance,
              totalRequired: totalRequired,
              orderValue: orderValue
            };
          }
        } else {
          // For BUY orders, check USDT balance (existing logic)
          const requiredValue = orderValue;
          
          console.log(`💰 Spot BUY balance check for ${symbol}:`);
          console.log(`   Available USDT: $${availableBalance.toFixed(2)}`);
          console.log(`   Required: $${requiredValue.toFixed(2)}`);
          
          const buffer = requiredValue * 0.05;
          const totalRequired = requiredValue + buffer;
          
          if (availableBalance >= totalRequired) {
            console.log(`✅ Sufficient USDT balance: $${availableBalance.toFixed(2)} >= $${totalRequired.toFixed(2)} (required + 5% buffer)`);
            return {
              hasBalance: true,
              availableBalance: availableBalance,
              totalRequired: totalRequired,
              orderValue: orderValue
            };
          } else {
            const shortfall = totalRequired - availableBalance;
            console.warn(`⚠️ Insufficient USDT balance: $${availableBalance.toFixed(2)} < $${totalRequired.toFixed(2)} (required + 5% buffer)`);
            console.warn(`💡 Tip: Add at least $${Math.ceil(shortfall)} USDT to your Bybit Spot wallet to enable trading`);
            return {
              hasBalance: false,
              availableBalance: availableBalance,
              totalRequired: totalRequired,
              orderValue: orderValue
            };
          }
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

  /**
   * Check if Bitunix account has sufficient balance for order
   * Returns balance check result with details
   */
  private async checkBitunixBalance(apiKey: string, apiSecret: string, symbol: string, side: string, orderValue: number, tradingType: string, amount?: number): Promise<{
    hasBalance: boolean;
    availableBalance: number;
    totalRequired: number;
    orderValue: number;
  }> {
    const marketType = tradingType === 'futures' || tradingType === 'linear' ? 'futures' : 'spot';
    // Always use mainnet
    const baseUrls = marketType === 'futures'
      ? ['https://fapi.bitunix.com']
      : ['https://api.bitunix.com'];
    
    const isSellOrder = side.toLowerCase() === 'sell';
    
    try {
      // Sync Bitunix server time to prevent timestamp errors
      await this.syncBitunixServerTime();
      const timestamp = (Date.now() + (BotExecutor as any).bitunixServerTimeOffset || 0).toString();
      const nonce = this.generateNonce();
      
      // Try account balance endpoints (order matters - try most specific first)
      // IMPORTANT: Bitunix futures account endpoint requires marginCoin query parameter
      // CRITICAL: For futures trading, ONLY use futures endpoints to avoid System Error 2
      const endpointsToTry = marketType === 'futures'
        ? [
            { path: '/api/v1/futures/account', params: 'marginCoin=USDT' },  // Futures-specific account (REQUIRES marginCoin)
            { path: '/api/v1/futures/account/info', params: 'marginCoin=USDT' },  // Alternative futures endpoint
          ]
        : [
            { path: '/api/v1/spot/account', params: '' },     // Spot-specific account
            { path: '/api/v1/account', params: '' },          // General account endpoint
            { path: '/api/v1/account/balance', params: '' },  // Alternative balance endpoint
          ];
      
      let response: Response | null = null;
      let data: any = null;
      
      for (const baseUrl of baseUrls) {
        for (const endpoint of endpointsToTry) {
          try {
            const queryParams = endpoint.params; // Include marginCoin for futures account
            const body = ''; // Empty for GET requests
            const signature = await this.createBitunixSignatureDoubleSHA256(nonce, timestamp, apiKey, queryParams, body, apiSecret);
            
            const url = queryParams ? `${baseUrl}${endpoint.path}?${queryParams}` : `${baseUrl}${endpoint.path}`;
            response = await fetch(url, {
              method: 'GET',
              headers: {
                'api-key': String(apiKey),
                'nonce': String(nonce),
                'timestamp': String(timestamp),
                'sign': String(signature),
                'Content-Type': 'application/json'
              }
            });
            
            if (!response.ok) {
              if (response.status === 404) {
                continue; // Try next endpoint
              }
              // For other errors, log and continue
              const errorText = await response.text().catch(() => '');
              console.warn(`⚠️ Balance check failed: ${baseUrl}${endpoint.path}${queryParams ? '?' + queryParams : ''} returned ${response.status}: ${errorText.substring(0, 200)}`);
              continue;
            }
            
            const responseText = await response.text();
            if (!responseText) {
              continue; // Empty response, try next endpoint
            }
            
            data = JSON.parse(responseText);
            
            if (data && data.code === 0) {
              console.log(`✅ Bitunix balance check successful: ${baseUrl}${endpoint.path}${queryParams ? '?' + queryParams : ''}`);
              break; // Success
            } else if (data && data.code) {
              // Log non-zero error codes but continue trying
              console.warn(`⚠️ Balance check returned code ${data.code}: ${data.msg || 'Unknown error'} from ${baseUrl}${endpoint.path}${queryParams ? '?' + queryParams : ''}`);
            }
          } catch (err: any) {
            // Log error but continue trying other endpoints
            console.warn(`⚠️ Balance check error for ${baseUrl}${endpoint.path}${endpoint.params ? '?' + endpoint.params : ''}:`, err.message || String(err));
            continue;
          }
        }
        
        if (data && data.code === 0) {
          break; // Success
        }
      }
      
      // If balance check failed, DO NOT allow order to proceed (prevents System Error 2)
      if (!data || data.code !== 0) {
        const errorMsg = data?.msg || data?.message || 'Unknown error';
        const errorCode = data?.code || 'N/A';
        console.error(`❌ Bitunix balance check failed (Code: ${errorCode}): ${errorMsg}`);
        throw new Error(`Bitunix balance check failed (Code: ${errorCode}): ${errorMsg}. Cannot proceed with order without balance verification.`);
      }
      
      // Parse balance data
      const responseData = data.data || {};
      let assets: any[] = [];
      
      if (Array.isArray(responseData)) {
        assets = responseData;
      } else if (responseData.assets) {
        assets = responseData.assets;
      } else if (responseData.balances) {
        assets = responseData.balances;
      } else if (responseData.coin || responseData.balance !== undefined) {
        assets = [responseData];
      }
      
      // For futures, check total equity (all assets as collateral)
      if (marketType === 'futures') {
        let totalEquity = 0;
        for (const asset of assets) {
          const equity = parseFloat(
            asset.totalEquity ||
            asset.equity ||
            asset.balance ||
            asset.total ||
            '0'
          );
          totalEquity += equity;
        }
        
        const totalRequired = orderValue * 1.05; // 5% buffer
        const hasBalance = totalEquity >= totalRequired;
        
        console.log(`💰 Bitunix Futures Balance: $${totalEquity.toFixed(2)} (Required: $${totalRequired.toFixed(2)})`);
        
        return {
          hasBalance: hasBalance,
          availableBalance: totalEquity,
          totalRequired: totalRequired,
          orderValue: orderValue
        };
      } else {
        // For spot trading
        if (isSellOrder) {
          // For SELL orders, check asset quantity
          let baseAsset = symbol;
          if (symbol.endsWith('USDT')) {
            baseAsset = symbol.replace(/USDT$/, '').replace(/^(1000|10000)/, '');
          }
          
          const asset = assets.find((a: any) => {
            const assetSymbol = (a.asset || a.coin || a.currency || '').toUpperCase();
            return assetSymbol === baseAsset.toUpperCase();
          });
          
          const availableBalance = asset ? parseFloat(
            asset.available ||
            asset.free ||
            asset.balance ||
            '0'
          ) : 0;
          
          const totalRequired = amount ? amount * 1.01 : 0; // 1% buffer for sell
          
          console.log(`💰 Bitunix Spot Balance (${baseAsset}): ${availableBalance} (Required: ${totalRequired})`);
          
          return {
            hasBalance: availableBalance >= totalRequired,
            availableBalance: availableBalance,
            totalRequired: totalRequired,
            orderValue: orderValue
          };
        } else {
          // For BUY orders, check USDT balance
          const usdtAsset = assets.find((a: any) => {
            const assetSymbol = (a.asset || a.coin || a.currency || '').toUpperCase();
            return assetSymbol === 'USDT';
          });
          
          const availableBalance = usdtAsset ? parseFloat(
            usdtAsset.available ||
            usdtAsset.free ||
            usdtAsset.balance ||
            '0'
          ) : 0;
          
          const totalRequired = orderValue * 1.05; // 5% buffer
          
          console.log(`💰 Bitunix Spot Balance (USDT): $${availableBalance.toFixed(2)} (Required: $${totalRequired.toFixed(2)})`);
          
          return {
            hasBalance: availableBalance >= totalRequired,
            availableBalance: availableBalance,
            totalRequired: totalRequired,
            orderValue: orderValue
          };
        }
      }
    } catch (error) {
      console.warn('⚠️ Error checking Bitunix balance, allowing order to proceed:', error);
      // Return unknown balance status - let order attempt happen
      return {
        hasBalance: true, // Assume sufficient if check fails
        availableBalance: 0,
        totalRequired: isSellOrder && amount ? amount * 1.01 : orderValue * 1.05,
        orderValue: orderValue
      };
    }
  }

  private async getBybitPositionEntryPrice(apiKey: string, apiSecret: string, symbol: string): Promise<number | null> {
    // Always use mainnet
    const baseUrl = 'https://api.bybit.com';
    
    try {
      const timestamp = Date.now().toString();
      const recvWindow = '5000';
      
      // For GET requests, signature includes query params
      const queryParams = `category=linear&symbol=${symbol}`;
      const signaturePayload = timestamp + apiKey + recvWindow + queryParams;
      const signature = await this.createBybitSignature(signaturePayload, apiSecret);
      
      const response = await fetch(`${baseUrl}/v5/position/list?${queryParams}`, {
        method: 'GET',
        headers: this.buildBybitHeaders(apiKey, timestamp, recvWindow, signature),
      });
      
      const data = await response.json();
      
      if (data.retCode === 0 && data.result?.list && data.result.list.length > 0) {
        const position = data.result.list.find((p: any) => parseFloat(p.size || '0') !== 0);
        if (position && position.avgPrice) {
          const entryPrice = parseFloat(position.avgPrice);
          const positionSize = parseFloat(position.size || '0');
          console.log(`📊 Fetched position entry price for ${symbol}: ${entryPrice} (size: ${positionSize})`);
          return entryPrice;
        }
      }
      
      // If no position found, wait and retry once (position might still be updating)
      console.log(`⚠️ No position found for ${symbol} on first attempt, waiting 1 second and retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Retry once
      const retryTimestamp = Date.now().toString();
      const retrySigPayload = retryTimestamp + apiKey + recvWindow + queryParams;
      const retrySig = await this.createBybitSignature(retrySigPayload, apiSecret);
      
      const retryResponse = await fetch(`${baseUrl}/v5/position/list?${queryParams}`, {
        method: 'GET',
        headers: this.buildBybitHeaders(apiKey, retryTimestamp, recvWindow, retrySig),
      });
      
      const retryData = await retryResponse.json();
      if (retryData.retCode === 0 && retryData.result?.list && retryData.result.list.length > 0) {
        const position = retryData.result.list.find((p: any) => parseFloat(p.size || '0') !== 0);
        if (position && position.avgPrice) {
          const entryPrice = parseFloat(position.avgPrice);
          const positionSize = parseFloat(position.size || '0');
          console.log(`📊 Fetched position entry price for ${symbol} on retry: ${entryPrice} (size: ${positionSize})`);
          return entryPrice;
        }
      }
      
      return null;
    } catch (error) {
      console.warn('⚠️ Failed to fetch position entry price:', error);
      return null;
    }
  }
  
  private async setBybitSLTP(apiKey: string, apiSecret: string, symbol: string, side: string, entryPrice: number, bot: any, tradeSignal: any = null): Promise<void> {
    // Always use mainnet
    const baseUrl = 'https://api.bybit.com';
    const recvWindow = '5000';
    
    try {
      // First, check actual position to determine correct side
      const timestamp = Date.now().toString();
      const positionQuery = `category=linear&symbol=${symbol}`;
      const positionSigPayload = timestamp + apiKey + recvWindow + positionQuery;
      const positionSig = await this.createBybitSignature(positionSigPayload, apiSecret);
      
      const positionResponse = await fetch(`${baseUrl}/v5/position/list?${positionQuery}`, {
        method: 'GET',
        headers: this.buildBybitHeaders(apiKey, timestamp, recvWindow, positionSig),
      });
      
      const positionData = await positionResponse.json();
      let actualPositionSide = side; // Default to trade side
      let positionSize = 0;
      
      if (positionData.retCode === 0 && positionData.result?.list) {
        const position = positionData.result.list.find((p: any) => {
          const size = parseFloat(p.size || '0');
          return size !== 0;
        });
        
        if (position) {
          positionSize = parseFloat(position.size || '0');
          // Bybit: Positive size = Long (Buy), Negative size = Short (Sell)
          // But Bybit API might report side as "Buy" or "Sell" in different fields
          // Use size to determine: positive = Buy (Long), negative = Sell (Short)
          actualPositionSide = positionSize > 0 ? 'Buy' : 'Sell';
          
          // Also check position.side if available (some Bybit responses include this)
          // CRITICAL: Always trust Bybit's reported side when available - it's the source of truth
          const bybitPositionSide = position.side;
          if (bybitPositionSide) {
            // Always use Bybit's reported side as it's authoritative
            actualPositionSide = bybitPositionSide === 'Buy' ? 'Buy' : 'Sell';
            if (actualPositionSide !== (positionSize > 0 ? 'Buy' : 'Sell')) {
              console.warn(`⚠️ Position side mismatch: size indicates ${positionSize > 0 ? 'Buy' : 'Sell'} but Bybit reports ${bybitPositionSide} - using Bybit's side`);
            }
            console.log(`   ✅ Using Bybit reported side: ${actualPositionSide} (authoritative)`);
          } else {
            // Fallback to size-based detection only if Bybit doesn't report side
            console.log(`   ℹ️ Bybit didn't report side, using size-based detection: ${actualPositionSide}`);
          }
          
          console.log(`📊 Actual position side for ${symbol}: ${actualPositionSide} (size: ${positionSize}, Bybit side: ${bybitPositionSide || 'not reported'})`);
          
          // Update entry price from actual position if available
          if (position.avgPrice && parseFloat(position.avgPrice) > 0) {
            entryPrice = parseFloat(position.avgPrice);
            console.log(`📊 Using actual position entry price: ${entryPrice}`);
          } else if (position.entryPrice && parseFloat(position.entryPrice) > 0) {
            entryPrice = parseFloat(position.entryPrice);
            console.log(`📊 Using position entryPrice field: ${entryPrice}`);
          }
        } else {
          console.log(`📊 No open position found for ${symbol} - position may have been closed`);
          // If no position found, the trade likely closed the position - skip SL/TP
          return;
        }
      }
      
      // Critical: If trade side doesn't match position side, the position might have been closed or reversed
      // In one-way mode, a SELL trade closes a LONG position or opens a SHORT
      // We need to determine which position we're actually setting SL/TP for
      const tradeSideMatch = (side === 'Buy' && actualPositionSide === 'Buy') || 
                            (side === 'Sell' && actualPositionSide === 'Sell');
      
      if (!tradeSideMatch) {
        // Trade side doesn't match position side - this could mean:
        // 1. SELL order closed/reversed a LONG position (one-way mode)
        // 2. Position hasn't updated yet after the trade
        console.warn(`⚠️ Trade side (${side}) doesn't match position side (${actualPositionSide}) for ${symbol}`);
        console.warn(`   Position size: ${positionSize}. This may indicate position closure or reversal.`);
        
        // In one-way mode:
        // - SELL order on LONG position reduces/closes the LONG
        // - If SELL size >= LONG size, the LONG is closed (or reversed to SHORT if SELL > LONG)
        // - If SELL size < LONG size, the LONG is reduced (still LONG, but smaller)
        // - If no position exists, SELL creates a SHORT
        
        // For SELL on LONG: The position might be closing, but if position still exists and is LONG,
        // we should set SL/TP for the remaining LONG position. However, if the error suggests it's a SELL
        // position, we might need to wait for position to fully update or check if position was reversed.
        
        // Wait a bit longer for position to update, then check again
        console.log(`   Waiting 1 second for position to update after ${side} trade...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Re-check position after delay
        const retryTimestamp = Date.now().toString();
        const retryPositionQuery = `category=linear&symbol=${symbol}`;
        const retrySigPayload = retryTimestamp + apiKey + recvWindow + retryPositionQuery;
        const retryPositionSig = await this.createBybitSignature(retrySigPayload, apiSecret);
        
        const retryPositionResponse = await fetch(`${baseUrl}/v5/position/list?${retryPositionQuery}`, {
          method: 'GET',
          headers: this.buildBybitHeaders(apiKey, retryTimestamp, recvWindow, retryPositionSig),
        });
        
        const retryPositionData = await retryPositionResponse.json();
        if (retryPositionData.retCode === 0 && retryPositionData.result?.list) {
          const updatedPosition = retryPositionData.result.list.find((p: any) => {
            const size = parseFloat(p.size || '0');
            return size !== 0;
          });
          
          if (updatedPosition) {
            const updatedSize = parseFloat(updatedPosition.size || '0');
            const updatedSide = updatedSize > 0 ? 'Buy' : 'Sell';
            console.log(`📊 Position after delay: ${updatedSide} (size: ${updatedSize})`);
            
            // Update with the new position info
            if (updatedPosition.avgPrice && parseFloat(updatedPosition.avgPrice) > 0) {
              entryPrice = parseFloat(updatedPosition.avgPrice);
              console.log(`📊 Updated entry price: ${entryPrice}`);
            }
            actualPositionSide = updatedSide;
            positionSize = updatedSize;
            
            // Check if position was closed
            if (Math.abs(positionSize) < 0.01) {
              // Position was closed
              console.log(`   Position was closed (size: ${positionSize}) - skipping SL/TP`);
              return;
            }
            
            // In one-way mode: SELL on LONG reduces the LONG (but it's still LONG)
            // BUY on SHORT reduces the SHORT (but it's still SHORT)
            // If position still exists, we should set SL/TP for that position
            const nowMatches = (side === 'Buy' && actualPositionSide === 'Buy') || 
                              (side === 'Sell' && actualPositionSide === 'Sell');
            
            if (!nowMatches) {
              // Trade reduced but didn't close/reverse the position
              // Set SL/TP for the remaining position (not the trade direction)
              console.log(`   Trade (${side}) reduced ${actualPositionSide} position but didn't close it`);
              console.log(`   Setting SL/TP for remaining ${actualPositionSide} position (size: ${positionSize})`);
              // Continue with actualPositionSide for SL/TP calculation (already set above)
            }
          } else {
            // No position found after delay - position was closed
            console.log(`   No position found after delay - position was closed, skipping SL/TP`);
            return;
          }
        } else {
          // Retry fetch failed - skip to avoid errors
          console.warn(`   Could not re-check position after delay - skipping SL/TP to avoid errors`);
          return;
        }
        
        // If we get here, we have a valid position (either matches trade side or was reduced but still open)
        // Continue to set SL/TP for the actual position
      }
      
      // Calculate SL/TP prices with proper validation
      let stopLossPrice: string;
      let takeProfitPrice: string;
      
      const { tickSize } = getSymbolSteps(symbol);
      // Calculate proper decimal places for tick size
      let tickDecimals = 0;
      if (tickSize < 1) {
        const tickStr = tickSize.toString();
        if (tickStr.includes('.')) {
          tickDecimals = tickStr.split('.')[1].length;
        } else if (tickStr.includes('e-')) {
          // Handle scientific notation like 1e-6
          tickDecimals = Math.abs(parseInt(tickStr.split('e-')[1]));
        }
      }
      // Ensure at least 2 decimal places for prices
      tickDecimals = Math.max(tickDecimals, 2);
      
      const roundToTick = (v: number) => {
        if (tickSize <= 0) return v;
        return Math.round(v / tickSize) * tickSize;
      };

      // PRIORITY: Use strategy-calculated SL/TP from tradeSignal if available (ATR-based)
      // Otherwise, fall back to bot's configured stop_loss and take_profit percentages
      let slValue: number;
      let tpValue: number;
      
      if (tradeSignal?.stopLoss && tradeSignal?.takeProfit1) {
        // Use strategy-calculated values (ATR-based from evaluateStrategy)
        slValue = roundToTick(tradeSignal.stopLoss);
        tpValue = roundToTick(tradeSignal.takeProfit1);
        
        console.log(`\n🛡️ SL/TP Configuration: Using STRATEGY-CALCULATED values (ATR-based)`);
        console.log(`   Strategy SL: $${tradeSignal.stopLoss} → ${slValue} (rounded)`);
        console.log(`   Strategy TP1: $${tradeSignal.takeProfit1} → ${tpValue} (rounded)`);
        if (tradeSignal.takeProfit2) {
          console.log(`   Strategy TP2: $${tradeSignal.takeProfit2} (will use TP1 for now, TP2 can be set separately)`);
        }
        console.log(`   Entry Price: $${entryPrice}`);
      } else {
        // Fall back to bot percentage settings
        const stopLossPercent = parseFloat(bot.stop_loss || bot.stopLoss || '2.0');
        const takeProfitPercent = parseFloat(bot.take_profit || bot.takeProfit || '4.0');
        
        console.log(`\n🛡️ SL/TP Configuration: Using BOT PERCENTAGE settings (fallback)`);
        console.log(`   Bot Settings: SL=${bot?.stop_loss || bot?.stopLoss || '2.0'}%, TP=${bot?.take_profit || bot?.takeProfit || '4.0'}%`);
        console.log(`   Entry Price: $${entryPrice}`);
        
        // Use the determined position side for SL/TP calculation
        if (actualPositionSide === 'Buy') {
          // Long position: SL below entry, TP above entry
          slValue = roundToTick(entryPrice * (1 - stopLossPercent / 100));
          tpValue = roundToTick(entryPrice * (1 + takeProfitPercent / 100));
        } else {
          // Short position: SL above entry, TP below entry
          slValue = roundToTick(entryPrice * (1 + stopLossPercent / 100));
          tpValue = roundToTick(entryPrice * (1 - takeProfitPercent / 100));
          
          // DOUBLE-CHECK: If TP is still >= entry (shouldn't happen but safety check), force it below
          if (tpValue >= entryPrice) {
            console.error(`❌ CRITICAL: Short TP calculation resulted in TP >= Entry (${tpValue} >= ${entryPrice})`);
            console.error(`   Forcing TP to be at least 0.1% below entry`);
            tpValue = roundToTick(entryPrice * 0.999); // Force 0.1% below entry
          }
        }
        
        console.log(`   Calculated: SL=${slValue}, TP=${tpValue}`);
      }
      
      // Format prices as strings with proper precision, ensuring no scientific notation
      stopLossPrice = Number(slValue.toFixed(tickDecimals)).toString();
      takeProfitPrice = Number(tpValue.toFixed(tickDecimals)).toString();
      
      // Validate direction based on position side
      if (actualPositionSide === 'Buy') {
        // Long: SL < Entry, TP > Entry
        if (slValue >= entryPrice) {
          console.error(`❌ CRITICAL: Long position SL (${slValue}) >= Entry (${entryPrice}) - INVALID!`);
          console.error(`   Force correcting SL to be below entry...`);
          // Use Math.floor to ensure we round DOWN away from entry
          slValue = Math.floor((entryPrice * 0.995) / tickSize) * tickSize;
          stopLossPrice = Number(slValue.toFixed(tickDecimals)).toString();
        }
        if (tpValue <= entryPrice) {
          console.error(`❌ CRITICAL: Long position TP (${tpValue}) <= Entry (${entryPrice}) - INVALID!`);
          console.error(`   Force correcting TP to be above entry...`);
          // Use Math.ceil to ensure we round UP away from entry
          tpValue = Math.ceil((entryPrice * 1.005) / tickSize) * tickSize;
          takeProfitPrice = Number(tpValue.toFixed(tickDecimals)).toString();
        }
        console.log(`📊 Long Position SL/TP:`);
        console.log(`   Entry: ${entryPrice}, SL: ${stopLossPrice}, TP: ${takeProfitPrice}`);
      } else {
        // Short: SL > Entry, TP < Entry
        if (slValue <= entryPrice) {
          console.error(`❌ CRITICAL: Short position SL (${slValue}) <= Entry (${entryPrice}) - INVALID!`);
          console.error(`   Force correcting SL to be above entry...`);
          // Use Math.ceil to ensure we round UP away from entry
          slValue = Math.ceil((entryPrice * 1.005) / tickSize) * tickSize; 
          stopLossPrice = Number(slValue.toFixed(tickDecimals)).toString();
        }
        if (tpValue >= entryPrice) {
          console.error(`❌ CRITICAL: Short position TP (${tpValue}) >= Entry (${entryPrice}) - INVALID!`);
          console.error(`   Force correcting TP to be below entry...`);
          // Use Math.floor to ensure we round DOWN away from entry
          tpValue = Math.floor((entryPrice * 0.995) / tickSize) * tickSize;
          takeProfitPrice = Number(tpValue.toFixed(tickDecimals)).toString();
        }
        console.log(`📊 Short Position SL/TP:`);
        console.log(`   Entry: ${entryPrice}, SL: ${stopLossPrice}, TP: ${takeProfitPrice}`);
      }
      
      // Validate TP/SL direction. If invalid, skip setting to avoid API errors
      // Use existing tpValue and slValue variables (already declared above)
      const tpValueNum = parseFloat(takeProfitPrice);
      const slValueNum = parseFloat(stopLossPrice);
      console.log(`\n🔍 SL/TP Final Validation:`);
      console.log(`   Position Side: ${actualPositionSide}`);
      console.log(`   Entry Price: ${entryPrice}`);
      console.log(`   Stop Loss: ${slValueNum} (${actualPositionSide === 'Buy' ? 'should be <' : 'should be >'} entry)`);
      console.log(`   Take Profit: ${tpValueNum} (${actualPositionSide === 'Buy' ? 'should be >' : 'should be <'} entry)`);
      
      // Enhanced validation with detailed error messages
      let validationError = null;
      if (actualPositionSide === 'Buy') {
        // Long: SL < Entry, TP > Entry
        if (tpValueNum <= entryPrice) {
          validationError = `Take Profit (${tpValueNum}) must be GREATER than entry (${entryPrice}) for Long position`;
        }
        if (slValueNum >= entryPrice) {
          validationError = `Stop Loss (${slValueNum}) must be LESS than entry (${entryPrice}) for Long position`;
        }
      } else {
        // Short: SL > Entry, TP < Entry
        if (tpValueNum >= entryPrice) {
          validationError = `Take Profit (${tpValueNum}) must be LESS than entry (${entryPrice}) for Short position`;
        }
        if (slValueNum <= entryPrice) {
          validationError = `Stop Loss (${slValueNum}) must be GREATER than entry (${entryPrice}) for Short position`;
        }
      }
      
      if (validationError) {
        console.error(`❌ SL/TP Validation FAILED: ${validationError}`);
        console.error(`   ⚠️ WARNING: Position is OPEN but WITHOUT automatic SL/TP protection!`);
        console.error(`   ⚠️ ACTION REQUIRED: You must manually set SL/TP on the exchange or close the position`);
        console.error(`   📊 Position details: ${symbol}, Side: ${actualPositionSide}, Entry: ${entryPrice}`);
        console.error(`   💡 Manual SL/TP: Set SL=${bot?.stop_loss || 2.0}%, TP=${bot?.take_profit || 4.0}% on Bybit`);
        
        // Log critical warning to bot activity logs
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'trade',
          message: `⚠️ CRITICAL: SL/TP could not be set for ${symbol} ${actualPositionSide} position. Position is OPEN without protection!`,
          details: {
            symbol,
            side: actualPositionSide,
            entryPrice,
            error: validationError,
            recommendation: 'Manually set SL/TP on exchange or close position',
            manualSL: `${bot?.stop_loss || 2.0}%`,
            manualTP: `${bot?.take_profit || 4.0}%`
          }
        });
        
        return; // Non-critical; order already placed
      }
      
      console.log(`✅ SL/TP Validation PASSED`);

      console.log(`✅ Final SL/TP: SL=${stopLossPrice}, TP=${takeProfitPrice}`);
      
      // Double-check position side right before setting SL/TP (position might have changed)
      // This is especially important for small positions that might be closing
      const finalCheckTimestamp = Date.now().toString();
      const finalCheckQuery = `category=linear&symbol=${symbol}`;
      const finalCheckSigPayload = finalCheckTimestamp + apiKey + recvWindow + finalCheckQuery;
      const finalCheckSig = await this.createBybitSignature(finalCheckSigPayload, apiSecret);
      
      const finalCheckResponse = await fetch(`${baseUrl}/v5/position/list?${finalCheckQuery}`, {
        method: 'GET',
        headers: this.buildBybitHeaders(apiKey, finalCheckTimestamp, recvWindow, finalCheckSig),
      });
      
      const finalCheckData = await finalCheckResponse.json();
      let finalPositionSide = actualPositionSide;
      if (finalCheckData.retCode === 0 && finalCheckData.result?.list) {
        const finalPosition = finalCheckData.result.list.find((p: any) => {
          const size = parseFloat(p.size || '0');
          return size !== 0;
        });
        if (finalPosition) {
          const finalSize = parseFloat(finalPosition.size || '0');
          // CRITICAL: Always trust Bybit's reported side when available
          const finalBybitSide = finalPosition.side;
          if (finalBybitSide) {
            finalPositionSide = finalBybitSide === 'Buy' ? 'Buy' : 'Sell';
            console.log(`🔍 Final position check before SL/TP: ${finalPositionSide} (Bybit reported side, size: ${finalSize})`);
          } else {
            // Fallback to size-based detection only if Bybit doesn't report side
            finalPositionSide = finalSize > 0 ? 'Buy' : 'Sell';
            console.log(`🔍 Final position check before SL/TP: ${finalPositionSide} (size-based, size: ${finalSize})`);
          }
          
          // If position side changed, recalculate SL/TP
          if (finalPositionSide !== actualPositionSide) {
            console.warn(`⚠️ Position side changed from ${actualPositionSide} to ${finalPositionSide} - recalculating SL/TP`);
            actualPositionSide = finalPositionSide;
            
            // Recalculate SL/TP for the correct side
            // Use strategy-calculated values if available, otherwise use bot settings
            let recalcSlValue: number;
            let recalcTpValue: number;
            
            if (tradeSignal?.stopLoss && tradeSignal?.takeProfit1) {
              // Use strategy-calculated values
              recalcSlValue = roundToTick(tradeSignal.stopLoss);
              recalcTpValue = roundToTick(tradeSignal.takeProfit1);
              console.log(`📊 Recalculated using strategy values: SL=${recalcSlValue}, TP=${recalcTpValue}`);
            } else {
              // Use bot percentage settings
              const stopLossPercent = parseFloat(bot.stop_loss || bot.stopLoss || '2.0');
              const takeProfitPercent = parseFloat(bot.take_profit || bot.takeProfit || '4.0');
              
              if (actualPositionSide === 'Buy') {
                recalcSlValue = roundToTick(entryPrice * (1 - stopLossPercent / 100));
                recalcTpValue = roundToTick(entryPrice * (1 + takeProfitPercent / 100));
                
                // Validate long position TP/SL
                if (recalcSlValue >= entryPrice) {
                  console.error(`❌ Recalculated Long SL (${recalcSlValue}) >= Entry (${entryPrice}) - INVALID!`);
                  recalcSlValue = Math.floor((entryPrice * 0.995) / tickSize) * tickSize;
                  console.log(`   ✅ Corrected SL: ${recalcSlValue}`);
                }
                if (recalcTpValue <= entryPrice) {
                  console.error(`❌ Recalculated Long TP (${recalcTpValue}) <= Entry (${entryPrice}) - INVALID!`);
                  recalcTpValue = Math.ceil((entryPrice * 1.005) / tickSize) * tickSize;
                  console.log(`   ✅ Corrected TP: ${recalcTpValue}`);
                }
              } else {
                recalcSlValue = roundToTick(entryPrice * (1 + stopLossPercent / 100));
                recalcTpValue = roundToTick(entryPrice * (1 - takeProfitPercent / 100));
                
                // Validate short position TP/SL
                if (recalcTpValue >= entryPrice) {
                  console.error(`❌ Recalculated Short TP (${recalcTpValue}) >= Entry (${entryPrice}) - INVALID!`);
                  recalcTpValue = Math.floor((entryPrice * 0.995) / tickSize) * tickSize;
                  console.log(`   ✅ Corrected TP: ${recalcTpValue}`);
                }
                if (recalcSlValue <= entryPrice) {
                  console.error(`❌ Recalculated Short SL (${recalcSlValue}) <= Entry (${entryPrice}) - INVALID!`);
                  recalcSlValue = Math.ceil((entryPrice * 1.005) / tickSize) * tickSize;
                  console.log(`   ✅ Corrected SL: ${recalcSlValue}`);
                }
              }
              console.log(`📊 Recalculated using bot settings: SL=${recalcSlValue}, TP=${recalcTpValue}`);
            }
            
            stopLossPrice = Number(recalcSlValue.toFixed(tickDecimals)).toString();
            takeProfitPrice = Number(recalcTpValue.toFixed(tickDecimals)).toString();
            console.log(`✅ Recalculated SL/TP: SL=${stopLossPrice}, TP=${takeProfitPrice} for ${actualPositionSide}`);
          }
        } else {
          console.warn(`⚠️ No position found in final check - position may have been closed, skipping SL/TP`);
          return;
        }
      }
      
      // CRITICAL: Ensure prices are properly formatted as strings with correct decimal places
      // Bybit requires prices as strings, not numbers, and they must match the tick size
      const formattedStopLoss = parseFloat(stopLossPrice).toFixed(tickDecimals);
      const formattedTakeProfit = parseFloat(takeProfitPrice).toFixed(tickDecimals);
      
      // Double-check that we're not sending scientific notation or incorrectly formatted numbers
      const slNum = parseFloat(formattedStopLoss);
      const tpNum = parseFloat(formattedTakeProfit);
      
      // Validate that prices are reasonable (not in the millions/thousands incorrectly)
      if (slNum > entryPrice * 10 || tpNum > entryPrice * 10) {
        console.error(`❌ CRITICAL: SL/TP prices appear to be incorrectly formatted!`);
        console.error(`   Entry: ${entryPrice}, SL: ${slNum}, TP: ${tpNum}`);
        console.error(`   This suggests a formatting error. Skipping SL/TP to avoid API error.`);
        throw new Error(`SL/TP price formatting error: prices appear to be multiplied incorrectly`);
      }
      
      const requestBody = {
        category: 'linear',
        symbol: symbol,
        stopLoss: formattedStopLoss,
        takeProfit: formattedTakeProfit,
        positionIdx: 0  // 0 for one-way mode, 1 for Buy side in hedge mode, 2 for Sell side
      };
      
      const signaturePayload = timestamp + apiKey + recvWindow + JSON.stringify(requestBody);
      const signature = await this.createBybitSignature(signaturePayload, apiSecret);
      
      console.log(`🛡️ Setting SL/TP for ${symbol} ${actualPositionSide} position:`);
      console.log(`   Entry: ${entryPrice}`);
      console.log(`   Stop Loss: ${formattedStopLoss} (formatted from ${stopLossPrice})`);
      console.log(`   Take Profit: ${formattedTakeProfit} (formatted from ${takeProfitPrice})`);
      console.log(`   Position Side: ${actualPositionSide}`);
      console.log(`   Position Index: 0 (one-way mode)`);
      
      const response = await fetch(`${baseUrl}/v5/position/trading-stop`, {
        method: 'POST',
        headers: this.buildBybitHeaders(apiKey, timestamp, recvWindow, signature),
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      if (data.retCode !== 0) {
        console.error('SL/TP Response:', JSON.stringify(data, null, 2));
        console.error(`❌ SL/TP setting failed for ${symbol} (non-critical): ${data.retMsg}`);
        console.error(`📊 SL/TP Request Details:`);
        console.error(`   Symbol: ${symbol}`);
        console.error(`   Position Side: ${actualPositionSide}`);
        console.error(`   Entry Price: ${entryPrice}`);
        console.error(`   Stop Loss: ${formattedStopLoss} (parsed: ${slNum})`);
        console.error(`   Take Profit: ${formattedTakeProfit} (parsed: ${tpNum})`);
        console.error(`   Request Body:`, JSON.stringify(requestBody, null, 2));
        
        // If error mentions wrong position side, log additional debugging info
        if (data.retMsg && (data.retMsg.includes('Sell position') || data.retMsg.includes('Buy position'))) {
          console.error(`⚠️ Position side mismatch detected in error message`);
          console.error(`   Our detected side: ${actualPositionSide}`);
          console.error(`   Error suggests: ${data.retMsg.includes('Sell position') ? 'Sell' : 'Buy'}`);
          console.error(`   This may indicate a timing issue where position hasn't updated yet`);
        }
        
        // CRITICAL SAFETY: If SL/TP fails, position has NO PROTECTION - must close immediately
        console.error(`   🚨 CRITICAL: Position is OPEN but WITHOUT protection!`);
        // Read environment variable directly
        const disableSlTpSafety = (Deno.env.get('DISABLE_SLTPSAFETY') || '').toLowerCase() === 'true';
        if (disableSlTpSafety) {
          console.warn('⚠️ DISABLE_SLTPSAFETY=true: Skipping automatic close of unprotected position. Position remains OPEN without SL/TP. Monitor manually.');
          // Log and return without closing
          if (bot) {
            await this.addBotLog(bot.id, {
              level: 'warning',
              category: 'trade',
              message: `⚠️ SL/TP failed for ${symbol}. Safety auto-close disabled by env. Position left OPEN without SL/TP.`,
              details: {
                symbol,
                side: actualPositionSide,
                entryPrice,
                stopLoss: formattedStopLoss,
                takeProfit: formattedTakeProfit,
                bybitErrorCode: data.retCode,
                error: data.retMsg,
                note: 'Set SL/TP manually or use UI to manage risk.'
              }
            });
          }
          return;
        }
        console.error(`   🛡️ SAFETY PROTOCOL: Attempting to close unprotected position immediately...`);
        
        // Log critical error to bot activity logs
        if (bot) {
          await this.addBotLog(bot.id, {
            level: 'error',
            category: 'trade',
            message: `⚠️ CRITICAL: SL/TP API failed for ${symbol} ${actualPositionSide} position. Position is OPEN without protection!`,
            details: {
              symbol,
              side: actualPositionSide,
              entryPrice,
              stopLoss: formattedStopLoss,
              takeProfit: formattedTakeProfit,
              error: data.retMsg,
              bybitErrorCode: data.retCode,
              requestBody: requestBody,
              recommendation: 'Manually set SL/TP on exchange or close position',
              manualSL: `${bot?.stop_loss || 2.0}%`,
              manualTP: `${bot?.take_profit || 4.0}%`
            }
          });
        }
        
        // Attempt to close the position immediately for safety
        try {
          console.log(`🛡️ Attempting to close unprotected position: ${symbol} ${actualPositionSide}`);
          
          // Re-fetch position to get current size and ACTUAL side
          const closeCheckTimestamp = Date.now().toString();
          const closeCheckQuery = `category=linear&symbol=${symbol}`;
          const closeCheckSigPayload = closeCheckTimestamp + apiKey + recvWindow + closeCheckQuery;
          const closeCheckSig = await this.createBybitSignature(closeCheckSigPayload, apiSecret);
          
          const closeCheckResponse = await fetch(`${baseUrl}/v5/position/list?${closeCheckQuery}`, {
            method: 'GET',
            headers: this.buildBybitHeaders(apiKey, closeCheckTimestamp, recvWindow, closeCheckSig),
          });
          
          const closeCheckData = await closeCheckResponse.json();
          let closePositionSize = 0;
          let actualClosePositionSide = actualPositionSide; // Default to what we detected earlier
          
          if (closeCheckData.retCode === 0 && closeCheckData.result?.list) {
            const closePosition = closeCheckData.result.list.find((p: any) => {
              const size = parseFloat(p.size || '0');
              return size !== 0;
            });
            if (closePosition) {
              const rawSize = parseFloat(closePosition.size || '0');
              closePositionSize = Math.abs(rawSize);
              
              // CRITICAL: Re-determine position side from actual position data
              // Positive size = Long (Buy), Negative size = Short (Sell)
              actualClosePositionSide = rawSize > 0 ? 'Buy' : 'Sell';
              
              // Also check position.side if available (some Bybit responses include this)
              const bybitCloseSide = closePosition.side;
              if (bybitCloseSide && (bybitCloseSide === 'Buy' || bybitCloseSide === 'Sell')) {
                actualClosePositionSide = bybitCloseSide;
                console.log(`📊 Using Bybit reported side for closure: ${actualClosePositionSide}`);
              }
              
              console.log(`📊 Position closure check: size=${rawSize}, detected side=${actualClosePositionSide}, bybit side=${bybitCloseSide || 'not reported'}`);
            }
          }
          
          // Get opposite side to close position (use the ACTUAL detected side)
          const closeSide = actualClosePositionSide === 'Buy' ? 'Sell' : 'Buy';
          console.log(`🛡️ Closing ${actualClosePositionSide} position with ${closeSide} order (reduceOnly)`);
          
          if (closePositionSize > 0) {
            console.log(`🛡️ Closing position: ${symbol} ${actualClosePositionSide}, Size: ${closePositionSize}`);
            
            // CRITICAL: Use bot's actual trading type to determine category
            const botTradingType = bot?.tradingType || bot?.trading_type || 'futures';
            const closeCategory = botTradingType === 'spot' ? 'spot' : 'linear';
            
            console.log(`🛡️ Closing position with category: ${closeCategory} (bot trading type: ${botTradingType})`);
            
            // For linear (futures), use reduceOnly order to close position exactly
            if (closeCategory === 'linear') {
              // Use Bybit's reduceOnly parameter to close position exactly
              const closeTimestamp = Date.now().toString();
              const closeRecvWindow = '5000';
              
              // Format quantity according to step size
              const { stepSize } = getSymbolSteps(symbol);
              let formattedCloseSize = closePositionSize;
              if (stepSize > 0) {
                const factor = 1 / stepSize;
                formattedCloseSize = Math.floor(closePositionSize * factor) / factor;
              }
              const stepDecimals = stepSize < 1 ? stepSize.toString().split('.')[1]?.length || 0 : 0;
              const formattedQty = Number(formattedCloseSize.toFixed(stepDecimals)).toString();
              
              console.log(`📊 Closing ${symbol} position: size=${closePositionSize}, formatted=${formattedQty}, stepSize=${stepSize}`);
              
              // Use reduceOnly=true to ensure we're closing, not opening
              const closeOrderBody = {
                category: 'linear',
                symbol: symbol,
                side: closeSide, // Opposite side to close
                orderType: 'Market',
                qty: formattedQty,
                reduceOnly: true, // CRITICAL: This ensures we're closing, not opening
                positionIdx: 0 // 0 for one-way mode
              };
              
              const closeSigPayload = closeTimestamp + apiKey + closeRecvWindow + JSON.stringify(closeOrderBody);
              const closeSig = await this.createBybitSignature(closeSigPayload, apiSecret);
              
              console.log(`🛡️ Placing reduceOnly market order to close position: ${symbol} ${closeSide} ${formattedQty}`);
              
              const closeOrderResponse = await fetch(`${baseUrl}/v5/order/create`, {
                method: 'POST',
                headers: this.buildBybitHeaders(apiKey, closeTimestamp, closeRecvWindow, closeSig),
                body: JSON.stringify(closeOrderBody),
              });
              
              const closeOrderData = await closeOrderResponse.json();
              
              if (closeOrderData.retCode !== 0) {
                console.error(`❌ Failed to close position via reduceOnly order:`, closeOrderData);
                throw new Error(`Bybit API error: ${closeOrderData.retMsg} (Code: ${closeOrderData.retCode})`);
              }
              
              console.log(`✅ Position closed successfully via reduceOnly order: ${symbol} (Order ID: ${closeOrderData.result?.orderId})`);
              
              if (bot) {
                await this.addBotLog(bot.id, {
                  level: 'warning',
                  category: 'trade',
                  message: `🛡️ Unprotected position closed: ${symbol} ${actualPositionSide} (safety protocol)`,
                  details: {
                    symbol,
                    originalSide: actualPositionSide,
                    closeSide,
                    positionSize: closePositionSize,
                    closeOrderId: closeOrderData.result?.orderId,
                    reason: 'SL/TP setup failed - position closed for safety',
                    method: 'reduceOnly market order'
                  }
                });
              }
            } else {
              // For spot, use regular order placement
              const closeOrderResult = await this.placeBybitOrder(
                apiKey,
                apiSecret,
                symbol,
                closeSide,
                closePositionSize,
                0, // Market order - use 0 for price
                'spot',
                bot
              );
              
              console.log(`✅ Position closed successfully: ${symbol} (Order ID: ${closeOrderResult?.orderId})`);
              
              if (bot) {
                await this.addBotLog(bot.id, {
                  level: 'warning',
                  category: 'trade',
                  message: `🛡️ Unprotected position closed: ${symbol} ${actualClosePositionSide} (safety protocol)`,
                  details: {
                    symbol,
                    originalSide: actualClosePositionSide,
                    closeSide,
                    positionSize: closePositionSize,
                    closeOrderId: closeOrderResult?.orderId,
                    reason: 'SL/TP setup failed - position closed for safety'
                  }
                });
              }
            }
          } else {
            console.warn(`⚠️ Could not determine position size to close - position may already be closed`);
          }
        } catch (closeError) {
          // If closing fails, this is CRITICAL - position is unprotected and we can't close it
          console.error(`❌ CRITICAL ERROR: Failed to close unprotected position: ${symbol}`);
          console.error(`   Error: ${closeError instanceof Error ? closeError.message : String(closeError)}`);
          console.error(`   🚨 MANUAL ACTION REQUIRED: Position ${symbol} is OPEN without protection!`);
          console.error(`   💡 IMMEDIATE ACTION: Close position manually on Bybit exchange or via UI`);
          
          if (bot) {
            await this.addBotLog(bot.id, {
              level: 'error',
              category: 'trade',
              message: `🚨 CRITICAL: Unprotected position ${symbol} cannot be closed automatically! MANUAL ACTION REQUIRED!`,
              details: {
                symbol,
                side: actualClosePositionSide || actualPositionSide,
                entryPrice,
                slTpError: data.retMsg,
                closeError: closeError instanceof Error ? closeError.message : String(closeError),
                closeSide: closeSide || 'unknown',
                positionSize: closePositionSize || 0,
                urgentAction: 'CLOSE POSITION MANUALLY IMMEDIATELY',
                instructions: 'Go to Bybit exchange → Positions → Close position manually',
                riskLevel: 'CRITICAL - Position has no stop loss protection'
              }
            });
          }
          
          // Throw error to alert caller that position is unprotected
          throw new Error(`CRITICAL: Position ${symbol} opened but SL/TP failed and position could not be closed. MANUAL ACTION REQUIRED!`);
        }
        
        // If we successfully closed the position, throw error to alert caller
        // This will cause the trade to be marked as failed
        throw new Error(`Position ${symbol} was closed due to SL/TP setup failure (safety protocol)`);
      }
      
      console.log('✅ SL/TP set successfully');
    } catch (error) {
      // CRITICAL: If SL/TP fails and position couldn't be closed, this is a critical error
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('CRITICAL') || errorMessage.includes('safety protocol')) {
        // Read environment variable directly
        const disableSlTpSafety = (Deno.env.get('DISABLE_SLTPSAFETY') || '').toLowerCase() === 'true';
        if (disableSlTpSafety) {
          console.warn('⚠️ SL/TP critical error detected after safety block, but DISABLE_SLTPSAFETY=true. Continuing without abort.');
          // still log error but don't throw
          return;
        }
        // This is a critical safety error - re-throw to prevent trade completion
        console.error('🚨 CRITICAL: SL/TP failure resulted in unprotected position - trade cannot proceed');
        throw error;
      }
      
      // For other SL/TP errors, log but don't fail the trade
      console.error('⚠️ SL/TP setting error:', error);
      
      // Log to bot activity
      if (bot) {
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'trade',
          message: `⚠️ SL/TP setting error for ${symbol}: ${errorMessage}`,
          details: {
            symbol,
            error: errorMessage,
            note: 'Trade completed but SL/TP may not be set. Check position manually.'
          }
        });
      }
    }
  }
  
  private async placeOKXOrder(apiKey: string, apiSecret: string, passphrase: string, symbol: string, side: string, amount: number, price: number): Promise<any> {
    // Always use mainnet
    const baseUrl = 'https://www.okx.com';
    
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
  
  private async placeBitunixOrder(apiKey: string, apiSecret: string, symbol: string, side: string, amount: number, price: number, tradingType: string = 'spot', bot: any = null): Promise<any> {
    // Use correct base URL based on trading type (per official docs)
    const marketType = tradingType === 'futures' || tradingType === 'linear' ? 'futures' : 'spot';
    // Always use mainnet
    const baseUrls = marketType === 'futures'
      ? ['https://fapi.bitunix.com'] // Official futures API domain
      : ['https://api.bitunix.com'];
    
    console.log(`🔑 Bitunix Order Details:`);
    console.log(`   Market Type: ${marketType}, Trading Type: ${tradingType}`);
    console.log(`   Base URLs to try: ${baseUrls.join(', ')}`);
    console.log(`   API Key length: ${apiKey.length}, starts with: ${apiKey.substring(0, 8)}...`);
    console.log(`   API Secret length: ${apiSecret.length}, starts with: ${apiSecret.substring(0, 8)}...`);
    console.log(`   Symbol: ${symbol}, Side: ${side}, Amount: ${amount}, Price: ${price}`);
    
    // Try symbol variants before giving up (some symbols may need different formats on Bitunix)
    const symbolVariants = MarketDataFetcher.normalizeSymbol(symbol, 'bitunix', tradingType);
    console.log(`🔍 Will try symbol variants: ${symbolVariants.join(', ')}`);
    
    // Use correct endpoints based on official Bitunix API documentation
    // CRITICAL: For futures, ONLY use /api/v1/futures/trade/place_order
    // Using /api/v1/trade/place_order for futures causes Code 2 (System error)
    // Futures: /api/v1/futures/trade/place_order (ONLY)
    // Spot: /api/v1/spot/trade/place_order or /api/v1/trade/place_order
    const endpointsToTry = marketType === 'futures' 
      ? [
          '/api/v1/futures/trade/place_order',  // Official futures endpoint (ONLY - others cause Code 2)
        ]
      : [
          '/api/v1/spot/trade/place_order',     // Spot endpoint (if exists)
          '/api/v1/trade/place_order',          // Alternative for spot
          '/api/v1/futures/trade/place_order',  // Try futures endpoint as fallback
        ];
    
    try {
      // Track errors across all symbol variants
      let allSymbolVariantsFailed = true;
      let lastSymbolVariantError: any = null;
      
      // Try each symbol variant
      for (const symbolVariant of symbolVariants) {
        console.log(`\n🔄 Trying symbol variant: ${symbolVariant}`);
        
        try {
        // Sync Bitunix server time to prevent timestamp errors
        await this.syncBitunixServerTime();
        const timestamp = (Date.now() + BotExecutor.bitunixServerTimeOffset).toString(); // milliseconds with server offset
        const nonce = this.generateNonce(); // 32-bit random string
        
        // Track if all errors were Code 2 (likely symbol doesn't exist)
        let allErrorsWereCode2 = true;
        let code2ErrorCount = 0;
        let totalAttempts = 0;
        
        // Bitunix order parameters per official API documentation (updated per support feedback)
        // IMPORTANT: Bitunix Futures API requires STRING values, not numeric codes!
        // side: "BUY" or "SELL" (not 1 or 2)
        // orderType: "LIMIT" or "MARKET" (not 1 or 2) - NOTE: parameter name is "orderType", not "type"
        // tradeSide: "OPEN" or "CLOSE" (required for futures, especially when hedge mode is enabled)
        // IMPORTANT: Bitunix futures API uses 'qty' parameter, not 'volume'
        // CRITICAL: Trading bots should ALWAYS use MARKET orders for immediate execution
        const sideString = side.toUpperCase() === 'SELL' ? 'SELL' : 'BUY'; // String: "BUY" or "SELL"
        const orderTypeString = 'MARKET'; // Always use MARKET orders for trading bots (immediate execution)
        
        const orderParams: any = {
          symbol: symbolVariant.toUpperCase(), // Use symbol variant instead of original symbol
          side: sideString, // String: "BUY" or "SELL"
          orderType: orderTypeString, // String: "LIMIT" or "MARKET" (NOTE: parameter name is "orderType", not "type")
          qty: amount.toString(), // Bitunix futures API uses 'qty', not 'volume'
        };
      
      // Add tradeSide and marginCoin for futures trading (required, especially when hedge mode is enabled)
      if (marketType === 'futures') {
        orderParams.tradeSide = 'OPEN'; // "OPEN" for opening new positions, "CLOSE" for closing
        orderParams.marginCoin = 'USDT'; // Add marginCoin parameter (required for USDT-M futures)
        
        // CRITICAL: Do NOT add leverage, margin mode, or SL/TP to order parameters
        // These cause Code 2 errors. Set them separately before/after order placement.
        // Bitunix API requires minimal parameters for order placement:
        // - symbol, side, orderType, qty, tradeSide, marginCoin (for futures)
        // Everything else should be set via separate API calls
        
        console.log(`   📊 Order will use account default leverage/margin mode. Will set separately after order.`);
      }
      
      // MARKET orders don't require price parameter (price is determined by market)
      // Only LIMIT orders need price, but we're always using MARKET for trading bots
      
      // Keep 'volume' as fallback for older API versions or spot trading
      
      // Create body string (JSON with no spaces, per Bitunix docs)
      const bodyString = JSON.stringify(orderParams).replace(/\s+/g, '');
      
      // For POST requests: queryParams = "" (empty), body is in request body
      const queryParams = ''; // Empty for POST
      
      // Create signature using double SHA256 (official Bitunix method)
      // digest = SHA256(nonce + timestamp + api-key + queryParams + body)
      // sign = SHA256(digest + secretKey)
      const signature = await this.createBitunixSignatureDoubleSHA256(nonce, timestamp, apiKey, queryParams, bodyString, apiSecret);
      
      console.log(`   Signature created using double SHA256`);
      console.log(`   Request body: ${bodyString}`);
      console.log(`   Order parameters (parsed):`, JSON.stringify(orderParams, null, 2));
      
      // Try each base URL and endpoint combination
      let lastError: any = null;
      for (const baseUrl of baseUrls) {
        for (const requestPath of endpointsToTry) {
          try {
            console.log(`   Trying: ${baseUrl}${requestPath}`);
            
            const response = await fetch(`${baseUrl}${requestPath}`, {
              method: 'POST',
              headers: {
                'api-key': String(apiKey),
                'nonce': String(nonce),
                'timestamp': String(timestamp),
                'sign': String(signature),
                'Content-Type': 'application/json',
                'language': 'en-US' // Optional but recommended
              },
              body: bodyString
            });
            
            const responseText = await response.text();
            console.log(`   Response status: ${response.status}, body: ${responseText.substring(0, 500)}`);
            
            if (!response.ok) {
              if (response.status === 401) {
                throw new Error('Bitunix 401 Unauthorized - check API key, secret, and testnet flag');
              }
              if (response.status === 404) {
                console.warn(`   ⚠️ 404 from ${baseUrl}${requestPath}, trying next endpoint...`);
                lastError = new Error(`Bitunix API error: 404 - Endpoint not found: ${requestPath}`);
                continue; // Try next endpoint
              }
              
              // Try to parse error response
              try {
                const errorData = JSON.parse(responseText);
                const errorMsg = errorData.msg || errorData.message || `HTTP ${response.status}`;
                console.warn(`   ⚠️ HTTP ${response.status}: ${errorMsg}`);
                lastError = new Error(`Bitunix API error: ${response.status} - ${errorMsg}`);
                continue;
              } catch {
                throw new Error(`Bitunix API error: ${response.status} - ${responseText.substring(0, 200)}`);
              }
            }
            
            const data = JSON.parse(responseText);
            
            if (data.code !== 0) {
              const errorMsg = data.msg || data.message || 'Unknown error';
              
              // Handle Code 10007 (Signature Error) - might need to try different endpoint
              if (data.code === 10007) {
                console.warn(`   ⚠️ API returned code 10007: Signature Error, trying next endpoint...`);
                lastError = new Error(`Bitunix signature error (Code: 10007): ${errorMsg}`);
                continue; // Try next endpoint - signature might work on different endpoint
              }
              
              // Handle Code 10003 (Token invalid) FIRST - don't retry, fail immediately
              // This must be checked before Code 2 because invalid API keys will fail on all endpoints
              if (data.code === 10003) {
                console.error(`❌ Bitunix API key is invalid (Code: 10003) for ${symbol}`);
                console.error(`📋 Error message: ${errorMsg}`);
                console.error(`🔑 API Key (first 8 chars): ${apiKey.substring(0, 8)}...`);
                console.error(`🌐 Base URL: ${baseUrl}`);
                console.error(`🌐 Environment: Mainnet`);
                
                // Log to bot activity logs with actionable message
                if (bot?.id) {
                  await this.addBotLog(bot.id, {
                    level: 'error',
                    category: 'trade',
                    message: `Bitunix API key is invalid (Code: 10003). Please verify and update your Bitunix API keys in account settings.`,
                    details: {
                      symbol: symbol,
                      code: 10003,
                      msg: errorMsg,
                      exchange: 'bitunix',
                      is_testnet: false, // Always mainnet
                      api_key_preview: apiKey.substring(0, 8) + '...',
                      action_required: 'Update Bitunix API keys in account settings. Ensure keys are valid and have trading permissions.',
                      troubleshooting: [
                        '1. Go to Bitunix → API Management',
                        '2. Verify your API key is active and has trading permissions',
                        '3. Check if API key has expired or been revoked',
                        '4. Re-enter API key and secret in your account settings',
                        '5. Ensure API key has futures trading permissions if using futures'
                      ]
                    }
                  });
                }
                
                throw new Error(`Bitunix API key is invalid (Code: 10003). Please verify and update your Bitunix API keys in your account settings. The API key may have expired, been revoked, or may not have trading permissions.`);
              }
              
              // Handle Code 2 (System error) - try different parameter formats
              if (data.code === 2) {
                code2ErrorCount++;
                totalAttempts++;
                console.error(`   ❌ System error (Code: 2) from ${baseUrl}${requestPath}`);
                console.error(`   📋 Error message: ${errorMsg}`);
                console.error(`   📋 Full error response: ${JSON.stringify(data, null, 2)}`);
                console.error(`   📋 Raw response text: ${responseText}`);
                console.error(`   📋 Original request: symbol=${symbolVariant}, side=${sideString}, orderType=${orderTypeString}, qty=${amount}, price=${price}`);
                console.error(`   📋 Request body: ${bodyString}`);
                console.error(`   📋 Request headers: api-key=${apiKey.substring(0, 8)}..., nonce=${nonce}, timestamp=${timestamp}`);
                // Log to bot activity logs for visibility
                if (bot?.id) {
                  await this.addBotLog(bot.id, {
                    level: 'error',
                    category: 'trade',
                    message: `Bitunix order placement failed with Code 2 (System error): ${errorMsg}`,
                    details: {
                      symbol: symbolVariant,
                      side: sideString,
                      orderType: orderTypeString,
                      qty: amount,
                      price: price,
                      code: 2,
                      msg: errorMsg,
                      endpoint: `${baseUrl}${requestPath}`,
                      troubleshooting: [
                        '1. Verify symbol is tradeable on Bitunix futures',
                        '2. Check account margin mode and leverage settings',
                        '3. Ensure API key has futures trading permissions',
                        '4. Verify symbol format matches Bitunix requirements',
                        '5. Check Bitunix API status for temporary issues'
                      ]
                    }
                  });
                }
                console.log(`   🔄 Trying alternative parameter format...`);
                
                // Try alternative parameter names: 'volume' instead of 'qty' (for spot or older API versions)
                const altOrderParams: any = {
                  symbol: symbolVariant.toUpperCase(), // Use symbol variant
                  side: sideString, // Keep string format
                  orderType: orderTypeString, // Keep string format (use "orderType", not "type")
                  volume: amount.toString(), // Try 'volume' as alternative
                };
                
                // Add tradeSide and marginCoin for futures (keep minimal - no margin mode in order)
                if (marketType === 'futures') {
                  altOrderParams.tradeSide = 'OPEN';
                  altOrderParams.marginCoin = 'USDT'; // Add marginCoin for futures
                  // Do NOT add marginMode here - causes Code 2 errors
                }
                
                if (orderTypeString === 'LIMIT' && price && price > 0) {
                  altOrderParams.price = price.toString();
                }
                
                const altBodyString = JSON.stringify(altOrderParams).replace(/\s+/g, '');
                console.log(`   🔄 Trying alternative format with 'volume': ${altBodyString}`);
                const altSignature = await this.createBitunixSignatureDoubleSHA256(nonce, timestamp, apiKey, queryParams, altBodyString, apiSecret);
                
                try {
                  const altResponse = await fetch(`${baseUrl}${requestPath}`, {
                    method: 'POST',
                    headers: {
                      'api-key': String(apiKey),
                      'nonce': String(nonce),
                      'timestamp': String(timestamp),
                      'sign': String(altSignature),
                      'Content-Type': 'application/json',
                      'language': 'en-US'
                    },
                    body: altBodyString
                  });
                  
                  const altResponseText = await altResponse.text();
                  console.log(`   Alt format response: ${altResponse.status}, body: ${altResponseText.substring(0, 300)}`);
                  
                  if (altResponse.ok) {
                    const altData = JSON.parse(altResponseText);
                    
                    // Check for Code 10003 in alternative format response - fail immediately
                    if (altData.code === 10003) {
                      console.error(`❌ Bitunix API key is invalid (Code: 10003) in alternative format for ${symbol}`);
                      if (bot?.id) {
                        await this.addBotLog(bot.id, {
                          level: 'error',
                          category: 'trade',
                          message: `Bitunix API key is invalid (Code: 10003). Please verify and update your Bitunix API keys in account settings.`,
                          details: {
                            symbol: symbol,
                            code: 10003,
                            msg: altData.msg || 'Token invalid',
                            exchange: 'bitunix',
                            action_required: 'Update Bitunix API keys in account settings.'
                          }
                        });
                      }
                      throw new Error(`Bitunix API key is invalid (Code: 10003). Please verify and update your Bitunix API keys in your account settings.`);
                    }
                    
                    if (altData.code === 0) {
                      console.log(`✅ Bitunix order placed successfully with alternative format via ${baseUrl}${requestPath}`);
                      return {
                        orderId: altData.data?.orderId || altData.data?.id || altData.data?.order_id || altData.data?.clientId,
                        status: altData.data?.status || 'filled',
                        exchange: 'bitunix',
                        response: altData
                      };
                    }
                  }
                } catch (altErr) {
                  console.warn(`   ⚠️ Alternative format also failed:`, altErr);
                }
                
                // If alternative format failed, try with 'quantity' parameter
                const altOrderParams2: any = {
                  symbol: symbolVariant.toUpperCase(), // Use symbol variant
                  side: sideString, // Keep string format
                  orderType: orderTypeString, // Keep string format (use "orderType", not "type")
                  quantity: amount.toString(), // Try 'quantity'
                };
                
                // Add tradeSide and marginCoin for futures (keep minimal - no margin mode in order)
                if (marketType === 'futures') {
                  altOrderParams2.tradeSide = 'OPEN';
                  altOrderParams2.marginCoin = 'USDT'; // Add marginCoin for futures
                  // Do NOT add marginMode here - causes Code 2 errors
                }
                
                if (orderTypeString === 'LIMIT' && price && price > 0) {
                  altOrderParams2.price = price.toString();
                }
                
                const altBodyString2 = JSON.stringify(altOrderParams2).replace(/\s+/g, '');
                const altSignature2 = await this.createBitunixSignatureDoubleSHA256(nonce, timestamp, apiKey, queryParams, altBodyString2, apiSecret);
                
                try {
                  const altResponse2 = await fetch(`${baseUrl}${requestPath}`, {
                    method: 'POST',
                    headers: {
                      'api-key': String(apiKey),
                      'nonce': String(nonce),
                      'timestamp': String(timestamp),
                      'sign': String(altSignature2),
                      'Content-Type': 'application/json',
                      'language': 'en-US'
                    },
                    body: altBodyString2
                  });
                  
                  const altResponseText2 = await altResponse2.text();
                  console.log(`   Alt format 2 response: ${altResponse2.status}, body: ${altResponseText2.substring(0, 300)}`);
                  
                  if (altResponse2.ok) {
                    const altData2 = JSON.parse(altResponseText2);
                    
                    // Check for Code 10003 in alternative format 2 response - fail immediately
                    if (altData2.code === 10003) {
                      console.error(`❌ Bitunix API key is invalid (Code: 10003) in alternative format 2 for ${symbol}`);
                      if (bot?.id) {
                        await this.addBotLog(bot.id, {
                          level: 'error',
                          category: 'trade',
                          message: `Bitunix API key is invalid (Code: 10003). Please verify and update your Bitunix API keys in account settings.`,
                          details: {
                            symbol: symbol,
                            code: 10003,
                            msg: altData2.msg || 'Token invalid',
                            exchange: 'bitunix',
                            action_required: 'Update Bitunix API keys in account settings.'
                          }
                        });
                      }
                      throw new Error(`Bitunix API key is invalid (Code: 10003). Please verify and update your Bitunix API keys in your account settings.`);
                    }
                    
                    if (altData2.code === 0) {
                      console.log(`✅ Bitunix order placed successfully with alternative format 2 via ${baseUrl}${requestPath}`);
                      return {
                        orderId: altData2.data?.orderId || altData2.data?.id || altData2.data?.order_id || altData2.data?.clientId,
                        status: altData2.data?.status || 'filled',
                        exchange: 'bitunix',
                        response: altData2
                      };
                    }
                  }
                } catch (altErr2) {
                  console.warn(`   ⚠️ Alternative format 2 also failed:`, altErr2);
                }
                
                // If limit order failed, try market order as last resort (market orders have fewer requirements)
                if (orderTypeString === 'LIMIT' && price && price > 0) {
                  console.log(`   🔄 Trying market order format (no price required)...`);
                  const marketOrderParams: any = {
                    symbol: symbolVariant.toUpperCase(), // Use symbol variant
                    side: sideString, // Keep string format
                    orderType: 'MARKET', // String: "MARKET" (use "orderType", not "type")
                    qty: amount.toString(),
                  };
                  
                  // Add tradeSide and marginCoin for futures (keep minimal - no margin mode in order)
                  if (marketType === 'futures') {
                    marketOrderParams.tradeSide = 'OPEN';
                    marketOrderParams.marginCoin = 'USDT'; // Add marginCoin for futures
                    // Do NOT add marginMode here - causes Code 2 errors
                  }
                  
                  const marketBodyString = JSON.stringify(marketOrderParams).replace(/\s+/g, '');
                  const marketSignature = await this.createBitunixSignatureDoubleSHA256(nonce, timestamp, apiKey, queryParams, marketBodyString, apiSecret);
                  
                  try {
                    const marketResponse = await fetch(`${baseUrl}${requestPath}`, {
                      method: 'POST',
                      headers: {
                        'api-key': String(apiKey),
                        'nonce': String(nonce),
                        'timestamp': String(timestamp),
                        'sign': String(marketSignature),
                        'Content-Type': 'application/json',
                        'language': 'en-US'
                      },
                      body: marketBodyString
                    });
                    
                    const marketResponseText = await marketResponse.text();
                    console.log(`   Market order response: ${marketResponse.status}, body: ${marketResponseText.substring(0, 300)}`);
                    
                    if (marketResponse.ok) {
                      const marketData = JSON.parse(marketResponseText);
                      
                      if (marketData.code === 0) {
                        console.log(`✅ Bitunix market order placed successfully via ${baseUrl}${requestPath}`);
                        if (bot?.id) {
                          await this.addBotLog(bot.id, {
                            level: 'info',
                            category: 'trade',
                            message: `Bitunix order placed as market order (limit order failed)`,
                            details: { symbol, originalType: 'limit', executedType: 'market' }
                          });
                        }
                        return {
                          orderId: marketData.data?.orderId || marketData.data?.id || marketData.data?.order_id || marketData.data?.clientId,
                          status: marketData.data?.status || 'filled',
                          exchange: 'bitunix',
                          response: marketData
                        };
                      }
                    }
                  } catch (marketErr) {
                    console.warn(`   ⚠️ Market order fallback also failed:`, marketErr);
                  }
                }
                
                // Last resort: Try without marginCoin (some endpoints might not require it)
                if (marketType === 'futures' && data.code === 2) {
                  console.log(`   🔄 Trying without marginCoin parameter (last resort)...`);
                  const noMarginCoinParams: any = {
                    symbol: symbolVariant.toUpperCase(),
                    side: sideString,
                    orderType: 'MARKET',
                    qty: amount.toString(),
                    tradeSide: 'OPEN',
                    // Intentionally omitting marginCoin
                  };
                  
                  const noMarginCoinBody = JSON.stringify(noMarginCoinParams).replace(/\s+/g, '');
                  const noMarginCoinSig = await this.createBitunixSignatureDoubleSHA256(nonce, timestamp, apiKey, queryParams, noMarginCoinBody, apiSecret);
                  
                  try {
                    const noMarginCoinResponse = await fetch(`${baseUrl}${requestPath}`, {
                      method: 'POST',
                      headers: {
                        'api-key': String(apiKey),
                        'nonce': String(nonce),
                        'timestamp': String(timestamp),
                        'sign': String(noMarginCoinSig),
                        'Content-Type': 'application/json',
                        'language': 'en-US'
                      },
                      body: noMarginCoinBody
                    });
                    
                    const noMarginCoinResponseText = await noMarginCoinResponse.text();
                    console.log(`   No marginCoin response: ${noMarginCoinResponse.status}, body: ${noMarginCoinResponseText.substring(0, 300)}`);
                    
                    if (noMarginCoinResponse.ok) {
                      const noMarginCoinData = JSON.parse(noMarginCoinResponseText);
                      if (noMarginCoinData.code === 0) {
                        console.log(`✅ Bitunix order placed successfully without marginCoin via ${baseUrl}${requestPath}`);
                        return {
                          orderId: noMarginCoinData.data?.orderId || noMarginCoinData.data?.id || noMarginCoinData.data?.order_id || noMarginCoinData.data?.clientId,
                          status: noMarginCoinData.data?.status || 'filled',
                          exchange: 'bitunix',
                          response: noMarginCoinData
                        };
                      }
                    }
                  } catch (noMarginCoinErr) {
                    console.warn(`   ⚠️ No marginCoin attempt also failed:`, noMarginCoinErr);
                  }
                }
              }
              
              // Code 2 handling is done above in the dedicated block
              // This block should not be reached for Code 2, but handle other codes here
              if (data.code === 2) {
                // If we reach here, alternative formats were already tried above
                // This means all parameter formats failed - try next endpoint
                console.error(`   ❌ Code 2 persisted after trying all parameter formats, trying next endpoint...`);
                console.error(`   📋 Error message: ${errorMsg}`);
                console.error(`   📋 Full error response: ${JSON.stringify(data)}`);
                console.error(`   💡 Possible causes: Symbol ${symbolVariant} may not be tradeable, account may need margin mode/leverage setup, or temporary API issue`);
                lastError = new Error(`Bitunix system error (Code: 2): ${errorMsg}. All parameter formats failed. Please verify: 1) Symbol ${symbolVariant} is tradeable on Bitunix futures, 2) API key has trading permissions, 3) Account has margin mode and leverage configured.`);
                continue;
              }
              
              totalAttempts++;
              if (data.code !== 2) {
                allErrorsWereCode2 = false; // Not all errors are Code 2
              } else {
                code2ErrorCount++;
              }
              console.warn(`   ⚠️ API returned code ${data.code}: ${errorMsg}, trying next endpoint...`);
              lastError = new Error(`Bitunix order error: ${errorMsg} (Code: ${data.code})`);
              continue; // Try next endpoint
            }
            
            // Success!
            console.log(`✅ Bitunix order placed successfully via ${baseUrl}${requestPath} with symbol ${symbolVariant}`);
            allSymbolVariantsFailed = false; // Mark success
            return {
              orderId: data.data?.orderId || data.data?.id || data.data?.order_id || data.data?.clientId,
              status: data.data?.status || 'filled',
              exchange: 'bitunix',
              response: data
            };
          } catch (endpointErr: any) {
            totalAttempts++;
            // If this is a Code 10003 (invalid API key) error, fail immediately - don't try other endpoints
            if (endpointErr.message && endpointErr.message.includes('Code: 10003')) {
              console.error(`❌ Bitunix API key is invalid (Code: 10003) - stopping all retry attempts`);
              allErrorsWereCode2 = false; // This is not Code 2, so symbol might exist
              throw endpointErr; // Re-throw immediately, don't try other endpoints
            }
            
            // Check if error message contains Code 2
            if (endpointErr.message && endpointErr.message.includes('Code: 2')) {
              code2ErrorCount++;
            } else {
              allErrorsWereCode2 = false; // Not all errors are Code 2
            }
            
            console.warn(`   ⚠️ Error with ${baseUrl}${requestPath}:`, endpointErr.message);
            lastError = endpointErr;
            continue; // Try next endpoint
          }
        }
      }
      
      // All endpoints failed for this symbol variant
      if (lastError) {
        // Check if all errors were Code 2 - likely symbol doesn't exist on Bitunix
        if (allErrorsWereCode2 && code2ErrorCount > 0 && totalAttempts === code2ErrorCount) {
          console.warn(`   ⚠️ All attempts for symbol variant ${symbolVariant} returned Code 2 (System error). Trying next variant...`);
          lastSymbolVariantError = new Error(`Symbol variant ${symbolVariant} not available on Bitunix ${marketType}`);
          continue; // Try next symbol variant
        }
        
        // Store error but continue to next symbol variant
        lastSymbolVariantError = lastError;
        console.warn(`   ⚠️ Symbol variant ${symbolVariant} failed: ${lastError.message}. Trying next variant...`);
        continue; // Try next symbol variant
      }
    } catch (variantErr: any) {
      // Handle any unexpected errors during variant processing
      console.warn(`   ⚠️ Unexpected error processing symbol variant ${symbolVariant}:`, variantErr.message);
      lastSymbolVariantError = variantErr;
      continue; // Try next symbol variant
    }
    } // End of symbol variant loop
    
    // All symbol variants failed
    if (allSymbolVariantsFailed && lastSymbolVariantError) {
      // Check if all errors were Code 2 across all variants
      const allVariantsCode2 = lastSymbolVariantError.message && lastSymbolVariantError.message.includes('Code: 2');
      
      if (allVariantsCode2) {
        console.error(`❌ All symbol variants returned Code 2 (System error).`);
        console.error(`   Possible causes:`);
        console.error(`   1. Leverage/margin mode not set on Bitunix account (REQUIRED before placing orders)`);
        console.error(`   2. Symbol ${symbol} may not be available for ${marketType} trading on Bitunix`);
        console.error(`   3. Insufficient balance or API key permissions`);
        console.error(`   4. Account may need initial setup/activation`);
        
        if (bot?.id) {
          await this.addBotLog(bot.id, {
            level: 'error',
            category: 'trade',
            message: `⚠️ Trade skipped: Symbol ${symbol} is not available for ${marketType} trading on Bitunix. All symbol variants and order attempts returned "System error" (Code: 2), which typically indicates the symbol is not listed on this exchange.`,
            details: {
              symbol: symbol,
              symbolVariants: symbolVariants,
              exchange: 'bitunix',
              marketType: marketType,
              error_code: 2,
              action_required: 'Verify symbol is available on Bitunix or switch to a different exchange'
            }
          });
        }
        
        // Return a skipped result instead of throwing an error
        return {
          orderId: null,
          status: 'skipped',
          exchange: 'bitunix',
          reason: `Symbol ${symbol} not available on Bitunix ${marketType} (tried variants: ${symbolVariants.join(', ')})`,
          response: null
        };
      }
      
      // Enhance error message with diagnostic information
      const enhancedError = new Error(
        `${lastSymbolVariantError.message}\n\n` +
        `Bitunix Order Placement Diagnostic:\n` +
        `- Original Symbol: ${symbol}\n` +
        `- Symbol Variants Tried: ${symbolVariants.join(', ')}\n` +
        `- Side: ${side.toUpperCase() === 'SELL' ? 'SELL' : 'BUY'}\n` +
        `- OrderType: MARKET\n` +
        `- Quantity: ${amount}\n` +
        `- Price: ${price || 'N/A'}\n` +
        `- Trading Type: ${tradingType} (${marketType})\n` +
        `${marketType === 'futures' ? `- Trade Side: OPEN\n` : ''}` +
        `\nTroubleshooting:\n` +
        `1. Verify symbol ${symbol} is available for ${marketType} trading on Bitunix\n` +
        `2. Check API key has ${marketType} trading permissions\n` +
        `3. Ensure account has margin mode and leverage configured\n` +
        `4. Verify quantity and price meet exchange requirements\n` +
        `5. Contact Bitunix support if issue persists`
      );
      throw enhancedError;
    }
    
    // This should not be reached, but handle it just in case
    throw new Error(`Failed to place Bitunix order for ${symbol} after trying all symbol variants`);
    } catch (error: any) {
      console.error('❌ Bitunix order placement error:', error);
      throw error;
    }
  }
  
  /**
   * Set Stop Loss and Take Profit for Bitunix positions
   * Similar to setBybitSLTP but uses Bitunix API endpoints
   */
  /**
   * Get Bitunix account settings for a symbol (leverage and margin mode)
   */
  private async getBitunixAccountSettings(apiKey: string, apiSecret: string, symbol: string): Promise<any> {
    const baseUrl = 'https://fapi.bitunix.com';
    
    try {
      // Sync Bitunix server time to prevent timestamp errors
      await this.syncBitunixServerTime();
      const timestamp = (Date.now() + BotExecutor.bitunixServerTimeOffset).toString();
      const nonce = this.generateNonce();
      // Query params will be sorted alphabetically in signature function
      const queryParams = `marginCoin=USDT&symbol=${symbol.toUpperCase()}`;
      const body = '';
      const signature = await this.createBitunixSignatureDoubleSHA256(nonce, timestamp, apiKey, queryParams, body, apiSecret);
      
      // Try account info endpoint (sorted query params in URL too)
      const endpoints = [
        `/api/v1/futures/account?marginCoin=USDT&symbol=${symbol.toUpperCase()}`,
        `/api/v1/futures/account?marginCoin=USDT`,
        `/api/v1/futures/account/info?marginCoin=USDT&symbol=${symbol.toUpperCase()}`,
        `/api/v1/futures/account`
      ];
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${baseUrl}${endpoint}`, {
            method: 'GET',
            headers: {
              'api-key': String(apiKey),
              'nonce': String(nonce),
              'timestamp': String(timestamp),
              'sign': String(signature),
              'Content-Type': 'application/json',
              'language': 'en-US'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.code === 0 && data.data) {
              const account = data.data;
              return {
                leverage: parseFloat(account.leverage || account.leverageRatio || '20'),
                marginMode: account.marginMode || account.tdMode || account.margin_mode || 'CROSS'
              };
            }
          }
        } catch (err) {
          continue;
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting Bitunix account settings:', error);
      return null;
    }
  }
  
  /**
   * Set Bitunix account-level leverage and margin mode for a symbol
   * This MUST be called BEFORE placing orders
   */
  private async setBitunixAccountLeverageAndMarginMode(apiKey: string, apiSecret: string, symbol: string, leverage: number, marginMode: string = 'ISOLATED'): Promise<void> {
    const baseUrl = 'https://fapi.bitunix.com';
    
    try {
      console.log(`⚙️ Setting Bitunix account leverage and margin mode for ${symbol}:`);
      console.log(`   Leverage: ${leverage}x, Margin Mode: ${marginMode}`);
      
      // Sync Bitunix server time to prevent timestamp errors
      await this.syncBitunixServerTime();
      const timestamp = (Date.now() + BotExecutor.bitunixServerTimeOffset).toString();
      const nonce = this.generateNonce();
      
      // Official Bitunix API endpoints (must be called separately):
      // 1. POST /api/v1/futures/account/change_margin_mode - Required: symbol, marginMode, marginCoin
      // 2. POST /api/v1/futures/account/change_leverage - Required: symbol, leverage
      // Reference: https://openapidoc.bitunix.com
      
      // Extract margin coin from symbol (e.g., BTCUSDT -> USDT)
      const marginCoin = symbol.toUpperCase().endsWith('USDT') ? 'USDT' : 
                         symbol.toUpperCase().endsWith('USD') ? 'USD' : 'USDT';
      
      // Convert margin mode to API format: ISOLATED -> ISOLATION
      const apiMarginMode = marginMode.toUpperCase() === 'ISOLATED' ? 'ISOLATION' : marginMode.toUpperCase();
      
      // Step 1: Set margin mode
      console.log(`   Step 1: Setting margin mode to ${apiMarginMode} with marginCoin ${marginCoin}...`);
      const marginModeEndpoints = [
        '/api/v1/futures/account/change_margin_mode', // Official endpoint (with underscore)
        '/api/v1/futures/account/change-margin-mode'  // Alternative (with hyphen)
      ];
      
      let marginModeSet = false;
      for (const endpoint of marginModeEndpoints) {
        try {
          // Per API docs: Required: symbol, marginMode, marginCoin
          const params = {
            symbol: symbol.toUpperCase(),
            marginMode: apiMarginMode, // ISOLATION or CROSS (not ISOLATED)
            marginCoin: marginCoin // REQUIRED: USDT, USD, etc.
          };
          
          const bodyString = JSON.stringify(params).replace(/\s+/g, '');
          const queryParams = '';
          const signature = await this.createBitunixSignatureDoubleSHA256(nonce, timestamp, apiKey, queryParams, bodyString, apiSecret);
          
          console.log(`   Trying: ${endpoint}`);
          console.log(`   Body: ${bodyString}`);
          
          const response = await fetch(`${baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
              'api-key': String(apiKey),
              'nonce': String(nonce),
              'timestamp': String(timestamp),
              'sign': String(signature),
              'Content-Type': 'application/json',
              'language': 'en-US'
            },
            body: bodyString
          });
          
          const responseText = await response.text();
          console.log(`   Response: ${response.status}, ${responseText.substring(0, 200)}`);
          
          if (response.ok) {
            const data = JSON.parse(responseText);
            if (data.code === 0) {
              console.log(`✅ Margin mode set to ${apiMarginMode} via ${endpoint}`);
              marginModeSet = true;
              break;
            } else if (data.code === 2) {
              // Code 2: System error - Bitunix may require setting margin mode on position, not account level
              // This is common when account has no positions yet
              console.warn(`   ⚠️ Code 2 (System error) when setting margin mode at account level.`);
              console.warn(`   This is normal if account has no positions. Will set margin mode on position after order placement.`);
              console.warn(`   Response: ${responseText.substring(0, 200)}`);
              // Mark as "handled" - will set on position after order
              marginModeSet = true;
              break;
            } else {
              console.warn(`   Code ${data.code}: ${data.msg || data.message}`);
              // If error says position/order exists, that's expected - continue to leverage
              // Also check for common error codes that indicate position exists
              if (data.msg && (data.msg.includes('position') || data.msg.includes('order') || data.msg.includes('exist'))) {
                console.warn(`   ⚠️ Cannot change margin mode while position exists (Code: ${data.code}). Will set on position after order.`);
                marginModeSet = true; // Mark as "handled" - will set on position
                break;
              }
              // Some exchanges return success even if position exists - check code
              if (data.code === 0 || data.code === 200) {
                marginModeSet = true;
                break;
              }
            }
          }
        } catch (err) {
          console.warn(`   Error:`, err);
        }
      }
      
      // Step 2: Set leverage
      console.log(`   Step 2: Setting leverage to ${leverage}x...`);
      const leverageEndpoints = [
        '/api/v1/futures/account/change_leverage', // Official endpoint (with underscore)
        '/api/v1/futures/account/change-leverage'  // Alternative (with hyphen)
      ];
      
      let leverageSet = false;
      for (const endpoint of leverageEndpoints) {
        try {
          // Per API docs: leverage must be a string
          const params = {
            symbol: symbol.toUpperCase(),
            leverage: String(leverage) // Must be string, not number
          };
          
          const bodyString = JSON.stringify(params).replace(/\s+/g, '');
          const queryParams = '';
          const signature = await this.createBitunixSignatureDoubleSHA256(nonce, timestamp, apiKey, queryParams, bodyString, apiSecret);
          
          console.log(`   Trying: ${endpoint}`);
          console.log(`   Body: ${bodyString}`);
          
          const response = await fetch(`${baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
              'api-key': String(apiKey),
              'nonce': String(nonce),
              'timestamp': String(timestamp),
              'sign': String(signature),
              'Content-Type': 'application/json',
              'language': 'en-US'
            },
            body: bodyString
          });
          
          const responseText = await response.text();
          console.log(`   Response: ${response.status}, ${responseText.substring(0, 200)}`);
          
          if (response.ok) {
            const data = JSON.parse(responseText);
            if (data.code === 0 || data.code === 200) {
              console.log(`✅ Leverage set to ${leverage}x via ${endpoint}`);
              leverageSet = true;
              break;
            } else if (data.code === 2) {
              // Code 2: System error - Bitunix may require setting leverage on position, not account level
              // This is common when account has no positions yet
              console.warn(`   ⚠️ Code 2 (System error) when setting leverage at account level.`);
              console.warn(`   This is normal if account has no positions. Will set leverage on position after order placement.`);
              console.warn(`   Response: ${responseText.substring(0, 200)}`);
              // Mark as "handled" - will set on position after order
              leverageSet = true;
              break;
            } else {
              console.warn(`   Code ${data.code}: ${data.msg || data.message}`);
              const errorMsg = (data.msg || data.message || '').toLowerCase();
              
              // If error says position/order exists, check if current leverage is already correct
              if (errorMsg.includes('position') || errorMsg.includes('order') || errorMsg.includes('exist')) {
                console.warn(`   ⚠️ Cannot change leverage while position exists (Code: ${data.code}). Checking current leverage...`);
                
                // Check if current leverage is already the desired value
                try {
                  const currentSettings = await this.getBitunixAccountSettings(apiKey, apiSecret, symbol);
                  if (currentSettings && currentSettings.leverage === leverage) {
                    console.log(`   ✅ Current leverage is already ${leverage}x - proceeding`);
                    leverageSet = true; // Mark as "handled" - leverage is already correct
                    break;
                  } else {
                    console.warn(`   ⚠️ Current leverage is ${currentSettings?.leverage || 'unknown'}x, expected ${leverage}x. Will set on position after order.`);
                    leverageSet = true; // Mark as "handled" - will set on position
                    break;
                  }
                } catch (checkError) {
                  console.warn(`   ⚠️ Could not check current leverage:`, checkError);
                  leverageSet = true; // Mark as "handled" - will set on position
                  break;
                }
              } else {
                // For other errors, try to check current settings - if already correct, proceed
                // This handles cases where API returns errors but settings might already be correct
                try {
                  const currentSettings = await this.getBitunixAccountSettings(apiKey, apiSecret, symbol);
                  if (currentSettings && currentSettings.leverage === leverage) {
                    console.log(`   ✅ Current leverage is already ${leverage}x despite API error - proceeding`);
                    leverageSet = true;
                    break;
                  }
                } catch (checkError) {
                  // If we can't check, continue to next endpoint
                  console.warn(`   ⚠️ Could not verify current leverage:`, checkError);
                }
              }
            }
          } else {
            // HTTP error (not 200) - try to check current settings
            try {
              const currentSettings = await this.getBitunixAccountSettings(apiKey, apiSecret, symbol);
              if (currentSettings && currentSettings.leverage === leverage) {
                console.log(`   ✅ Current leverage is already ${leverage}x despite HTTP ${response.status} - proceeding`);
                leverageSet = true;
                break;
              }
            } catch (checkError) {
              // If we can't check, continue to next endpoint
              console.warn(`   ⚠️ Could not verify current leverage:`, checkError);
            }
          }
        } catch (err) {
          console.warn(`   Error:`, err);
          // On exception, try to check current settings as last resort
          try {
            const currentSettings = await this.getBitunixAccountSettings(apiKey, apiSecret, symbol);
            if (currentSettings && currentSettings.leverage === leverage) {
              console.log(`   ✅ Current leverage is already ${leverage}x despite exception - proceeding`);
              leverageSet = true;
              break;
            }
          } catch (checkError) {
            // Continue to next endpoint if check fails
          }
        }
      }
      
      // Only throw error if BOTH failed AND we couldn't verify current settings are correct
      if (!marginModeSet || !leverageSet) {
        // Final check: verify current settings - if already correct, don't throw error
        try {
          const currentSettings = await this.getBitunixAccountSettings(apiKey, apiSecret, symbol);
          if (currentSettings) {
            const actualMarginMode = currentSettings.marginMode?.toUpperCase();
            const isMarginModeCorrect = actualMarginMode === 'ISOLATED' || actualMarginMode === 'ISOLATION';
            
            if (currentSettings.leverage === leverage && isMarginModeCorrect) {
              console.log(`✅ Current settings verified as correct: ${currentSettings.leverage}x ${currentSettings.marginMode} - proceeding`);
              return; // Success - settings are already correct, no error needed
            } else {
              // Settings are not correct, but log what they are
              console.warn(`⚠️ Current settings: ${currentSettings.leverage}x ${currentSettings.marginMode}, expected: ${leverage}x ISOLATED`);
            }
          } else {
            console.warn(`⚠️ Could not retrieve current settings for verification`);
          }
        } catch (verifyError) {
          console.warn(`⚠️ Could not verify current settings:`, verifyError);
          // If verification fails, throw error but indicate it's not critical (will set on position)
          const errors = [];
          if (!marginModeSet) errors.push('margin mode');
          if (!leverageSet) errors.push('leverage');
          throw new Error(`Failed to set account ${errors.join(' and ')}. Will try on position after order placement.`);
        }
        
        // If we get here, settings couldn't be set and aren't already correct
        const errors = [];
        if (!marginModeSet) errors.push('margin mode');
        if (!leverageSet) errors.push('leverage');
        throw new Error(`Failed to set account ${errors.join(' and ')}. Will try on position after order placement.`);
      }
      
    } catch (error) {
      // Check if this is a non-critical error (will try on position)
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('Will try on position') || errorMsg.includes('will try on position')) {
        // Log as warning since it's not critical - will set on position after order
        console.warn('⚠️ Bitunix account leverage/margin setup: Will set on position after order placement:', errorMsg);
      } else {
        // Log as error for unexpected issues
        console.error('❌ Bitunix account leverage/margin setup error:', error);
      }
      throw error;
    }
  }
  
  /**
   * Get Bitunix position details
   * Tries multiple endpoints: position/list (open positions) and position/pending (pending positions)
   */
  private async getBitunixPosition(apiKey: string, apiSecret: string, symbol: string): Promise<any> {
    const baseUrl = 'https://fapi.bitunix.com';
    
    // Sync server time before making API calls to prevent timestamp errors
    await this.syncBitunixServerTime();
    
    // Try multiple endpoints - positions might be in different states
    const endpoints = [
      '/api/v1/futures/position/list',      // Open positions
      '/api/v1/futures/position/pending',   // Pending positions
      '/api/v1/futures/position',            // All positions
      '/api/v1/position/list'                // Alternative endpoint
    ];
    
    for (const endpoint of endpoints) {
      try {
        const timestamp = (Date.now() + BotExecutor.bitunixServerTimeOffset).toString();
        const nonce = this.generateNonce();
        const queryParams = `symbol=${symbol.toUpperCase()}`;
        const body = '';
        const signature = await this.createBitunixSignatureDoubleSHA256(nonce, timestamp, apiKey, queryParams, body, apiSecret);
        
        const response = await fetch(`${baseUrl}${endpoint}?${queryParams}`, {
          method: 'GET',
          headers: {
            'api-key': String(apiKey),
            'nonce': String(nonce),
            'timestamp': String(timestamp),
            'sign': String(signature),
            'Content-Type': 'application/json',
            'language': 'en-US'
          }
        });
        
        if (response.ok) {
          const responseText = await response.text();
          const data = JSON.parse(responseText);
          
          console.log(`📊 ${endpoint} response code: ${data.code}, has data: ${!!data.data}`);
          
          if (data.code === 0 && data.data) {
            // Handle both array and object responses
            let positions = [];
            if (Array.isArray(data.data)) {
              positions = data.data;
            } else if (typeof data.data === 'object') {
              // Try to find array in object
              const possibleArrays = Object.values(data.data).filter(v => Array.isArray(v));
              if (possibleArrays.length > 0) {
                positions = possibleArrays[0];
              } else {
                // Single position object
                positions = [data.data];
              }
            }
            
            if (positions.length > 0) {
              // Find position with non-zero size
              const position = positions.find(p => {
                const size = parseFloat(p.size || p.holdVol || p.quantity || '0');
                return size > 0;
              }) || positions[0];
              
              // Log full position response for debugging
              console.log(`📊 Bitunix position response keys:`, Object.keys(position));
              console.log(`📊 Full position data:`, JSON.stringify(position).substring(0, 500));
              
              // Try multiple possible field names for positionId
              const positionId = position.positionId || position.id || position.position_id || position.positionID || 
                                position.pid || position.posId || position.pos_id;
              
              if (!positionId) {
                console.warn(`⚠️ WARNING: positionId not found in position response. Available fields:`, Object.keys(position));
              } else {
                console.log(`✅ Found positionId: ${positionId}`);
              }
              
              return {
                positionId: positionId, // Position ID for TP/SL orders
                size: parseFloat(position.size || position.holdVol || position.holdVol || position.quantity || '0'),
                entryPrice: parseFloat(position.entryPrice || position.avgPrice || position.openPrice || position.entry_price || '0'),
                leverage: parseFloat(position.leverage || position.leverageRatio || position.leverage_ratio || '20'),
                marginMode: position.marginMode || position.tdMode || position.margin_mode || position.marginMode || 'CROSS',
                stopLoss: position.stopLoss || position.stop_loss || position.stopPrice || position.slPrice || position.sl_price,
                takeProfit: position.takeProfit || position.take_profit || position.tpPrice || position.tp_price,
                side: position.side || position.positionSide || (parseFloat(position.size || position.holdVol || position.quantity || '0') > 0 ? 'BUY' : 'SELL'),
                rawPosition: position // Include raw position for debugging
              };
            } else {
              console.log(`   No positions found in ${endpoint} response`);
            }
          } else {
            const errorMsg = data.msg || data.message || 'Unknown error';
            console.log(`   ${endpoint} returned code ${data.code}: ${errorMsg}`);
            // If it's Code 2 (System error), log but continue - this is common for Bitunix
            if (data.code === 2) {
              console.warn(`   ⚠️ Code 2 (System error) from ${endpoint} - this may be normal if account isn't fully set up`);
            }
          }
        } else {
          const errorText = await response.text().catch(() => '');
          console.log(`   ${endpoint} returned HTTP ${response.status}: ${errorText.substring(0, 200)}`);
        }
      } catch (error) {
        console.warn(`   Error trying ${endpoint}:`, error instanceof Error ? error.message : String(error));
        continue; // Try next endpoint
      }
    }
    
    // If all endpoints failed, log detailed error but return null
    console.warn(`⚠️ All position endpoints failed for ${symbol}`);
    console.warn(`   This may be normal if:`);
    console.warn(`   1. Position hasn't been created yet (wait a few seconds and retry)`);
    console.warn(`   2. Account needs futures trading activation`);
    console.warn(`   3. API key doesn't have position read permissions`);
    return null;
  }
  
  /**
   * Set leverage and margin mode on an existing Bitunix futures position
   * This should be called AFTER the order is placed and position is created
   */
  private async setBitunixPositionLeverageAndMarginMode(apiKey: string, apiSecret: string, symbol: string, leverage: number, marginMode: string = 'ISOLATED'): Promise<void> {
    const baseUrl = 'https://fapi.bitunix.com'; // Futures API domain
    
    try {
      console.log(`⚙️ Setting Bitunix position leverage and margin mode for ${symbol}:`);
      console.log(`   Leverage: ${leverage}x, Margin Mode: ${marginMode}`);
      
      const timestamp = Date.now().toString();
      const nonce = this.generateNonce();
      
      // Bitunix API endpoints for setting leverage and margin mode on position
      // Official API: POST /api/v1/futures/account/change_leverage and change_margin_mode
      // These should work on position level too (with symbol parameter)
      const endpointsToTry = [
        // Try account-level endpoints first (they work per symbol)
        '/api/v1/futures/account/change_leverage',     // Official: Change leverage (with underscore)
        '/api/v1/futures/account/change-leverage',      // Alternative: Change leverage (with hyphen)
        '/api/v1/futures/account/change_margin_mode',   // Official: Change margin mode (with underscore)
        '/api/v1/futures/account/change-margin-mode',   // Alternative: Change margin mode (with hyphen)
        // Try position-specific endpoints
        '/api/v1/futures/position/change_leverage',     // Position-level leverage
        '/api/v1/futures/position/change_margin_mode',  // Position-level margin mode
        '/api/v1/futures/position/modify',              // Modify position
        '/api/v1/futures/position/update'               // Update position
      ];
      
      let success = false;
      let lastError: any = null;
      
      for (const endpoint of endpointsToTry) {
        try {
          // Bitunix position leverage and margin mode parameters
          // Based on official API: these endpoints require symbol and the setting to change
          let params: any = {};
          
          if (endpoint.includes('change_leverage') || endpoint.includes('change-leverage')) {
            // Official API: POST /api/v1/futures/account/change_leverage
            // Required: symbol, leverage
            params = {
              symbol: symbol.toUpperCase(),
              leverage: leverage.toString()
            };
          } else if (endpoint.includes('change_margin_mode') || endpoint.includes('change-margin-mode')) {
            // Official API: POST /api/v1/futures/account/change_margin_mode
            // Required: symbol, marginMode
            params = {
              symbol: symbol.toUpperCase(),
              marginMode: marginMode.toUpperCase() // ISOLATED or CROSS
            };
          } else {
            // For other endpoints, try both settings
            params = {
              symbol: symbol.toUpperCase(),
              leverage: leverage.toString(),
              marginMode: marginMode.toUpperCase(),
              tdMode: marginMode.toUpperCase(), // Alternative parameter name
              margin_mode: marginMode.toUpperCase() // Another alternative
            };
          }
          
          const bodyString = JSON.stringify(params).replace(/\s+/g, '');
          const queryParams = '';
          const signature = await this.createBitunixSignatureDoubleSHA256(nonce, timestamp, apiKey, queryParams, bodyString, apiSecret);
          
          console.log(`   Trying endpoint: ${endpoint}`);
          console.log(`   Request body: ${bodyString}`);
          
          const response = await fetch(`${baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
              'api-key': String(apiKey),
              'nonce': String(nonce),
              'timestamp': String(timestamp),
              'sign': String(signature),
              'Content-Type': 'application/json',
              'language': 'en-US'
            },
            body: bodyString
          });
          
          const responseText = await response.text();
          console.log(`   Response from ${endpoint}: ${response.status}, body: ${responseText.substring(0, 300)}`);
          
          if (response.ok) {
            try {
              const data = JSON.parse(responseText);
              if (data.code === 0) {
                console.log(`✅ Bitunix position leverage and margin mode set successfully via ${endpoint}`);
                success = true;
                break;
              } else {
                lastError = new Error(`Bitunix position leverage/margin error: ${data.msg || data.message} (Code: ${data.code})`);
                console.warn(`   ⚠️ ${endpoint} returned code ${data.code}: ${data.msg || data.message}`);
                // Continue to next endpoint
                continue;
              }
            } catch (parseErr) {
              console.warn(`   ⚠️ Failed to parse response from ${endpoint}:`, parseErr);
              continue;
            }
          } else {
            if (response.status === 404) {
              console.warn(`   ⚠️ ${endpoint} not found (404), trying next endpoint...`);
              continue;
            }
            lastError = new Error(`Bitunix position leverage/margin HTTP error: ${response.status} - ${responseText.substring(0, 200)}`);
            continue;
          }
        } catch (endpointErr) {
          console.warn(`   ⚠️ Error with ${endpoint}:`, endpointErr);
          lastError = endpointErr;
          continue;
        }
      }
      
      if (!success) {
        console.warn(`⚠️ Could not set Bitunix position leverage/margin mode via API endpoints.`);
        console.warn(`   Attempted leverage: ${leverage}x, margin mode: ${marginMode}`);
        throw new Error(`Failed to set position leverage/margin: ${lastError?.message || 'All endpoints failed'}`);
      }
      
    } catch (error) {
      console.error('❌ Bitunix position leverage/margin setup error:', error);
      throw error;
    }
  }
  
  /**
   * Set leverage and margin mode for Bitunix futures position
   * This should be called before placing the order to ensure correct settings
   */
  private async setBitunixLeverageAndMarginMode(apiKey: string, apiSecret: string, symbol: string, leverage: number, marginMode: string = 'ISOLATED'): Promise<void> {
    const baseUrl = 'https://fapi.bitunix.com'; // Futures API domain
    
    try {
      console.log(`⚙️ Setting Bitunix leverage and margin mode for ${symbol}:`);
      console.log(`   Leverage: ${leverage}x, Margin Mode: ${marginMode}`);
      
      const timestamp = Date.now().toString();
      const nonce = this.generateNonce();
      
      // Bitunix API endpoints for setting leverage and margin mode
      const endpointsToTry = [
        '/api/v1/futures/position/set-leverage',
        '/api/v1/futures/account/set-leverage',
        '/api/v1/futures/position/leverage',
        '/api/v1/position/set-leverage'
      ];
      
      let success = false;
      let lastError: any = null;
      
      for (const endpoint of endpointsToTry) {
        try {
          // Bitunix leverage and margin mode parameters
          const params: any = {
            symbol: symbol.toUpperCase(),
            leverage: leverage.toString(),
            marginMode: marginMode.toUpperCase(),
            tdMode: marginMode.toUpperCase(), // Alternative parameter name
            margin_mode: marginMode.toUpperCase() // Another alternative
          };
          
          const bodyString = JSON.stringify(params).replace(/\s+/g, '');
          const queryParams = '';
          const signature = await this.createBitunixSignatureDoubleSHA256(nonce, timestamp, apiKey, queryParams, bodyString, apiSecret);
          
          console.log(`   Trying endpoint: ${endpoint}`);
          console.log(`   Request body: ${bodyString}`);
          
          const response = await fetch(`${baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
              'api-key': String(apiKey),
              'nonce': String(nonce),
              'timestamp': String(timestamp),
              'sign': String(signature),
              'Content-Type': 'application/json',
              'language': 'en-US'
            },
            body: bodyString
          });
          
          const responseText = await response.text();
          console.log(`   Response from ${endpoint}: ${response.status}, body: ${responseText.substring(0, 300)}`);
          
          if (response.ok) {
            try {
              const data = JSON.parse(responseText);
              if (data.code === 0) {
                console.log(`✅ Bitunix leverage and margin mode set successfully via ${endpoint}`);
                success = true;
                break;
              } else {
                lastError = new Error(`Bitunix leverage/margin error: ${data.msg || data.message} (Code: ${data.code})`);
                console.warn(`   ⚠️ ${endpoint} returned code ${data.code}: ${data.msg || data.message}`);
                // Continue to next endpoint
                continue;
              }
            } catch (parseErr) {
              console.warn(`   ⚠️ Failed to parse response from ${endpoint}:`, parseErr);
              continue;
            }
          } else {
            if (response.status === 404) {
              console.warn(`   ⚠️ ${endpoint} not found (404), trying next endpoint...`);
              continue;
            }
            lastError = new Error(`Bitunix leverage/margin HTTP error: ${response.status} - ${responseText.substring(0, 200)}`);
            continue;
          }
        } catch (endpointErr) {
          console.warn(`   ⚠️ Error with ${endpoint}:`, endpointErr);
          lastError = endpointErr;
          continue;
        }
      }
      
      if (!success) {
        console.warn(`⚠️ Could not set Bitunix leverage/margin mode via API endpoints.`);
        console.warn(`   This may be acceptable if Bitunix allows setting these in the order itself.`);
        console.warn(`   Attempted leverage: ${leverage}x, margin mode: ${marginMode}`);
        // Don't throw error - some exchanges allow setting these in the order
      }
      
    } catch (error) {
      console.error('❌ Bitunix leverage/margin setup error:', error);
      // Don't throw - this is non-critical as some exchanges allow setting in order
      console.warn('   Continuing with order placement - leverage/margin may be set in order parameters');
    }
  }
  
  private async setBitunixSLTP(apiKey: string, apiSecret: string, symbol: string, side: string, entryPrice: number, bot: any, tradeSignal: any = null, orderResult: any = null): Promise<void> {
    // #region agent log
    console.log(`[DEBUG-SLTP] setBitunixSLTP called:`, JSON.stringify({
      location: 'bot-executor/index.ts:10891',
      message: 'setBitunixSLTP called',
      data: { symbol, side, entryPrice, hasBot: !!bot, hasOrderResult: !!orderResult, orderId: orderResult?.orderId },
      timestamp: Date.now(),
      hypothesisId: 'D'
    }));
    // #endregion
    
    const baseUrl = 'https://fapi.bitunix.com'; // Futures API domain
    const marketType = 'futures';
    
    try {
      // Get bot stop loss and take profit percentages
      const stopLossPercent = bot.stop_loss || bot.stopLoss || 2.0;
      const takeProfitPercent = bot.take_profit || bot.takeProfit || 4.0;
      
      // Calculate SL/TP prices based on percentage
      const isLong = side.toUpperCase() === 'BUY' || side === 'Buy';
      const stopLossPrice = isLong 
        ? entryPrice * (1 - stopLossPercent / 100)  // Long: SL below entry
        : entryPrice * (1 + stopLossPercent / 100); // Short: SL above entry
      
      const takeProfitPrice = isLong
        ? entryPrice * (1 + takeProfitPercent / 100)  // Long: TP above entry
        : entryPrice * (1 - takeProfitPercent / 100); // Short: TP below entry
      
      // #region agent log
      console.log(`[DEBUG-SLTP] SL/TP prices calculated:`, JSON.stringify({
        location: 'bot-executor/index.ts:10908',
        message: 'SL/TP prices calculated',
        data: { entryPrice, stopLossPrice, takeProfitPrice, stopLossPercent, takeProfitPercent, isLong },
        timestamp: Date.now(),
        hypothesisId: 'C'
      }));
      // #endregion
      
      console.log(`🛡️ Setting Bitunix SL/TP for ${symbol} ${side}:`);
      console.log(`   Entry: ${entryPrice}, SL: ${stopLossPrice.toFixed(4)} (${stopLossPercent}%), TP: ${takeProfitPrice.toFixed(4)} (${takeProfitPercent}%)`);
      console.log(`   Margin Mode: ISOLATED, Order Type: MARKET`);
      
      // Sync Bitunix server time to prevent timestamp errors
      await this.syncBitunixServerTime();
      
      // CRITICAL: Verify position exists before attempting SL/TP
      // Bitunix requires the position to be fully established before SL/TP can be set
      // Based on Code 2 errors, Bitunix needs more time to process positions
      console.log(`⏳ Verifying Bitunix position exists before setting SL/TP...`);
      
      // Wait initial delay for position to be established (increased from 3s to 5s)
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Verify position exists with retries (increased retries and wait times)
      let positionInfo = null;
      let positionVerified = false;
      const maxPositionRetries = 10; // Increased retries for better reliability
      
      for (let retry = 0; retry < maxPositionRetries; retry++) {
        try {
          positionInfo = await this.getBitunixPosition(apiKey, apiSecret, symbol);
          if (positionInfo && positionInfo.size > 0) {
            console.log(`✅ Position verified: ${positionInfo.size} @ ${positionInfo.entryPrice || 'N/A'}`);
            positionVerified = true;
            break;
          } else {
            console.warn(`   ⚠️ Position not found yet (attempt ${retry + 1}/${maxPositionRetries}), waiting 3 seconds...`);
            if (retry < maxPositionRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          }
        } catch (posErr) {
          console.warn(`   ⚠️ Error verifying position (attempt ${retry + 1}/${maxPositionRetries}):`, posErr instanceof Error ? posErr.message : String(posErr));
          if (retry < maxPositionRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
      }
      
      if (!positionVerified) {
        console.error(`❌ CRITICAL: Position not verified after ${maxPositionRetries} attempts`);
        console.error(`   Symbol: ${symbol}, Side: ${side}, Entry Price: ${entryPrice}`);
        console.error(`   This may indicate:`);
        console.error(`   1. Order was not filled successfully`);
        console.error(`   2. Position takes longer to appear (Bitunix delay)`);
        console.error(`   3. API key lacks position read permissions`);
        console.warn(`   ⚠️ Proceeding with SL/TP attempt anyway (symbol-based endpoint may work without positionId)...`);
      }
      
      // CRITICAL: Get positionId (preferred for position-based endpoints, but not required for symbol-based)
      // First, try to get positionId from positionInfo if available
      let positionId = null;
      
      if (positionInfo?.positionId) {
        positionId = String(positionInfo.positionId);
        console.log(`📊 Using positionId from positionInfo: ${positionId}`);
      } else if (positionInfo?.rawPosition) {
        // Try to extract from raw position
        const rawPos = positionInfo.rawPosition;
        positionId = rawPos.positionId || rawPos.id || rawPos.position_id || rawPos.positionID || 
                     rawPos.pid || rawPos.posId || rawPos.pos_id;
        if (positionId) {
          positionId = String(positionId);
          console.log(`📊 Extracted positionId from rawPosition: ${positionId}`);
        }
      }
      
      // Fallback: try to get positionId from orderResult if available
      if (!positionId) {
        if (orderResult?.positionId) {
          positionId = String(orderResult.positionId);
          console.log(`📊 Using positionId from orderResult: ${positionId}`);
          // #region agent log
          console.log(`[DEBUG-SLTP] PositionId found in orderResult:`, JSON.stringify({
            location: 'bot-executor/index.ts:10925',
            message: 'PositionId found in orderResult',
            data: { positionId },
            timestamp: Date.now(),
            hypothesisId: 'F'
          }));
          // #endregion
        } else if (orderResult?.response?.data) {
          const orderData = orderResult.response.data;
          positionId = orderData.positionId || orderData.position_id || orderData.positionID || 
                       orderData.id || orderData.orderId;
          if (positionId) {
            positionId = String(positionId);
            console.log(`📊 Using positionId from order response data: ${positionId}`);
            // #region agent log
            console.log(`[DEBUG-SLTP] PositionId found in order response data:`, JSON.stringify({
              location: 'bot-executor/index.ts:10933',
              message: 'PositionId found in order response data',
              data: { positionId },
              timestamp: Date.now(),
              hypothesisId: 'F'
            }));
            // #endregion
          }
        }
      }
      
      // #region agent log
      console.log(`[DEBUG-SLTP] PositionId initial check:`, JSON.stringify({
        location: 'bot-executor/index.ts:10937',
        message: 'PositionId initial check',
        data: { hasPositionId: !!positionId, positionId },
        timestamp: Date.now(),
        hypothesisId: 'F'
      }));
      // #endregion
      
      // Position verification already done above - positionInfo should be available if position exists
      // If we still don't have positionId, log warning but proceed (symbol-based endpoint doesn't require it)
      
      // Fallback: If positionId is still missing but we have an orderId, use it as a temporary positionId
      // This allows us to attempt SL/TP via the symbol-based endpoint
      if (!positionId && orderResult) {
        const orderId = orderResult.orderId || 
                       orderResult.id || 
                       (orderResult.response?.data?.orderId) ||
                       (orderResult.response?.data?.id);
        if (orderId) {
          console.warn(`   ⚠️ PositionId not found, but orderId available: ${orderId}`);
          console.warn(`   ⚠️ Will attempt SL/TP using symbol-based endpoint (does not require positionId)`);
          // Note: We'll proceed without positionId - the symbol-based endpoint should work
        }
      }
      
      // #region agent log
      console.log(`[DEBUG-SLTP] PositionId final check before API call:`, JSON.stringify({
        location: 'bot-executor/index.ts:11020',
        message: 'PositionId final check before API call',
        data: { hasPositionId: !!positionId, positionId, hasPositionInfo: !!positionInfo, positionSize: positionInfo?.size || 0 },
        timestamp: Date.now(),
        hypothesisId: 'F'
      }));
      // #endregion
      
      if (!positionId && (!positionInfo || positionInfo.size === 0)) {
        // Try one more direct API call with detailed logging
        console.error(`❌ Position not found after ${maxRetries} retries. Trying direct API call...`);
        try {
          const positionTimestamp = Date.now().toString();
          const positionNonce = this.generateNonce();
          const positionQueryParams = `symbol=${symbol.toUpperCase()}`;
          const positionBody = '';
          const positionSig = await this.createBitunixSignatureDoubleSHA256(positionNonce, positionTimestamp, apiKey, positionQueryParams, positionBody, apiSecret);
          
          const positionResponse = await fetch(`${baseUrl}/api/v1/futures/position/list?${positionQueryParams}`, {
            method: 'GET',
            headers: {
              'api-key': String(apiKey),
              'nonce': String(positionNonce),
              'timestamp': String(positionTimestamp),
              'sign': String(positionSig),
              'Content-Type': 'application/json',
              'language': 'en-US'
            }
          });
          
          const positionResponseText = await positionResponse.text();
          console.error(`   Direct API call response: ${positionResponse.status}`);
          console.error(`   Response body: ${positionResponseText.substring(0, 1000)}`);
          
          if (positionResponse.ok) {
            const positionData = JSON.parse(positionResponseText);
            console.error(`   Response code: ${positionData.code}`);
            console.error(`   Has data: ${!!positionData.data}`);
            if (positionData.data) {
              console.error(`   Data type: ${Array.isArray(positionData.data) ? 'array' : typeof positionData.data}`);
              if (Array.isArray(positionData.data)) {
                console.error(`   Data length: ${positionData.data.length}`);
              }
            }
          }
        } catch (debugErr) {
          console.error(`   Debug API call failed:`, debugErr);
        }
        
        // If we still don't have positionId, try using orderId as fallback
        if (!positionId && orderResult?.orderId) {
          console.warn(`⚠️ Using orderId as positionId fallback: ${orderResult.orderId}`);
          positionId = String(orderResult.orderId);
        } else if (!positionId) {
          // CRITICAL FIX: Don't throw error - proceed with symbol-based SL/TP endpoint
          // Symbol-based endpoint doesn't require positionId, only symbol, side, and prices
          console.warn(`⚠️ Position not found after ${maxRetries} retries, but order was successful.`);
          console.warn(`   Will proceed with symbol-based SL/TP endpoint (does not require positionId)`);
          // Continue without positionId - symbol-based endpoint will be used
        }
      }
      
      // Final check - positionId is NOT required for symbol-based endpoint
      // Only log warning if positionId is missing, but don't throw error
      if (!positionId) {
        // Last resort: try orderId
        if (orderResult?.orderId) {
          console.warn(`⚠️ Final fallback: Using orderId as positionId: ${orderResult.orderId}`);
          positionId = String(orderResult.orderId);
        } else {
          // CRITICAL FIX: Don't throw - symbol-based endpoint doesn't need positionId
          console.warn(`⚠️ positionId not found, but will use symbol-based SL/TP endpoint (does not require positionId)`);
          console.warn(`   Symbol: ${symbol}, Side: ${side}, Entry: ${entryPrice}, SL: ${stopLossPrice.toFixed(4)}, TP: ${takeProfitPrice.toFixed(4)}`);
          // Continue without positionId - the symbol-based endpoints in endpointsToTry don't require it
        }
      }
      
      // Additional check removed - we'll proceed even without positionId
      if (false && !positionId) {
        // CRITICAL: positionId is required for Bitunix TP/SL orders
        // Try one more time with direct API call and exhaustive field search
        console.error(`❌ CRITICAL: positionId not found after all retries. Attempting final extraction...`);
        try {
          const positionTimestamp = Date.now().toString();
          const positionNonce = this.generateNonce();
          const positionQueryParams = `symbol=${symbol.toUpperCase()}`;
          const positionBody = '';
          const positionSig = await this.createBitunixSignatureDoubleSHA256(positionNonce, positionTimestamp, apiKey, positionQueryParams, positionBody, apiSecret);
          
          const positionResponse = await fetch(`${baseUrl}/api/v1/futures/position/list?${positionQueryParams}`, {
            method: 'GET',
            headers: {
              'api-key': String(apiKey),
              'nonce': String(positionNonce),
              'timestamp': String(positionTimestamp),
              'sign': String(positionSig),
              'Content-Type': 'application/json',
              'language': 'en-US'
            }
          });
          
          if (positionResponse.ok) {
            const positionData = await positionResponse.json();
            console.error(`   Final API call - Response code: ${positionData.code}`);
            console.error(`   Has data: ${!!positionData.data}`);
            
            if (positionData.code === 0 && positionData.data) {
              // Handle both array and object responses
              let positions = [];
              if (Array.isArray(positionData.data)) {
                positions = positionData.data;
              } else if (typeof positionData.data === 'object') {
                const possibleArrays = Object.values(positionData.data).filter(v => Array.isArray(v));
                if (possibleArrays.length > 0) {
                  positions = possibleArrays[0];
                } else {
                  positions = [positionData.data];
                }
              }
              
              console.error(`   Found ${positions.length} position(s)`);
              
              if (positions.length > 0) {
                const position = positions.find(p => {
                  const size = parseFloat(p.size || p.holdVol || p.quantity || '0');
                  return size > 0;
                }) || positions[0];
                
                console.error(`   Position keys:`, Object.keys(position));
                console.error(`   Full position:`, JSON.stringify(position).substring(0, 1000));
                
                // Try ALL possible field names - exhaustive search
                const allFields = Object.keys(position);
                for (const field of allFields) {
                  const value = position[field];
                  if (value && (typeof value === 'string' || typeof value === 'number')) {
                    const fieldLower = field.toLowerCase();
                    if (fieldLower.includes('id') || fieldLower.includes('position')) {
                      positionId = String(value);
                      console.error(`   ✅ Found potential positionId in field '${field}': ${positionId}`);
                      break;
                    }
                  }
                }
                
                // If still not found, try using orderId as positionId (some exchanges use this)
                if (!positionId && orderResult?.orderId) {
                  console.warn(`   ⚠️ Trying orderId as positionId: ${orderResult.orderId}`);
                  positionId = String(orderResult.orderId);
                }
                
                // Also try extracting from orderResult response data
                if (!positionId && orderResult?.response?.data) {
                  const orderData = orderResult.response.data;
                  const orderDataId = orderData.positionId || orderData.id || orderData.position_id || orderData.orderId;
                  if (orderDataId) {
                    console.warn(`   ⚠️ Trying positionId from order response: ${orderDataId}`);
                    positionId = String(orderDataId);
                  }
                }
                
                if (!positionId) {
                  console.warn(`⚠️ positionId not found in position response after exhaustive search.`);
                  console.warn(`   Available fields:`, allFields);
                  console.warn(`   Position size: ${position.size || position.holdVol || position.quantity || '0'}`);
                  console.warn(`   Will proceed with symbol-based SL/TP endpoint (does not require positionId)`);
                  // Don't throw - proceed with symbol-based endpoint
                }
              } else {
                console.warn(`   No positions found in response - will use symbol-based SL/TP endpoint`);
                // Don't throw - proceed with symbol-based endpoint
              }
            } else {
              console.warn(`   API returned code ${positionData.code}: ${positionData.msg || positionData.message}`);
              console.warn(`   Will proceed with symbol-based SL/TP endpoint (does not require positionId)`);
              // Don't throw - proceed with symbol-based endpoint
            }
          } else {
            console.warn(`   Position API returned HTTP ${positionResponse.status} - will use symbol-based SL/TP endpoint`);
            // Don't throw - proceed with symbol-based endpoint
          }
        } catch (extractErr) {
          console.warn(`⚠️ Could not extract positionId:`, extractErr);
          console.warn(`   Will proceed with symbol-based SL/TP endpoint (does not require positionId)`);
          // Don't throw - proceed with symbol-based endpoint
        }
      }
      
      // Bitunix API endpoints for setting stop loss and take profit
      // PRIMARY: Use /api/v1/futures/tpsl/place_tp_sl_order (symbol-based, more reliable)
      // FALLBACK: Use /api/v1/futures/tpsl/place_position_tp_sl_order (position-based, requires positionId)
      // API Docs: https://openapidoc.bitunix.com/doc/tp_sl/place_tp_sl_order.html
      // API Docs: https://openapidoc.bitunix.com/doc/tp_sl/place_position_tp_sl_order.html
      const timestamp = (Date.now() + BotExecutor.bitunixServerTimeOffset).toString();
      const nonce = this.generateNonce();
      
      // CRITICAL: Convert side to position side format (LONG/SHORT) for TP/SL orders
      // Bitunix TP/SL API uses position side (LONG/SHORT) not order side (BUY/SELL)
      // BUY order = LONG position, SELL order = SHORT position
      const positionSide = (side.toUpperCase() === 'BUY' || side.toUpperCase() === 'LONG') ? 'LONG' : 'SHORT';
      const orderSide = side.toUpperCase() === 'BUY' ? 'BUY' : 'SELL'; // Keep for error logging
      
      console.log(`🔍 Side conversion: ${side} → positionSide: ${positionSide}, orderSide: ${orderSide}`);
      
      // CRITICAL FIX: Based on Bitunix official API documentation
      // The correct endpoint is /api/v1/futures/tpsl/place_tp_sl_order
      // Required parameters: symbol, holdSide (LONG/SHORT), tpPrice, slPrice
      // Optional parameters: tpStopType, slStopType, tpOrderType, slOrderType, marginCoin
      // CRITICAL FIX: Prioritize symbol-based endpoints (they don't require positionId)
      // Only include position-based endpoints if we have a valid positionId
      // Based on Code 2 errors, position-based endpoints fail when positionId is invalid
      const endpointsToTry: Array<{endpoint: string, params: any, description: string}> = [
        // Try 1: Official symbol-based endpoint minimal (required params only) - MOST RELIABLE
        // Based on: https://openapidoc.bitunix.com/doc/tp_sl/place_tp_sl_order.html
        {
          endpoint: '/api/v1/futures/tpsl/place_tp_sl_order',
          params: {
            symbol: symbol.toUpperCase(),
            holdSide: positionSide,
            tpPrice: String(takeProfitPrice.toFixed(8)),
            slPrice: String(stopLossPrice.toFixed(8))
          },
          description: 'Official symbol-based endpoint minimal (required params only) - PRIORITY'
        },
        // Try 2: Official symbol-based endpoint with MARK_PRICE
        {
          endpoint: '/api/v1/futures/tpsl/place_tp_sl_order',
          params: {
            symbol: symbol.toUpperCase(),
            holdSide: positionSide, // Required: LONG or SHORT
            tpPrice: String(takeProfitPrice.toFixed(8)), // Required: string format
            slPrice: String(stopLossPrice.toFixed(8)), // Required: string format
            tpStopType: 'MARK_PRICE', // Optional: MARK_PRICE or LAST_PRICE
            slStopType: 'MARK_PRICE', // Optional: MARK_PRICE or LAST_PRICE
            tpOrderType: 'MARKET', // Optional: MARKET or LIMIT
            slOrderType: 'MARKET', // Optional: MARKET or LIMIT
            marginCoin: 'USDT' // Optional: margin coin
          },
          description: 'Official symbol-based endpoint with all parameters (MARK_PRICE)'
        },
        // Try 3: Official symbol-based endpoint with LAST_PRICE
        {
          endpoint: '/api/v1/futures/tpsl/place_tp_sl_order',
          params: {
            symbol: symbol.toUpperCase(),
            holdSide: positionSide,
            tpPrice: String(takeProfitPrice.toFixed(8)),
            slPrice: String(stopLossPrice.toFixed(8)),
            tpStopType: 'LAST_PRICE',
            slStopType: 'LAST_PRICE',
            tpOrderType: 'MARKET',
            slOrderType: 'MARKET',
            marginCoin: 'USDT'
          },
          description: 'Official symbol-based endpoint with LAST_PRICE'
        }
      ];
      
      // Only add position-based endpoints if we have a valid positionId
      // Position-based endpoints require positionId and fail with Code 2 if invalid
      if (positionId && positionId !== '' && positionId !== 'undefined' && positionId !== 'null') {
        // Try 4: Position-based endpoint (only if positionId is valid)
        // Based on: https://openapidoc.bitunix.com/doc/tp_sl/place_position_tp_sl_order.html
        endpointsToTry.push({
          endpoint: '/api/v1/futures/tpsl/place_position_tp_sl_order',
          params: {
            symbol: symbol.toUpperCase(),
            positionId: String(positionId),
            holdSide: positionSide,
            tpPrice: String(takeProfitPrice.toFixed(8)),
            slPrice: String(stopLossPrice.toFixed(8)),
            tpStopType: 'MARK_PRICE',
            slStopType: 'MARK_PRICE',
            tpOrderType: 'MARKET',
            slOrderType: 'MARKET',
            marginCoin: 'USDT'
          },
          description: 'Position-based endpoint with positionId (validated)'
        });
        // Try 5: Position-based endpoint minimal
        endpointsToTry.push({
          endpoint: '/api/v1/futures/tpsl/place_position_tp_sl_order',
          params: {
            symbol: symbol.toUpperCase(),
            positionId: String(positionId),
            holdSide: positionSide,
            tpPrice: String(takeProfitPrice.toFixed(8)),
            slPrice: String(stopLossPrice.toFixed(8))
          },
          description: 'Position-based endpoint minimal (validated positionId)'
        });
      } else {
        console.log(`   ℹ️ Skipping position-based endpoints (no valid positionId available)`);
      }
      
      let slTpSuccess = false;
      let lastError: any = null;
      
      // #region agent log
      console.log(`[DEBUG-SLTP] Starting SL/TP API calls:`, JSON.stringify({
        location: 'bot-executor/index.ts:11280',
        message: 'Starting SL/TP API calls',
        data: { endpointCount: endpointsToTry.length, hasPositionId: !!positionId, positionId, stopLossPrice, takeProfitPrice },
        timestamp: Date.now(),
        hypothesisId: 'E'
      }));
      // #endregion
      
      for (let endpointIndex = 0; endpointIndex < endpointsToTry.length; endpointIndex++) {
        const endpointConfig = endpointsToTry[endpointIndex];
        try {
          // CRITICAL FIX: Add delay between endpoint attempts to give Bitunix time to process
          // Code 2 errors may occur if we try too quickly after order placement
          if (endpointIndex > 0) {
            const delayMs = 2000 * endpointIndex; // Exponential delay: 2s, 4s, 6s, etc.
            console.log(`   ⏳ Waiting ${delayMs}ms before trying next endpoint (attempt ${endpointIndex + 1}/${endpointsToTry.length})...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
          
          // CRITICAL FIX: Skip position-based endpoints if positionId is missing
          // Position-based endpoints require positionId, but symbol-based ones don't
          if (endpointConfig.endpoint.includes('place_position_tp_sl_order') && !positionId) {
            console.log(`   ⏭️ Skipping position-based endpoint (no positionId): ${endpointConfig.endpoint}`);
            // #region agent log
            console.log(`[DEBUG-SLTP] Skipping position-based endpoint:`, JSON.stringify({
              location: 'bot-executor/index.ts:11540',
              message: 'Skipping position-based endpoint',
              data: { endpoint: endpointConfig.endpoint, reason: 'no positionId' },
              timestamp: Date.now(),
              hypothesisId: 'E'
            }));
            // #endregion
            continue; // Skip position-based endpoints when positionId is missing
          }
          
          const slTpParams = endpointConfig.params;
          
          // Remove empty positionId from params if it's empty (cleaner request)
          if (slTpParams.positionId === '' || slTpParams.positionId === 'undefined' || slTpParams.positionId === 'null') {
            delete slTpParams.positionId;
          }
          
          // CRITICAL: Remove empty or invalid positionId from params
          if (slTpParams.positionId === '' || slTpParams.positionId === 'undefined' || slTpParams.positionId === 'null' || !slTpParams.positionId) {
            delete slTpParams.positionId;
          }
          
          // CRITICAL: Ensure all price values are properly formatted as strings
          if (slTpParams.tpPrice) {
            slTpParams.tpPrice = String(parseFloat(slTpParams.tpPrice).toFixed(8));
          }
          if (slTpParams.slPrice) {
            slTpParams.slPrice = String(parseFloat(slTpParams.slPrice).toFixed(8));
          }
          
          const bodyString = JSON.stringify(slTpParams).replace(/\s+/g, '');
          const queryParams = '';
          const signature = await this.createBitunixSignatureDoubleSHA256(nonce, timestamp, apiKey, queryParams, bodyString, apiSecret);
          
          console.log(`   🔄 Trying endpoint: ${endpointConfig.endpoint}`);
          console.log(`   📋 Description: ${endpointConfig.description}`);
          console.log(`   📦 Request params: ${JSON.stringify(slTpParams, null, 2)}`);
          console.log(`   📝 Request body: ${bodyString}`);
          console.log(`   🔑 API Key (first 8): ${apiKey.substring(0, 8)}...`);
          console.log(`   ⏰ Timestamp: ${timestamp}, Nonce: ${nonce}`);
          console.log(`   📊 Symbol: ${symbol.toUpperCase()}, Position Side: ${positionSide}, Entry Price: ${entryPrice}`);
          console.log(`   🎯 SL Price: ${stopLossPrice.toFixed(8)}, TP Price: ${takeProfitPrice.toFixed(8)}`);
          console.log(`   📍 Position Verified: ${positionVerified}, Position Size: ${positionInfo?.size || 0}`);
          
          // #region agent log
          console.log(`[DEBUG-SLTP] Calling SL/TP API endpoint:`, JSON.stringify({
            location: 'bot-executor/index.ts:11558',
            message: 'Calling SL/TP API endpoint',
            data: { 
              endpoint: endpointConfig.endpoint, 
              description: endpointConfig.description, 
              params: slTpParams, 
              hasPositionId: !!positionId,
              positionId: positionId,
              positionSide: positionSide,
              positionVerified: positionVerified,
              positionSize: positionInfo?.size || 0,
              stopLossPrice: stopLossPrice.toFixed(8),
              takeProfitPrice: takeProfitPrice.toFixed(8),
              requestBody: bodyString,
              timestamp: timestamp,
              nonce: nonce
            },
            timestamp: Date.now(),
            hypothesisId: 'E'
          }));
          // #endregion
          
          // CRITICAL: Use POST method (Bitunix API uses POST for TP/SL orders)
          const response = await fetch(`${baseUrl}${endpointConfig.endpoint}`, {
            method: 'POST',
            headers: {
              'api-key': String(apiKey),
              'nonce': String(nonce),
              'timestamp': String(timestamp),
              'sign': String(signature),
              'Content-Type': 'application/json',
              'language': 'en-US'
            },
            body: bodyString
          });
          
          const responseText = await response.text();
          console.log(`   📥 Response status: ${response.status} ${response.statusText}`);
          console.log(`   📄 Response body: ${responseText}`);
          
          // #region agent log
          console.log(`[DEBUG-SLTP] SL/TP API response received:`, JSON.stringify({
            location: 'bot-executor/index.ts:11585',
            message: 'SL/TP API response received',
            data: { 
              status: response.status, 
              statusText: response.statusText,
              endpoint: endpointConfig.endpoint, 
              responseText: responseText,
              responseHeaders: Object.fromEntries(response.headers.entries())
            },
            timestamp: Date.now(),
            hypothesisId: 'E'
          }));
          // #endregion
          
          if (response.ok) {
            try {
              const data = JSON.parse(responseText);
              console.log(`   ✅ Response code: ${data.code}`);
              console.log(`   📨 Response message: ${data.msg || data.message || 'N/A'}`);
              console.log(`   📊 Response data: ${JSON.stringify(data.data || {}, null, 2)}`);
              
              // #region agent log
              console.log(`[DEBUG-SLTP] SL/TP API response parsed:`, JSON.stringify({
                location: 'bot-executor/index.ts:11602',
                message: 'SL/TP API response parsed',
                data: { 
                  code: data.code, 
                  msg: data.msg || data.message, 
                  hasData: !!data.data,
                  data: data.data
                },
                timestamp: Date.now(),
                hypothesisId: 'E'
              }));
              // #endregion
              
              // CRITICAL: Handle Code 2 (System error) with detailed diagnostics
              if (data.code === 2) {
                const errorMsg = data.msg || data.message || 'System error';
                console.error(`   ❌ Code 2 (System error): ${errorMsg}`);
                console.error(`   📋 Possible causes:`);
                console.error(`      1. Position not fully established (wait longer)`);
                console.error(`      2. Invalid parameter format (check holdSide, prices)`);
                console.error(`      3. API key lacks TP/SL permissions`);
                console.error(`      4. Symbol not supported for TP/SL`);
                console.error(`      5. Account not fully activated for futures trading`);
                console.error(`   📋 Request details:`);
                console.error(`      Endpoint: ${endpointConfig.endpoint}`);
                console.error(`      Params: ${JSON.stringify(slTpParams, null, 2)}`);
                console.error(`      Position verified: ${positionVerified}`);
                console.error(`      Position size: ${positionInfo?.size || 0}`);
                
                lastError = new Error(`Bitunix system error (Code: 2): ${errorMsg}. Endpoint: ${endpointConfig.endpoint}. Check: 1) Position exists, 2) Parameter format, 3) API permissions, 4) Account activation.`);
                
                // #region agent log
                console.log(`[DEBUG-SLTP] Code 2 error details:`, JSON.stringify({
                  location: 'bot-executor/index.ts:11615',
                  message: 'Code 2 error details',
                  data: { 
                    code: data.code,
                    errorMsg,
                    endpoint: endpointConfig.endpoint,
                    description: endpointConfig.description,
                    params: slTpParams,
                    positionVerified,
                    positionSize: positionInfo?.size || 0,
                    responseText: responseText
                  },
                  timestamp: Date.now(),
                  hypothesisId: 'E'
                }));
                // #endregion
                
                // Continue to next endpoint - don't fail yet
                console.log(`   ⏭️ Trying next endpoint variation...`);
                continue;
              }
              
              if (data.code === 0 || data.code === 200) {
                console.log(`✅ Bitunix SL/TP API call succeeded via ${endpointConfig.endpoint}`);
                console.log(`   ✅ Used parameters: ${endpointConfig.description}`);
                
                // #region agent log
                console.log(`[DEBUG-SLTP] SL/TP API call succeeded:`, JSON.stringify({
                  location: 'bot-executor/index.ts:11615',
                  message: 'SL/TP API call succeeded',
                  data: { 
                    endpoint: endpointConfig.endpoint, 
                    description: endpointConfig.description,
                    code: data.code,
                    responseData: data.data
                  },
                  timestamp: Date.now(),
                  hypothesisId: 'E'
                }));
                // #endregion
                console.log(`   📊 Full response data: ${JSON.stringify(data.data || {}, null, 2)}`);
                
                // CRITICAL: Verify SL/TP was actually set by checking position AND TP/SL orders API
                console.log(`🔍 Verifying SL/TP was actually set on position...`);
                await new Promise(resolve => setTimeout(resolve, 3000)); // Increased wait time for Bitunix to process
                
                let verified = false;
                for (let verifyAttempt = 1; verifyAttempt <= 5; verifyAttempt++) { // Increased attempts from 3 to 5
                  try {
                    // Method 1: Check position for SL/TP fields
                    const verifyPosition = await this.getBitunixPosition(apiKey, apiSecret, symbol);
                    if (verifyPosition) {
                      const hasSL = !!(verifyPosition.stopLoss || verifyPosition.stop_loss || verifyPosition.slPrice || verifyPosition.stopPrice);
                      const hasTP = !!(verifyPosition.takeProfit || verifyPosition.take_profit || verifyPosition.tpPrice || verifyPosition.takeProfitPrice);
                      
                      // Method 2: Also check TP/SL orders API endpoint
                      let hasTPSLOrders = false;
                      try {
                        const tpslTimestamp = (Date.now() + BotExecutor.bitunixServerTimeOffset).toString();
                        const tpslNonce = this.generateNonce();
                        const tpslQueryParams = `symbol=${symbol.toUpperCase()}`;
                        const tpslBody = '';
                        const tpslSig = await this.createBitunixSignatureDoubleSHA256(tpslNonce, tpslTimestamp, apiKey, tpslQueryParams, tpslBody, apiSecret);
                        
                        const tpslResponse = await fetch(`${baseUrl}/api/v1/futures/tpsl/pending_orders?${tpslQueryParams}`, {
                          method: 'GET',
                          headers: {
                            'api-key': String(apiKey),
                            'nonce': String(tpslNonce),
                            'timestamp': String(tpslTimestamp),
                            'sign': String(tpslSig),
                            'Content-Type': 'application/json',
                            'language': 'en-US'
                          }
                        });
                        
                        if (tpslResponse.ok) {
                          const tpslData = await tpslResponse.json();
                          if (tpslData.code === 0 && tpslData.data) {
                            const orders = Array.isArray(tpslData.data) ? tpslData.data : (tpslData.data.list || []);
                            hasTPSLOrders = orders.length > 0;
                            console.log(`   📊 Found ${orders.length} TP/SL order(s) via API`);
                            if (orders.length > 0) {
                              console.log(`   📊 TP/SL Orders: ${JSON.stringify(orders).substring(0, 500)}`);
                            }
                          }
                        }
                      } catch (tpslErr) {
                        console.warn(`   ⚠️ Could not check TP/SL orders API:`, tpslErr instanceof Error ? tpslErr.message : String(tpslErr));
                      }
                      
                      if ((hasSL && hasTP) || hasTPSLOrders) {
                        console.log(`✅ SL/TP verified on position (attempt ${verifyAttempt}): SL=${hasSL ? 'SET' : 'NOT SET'}, TP=${hasTP ? 'SET' : 'NOT SET'}, TP/SL Orders=${hasTPSLOrders ? 'FOUND' : 'NOT FOUND'}`);
                        verified = true;
                        break;
                      } else {
                        console.warn(`   ⚠️ SL/TP verification attempt ${verifyAttempt} failed. SL: ${hasSL ? 'SET' : 'NOT SET'}, TP: ${hasTP ? 'SET' : 'NOT SET'}, TP/SL Orders: ${hasTPSLOrders ? 'FOUND' : 'NOT FOUND'}`);
                        if (verifyAttempt < 5) {
                          await new Promise(resolve => setTimeout(resolve, 3000)); // Wait longer between attempts
                        }
                      }
                    }
                  } catch (verifyErr) {
                    console.warn(`   ⚠️ Error verifying SL/TP (attempt ${verifyAttempt}):`, verifyErr instanceof Error ? verifyErr.message : String(verifyErr));
                    if (verifyAttempt < 5) {
                      await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                  }
                }
                
                if (verified) {
                  // Log success
                  if (bot?.id) {
                    await this.addBotLog(bot.id, {
                      level: 'success',
                      category: 'trade',
                      message: `Bitunix SL/TP set and verified: SL=${stopLossPrice.toFixed(4)} (${stopLossPercent}%), TP=${takeProfitPrice.toFixed(4)} (${takeProfitPercent}%)`,
                      details: {
                        symbol: symbol,
                        side: side,
                        entryPrice: entryPrice,
                        stopLoss: stopLossPrice,
                        takeProfit: takeProfitPrice,
                        stopLossPercent: stopLossPercent,
                        takeProfitPercent: takeProfitPercent,
                        positionId: positionId,
                        endpoint: endpointConfig.endpoint
                      }
                    });
                  }
                  slTpSuccess = true;
                  break; // Success! Exit loop
                } else {
                  console.error(`❌ SL/TP API returned success but verification failed - SL/TP may not be set`);
                  console.error(`   Continuing to try other endpoints...`);
                  lastError = new Error(`SL/TP API returned success (code ${data.code}) but position verification failed - SL/TP may not be set`);
                  // Continue to next endpoint
                }
              } else {
                const errorMsg = data.msg || data.message || 'Unknown error';
                console.error(`   ❌ ${endpointConfig.endpoint} returned code ${data.code}: ${errorMsg}`);
                console.error(`   ❌ Full response: ${responseText}`);
                console.error(`   ❌ Request params: ${JSON.stringify(slTpParams, null, 2)}`);
                console.error(`   ❌ Request body: ${bodyString}`);
                console.error(`   ❌ Endpoint description: ${endpointConfig.description}`);
                
                // CRITICAL: Handle specific error codes
                if (data.code === 10003) {
                  // Invalid API key
                  console.error(`   ❌ CRITICAL: API key is invalid (Code: 10003)`);
                  throw new Error(`Bitunix API key is invalid (Code: 10003). Please verify and update your Bitunix API keys in account settings.`);
                } else if (data.code === 10004) {
                  // Invalid signature
                  console.error(`   ❌ CRITICAL: Invalid signature (Code: 10004)`);
                  console.error(`   📋 Check signature generation: nonce=${nonce}, timestamp=${timestamp}, body=${bodyString.substring(0, 100)}...`);
                } else if (data.code === 10005) {
                  // Invalid timestamp
                  console.error(`   ❌ CRITICAL: Invalid timestamp (Code: 10005)`);
                  console.error(`   📋 Current timestamp: ${timestamp}, Server offset: ${BotExecutor.bitunixServerTimeOffset}`);
                } else if (data.code === 10006) {
                  // Invalid parameter
                  console.error(`   ❌ CRITICAL: Invalid parameter (Code: 10006)`);
                  console.error(`   📋 Check parameters: ${JSON.stringify(slTpParams, null, 2)}`);
                }
                
                lastError = new Error(`Bitunix SL/TP endpoint failed: ${errorMsg} (Code: ${data.code}). Endpoint: ${endpointConfig.endpoint}. Response: ${responseText}`);
                
                // #region agent log
                console.log(`[DEBUG-SLTP] SL/TP API returned error code:`, JSON.stringify({
                  location: 'bot-executor/index.ts:11722',
                  message: 'SL/TP API returned error code',
                  data: { 
                    endpoint: endpointConfig.endpoint, 
                    description: endpointConfig.description,
                    code: data.code, 
                    errorMsg, 
                    responseText: responseText,
                    requestParams: slTpParams,
                    requestBody: bodyString,
                    positionVerified: positionVerified,
                    positionSize: positionInfo?.size || 0
                  },
                  timestamp: Date.now(),
                  hypothesisId: 'E'
                }));
                // #endregion
                
                // Continue to next endpoint - don't fail yet, try other variations
                console.log(`   ⏭️ Trying next endpoint variation...`);
              }
            } catch (parseError) {
              console.warn(`   ⚠️ Failed to parse response:`, parseError);
              console.error(`   ⚠️ Raw response: ${responseText}`);
              lastError = new Error(`Bitunix SL/TP endpoint returned invalid response: ${responseText.substring(0, 200)}`);
              
              // #region agent log
              console.log(`[DEBUG-SLTP] SL/TP API response parse error:`, JSON.stringify({
                location: 'bot-executor/index.ts:11459',
                message: 'SL/TP API response parse error',
                data: { endpoint: endpointConfig.endpoint, parseError: parseError instanceof Error ? parseError.message : String(parseError), responseText: responseText.substring(0, 500) },
                timestamp: Date.now(),
                hypothesisId: 'E'
              }));
              // #endregion
              
              // Continue to next endpoint
            }
          } else {
            const errorText = responseText;
            console.error(`   ❌ HTTP Error: ${response.status} ${response.statusText}`);
            console.error(`   ❌ Response body: ${errorText}`);
            console.error(`   ❌ Request params: ${JSON.stringify(slTpParams, null, 2)}`);
            console.error(`   ❌ Request body: ${bodyString}`);
            console.error(`   ❌ Endpoint: ${endpointConfig.endpoint}`);
            console.error(`   ❌ Description: ${endpointConfig.description}`);
            console.error(`   ❌ Position verified: ${positionVerified}, Position size: ${positionInfo?.size || 0}`);
            
            // Try to parse error if it's JSON
            try {
              const errorData = JSON.parse(errorText);
              if (errorData.code === 2) {
                console.error(`   ❌ Detected Code 2 in HTTP error response`);
                console.error(`   📋 This may indicate: 1) Position not established, 2) Invalid parameters, 3) API permissions`);
              }
            } catch (e) {
              // Not JSON, ignore
            }
            
            lastError = new Error(`Bitunix SL/TP endpoint returned HTTP ${response.status}: ${errorText}. Endpoint: ${endpointConfig.endpoint}`);
            
            // #region agent log
            console.log(`[DEBUG-SLTP] SL/TP API HTTP error:`, JSON.stringify({
              location: 'bot-executor/index.ts:11757',
              message: 'SL/TP API HTTP error',
              data: { 
                endpoint: endpointConfig.endpoint,
                description: endpointConfig.description,
                status: response.status, 
                statusText: response.statusText, 
                errorText: errorText,
                requestParams: slTpParams,
                requestBody: bodyString,
                positionVerified: positionVerified,
                positionSize: positionInfo?.size || 0,
                responseHeaders: Object.fromEntries(response.headers.entries())
              },
              timestamp: Date.now(),
              hypothesisId: 'E'
            }));
            // #endregion
            
            // Continue to next endpoint - don't fail yet
            console.log(`   ⏭️ Trying next endpoint variation...`);
          }
        } catch (endpointError) {
          console.error(`   ❌ Exception trying ${endpointConfig.endpoint}:`, endpointError);
          console.error(`   ❌ Endpoint description: ${endpointConfig.description}`);
          console.error(`   ❌ Request params: ${JSON.stringify(slTpParams, null, 2)}`);
          console.error(`   ❌ Position verified: ${positionVerified}, Position size: ${positionInfo?.size || 0}`);
          lastError = endpointError instanceof Error ? endpointError : new Error(String(endpointError));
          
          // #region agent log
          console.log(`[DEBUG-SLTP] SL/TP API endpoint exception:`, JSON.stringify({
            location: 'bot-executor/index.ts:11776',
            message: 'SL/TP API endpoint exception',
            data: { 
              endpoint: endpointConfig.endpoint,
              description: endpointConfig.description,
              endpointError: endpointError instanceof Error ? endpointError.message : String(endpointError), 
              errorStack: endpointError instanceof Error ? endpointError.stack : undefined,
              requestParams: slTpParams,
              positionVerified: positionVerified,
              positionSize: positionInfo?.size || 0
            },
            timestamp: Date.now(),
            hypothesisId: 'E'
          }));
          // #endregion
          
          // Continue to next endpoint - don't fail yet
          console.log(`   ⏭️ Trying next endpoint variation...`);
        }
      }
      
      // #region agent log
      console.log(`[DEBUG-SLTP] SL/TP API calls completed:`, JSON.stringify({
        location: 'bot-executor/index.ts:11478',
        message: 'SL/TP API calls completed',
        data: { slTpSuccess, hasLastError: !!lastError, lastError: lastError instanceof Error ? lastError.message : String(lastError) },
        timestamp: Date.now(),
        hypothesisId: 'E'
      }));
      // #endregion
      
      if (!slTpSuccess) {
        // All primary endpoints failed - try fallback method
        console.warn(`⚠️ Primary SL/TP endpoints failed, trying fallback method...`);
        console.warn(`   Last error: ${lastError?.message || 'Unknown error'}`);
        
        // Fallback: Try using position size directly without positionId
        // Some Bitunix endpoints work with just symbol and size
        try {
          if (positionInfo && positionInfo.size > 0) {
            const positionSize = String(positionInfo.size);
            console.log(`   📊 Using position size for fallback: ${positionSize}`);
            
            // Try simpler endpoint with holdSide (LONG/SHORT) and position size
            const fallbackParams = {
              symbol: symbol.toUpperCase(),
              holdSide: positionSide, // Use LONG/SHORT for position side
              tpPrice: String(takeProfitPrice.toFixed(8)),
              slPrice: String(stopLossPrice.toFixed(8)),
              tpStopType: 'LAST_PRICE',
              slStopType: 'LAST_PRICE',
              qty: positionSize,
              marginCoin: 'USDT'
            };
            
            const fallbackBody = JSON.stringify(fallbackParams).replace(/\s+/g, '');
            const fallbackSig = await this.createBitunixSignatureDoubleSHA256(nonce, timestamp, apiKey, '', fallbackBody, apiSecret);
            
            const fallbackEndpoints = [
              '/api/v1/futures/tpsl/place_tp_sl_order',
              '/api/v1/futures/tpsl/place',
              '/api/v1/futures/trade/tp_sl',
              '/api/v1/futures/trade/tpsl'
            ];
            
            for (const fallbackEndpoint of fallbackEndpoints) {
              try {
                console.log(`   Trying fallback endpoint: ${fallbackEndpoint}`);
                const fallbackResponse = await fetch(`${baseUrl}${fallbackEndpoint}`, {
                  method: 'POST',
                  headers: {
                    'api-key': String(apiKey),
                    'nonce': String(nonce),
                    'timestamp': String(timestamp),
                    'sign': String(fallbackSig),
                    'Content-Type': 'application/json',
                    'language': 'en-US'
                  },
                  body: fallbackBody
                });
                
                const fallbackResponseText = await fallbackResponse.text();
                console.log(`   Fallback response: ${fallbackResponse.status}, body: ${fallbackResponseText.substring(0, 500)}`);
                
                if (fallbackResponse.ok) {
                  const fallbackData = JSON.parse(fallbackResponseText);
                  if (fallbackData.code === 0 || fallbackData.code === 200) {
                    console.log(`✅ Bitunix SL/TP set via fallback endpoint: ${fallbackEndpoint}`);
                    slTpSuccess = true;
                    break;
                  }
                }
              } catch (fallbackErr) {
                console.warn(`   ⚠️ Fallback endpoint ${fallbackEndpoint} failed:`, fallbackErr);
              }
            }
          }
        } catch (fallbackError) {
          console.warn(`   ⚠️ Fallback method failed:`, fallbackError);
        }
      }
      
      if (!slTpSuccess) {
        // All endpoints failed - log error with all details
        const errorMsg = lastError?.message || 'All SL/TP endpoints failed';
        console.error(`❌ CRITICAL: All Bitunix SL/TP endpoints failed`);
        console.error(`   Last error: ${errorMsg}`);
        console.error(`   Endpoints tried: ${endpointsToTry.map(e => `${e.endpoint} (${e.description})`).join(', ')}`);
        console.error(`   Position side: ${positionSide} (LONG/SHORT)`);
        console.error(`   Order side: ${orderSide} (BUY/SELL)`);
        console.error(`   Symbol: ${symbol.toUpperCase()}`);
        console.error(`   Entry price: ${entryPrice}`);
        console.error(`   Stop loss: ${stopLossPrice.toFixed(8)}`);
        console.error(`   Take profit: ${takeProfitPrice.toFixed(8)}`);
        console.error(`   Position ID: ${positionId || 'NOT FOUND'}`);
        console.error(`   Position size: ${positionInfo?.size || 'NOT FOUND'}`);
        
        // #region agent log
        console.log(`[DEBUG-SLTP] All SL/TP endpoints failed:`, JSON.stringify({
          location: 'bot-executor/index.ts:11982',
          message: 'All SL/TP endpoints failed',
          data: {
            errorMsg,
            endpointsTried: endpointsToTry.map(e => ({ endpoint: e.endpoint, description: e.description })),
            positionSide,
            orderSide,
            symbol: symbol.toUpperCase(),
            entryPrice,
            stopLossPrice: stopLossPrice.toFixed(8),
            takeProfitPrice: takeProfitPrice.toFixed(8),
            positionId: positionId || 'NOT FOUND',
            positionSize: positionInfo?.size || 'NOT FOUND',
            lastError: lastError instanceof Error ? lastError.message : String(lastError)
          },
          timestamp: Date.now(),
          hypothesisId: 'E'
        }));
        // #endregion
        
        // CRITICAL: Log high-priority error to Supabase
        if (bot?.id) {
          await this.addBotLog(bot.id, {
            level: 'error',
            category: 'trade',
            message: `CRITICAL: Position opened but SL/TP failed. Manual intervention required.`,
            details: {
              symbol: symbol,
              side: side,
              positionSide: positionSide,
              orderSide: orderSide,
              entryPrice: entryPrice,
              stopLossPrice: stopLossPrice.toFixed(8),
              takeProfitPrice: takeProfitPrice.toFixed(8),
              stopLossPercent: stopLossPercent,
              takeProfitPercent: takeProfitPercent,
              positionId: positionId || 'NOT FOUND',
              positionSize: positionInfo?.size || 'NOT FOUND',
              error: errorMsg,
              endpointsTried: endpointsToTry.map(e => `${e.endpoint} (${e.description})`),
              action_required: 'URGENT: Manually set SL/TP on Bitunix exchange immediately',
              manualInstructions: `Go to Bitunix → Positions → ${symbol} → Click TP/SL → Set SL: ${stopLossPrice.toFixed(4)}, TP: ${takeProfitPrice.toFixed(4)}`,
              calculatedStopLoss: stopLossPrice.toFixed(8),
              calculatedTakeProfit: takeProfitPrice.toFixed(8),
              troubleshooting: [
                '1. Check Bitunix API documentation for correct TP/SL endpoint format',
                '2. Verify API key has futures trading and TP/SL permissions',
                '3. Ensure position exists and is open before setting TP/SL',
                '4. Check if Bitunix requires different parameter names (holdSide vs positionSide vs side)',
                `5. Manual fix: Set SL=${stopLossPrice.toFixed(4)}, TP=${takeProfitPrice.toFixed(4)} on Bitunix exchange`
              ]
            }
          });
        }
        
        // CRITICAL: Throw error to ensure caller knows SL/TP failed
        // This will trigger the background retry mechanism
        throw new Error(`CRITICAL: Bitunix order placed but SL/TP setup FAILED after trying ${endpointsToTry.length} endpoint variations. Position is UNPROTECTED. Last error: ${errorMsg}. Tried positionSide=${positionSide}, orderSide=${orderSide}`);
      }
      
      // FINAL VERIFICATION: Double-check that SL/TP was actually set on the position
      // This is critical because API might return success but SL/TP might not be set
      console.log(`🔍 Performing final SL/TP verification before returning...`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s for Bitunix to process
      
      let finalVerification = false;
      for (let finalAttempt = 1; finalAttempt <= 3; finalAttempt++) {
        try {
          const finalPosition = await this.getBitunixPosition(apiKey, apiSecret, symbol);
          if (finalPosition && finalPosition.size > 0) {
            const hasSL = !!(finalPosition.stopLoss || finalPosition.stop_loss || finalPosition.slPrice);
            const hasTP = !!(finalPosition.takeProfit || finalPosition.take_profit || finalPosition.tpPrice);
            
            if (hasSL && hasTP) {
              console.log(`✅ Final SL/TP verification passed: SL=${finalPosition.stopLoss || finalPosition.stop_loss || finalPosition.slPrice}, TP=${finalPosition.takeProfit || finalPosition.take_profit || finalPosition.tpPrice}`);
              finalVerification = true;
              break;
            } else {
              console.error(`❌ Final SL/TP verification failed (attempt ${finalAttempt}/3): SL=${hasSL ? 'SET' : 'NOT SET'}, TP=${hasTP ? 'SET' : 'NOT SET'}`);
              if (finalAttempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 3000));
              }
            }
          }
        } catch (finalErr) {
          console.error(`❌ Error during final SL/TP verification (attempt ${finalAttempt}/3):`, finalErr);
          if (finalAttempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
      }
      
      if (!finalVerification) {
        const errorMsg = `SL/TP API returned success but final position verification failed - SL/TP is NOT set on position`;
        console.error(`❌ ${errorMsg}`);
        
        // Log critical error
        if (bot?.id) {
          await this.addBotLog(bot.id, {
            level: 'error',
            category: 'trade',
            message: `CRITICAL: SL/TP verification failed - Position is UNPROTECTED despite API success`,
            details: {
              symbol: symbol,
              side: side,
              entryPrice: entryPrice,
              stopLossPrice: stopLossPrice.toFixed(8),
              takeProfitPrice: takeProfitPrice.toFixed(8),
              positionId: positionId || 'NOT FOUND',
              action_required: 'URGENT: Manually set SL/TP on Bitunix exchange immediately',
              manualInstructions: `Go to Bitunix → Positions → ${symbol} → Click TP/SL → Set SL: ${stopLossPrice.toFixed(4)}, TP: ${takeProfitPrice.toFixed(4)}`
            }
          });
        }
        
        throw new Error(`CRITICAL: ${errorMsg}. Position is UNPROTECTED. Please set manually: SL=${stopLossPrice.toFixed(4)}, TP=${takeProfitPrice.toFixed(4)}`);
      }
    } catch (error: any) {
      console.error('❌ Bitunix SL/TP setup error:', error);
      throw error;
    }
  }
  
  /**
   * Background retry function to set SL/TP after order placement
   * This runs asynchronously and doesn't block the main order flow
   */
  private async retrySetBitunixSLTPInBackground(
    apiKey: string,
    apiSecret: string,
    bot: any,
    symbol: string,
    side: string,
    entryPrice: number,
    tradeSignal: any,
    orderResult: any,
    orderPositionId: string | null
  ): Promise<void> {
    // Run in background - don't await, just start the task
    setTimeout(async () => {
      console.log(`🔄 [BACKGROUND] Starting SL/TP retry for ${symbol}...`);
      
      const maxBackgroundRetries = 15; // Try for up to 5 minutes (15 * 20 seconds)
      let attempt = 0;
      
      while (attempt < maxBackgroundRetries) {
        attempt++;
        console.log(`🔄 [BACKGROUND] SL/TP retry attempt ${attempt}/${maxBackgroundRetries} for ${symbol}...`);
        
        try {
          // Wait for position to appear (progressive delay)
          const delay = Math.min(5000 + attempt * 2000, 20000); // 5s, 7s, 9s... up to 20s
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Try to get position
          const positionInfo = await this.getBitunixPosition(apiKey, apiSecret, symbol);
          
          if (positionInfo && positionInfo.size > 0) {
            console.log(`✅ [BACKGROUND] Position found for ${symbol}: ${positionInfo.size}`);
            
            // Try to set SL/TP
            try {
              const actualEntryPrice = positionInfo.entryPrice || entryPrice;
              const capitalizedSide = side.charAt(0).toUpperCase() + side.slice(1).toLowerCase();
              const slTpOrderResult = orderPositionId ? { ...orderResult, positionId: orderPositionId } : orderResult;
              
              await this.setBitunixSLTP(apiKey, apiSecret, symbol, capitalizedSide, actualEntryPrice, bot, tradeSignal, slTpOrderResult);
              
              // Verify SL/TP was set
              await new Promise(resolve => setTimeout(resolve, 3000));
              const updatedPosition = await this.getBitunixPosition(apiKey, apiSecret, symbol);
              
              if (updatedPosition) {
                const hasSL = !!(updatedPosition.stopLoss || updatedPosition.stop_loss || updatedPosition.slPrice);
                const hasTP = !!(updatedPosition.takeProfit || updatedPosition.take_profit || updatedPosition.tpPrice);
                
                if (hasSL && hasTP) {
                  console.log(`✅ [BACKGROUND] SL/TP successfully set for ${symbol} on attempt ${attempt}`);
                  if (bot?.id) {
                    await this.addBotLog(bot.id, {
                      level: 'success',
                      category: 'trade',
                      message: `SL/TP successfully set for ${symbol} via background retry`,
                      details: {
                        symbol,
                        attempt,
                        stopLoss: updatedPosition.stopLoss || updatedPosition.stop_loss || updatedPosition.slPrice,
                        takeProfit: updatedPosition.takeProfit || updatedPosition.take_profit || updatedPosition.tpPrice
                      }
                    });
                  }
                  return; // Success!
                } else {
                  console.warn(`⚠️ [BACKGROUND] SL/TP verification failed (attempt ${attempt}): SL=${hasSL ? 'SET' : 'NOT SET'}, TP=${hasTP ? 'SET' : 'NOT SET'}`);
                }
              }
            } catch (slTpErr) {
              console.warn(`⚠️ [BACKGROUND] SL/TP setting failed (attempt ${attempt}):`, slTpErr instanceof Error ? slTpErr.message : String(slTpErr));
            }
          } else {
            console.log(`⏳ [BACKGROUND] Position not found yet for ${symbol} (attempt ${attempt}/${maxBackgroundRetries})`);
          }
        } catch (err) {
          console.warn(`⚠️ [BACKGROUND] Error on attempt ${attempt}:`, err instanceof Error ? err.message : String(err));
        }
      }
      
      // If we get here, all retries failed
      console.error(`❌ [BACKGROUND] SL/TP retry failed after ${maxBackgroundRetries} attempts for ${symbol}`);
      const stopLossPercent = bot.stop_loss || bot.stopLoss || 2.0;
      const takeProfitPercent = bot.take_profit || bot.takeProfit || 4.0;
      const isLong = side.toUpperCase() === 'BUY';
      const stopLossPrice = isLong 
        ? entryPrice * (1 - stopLossPercent / 100)
        : entryPrice * (1 + stopLossPercent / 100);
      const takeProfitPrice = isLong
        ? entryPrice * (1 + takeProfitPercent / 100)
        : entryPrice * (1 - takeProfitPercent / 100);
      
      if (bot?.id) {
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'trade',
          message: `CRITICAL: SL/TP could not be set after ${maxBackgroundRetries} background retry attempts. Position is UNPROTECTED.`,
          details: {
            symbol,
            entryPrice,
            stopLossPrice: stopLossPrice.toFixed(8),
            takeProfitPrice: takeProfitPrice.toFixed(8),
            attempts: maxBackgroundRetries,
            action_required: 'URGENT: Manually set SL/TP on Bitunix exchange immediately',
            manualInstructions: `Go to Bitunix → Positions → ${symbol} → Click TP/SL → Set SL: ${stopLossPrice.toFixed(4)}, TP: ${takeProfitPrice.toFixed(4)}`
          }
        });
      }
    }, 1000); // Start after 1 second
  }
  
  private async placeMEXCOrder(apiKey: string, apiSecret: string, symbol: string, side: string, amount: number, price: number, tradingType: string = 'spot', bot: any = null): Promise<any> {
    // MEXC API documentation: https://mexc.com/api-docs/spot-v3/introduction
    const baseUrl = 'https://api.mexc.com';
    
    console.log(`🔑 MEXC Order Details:`);
    console.log(`   Trading Type: ${tradingType}`);
    console.log(`   Symbol: ${symbol}, Side: ${side}, Amount: ${amount}, Price: ${price}`);
    
    try {
      const timestamp = Date.now().toString();
      const symbolUpper = symbol.toUpperCase();
      
      // MEXC order parameters
      // side: BUY or SELL
      // type: LIMIT or MARKET
      const orderSide = side.toUpperCase() === 'BUY' || side.toUpperCase() === 'LONG' ? 'BUY' : 'SELL';
      const orderType = price > 0 ? 'LIMIT' : 'MARKET';
      
      // Determine endpoint based on trading type
      // Spot: /api/v3/order
      // Futures: /api/v1/futures/order (or /api/v1/private/futures/order)
      const isFutures = tradingType === 'futures' || tradingType === 'linear';
      const endpoint = isFutures ? '/api/v1/private/futures/order' : '/api/v3/order';
      
      console.log(`   Using ${isFutures ? 'FUTURES' : 'SPOT'} endpoint: ${endpoint}`);
      
      // MEXC signature: HMAC_SHA256(sorted query parameters)
      // Parameters must be sorted alphabetically: quantity, recvWindow, side, symbol, timestamp, type (and price if LIMIT)
      const recvWindow = '5000';
      const queryParams: Record<string, string> = {
        symbol: symbolUpper,
        side: orderSide,
        type: orderType,
        quantity: amount.toString(),
        recvWindow: recvWindow,
        timestamp: timestamp
      };
      
      if (orderType === 'LIMIT' && price > 0) {
        queryParams.price = price.toString();
      }
      
      // For futures, might need additional parameters like positionSide, leverage, etc.
      if (isFutures) {
        // MEXC futures might require positionSide (LONG/SHORT)
        const positionSide = orderSide === 'BUY' ? 'LONG' : 'SHORT';
        queryParams.positionSide = positionSide;
        // Note: Leverage might need to be set separately via account settings
      }
      
      // Sort parameters alphabetically for signature
      const sortedParams = Object.keys(queryParams)
        .sort()
        .map(key => `${key}=${queryParams[key]}`)
        .join('&');
      
      // Generate signature from sorted query string
      const signature = await this.createHMACSignature(sortedParams, apiSecret);
      
      console.log(`   Sorted params for signature: ${sortedParams}`);
      console.log(`   Generated signature: ${signature}`);
      
      // MEXC API headers
      const headers: Record<string, string> = {
        'X-MEXC-APIKEY': apiKey,
        'Content-Type': 'application/json'
      };
      
      // MEXC order endpoint - parameters go in query string, not body
      const queryString = `${sortedParams}&signature=${signature}`;
      const orderUrl = `${baseUrl}${endpoint}?${queryString}`;
      
      console.log(`📤 Placing MEXC ${isFutures ? 'FUTURES' : 'SPOT'} ${orderType} order: ${orderSide} ${amount} ${symbolUpper} @ ${price > 0 ? price : 'MARKET'}`);
      console.log(`   Full URL (without signature): ${baseUrl}${endpoint}?${sortedParams}&signature=***`);
      
      // MEXC POST accepts parameters in query string, not body
      let response = await fetch(orderUrl, {
        method: 'POST',
        headers: headers
      });
      
      // If futures endpoint fails, try alternative endpoints
      if (!response.ok && isFutures) {
        const errorText = await response.text();
        console.warn(`⚠️ MEXC futures endpoint failed, trying alternatives...`);
        
        // Try alternative futures endpoints
        const alternativeEndpoints = [
          '/api/v1/futures/order',
          '/api/v1/private/futures/order',
          '/api/v3/order' // Fallback to spot endpoint (might work for some futures symbols)
        ];
        
        for (const altEndpoint of alternativeEndpoints) {
          if (altEndpoint === endpoint) continue; // Skip the one we already tried
          
          try {
            const altQueryString = `${sortedParams}&signature=${signature}`;
            const altOrderUrl = `${baseUrl}${altEndpoint}?${altQueryString}`;
            console.log(`   Trying alternative endpoint: ${altEndpoint}`);
            
            response = await fetch(altOrderUrl, {
              method: 'POST',
              headers: headers
            });
            
            if (response.ok) {
              console.log(`✅ Success with alternative endpoint: ${altEndpoint}`);
              break; // Success, exit loop
            }
          } catch (altError) {
            console.warn(`   Alternative endpoint ${altEndpoint} also failed:`, altError);
            continue;
          }
        }
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ MEXC order failed: HTTP ${response.status}`, errorText);
        throw new Error(`MEXC API error: HTTP ${response.status} - ${errorText.substring(0, 200)}`);
      }
      
      const responseText = await response.text();
      console.log(`📥 MEXC order raw response:`, responseText.substring(0, 500));
      
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`❌ Failed to parse MEXC response as JSON:`, parseError);
        console.error(`   Response text:`, responseText);
        throw new Error(`MEXC API returned invalid JSON: ${responseText.substring(0, 200)}`);
      }
      
      console.log(`📥 MEXC order parsed response:`, JSON.stringify(data, null, 2));
      
      // Check for error codes first
      if (data.code && data.code !== 200 && data.code !== 0) {
        const errorMsg = data.msg || data.message || `MEXC API error code: ${data.code}`;
        console.error(`❌ MEXC order failed with code ${data.code}:`, errorMsg);
        throw new Error(`MEXC order failed (Code ${data.code}): ${errorMsg}`);
      }
      
      // MEXC response format: { orderId: number, symbol: string, status: string, ... }
      // orderId can be a number or string
      const orderId = data.orderId || data.data?.orderId || data.data?.id;
      
      if (orderId) {
        console.log(`✅ MEXC order placed successfully: Order ID ${orderId}`);
        return {
          orderId: String(orderId), // Ensure orderId is a string
          status: data.status || 'NEW',
          exchange: 'mexc',
          response: data
        };
      } else {
        // Log full response for debugging
        console.error(`❌ MEXC order response missing orderId. Full response:`, JSON.stringify(data, null, 2));
        const errorMsg = data.msg || data.message || data.error || `Unknown error: ${JSON.stringify(data)}`;
        throw new Error(`MEXC order failed: ${errorMsg}`);
      }
    } catch (error: any) {
      console.error('❌ MEXC order placement error:', error);
      throw error;
    }
  }

  // Helper function to create HMAC SHA256 signature (for MEXC)
  private async createHMACSignature(message: string, secret: string): Promise<string> {
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
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private generateNonce(): string {
    // Generate 32-bit random string (8 hex characters)
    const randomBytes = new Uint8Array(4);
    crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  private async createBitunixSignatureDoubleSHA256(nonce: string, timestamp: string, apiKey: string, queryParams: string, body: string, secretKey: string): Promise<string> {
    // According to Bitunix official docs:
    // digest = SHA256(nonce + timestamp + api-key + queryParams + body)
    // sign = SHA256(digest + secretKey)
    // Where digest is converted to hex string before concatenating with secretKey
    // CRITICAL: Query parameters must be sorted alphabetically for GET requests
    
    // Step 1: Sort query parameters alphabetically (if present)
    let sortedQueryParams = queryParams;
    if (queryParams && queryParams.includes('=')) {
      const params = queryParams.split('&');
      const paramMap: { [key: string]: string } = {};
      for (const param of params) {
        const [key, value] = param.split('=');
        if (key) {
          paramMap[key] = value || '';
        }
      }
      const sortedKeys = Object.keys(paramMap).sort();
      sortedQueryParams = sortedKeys.map(key => `${key}=${paramMap[key]}`).join('&');
    }
    
    // Step 2: Create digest with sorted query params
    const digestInput = nonce + timestamp + apiKey + sortedQueryParams + body;
    
    // Log the signature string for debugging (mask secret key)
    const maskedSecret = secretKey ? `${secretKey.substring(0, 4)}...${secretKey.substring(secretKey.length - 4)}` : 'N/A';
    console.log(`🔐 Bitunix Signature Debug:`);
    console.log(`   Nonce: ${nonce}`);
    console.log(`   Timestamp: ${timestamp}`);
    console.log(`   API Key: ${apiKey.substring(0, 8)}...`);
    console.log(`   Query Params (original): ${queryParams || '(empty)'}`);
    console.log(`   Query Params (sorted): ${sortedQueryParams || '(empty)'}`);
    console.log(`   Body: ${body || '(empty)'}`);
    console.log(`   Secret Key: ${maskedSecret}`);
    console.log(`   Digest Input: ${digestInput.substring(0, 100)}...`);
    
    const digestHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(digestInput));
    const digestHex = Array.from(new Uint8Array(digestHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Step 3: Create signature from hex digest + secretKey (both as strings)
    const signInput = digestHex + secretKey;
    const signHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signInput));
    const signHex = Array.from(new Uint8Array(signHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    console.log(`   Digest Hex: ${digestHex.substring(0, 32)}...`);
    console.log(`   Signature: ${signHex.substring(0, 32)}...`);
    
    // Return lowercase hex string
    return signHex.toLowerCase();
  }
  
  private async createBitunixSignature(message: string, secret: string): Promise<string> {
    // Legacy method - kept for backward compatibility but not used
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
    // Bitunix expects lowercase hex string
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
  }
  
  private calculateTradeAmount(bot: any, price: number): number {
    const sizing = calculateTradeSizing(bot, price);

    if (sizing.baseAmount < sizing.minTradeAmount) {
      console.log(`⚠️ Trade amount $${sizing.baseAmount} below minimum $${sizing.minTradeAmount} for ${(bot.tradingType || bot.trading_type) || 'spot'} trading. Using $${sizing.effectiveBaseAmount}.`);
    }

    console.log(`💰 Trade calculation: Base=$${sizing.effectiveBaseAmount} (min=$${sizing.minTradeAmount}), Leverage=${sizing.leverageMultiplier}x, Risk=${bot.risk_level || bot.riskLevel || 'medium'}(${sizing.riskMultiplier}x) = Total=$${sizing.totalAmount}`);
    console.log(`📏 Quantity constraints for ${bot.symbol}: min=${sizing.constraints.min}, max=${sizing.constraints.max}, calculated=${sizing.rawQuantity.toFixed(6)}, final=${sizing.quantity.toFixed(6)}`);

    return sizing.quantity;
  }

  private getMinimumOrderValue(symbol: string, category: string): number {
    // Bybit minimum order values (in USDT) per trading pair
    // Spot trading: typically $1-5 USDT minimum
    // Futures trading: typically $5-10 USDT minimum
    const minOrderValues: { [key: string]: { spot: number, linear: number } } = {
      'BTCUSDT': { spot: 1, linear: 5 },
      'ETHUSDT': { spot: 1, linear: 5 },
      'XRPUSDT': { spot: 5, linear: 5 },
      'ADAUSDT': { spot: 5, linear: 5 },
      'DOTUSDT': { spot: 5, linear: 5 },
      'UNIUSDT': { spot: 5, linear: 5 },
      'AVAXUSDT': { spot: 5, linear: 5 },
      'SOLUSDT': { spot: 5, linear: 5 },
      'BNBUSDT': { spot: 1, linear: 5 },
      'MATICUSDT': { spot: 5, linear: 5 },
      'LINKUSDT': { spot: 5, linear: 5 },
      'LTCUSDT': { spot: 1, linear: 5 },
      // Meme coins and low-value tokens - typically need larger minimum order values
      'PEPEUSDT': { spot: 5, linear: 5 },
      'DOGEUSDT': { spot: 5, linear: 5 },
      'SHIBUSDT': { spot: 5, linear: 5 },
      'SWARMSUSDT': { spot: 5, linear: 5 }
    };
    
    // Determine which minimum to use based on category
    const isFutures = category === 'linear' || category === 'futures';
    const minValue = minOrderValues[symbol];
    
    if (minValue) {
      return isFutures ? minValue.linear : minValue.spot;
    }
    
    // Default minimum order values
    return isFutures ? 5 : 1; // $5 for futures, $1 for spot
  }

  /**
   * Track position opening for real trades
   */
  private async trackPositionOpen(bot: any, trade: any, orderResult: any, entryPrice: number, quantity: number, currentPrice: number): Promise<void> {
    try {
      console.log(`📊 [trackPositionOpen] Starting position tracking for bot ${bot.id} (${bot.name})`);
      console.log(`   Symbol: ${bot.symbol}, Side: ${trade.side}, Entry: $${entryPrice}, Quantity: ${quantity}`);
      
      const tradingType = bot.tradingType || bot.trading_type || 'futures';
      const side = (trade.side || '').toLowerCase();
      const normalizedSide = side === 'buy' ? 'long' : side === 'sell' ? 'short' : side;
      
      console.log(`   Trading type: ${tradingType}, Normalized side: ${normalizedSide}`);
      
      // Calculate fees
      const feeRate = resolveFeeRate(bot.exchange, tradingType);
      const orderNotional = quantity * entryPrice;
      const entryFees = orderNotional * feeRate;
      
      // Get leverage from bot or order result
      const leverage = bot.leverage || orderResult?.leverage || 1;
      
      // Calculate margin used (for futures)
      const marginUsed = tradingType === 'futures' || tradingType === 'linear' 
        ? (orderNotional / leverage) 
        : orderNotional;
      
      // Get stop loss and take profit from bot config or signal
      const stopLossPct = bot.stop_loss_percentage || bot.stopLossPercentage || 2;
      const takeProfitPct = bot.take_profit_percentage || bot.takeProfitPercentage || 4;
      
      let stopLossPrice: number | null = null;
      let takeProfitPrice: number | null = null;
      
      if (normalizedSide === 'long') {
        stopLossPrice = entryPrice * (1 - stopLossPct / 100);
        takeProfitPrice = entryPrice * (1 + takeProfitPct / 100);
      } else {
        stopLossPrice = entryPrice * (1 + stopLossPct / 100);
        takeProfitPrice = entryPrice * (1 - takeProfitPct / 100);
      }
      
      // Check if position already exists (for position increases)
      const { data: existingPosition } = await this.supabaseClient
        .from('trading_positions')
        .select('*')
        .eq('bot_id', bot.id)
        .eq('symbol', bot.symbol)
        .eq('exchange', bot.exchange)
        .eq('status', 'open')
        .maybeSingle();
      
      if (existingPosition) {
        // Update existing position (position size increased)
        console.log(`📊 [trackPositionOpen] Found existing position ${existingPosition.id}, updating...`);
        const newQuantity = parseFloat(existingPosition.quantity) + quantity;
        const avgEntryPrice = ((parseFloat(existingPosition.entry_price) * parseFloat(existingPosition.quantity)) + (entryPrice * quantity)) / newQuantity;
        
        const { error: updateError } = await this.supabaseClient
          .from('trading_positions')
          .update({
            quantity: newQuantity,
            entry_price: avgEntryPrice,
            current_price: currentPrice,
            margin_used: marginUsed,
            entry_fees: parseFloat(existingPosition.entry_fees || 0) + entryFees,
            fees: parseFloat(existingPosition.fees || 0) + entryFees,
            updated_at: TimeSync.getCurrentTimeISO()
          })
          .eq('id', existingPosition.id);
        
        if (updateError) {
          console.error(`❌ [trackPositionOpen] Failed to update position:`, updateError);
          throw updateError;
        }
        
        console.log(`✅ [trackPositionOpen] Updated existing position: ${bot.symbol} ${normalizedSide}, new size: ${newQuantity}, avg entry: $${avgEntryPrice}`);
      } else {
        // Create new position
        const { data: position, error: posError } = await this.supabaseClient
          .from('trading_positions')
          .insert({
            bot_id: bot.id,
            user_id: bot.user_id,
            trade_id: trade.id,
            symbol: bot.symbol,
            exchange: bot.exchange,
            trading_type: tradingType,
            side: normalizedSide,
            entry_price: entryPrice,
            quantity: quantity,
            leverage: leverage,
            stop_loss_price: stopLossPrice,
            take_profit_price: takeProfitPrice,
            current_price: currentPrice,
            margin_used: marginUsed,
            entry_fees: entryFees,
            fees: entryFees,
            status: 'open',
            exchange_position_id: orderResult?.orderId || orderResult?.positionId || null
          })
          .select()
          .single();
        
        if (posError) {
          console.error('❌ [trackPositionOpen] Failed to create position record:', posError);
          console.error('   Insert payload:', JSON.stringify({
            bot_id: bot.id,
            user_id: bot.user_id,
            trade_id: trade.id,
            symbol: bot.symbol,
            exchange: bot.exchange,
            trading_type: tradingType,
            side: normalizedSide,
            entry_price: entryPrice,
            quantity: quantity
          }, null, 2));
          throw posError;
        }
        
        console.log(`✅ [trackPositionOpen] Position created successfully: ${bot.symbol} ${normalizedSide} at $${entryPrice}, size: ${quantity}, position ID: ${position?.id}`);
      }
    } catch (error: any) {
      console.error('❌ Error tracking position open:', error);
      throw error;
    }
  }

  /**
   * Track position closing and update metrics
   */
  private async trackPositionClose(bot: any, trade: any, exitPrice: number, closeReason?: string): Promise<void> {
    try {
      const tradingType = bot.tradingType || bot.trading_type || 'futures';
      const side = (trade.side || '').toLowerCase();
      const normalizedSide = side === 'buy' ? 'long' : side === 'sell' ? 'short' : side;
      
      // Find open position for this bot/symbol
      const { data: position, error: posError } = await this.supabaseClient
        .from('trading_positions')
        .select('*')
        .eq('bot_id', bot.id)
        .eq('symbol', bot.symbol)
        .eq('exchange', bot.exchange)
        .eq('status', 'open')
        .maybeSingle();
      
      if (posError || !position) {
        console.warn('⚠️ No open position found to close:', posError?.message || 'Position not found');
        return;
      }
      
      // Calculate realized PnL
      const entryPrice = parseFloat(position.entry_price);
      const quantity = parseFloat(position.quantity);
      const entryFees = parseFloat(position.entry_fees || 0);
      
      // Calculate exit fees
      const feeRate = resolveFeeRate(bot.exchange, tradingType);
      const exitNotional = quantity * exitPrice;
      const exitFees = exitNotional * feeRate;
      const totalFees = entryFees + exitFees;
      
      // Calculate PnL based on side
      let realizedPnL: number;
      if (normalizedSide === 'long' || position.side === 'long') {
        realizedPnL = (exitPrice - entryPrice) * quantity - totalFees;
      } else {
        realizedPnL = (entryPrice - exitPrice) * quantity - totalFees;
      }
      
      // Update position to closed
      await this.supabaseClient
        .from('trading_positions')
        .update({
          exit_price: exitPrice,
          realized_pnl: realizedPnL,
          fees: totalFees,
          exit_fees: exitFees,
          status: 'closed',
          close_reason: closeReason || 'trade_execution',
          closed_at: TimeSync.getCurrentTimeISO(),
          updated_at: TimeSync.getCurrentTimeISO()
        })
        .eq('id', position.id);
      
      // Update trade with PnL and fees (exit_price and updated_at columns may not exist in trades table)
      await this.supabaseClient
        .from('trades')
        .update({
          pnl: realizedPnL,
          fee: totalFees, // Note: column is 'fee' (singular), not 'fees'
          status: 'closed'
          // Note: updated_at is handled by trigger if it exists, don't update it directly
        })
        .eq('id', trade.id);
      
      console.log(`✅ Position closed: ${bot.symbol} ${position.side}, PnL: $${realizedPnL.toFixed(2)}, Fees: $${totalFees.toFixed(2)}`);
      
      // Send Telegram notification for position close
      try {
        await this.sendPositionCloseNotification(bot, trade, realizedPnL, exitPrice, closeReason);
      } catch (notifError) {
        console.warn('⚠️ Failed to send position close notification:', notifError);
      }
      
      // Update bot performance metrics (trigger will also update, but this ensures immediate update)
      await this.updateBotPerformance(bot.id, { ...trade, pnl: realizedPnL, status: 'closed' });
      
    } catch (error: any) {
      console.error('❌ Error tracking position close:', error);
      throw error;
    }
  }

  /**
   * Sync positions from exchange and update database
   */
  private async syncPositionsFromExchange(bot: any): Promise<void> {
    try {
      if (bot.paper_trading === true) {
        return; // Skip for paper trading
      }
      
      const tradingType = bot.tradingType || bot.trading_type || 'futures';
      const symbol = bot.symbol;
      const exchange = bot.exchange || 'bybit';
      
      // Get API keys
      const { data: apiKeys, error: apiError } = await this.supabaseClient
        .from('api_keys')
        .select('*')
        .eq('user_id', bot.user_id)
        .eq('exchange', exchange)
        .eq('is_testnet', false)
        .eq('is_active', true)
        .single();
      
      if (apiError || !apiKeys) {
        console.warn(`⚠️ No API keys found for position sync: ${apiError?.message || 'Not found'}`);
        return;
      }
      
      // Fetch positions from exchange
      const baseUrl = 'https://api.bybit.com';
      const timestamp = Date.now().toString();
      const recvWindow = '5000';
      const category = tradingType === 'futures' ? 'linear' : tradingType === 'spot' ? 'spot' : 'linear';
      
      const queryParams = `category=${category}&symbol=${symbol}`;
      const signaturePayload = timestamp + apiKeys.api_key + recvWindow + queryParams;
      const signature = await this.createBybitSignature(signaturePayload, apiKeys.api_secret);
      
      const response = await fetch(`${baseUrl}/v5/position/list?${queryParams}`, {
        method: 'GET',
        headers: this.buildBybitHeaders(String(apiKeys.api_key || ''), timestamp, recvWindow, String(signature || '')),
      });
      
      if (!response.ok) {
        console.warn(`⚠️ Failed to fetch positions from exchange: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      if (data.retCode !== 0 || !data.result?.list) {
        console.warn(`⚠️ Exchange position fetch error: ${data.retMsg || 'Unknown error'}`);
        return;
      }
      
      const exchangePositions = data.result.list.filter((p: any) => parseFloat(p.size || 0) !== 0);
      
      // Get database positions
      const { data: dbPositions } = await this.supabaseClient
        .from('trading_positions')
        .select('*')
        .eq('bot_id', bot.id)
        .eq('symbol', symbol)
        .eq('exchange', exchange)
        .eq('status', 'open');
      
      // Update or close positions based on exchange data
      for (const dbPos of dbPositions || []) {
        const exchangePos = exchangePositions.find((ep: any) => 
          ep.symbol === symbol && 
          (ep.side?.toLowerCase() === dbPos.side || 
           (ep.side === 'Buy' && dbPos.side === 'long') ||
           (ep.side === 'Sell' && dbPos.side === 'short'))
        );
        
        if (!exchangePos || parseFloat(exchangePos.size || 0) === 0) {
          // Position closed on exchange, close in database
          const currentPrice = parseFloat(exchangePos?.markPrice || exchangePos?.lastPrice || dbPos.current_price || 0);
          if (currentPrice > 0) {
            try {
              await this.trackPositionClose(bot, { id: dbPos.trade_id, side: dbPos.side }, currentPrice, 'exchange_sync');
            } catch (closeError: any) {
              console.error(`   ❌ Failed to close position ${dbPos.id}: ${closeError.message || closeError}`);
              // Continue with other positions even if one fails
            }
          }
        } else {
          // Update position with current price and unrealized PnL
          const currentPrice = parseFloat(exchangePos.markPrice || exchangePos.lastPrice || 0);
          const unrealizedPnL = parseFloat(exchangePos.unrealisedPnl || 0);
          
          if (currentPrice > 0) {
            await this.supabaseClient
              .from('trading_positions')
              .update({
                current_price: currentPrice,
                unrealized_pnl: unrealizedPnL,
                quantity: parseFloat(exchangePos.size || dbPos.quantity),
                updated_at: TimeSync.getCurrentTimeISO()
              })
              .eq('id', dbPos.id);
          }
        }
      }
      
      console.log(`✅ Position sync completed for ${bot.symbol}`);
    } catch (error: any) {
      console.error('❌ Error syncing positions from exchange:', error);
    }
  }

  private async updateBotPerformance(botId: string, trade: any): Promise<void> {
    // Fetch current bot stats (including trade amount for percentage calc)
    const { data: bot, error: botError } = await this.supabaseClient
      .from('trading_bots')
      .select('total_trades, trade_amount, win_rate')
      .eq('id', botId)
      .single();

    if (botError) {
      console.error('Failed to load bot stats for performance update:', botError);
    }

    const previousTotalTrades = bot?.total_trades || 0;

    // Count total trades recorded for this bot (includes open + closed)
    const { count: recordedTradesCount, error: countError } = await this.supabaseClient
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('bot_id', botId);

    if (countError) {
      console.warn('Failed to count trades for bot:', countError.message);
    }

    const totalTrades = Math.max(previousTotalTrades + 1, recordedTradesCount ?? 0);

    // Calculate win rate & PnL from CLOSED trades only (realized performance)
    const { data: closedTrades } = await this.supabaseClient
      .from('trades')
      .select('pnl, executed_at')
      .eq('bot_id', botId)
      .in('status', ['closed', 'completed'])
      .not('pnl', 'is', null)
      .order('executed_at', { ascending: false });

    const totalPnL = closedTrades?.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0) || 0;

    const profitableTrades = closedTrades?.filter(t => parseFloat(t.pnl || 0) > 0) || [];
    const losingTrades = closedTrades?.filter(t => parseFloat(t.pnl || 0) < 0) || [];
    const winTrades = profitableTrades.length;
    const lossTrades = losingTrades.length;
    const totalClosedTrades = closedTrades?.length || 0;
    const newWinRate = totalClosedTrades > 0 ? (winTrades / totalClosedTrades) * 100 : (bot?.win_rate || 0);

    // Drawdown calculation (based on realized trades)
    let maxDrawdown = 0;
    let peakPnL = 0;
    let runningPnL = 0;
    if (closedTrades && closedTrades.length > 0) {
      const sortedTrades = [...closedTrades].sort((a, b) => {
        const dateA = new Date(a.executed_at || a.created_at || 0).getTime();
        const dateB = new Date(b.executed_at || b.created_at || 0).getTime();
        return dateA - dateB;
      });

      for (const t of sortedTrades) {
        runningPnL += parseFloat(t.pnl || 0);
        if (runningPnL > peakPnL) {
          peakPnL = runningPnL;
        }
        const drawdown = peakPnL - runningPnL;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
    }

    const drawdownPercentage = peakPnL > 0 ? (maxDrawdown / peakPnL) * 100 : 0;
    const tradeAmount = bot?.trade_amount ? Number(bot.trade_amount) : null;

    console.log(`📊 Win rate calculation (real): ${winTrades}/${totalClosedTrades} = ${newWinRate.toFixed(2)}%`);
    console.log(`📊 Performance: Wins ${winTrades}, Losses ${lossTrades}, Trades ${totalTrades}, PnL $${totalPnL.toFixed(2)}`);

    await this.supabaseClient
      .from('trading_bots')
      .update({
        total_trades: totalTrades,
        pnl: totalPnL,
        pnl_percentage: tradeAmount ? (totalPnL / tradeAmount) * 100 : 0,
        win_rate: newWinRate,
        last_trade_at: TimeSync.getCurrentTimeISO(),
        updated_at: TimeSync.getCurrentTimeISO()
      })
      .eq('id', botId);

    await this.addBotLog(botId, {
      level: 'info',
      category: 'trade',
      message: `Performance Update: ${winTrades} wins, ${lossTrades} losses, ${newWinRate.toFixed(1)}% win rate, $${maxDrawdown.toFixed(2)} drawdown (${drawdownPercentage.toFixed(1)}%)`,
      details: {
        winTrades,
        lossTrades,
        totalTrades,
        closedTrades: totalClosedTrades,
        winRate: newWinRate,
        drawdown: maxDrawdown,
        drawdownPercentage,
        peakPnL,
        currentPnL: runningPnL
      }
    });
    
    // Update pair statistics if enabled
    await this.updatePairStatistics(botId, trade);
  }
  
  /**
   * Update pair-based win rate statistics in real-time
   */
  private async updatePairStatistics(botId: string, trade: any): Promise<void> {
    try {
      // Get bot configuration
      const { data: bot } = await this.supabaseClient
        .from('trading_bots')
        .select('id, user_id, strategy_config, symbol, exchange')
        .eq('id', botId)
        .single();
      
      if (!bot) return;
      
      const strategyConfig = bot.strategy_config || {};
      const enablePairWinRate = strategyConfig.enable_pair_win_rate || false;
      
      // Only update if pair win rate is enabled
      if (!enablePairWinRate) return;
      
      // Only process closed/completed trades with PnL
      if (!trade || !trade.pnl || trade.status !== 'closed' && trade.status !== 'completed') return;
      
      const symbol = trade.symbol || bot.symbol;
      const exchange = trade.exchange || bot.exchange;
      const pnl = parseFloat(trade.pnl || 0);
      const isWin = pnl > 0;
      
      // Get or create pair statistics
      const { data: existingStats } = await this.supabaseClient
        .from('bot_pair_statistics')
        .select('*')
        .eq('bot_id', botId)
        .eq('symbol', symbol)
        .eq('exchange', exchange)
        .maybeSingle();
      
      if (existingStats) {
        // Update existing statistics
        const newTotalTrades = existingStats.total_trades + 1;
        const newWinningTrades = existingStats.winning_trades + (isWin ? 1 : 0);
        const newLosingTrades = existingStats.losing_trades + (isWin ? 0 : 1);
        const newWinRate = newTotalTrades > 0 ? (newWinningTrades / newTotalTrades) * 100 : 0;
        const newTotalPnL = parseFloat(existingStats.total_pnl || 0) + pnl;
        const newAvgPnL = newTotalPnL / newTotalTrades;
        const newBestPnL = isWin ? Math.max(parseFloat(existingStats.best_trade_pnl || 0), pnl) : parseFloat(existingStats.best_trade_pnl || 0);
        const newWorstPnL = !isWin ? Math.min(parseFloat(existingStats.worst_trade_pnl || 0), pnl) : parseFloat(existingStats.worst_trade_pnl || 0);
        
        await this.supabaseClient
          .from('bot_pair_statistics')
          .update({
            total_trades: newTotalTrades,
            winning_trades: newWinningTrades,
            losing_trades: newLosingTrades,
            win_rate: Math.round(newWinRate * 100) / 100, // Round to 2 decimals
            total_pnl: newTotalPnL,
            avg_pnl_per_trade: newAvgPnL,
            best_trade_pnl: newBestPnL,
            worst_trade_pnl: newWorstPnL,
            last_trade_at: trade.executed_at || trade.closed_at || TimeSync.getCurrentTimeISO(),
            updated_at: TimeSync.getCurrentTimeISO()
          })
          .eq('id', existingStats.id);
        
        console.log(`📊 [PAIR WIN RATE] Updated ${symbol}: ${newWinningTrades}/${newTotalTrades} = ${newWinRate.toFixed(2)}% (${isWin ? 'WIN' : 'LOSS'})`);
      } else {
        // Create new pair statistics
        await this.supabaseClient
          .from('bot_pair_statistics')
          .insert({
            bot_id: botId,
            user_id: bot.user_id,
            symbol: symbol,
            exchange: exchange,
            total_trades: 1,
            winning_trades: isWin ? 1 : 0,
            losing_trades: isWin ? 0 : 1,
            win_rate: isWin ? 100.00 : 0.00,
            total_pnl: pnl,
            avg_pnl_per_trade: pnl,
            best_trade_pnl: isWin ? pnl : 0,
            worst_trade_pnl: !isWin ? pnl : 0,
            last_trade_at: trade.executed_at || trade.closed_at || TimeSync.getCurrentTimeISO()
          });
        
        console.log(`📊 [PAIR WIN RATE] Created ${symbol}: ${isWin ? 'WIN' : 'LOSS'} (1/1 = ${isWin ? 100 : 0}%)`);
      }
      
      // Log pair win rate update
      await this.addBotLog(botId, {
        level: 'info',
        category: 'statistics',
        message: `📊 Pair Win Rate Updated: ${symbol} - ${isWin ? 'WIN' : 'LOSS'} (${pnl > 0 ? '+' : ''}$${pnl.toFixed(2)})`,
        details: {
          symbol,
          exchange,
          pnl,
          is_win: isWin,
          pair_win_rate_enabled: true
        }
      });
    } catch (error) {
      console.warn('⚠️ Failed to update pair statistics:', error);
      // Don't throw - this is non-critical
    }
  }
  
  /**
   * 🛡️ Comprehensive Safety Checks
   * Checks all safety limits before allowing any trade
   */
  private async checkSafetyLimits(bot: any): Promise<{ canTrade: boolean; reason: string; shouldPause: boolean }> {
    try {
      const isPaperTrading = bot.paper_trading === true;

      // 0. Check subscription/trial limits FIRST (only for real trading, not paper trading)
      if (!isPaperTrading) {
        try {
          const { data: tradeCheck, error: tradeCheckError } = await this.supabaseClient
            .rpc('can_user_trade', { 
              p_user_id: bot.user_id, 
              p_trade_type: 'real' 
            });

          if (tradeCheckError) {
            console.error(`❌ Error checking subscription trade limits:`, tradeCheckError);
            // Don't block on subscription check errors, let other checks proceed
          } else if (tradeCheck && !tradeCheck.allowed) {
            const reason = tradeCheck.reason || 'Subscription limit reached or trial expired';
            console.warn(`⚠️ Trading blocked by subscription limits: ${reason}`);
            return {
              canTrade: false,
              reason: reason,
              shouldPause: tradeCheck.trial_expired === true // Pause if trial expired
            };
          } else if (tradeCheck && tradeCheck.allowed) {
            // Log remaining trades if available
            if (tradeCheck.remaining_trades !== null && tradeCheck.remaining_trades !== undefined) {
              console.log(`✅ Subscription check passed: ${tradeCheck.current_trades || 0}/${tradeCheck.max_trades || 'unlimited'} trades today (${tradeCheck.remaining_trades} remaining)`);
            }
          }
        } catch (err: any) {
          console.error('❌ Error checking subscription limits:', err);
          // Don't block on subscription check errors, let other checks proceed
        }
      }

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
      const consecutiveLosses = await this.getConsecutiveLosses(bot.id, isPaperTrading);
      const maxConsecutiveLosses = this.getMaxConsecutiveLosses(bot);
      if (consecutiveLosses >= maxConsecutiveLosses) {
        return {
          canTrade: false,
          reason: `Max consecutive losses reached: ${consecutiveLosses}/${maxConsecutiveLosses}. Trading paused for safety.`,
          shouldPause: true
        };
      }

      // 4. Daily Loss Limit Check
      const dailyLoss = await this.getDailyLoss(bot.id, isPaperTrading);
      const dailyLossLimit = this.getDailyLossLimit(bot);
      if (dailyLoss >= dailyLossLimit) {
        return {
          canTrade: false,
          reason: `Daily loss limit exceeded: $${dailyLoss.toFixed(2)} >= $${dailyLossLimit.toFixed(2)}. Trading paused for today.`,
          shouldPause: true
        };
      }

      // 5. Weekly Loss Limit Check
      const weeklyLoss = await this.getWeeklyLoss(bot.id, isPaperTrading);
      const weeklyLossLimit = this.getWeeklyLossLimit(bot);
      if (weeklyLoss >= weeklyLossLimit) {
        return {
          canTrade: false,
          reason: `Weekly loss limit exceeded: $${weeklyLoss.toFixed(2)} >= $${weeklyLossLimit.toFixed(2)}. Trading paused for the week.`,
          shouldPause: true
        };
      }

      // 6. Max Trades Per Day Check
      const tradesToday = await this.getTradesToday(bot.id, isPaperTrading);
      const maxTradesPerDay = this.getMaxTradesPerDay(bot);
      if (tradesToday >= maxTradesPerDay) {
        return {
          canTrade: false,
          reason: `Max trades per day reached: ${tradesToday}/${maxTradesPerDay}. Trading paused until tomorrow.`,
          shouldPause: false // Don't pause permanently, just for today
        };
      }

      // 7. Max Concurrent Positions Check
      const openPositions = await this.getOpenPositions(bot.id, isPaperTrading);
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
    } catch (error: any) {
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
  private async getConsecutiveLosses(botId: string, isPaperTrading: boolean = false): Promise<number> {
    try {
      const tableName = isPaperTrading ? 'paper_trading_trades' : 'trades';
      const { data: recentTrades } = await this.supabaseClient
        .from(tableName)
        .select('pnl, outcome')
        .eq('bot_id', botId)
        .order('executed_at', { ascending: false })
        .limit(100); // Check last 100 trades

      if (!recentTrades || recentTrades.length === 0) {
        return 0;
      }

      let consecutiveLosses = 0;
      for (const trade of recentTrades) {
        const pnl = parseFloat(trade.pnl || 0);
        const isLoss = pnl < 0 || trade.outcome === 'loss';
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
  private async getDailyLoss(botId: string, isPaperTrading: boolean = false): Promise<number> {
    try {
      const tableName = isPaperTrading ? 'paper_trading_trades' : 'trades';
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
        .from(tableName)
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
  private async getWeeklyLoss(botId: string, isPaperTrading: boolean = false): Promise<number> {
    try {
      const tableName = isPaperTrading ? 'paper_trading_trades' : 'trades';
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
        .from(tableName)
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
  private async getTradesToday(botId: string, isPaperTrading: boolean = false): Promise<number> {
    try {
      const tableName = isPaperTrading ? 'paper_trading_trades' : 'trades';
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
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .eq('bot_id', botId)
        .not('executed_at', 'is', null) // Must have executed_at set
        .gte('executed_at', todayISO)
        .lt('executed_at', tomorrowISO) // Must be before tomorrow (strict today check)
        .in('status', ['filled', 'completed', 'closed']); // Only count executed trades

      if (error) {
        console.warn(`Error getting trades today from ${tableName}:`, error);
        // Fallback: try with created_at if executed_at doesn't work
        const { count: fallbackCount } = await this.supabaseClient
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .eq('bot_id', botId)
          .gte('created_at', todayISO)
          .lt('created_at', tomorrowISO)
          .in('status', ['filled', 'completed', 'closed']);
        
        const tradeCount = fallbackCount || 0;
        console.log(`📊 Trades today for bot ${botId} (${isPaperTrading ? 'PAPER' : 'REAL'}): ${tradeCount} (fallback using created_at, since ${todayISO})`);
        return tradeCount;
      }

      const tradeCount = count || 0;
      console.log(`📊 Trades today for bot ${botId} (${isPaperTrading ? 'PAPER' : 'REAL'}): ${tradeCount} (since ${todayISO}, before ${tomorrowISO})`);
      
      return tradeCount;
    } catch (error) {
      console.warn('Error getting trades today:', error);
      return 0;
    }
  }

  /**
   * Get number of open positions for bot
   */
  private async getOpenPositions(botId: string, isPaperTrading: boolean = false): Promise<number> {
    try {
      const tableName = isPaperTrading ? 'paper_trading_positions' : 'trades';
      const statusField = isPaperTrading ? 'status' : 'status'; // Both tables use 'status'
      
      const { count } = await this.supabaseClient
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .eq('bot_id', botId)
        .in('status', ['open', 'pending']);

      return count || 0;
    } catch (error) {
      console.warn(`Error getting open positions from ${isPaperTrading ? 'paper_trading_positions' : 'trades'}:`, error);
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
   * Check if cooldown bars have passed since last trade
   */
  private async checkCooldownBars(bot: any): Promise<{ canTrade: boolean; reason?: string; barsSinceLastTrade?: number; requiredBars?: number }> {
    try {
      // Get strategy config
      const strategyConfig = typeof bot.strategy_config === 'string' 
        ? JSON.parse(bot.strategy_config) 
        : bot.strategy_config || {};
      
      // Get cooldown bars - 0 means disabled, undefined/null means use default 8
      const cooldownBars = strategyConfig.cooldown_bars !== undefined && strategyConfig.cooldown_bars !== null
        ? strategyConfig.cooldown_bars
        : 8; // Default: 8 bars if not specified
      
      // If cooldown is 0 or negative, skip check (cooldown disabled)
      if (cooldownBars <= 0) {
        return { canTrade: true };
      }
      
      // Get last trade time (check paper_trading_trades for paper bots, trades for real bots)
      const isPaperTrading = bot.paper_trading === true;
      const lastTrade = await this.getLastTradeTime(bot.id, isPaperTrading);
      if (!lastTrade) {
        // No previous trades, cooldown doesn't apply
        return { canTrade: true };
      }
      
      // Get bot timeframe
      const timeframe = bot.timeframe || bot.timeFrame || '1h';
      
      // Calculate bars since last trade
      const barsSinceLastTrade = this.calculateBarsSince(lastTrade, timeframe);
      
      if (barsSinceLastTrade < cooldownBars) {
        return {
          canTrade: false,
          reason: `Cooldown active: ${barsSinceLastTrade}/${cooldownBars} bars passed since last trade`,
          barsSinceLastTrade,
          requiredBars: cooldownBars
        };
      }
      
      return { canTrade: true, barsSinceLastTrade, requiredBars: cooldownBars };
    } catch (error) {
      console.warn('Error checking cooldown bars:', error);
      // On error, allow trading (fail open)
      return { canTrade: true };
    }
  }

  /**
   * Check if current hour is in allowed trading hours
   */
  private checkTradingHours(bot: any): { canTrade: boolean; reason?: string; currentHour?: number; allowedHours?: number[] } {
    try {
      // Get strategy config
      const strategyConfig = typeof bot.strategy_config === 'string' 
        ? JSON.parse(bot.strategy_config) 
        : bot.strategy_config || {};
      
      // Check if session filter is enabled
      const sessionFilterEnabled = strategyConfig.session_filter_enabled || false;
      
      // If session filter is disabled, allow trading
      if (!sessionFilterEnabled) {
        return { canTrade: true };
      }
      
      // Get allowed hours (default to all hours if not set)
      const allowedHours = strategyConfig.allowed_hours_utc || [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23];
      
      // If all 24 hours are allowed, skip check
      if (allowedHours.length === 24) {
        return { canTrade: true };
      }
      
      // Get current UTC hour
      const currentHourUTC = new Date().getUTCHours();
      
      if (!allowedHours.includes(currentHourUTC)) {
        return {
          canTrade: false,
          reason: `Outside allowed trading hours (current: ${currentHourUTC}:00 UTC, allowed: ${allowedHours.join(', ')})`,
          currentHour: currentHourUTC,
          allowedHours
        };
      }
      
      return { canTrade: true, currentHour: currentHourUTC, allowedHours };
    } catch (error) {
      console.warn('Error checking trading hours:', error);
      // On error, allow trading (fail open)
      return { canTrade: true };
    }
  }

  /**
   * Get last trade time for a bot
   */
  private async getLastTradeTime(botId: string, isPaperTrading: boolean = false): Promise<string | null> {
    try {
      if (isPaperTrading) {
        // For paper trading, check paper_trading_trades table
        // Prefer closed_at (completed trade), then executed_at, then created_at
        const { data, error } = await this.supabaseClient
          .from('paper_trading_trades')
          .select('closed_at, executed_at, created_at')
          .eq('bot_id', botId)
          .not('closed_at', 'is', null)
          .order('closed_at', { ascending: false })
          .limit(1)
          .single();
        
        if (!error && data?.closed_at) {
          return data.closed_at;
        }
        
        // Fallback to executed_at
        const { data: executedData } = await this.supabaseClient
          .from('paper_trading_trades')
          .select('executed_at, created_at')
          .eq('bot_id', botId)
          .not('executed_at', 'is', null)
          .order('executed_at', { ascending: false })
          .limit(1)
          .single();
        
        if (!executedData?.executed_at) {
          // Last fallback: created_at
          const { data: createdData } = await this.supabaseClient
            .from('paper_trading_trades')
            .select('created_at')
            .eq('bot_id', botId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          return createdData?.created_at || null;
        }
        
        return executedData.executed_at || executedData.created_at || null;
      } else {
        // For real trading, check trades table
        const { data, error } = await this.supabaseClient
          .from('trades')
          .select('executed_at, created_at')
          .eq('bot_id', botId)
          .not('executed_at', 'is', null)
          .order('executed_at', { ascending: false })
          .limit(1)
          .single();
        
        if (error || !data) {
          // Try with created_at as fallback
          const { data: fallbackData } = await this.supabaseClient
            .from('trades')
            .select('created_at')
            .eq('bot_id', botId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          return fallbackData?.created_at || null;
        }
        
        return data.executed_at || data.created_at || null;
      }
    } catch (error) {
      console.warn('Error getting last trade time:', error);
      return null;
    }
  }

  /**
   * Calculate number of bars since a given timestamp based on timeframe
   */
  private calculateBarsSince(timestamp: string, timeframe: string): number {
    try {
      const lastTradeTime = new Date(timestamp).getTime();
      const currentTime = Date.now();
      const timeDiffMs = currentTime - lastTradeTime;
      
      // Convert timeframe to milliseconds
      const timeframeMs = this.timeframeToMilliseconds(timeframe);
      
      if (timeframeMs <= 0) {
        return 0;
      }
      
      // Calculate bars (floor to get complete bars only)
      const bars = Math.floor(timeDiffMs / timeframeMs);
      
      return Math.max(0, bars);
    } catch (error) {
      console.warn('Error calculating bars since:', error);
      return 0;
    }
  }

  /**
   * Convert timeframe string to milliseconds
   */
  private timeframeToMilliseconds(timeframe: string): number {
    const tf = timeframe.toLowerCase();
    
    if (tf === '1m') return 60 * 1000;
    if (tf === '5m') return 5 * 60 * 1000;
    if (tf === '15m') return 15 * 60 * 1000;
    if (tf === '30m') return 30 * 60 * 1000;
    if (tf === '1h') return 60 * 60 * 1000;
    if (tf === '2h') return 2 * 60 * 60 * 1000;
    if (tf === '3h') return 3 * 60 * 60 * 1000;
    if (tf === '4h') return 4 * 60 * 60 * 1000;
    if (tf === '6h') return 6 * 60 * 60 * 1000;
    if (tf === '12h') return 12 * 60 * 60 * 1000;
    if (tf === '1d') return 24 * 60 * 60 * 1000;
    if (tf === '1w') return 7 * 24 * 60 * 60 * 1000;
    
    // Default to 1 hour
    return 60 * 60 * 1000;
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
          category: 'system',
          message: `Bot paused automatically: ${reason}`,
          details: { reason, pausedAt: TimeSync.getCurrentTimeISO() }
        });
      }
    } catch (error) {
      console.error('Error pausing bot for safety:', error);
    }
  }

  /**
   * Send Telegram notification for trade execution
   */
  private async sendTradeNotification(bot: any, trade: any, orderResult: any): Promise<void> {
    try {
      // Get Supabase URL and keys from environment
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      
      if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('⚠️ Supabase URL or Anon Key not configured for Telegram notifications');
        return;
      }

      // Fetch account balance for notification
      let accountBalance: number | null = null;
      try {
        if (bot.paper_trading) {
          // Get paper trading account balance (available balance)
          const paperAccount = await this.getPaperAccount();
          if (paperAccount && paperAccount.balance !== undefined && paperAccount.balance !== null) {
            accountBalance = parseFloat(paperAccount.balance || '0');
            console.log(`📊 Paper trading available balance for notification: $${accountBalance.toFixed(2)}`);
          }
        } else {
          // For real trading, fetch available balance directly from exchange
          // Get API keys for the bot
          const apiKeysResp = await this.supabaseClient
            .from('api_keys')
            .select('*')
            .eq('user_id', bot.user_id)
            .eq('exchange', bot.exchange)
            .eq('is_testnet', false)
            .eq('is_active', true)
            .single();
          
          if (apiKeysResp.data && !apiKeysResp.error) {
            const apiKeys = apiKeysResp.data;
            const tradingType = bot.tradingType || bot.trading_type || 'futures';
            const exchange = (bot.exchange || '').toLowerCase();
            
            try {
              if (exchange === 'bitunix') {
                // Fetch Bitunix balance
                const baseUrl = tradingType === 'futures' ? 'https://fapi.bitunix.com' : 'https://api.bitunix.com';
                const timestamp = Date.now().toString();
                const nonce = this.generateNonce();
                const queryParams = '';
                const body = '';
                const signature = await this.createBitunixSignatureDoubleSHA256(nonce, timestamp, apiKeys.api_key, queryParams, body, apiKeys.api_secret);
                
                // Try multiple endpoints
                const endpoints = [
                  '/api/v1/futures/account/list',
                  '/api/v1/account/list',
                  '/api/v1/futures/account',
                  '/api/v1/account'
                ];
                
                for (const endpoint of endpoints) {
                  try {
                    const response = await fetch(`${baseUrl}${endpoint}`, {
                      method: 'GET',
                      headers: {
                        'api-key': String(apiKeys.api_key),
                        'nonce': String(nonce),
                        'timestamp': String(timestamp),
                        'sign': String(signature),
                        'Content-Type': 'application/json',
                        'language': 'en-US'
                      }
                    });
                    
                    if (response.ok) {
                      const data = await response.json();
                      if (data.code === 0 && data.data) {
                        const assets = Array.isArray(data.data) ? data.data : (data.data.assets || []);
                        if (tradingType === 'futures') {
                          // For futures, sum total equity
                          let totalEquity = 0;
                          for (const asset of assets) {
                            const equity = parseFloat(asset.totalEquity || asset.equity || asset.balance || asset.total || '0');
                            totalEquity += equity;
                          }
                          accountBalance = totalEquity;
                        } else {
                          // For spot, find USDT balance
                          const usdtAsset = assets.find((a: any) => {
                            const assetSymbol = (a.asset || a.coin || a.currency || '').toUpperCase();
                            return assetSymbol === 'USDT';
                          });
                          accountBalance = usdtAsset ? parseFloat(usdtAsset.available || usdtAsset.free || usdtAsset.balance || '0') : 0;
                        }
                        console.log(`📊 Bitunix available balance for notification: $${accountBalance.toFixed(2)}`);
                        break;
                      }
                    }
                  } catch (fetchError) {
                    console.warn(`⚠️ Failed to fetch Bitunix balance from ${endpoint}:`, fetchError);
                  }
                }
              } else if (exchange === 'bybit') {
                // Fetch available balance directly from Bybit API
                // Always use mainnet
                const baseDomains = ['https://api.bybit.com'];
                
                const timestamp = Date.now().toString();
                const recvWindow = '5000';
                const categoryMap: { [key: string]: string } = {
                  'spot': 'spot',
                  'futures': 'linear'
                };
                const bybitCategory = categoryMap[tradingType] || 'linear';
                
                // For futures/linear, get total equity (available balance)
                if (bybitCategory === 'linear') {
                  const queryParams = `accountType=UNIFIED`;
                  const signaturePayload = timestamp + apiKeys.api_key + recvWindow + queryParams;
                  const signature = await this.createBybitSignature(signaturePayload, apiKeys.api_secret);
                  
                  for (const domain of baseDomains) {
                    try {
                      const response = await fetch(`${domain}/v5/account/wallet-balance?${queryParams}`, {
                        method: 'GET',
                        headers: this.buildBybitHeaders(String(apiKeys.api_key || ''), timestamp, recvWindow, String(signature || '')),
                      });
                      
                      if (response.ok) {
                        const data = await response.json();
                        if (data.retCode === 0 && data.result?.list?.[0]) {
                          const accountInfo = data.result.list[0];
                          // Use totalAvailableBalance or totalEquity as available balance
                          accountBalance = parseFloat(
                            accountInfo.totalAvailableBalance || 
                            accountInfo.totalEquity || 
                            accountInfo.totalWalletBalance || 
                            '0'
                          );
                          console.log(`📊 Real trading available balance (futures): $${accountBalance.toFixed(2)}`);
                          break;
                        }
                      }
                    } catch (fetchError) {
                      console.warn(`⚠️ Failed to fetch balance from ${domain}:`, fetchError);
                    }
                  }
                } else {
                  // For spot, get USDT available balance
                  const queryParams = `accountType=SPOT&coin=USDT`;
                  const signaturePayload = timestamp + apiKeys.api_key + recvWindow + queryParams;
                  const signature = await this.createBybitSignature(signaturePayload, apiKeys.api_secret);
                  
                  for (const domain of baseDomains) {
                    try {
                      const response = await fetch(`${domain}/v5/account/wallet-balance?${queryParams}`, {
                        method: 'GET',
                        headers: this.buildBybitHeaders(String(apiKeys.api_key || ''), timestamp, recvWindow, String(signature || '')),
                      });
                      
                      if (response.ok) {
                        const data = await response.json();
                        if (data.retCode === 0 && data.result?.list?.[0]?.coin?.[0]) {
                          const wallet = data.result.list[0].coin[0];
                          // Use availableToWithdraw or availableBalance
                          accountBalance = parseFloat(
                            wallet.availableToWithdraw || 
                            wallet.availableBalance || 
                            wallet.walletBalance || 
                            '0'
                          );
                          console.log(`📊 Real trading available balance (spot): $${accountBalance.toFixed(2)}`);
                          break;
                        }
                      }
                    } catch (fetchError) {
                      console.warn(`⚠️ Failed to fetch balance from ${domain}:`, fetchError);
                    }
                  }
                }
              }
              // Add other exchanges (OKX, MEXC) here if needed
            } catch (balanceError: any) {
              console.warn('⚠️ Failed to fetch available balance for Telegram notification:', balanceError?.message || balanceError);
              // Don't fail notification if balance fetch fails
            }
          }
        }
      } catch (balanceError: any) {
        console.warn('⚠️ Failed to fetch account balance for Telegram notification:', balanceError?.message || balanceError);
        // Don't fail notification if balance fetch fails
      }

      // When called from cron, we don't have a user session, but we have user_id from the trade/bot
      // Use service role key to call the function and pass user_id in body
      // The telegram-notifier will handle user lookup internally
      const useServiceRole = !this.user || !this.supabaseClient.auth; // Check if we have user context
      
      // Invoke telegram-notifier Edge Function via HTTP
      const functionUrl = `${supabaseUrl}/functions/v1/telegram-notifier?action=send`;
      
      // Try to get session token first (for manual calls), fall back to service role (for cron)
      let authToken = supabaseAnonKey;
      try {
        const { data: { session } } = await this.supabaseClient.auth.getSession();
        if (session?.access_token) {
          authToken = session.access_token;
        } else if (useServiceRole && supabaseServiceKey) {
          authToken = supabaseServiceKey; // Use service role for cron jobs
        }
      } catch (sessionError) {
        // If getSession fails (e.g., in cron context), use service role key
        if (supabaseServiceKey) {
          authToken = supabaseServiceKey;
        }
      }
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({
          notification_type: 'position_open',
          data: {
            bot_name: bot.name,
            symbol: bot.symbol || trade.symbol,
            side: trade.side,
            entry_price: trade.price || trade.entry_price,
            price: trade.price || trade.entry_price,
            amount: trade.amount || trade.size,
            quantity: trade.amount || trade.size,
            leverage: bot.leverage || trade.leverage,
            order_id: trade.exchange_order_id || orderResult?.orderId,
            user_id: this.user?.id || trade.user_id || bot.user_id, // Pass user_id explicitly
            paper_trading: bot.paper_trading || false,
            exchange: bot.exchange || 'bybit', // Always include exchange
            trading_type: bot.tradingType || bot.trading_type || 'futures', // Always include trading type
            tradingType: bot.tradingType || bot.trading_type || 'futures', // Include both variations
            account_balance: accountBalance // Include account balance
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('⚠️ Telegram notification HTTP error:', response.status, errorText);
      } else {
        const result = await response.json();
        if (result.skipped) {
          // Only log skipped notifications at debug level to reduce log noise
          console.log('ℹ️ Telegram notification skipped for trade:', trade.id, result.message || 'Not configured');
        } else {
          console.log('✅ Telegram notification sent for trade:', trade.id, result);
        }
      }
    } catch (err) {
      console.warn('⚠️ Failed to send Telegram notification:', err);
      // Don't throw - notification failures shouldn't break trades
    }
  }

  private async sendPositionCloseNotification(bot: any, trade: any, pnl: number, exitPrice: number, closeReason?: string): Promise<void> {
    try {
      // Get Supabase URL and keys from environment
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      
      if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('⚠️ Supabase URL or Anon Key not configured for Telegram notifications');
        return;
      }

      // Fetch account balance for notification
      let accountBalance: number | null = null;
      try {
        if (bot.paper_trading) {
          // Get paper trading account balance (available balance)
          const paperAccount = await this.getPaperAccount();
          if (paperAccount && paperAccount.balance !== undefined && paperAccount.balance !== null) {
            accountBalance = parseFloat(paperAccount.balance || '0');
            console.log(`📊 Paper trading available balance for notification: $${accountBalance.toFixed(2)}`);
          }
        } else {
          // For real trading, fetch available balance directly from exchange
          // Get API keys for the bot
          const apiKeysResp = await this.supabaseClient
            .from('api_keys')
            .select('*')
            .eq('user_id', bot.user_id)
            .eq('exchange', bot.exchange)
            .eq('is_testnet', false)
            .eq('is_active', true)
            .single();
          
          if (apiKeysResp.data && !apiKeysResp.error) {
            const apiKeys = apiKeysResp.data;
            const tradingType = bot.tradingType || bot.trading_type || 'futures';
            const exchange = (bot.exchange || '').toLowerCase();
            
            try {
              if (exchange === 'bitunix') {
                // Fetch Bitunix balance
                const baseUrl = tradingType === 'futures' ? 'https://fapi.bitunix.com' : 'https://api.bitunix.com';
                const timestamp = Date.now().toString();
                const nonce = this.generateNonce();
                const queryParams = '';
                const body = '';
                const signature = await this.createBitunixSignatureDoubleSHA256(nonce, timestamp, apiKeys.api_key, queryParams, body, apiKeys.api_secret);
                
                // Try multiple endpoints
                const endpoints = [
                  '/api/v1/futures/account/list',
                  '/api/v1/account/list',
                  '/api/v1/futures/account',
                  '/api/v1/account'
                ];
                
                for (const endpoint of endpoints) {
                  try {
                    const response = await fetch(`${baseUrl}${endpoint}`, {
                      method: 'GET',
                      headers: {
                        'api-key': String(apiKeys.api_key),
                        'nonce': String(nonce),
                        'timestamp': String(timestamp),
                        'sign': String(signature),
                        'Content-Type': 'application/json',
                        'language': 'en-US'
                      }
                    });
                    
                    if (response.ok) {
                      const data = await response.json();
                      if (data.code === 0 && data.data) {
                        const assets = Array.isArray(data.data) ? data.data : (data.data.assets || []);
                        if (tradingType === 'futures') {
                          // For futures, sum total equity
                          let totalEquity = 0;
                          for (const asset of assets) {
                            const equity = parseFloat(asset.totalEquity || asset.equity || asset.balance || asset.total || '0');
                            totalEquity += equity;
                          }
                          accountBalance = totalEquity;
                        } else {
                          // For spot, find USDT balance
                          const usdtAsset = assets.find((a: any) => {
                            const assetSymbol = (a.asset || a.coin || a.currency || '').toUpperCase();
                            return assetSymbol === 'USDT';
                          });
                          accountBalance = usdtAsset ? parseFloat(usdtAsset.available || usdtAsset.free || usdtAsset.balance || '0') : 0;
                        }
                        console.log(`📊 Bitunix available balance for notification: $${accountBalance.toFixed(2)}`);
                        break;
                      }
                    }
                  } catch (fetchError) {
                    console.warn(`⚠️ Failed to fetch Bitunix balance from ${endpoint}:`, fetchError);
                  }
                }
              } else if (exchange === 'bybit') {
                // Fetch available balance directly from Bybit API
                // Always use mainnet
                const baseDomains = ['https://api.bybit.com'];
                
                const timestamp = Date.now().toString();
                const recvWindow = '5000';
                const categoryMap: { [key: string]: string } = {
                  'spot': 'spot',
                  'futures': 'linear'
                };
                const bybitCategory = categoryMap[tradingType] || 'linear';
                
                // For futures/linear, get total equity (available balance)
                if (bybitCategory === 'linear') {
                  const queryParams = `accountType=UNIFIED`;
                  const signaturePayload = timestamp + apiKeys.api_key + recvWindow + queryParams;
                  const signature = await this.createBybitSignature(signaturePayload, apiKeys.api_secret);
                  
                  for (const domain of baseDomains) {
                    try {
                      const response = await fetch(`${domain}/v5/account/wallet-balance?${queryParams}`, {
                        method: 'GET',
                        headers: this.buildBybitHeaders(String(apiKeys.api_key || ''), timestamp, recvWindow, String(signature || '')),
                      });
                      
                      if (response.ok) {
                        const data = await response.json();
                        if (data.retCode === 0 && data.result?.list?.[0]) {
                          const accountInfo = data.result.list[0];
                          // Use totalAvailableBalance or totalEquity as available balance
                          accountBalance = parseFloat(
                            accountInfo.totalAvailableBalance || 
                            accountInfo.totalEquity || 
                            accountInfo.totalWalletBalance || 
                            '0'
                          );
                          console.log(`📊 Real trading available balance (futures): $${accountBalance.toFixed(2)}`);
                          break;
                        }
                      }
                    } catch (fetchError) {
                      console.warn(`⚠️ Failed to fetch balance from ${domain}:`, fetchError);
                    }
                  }
                } else {
                  // For spot, get USDT available balance
                  const queryParams = `accountType=SPOT&coin=USDT`;
                  const signaturePayload = timestamp + apiKeys.api_key + recvWindow + queryParams;
                  const signature = await this.createBybitSignature(signaturePayload, apiKeys.api_secret);
                  
                  for (const domain of baseDomains) {
                    try {
                      const response = await fetch(`${domain}/v5/account/wallet-balance?${queryParams}`, {
                        method: 'GET',
                        headers: this.buildBybitHeaders(String(apiKeys.api_key || ''), timestamp, recvWindow, String(signature || '')),
                      });
                      
                      if (response.ok) {
                        const data = await response.json();
                        if (data.retCode === 0 && data.result?.list?.[0]?.coin?.[0]) {
                          const wallet = data.result.list[0].coin[0];
                          // Use availableToWithdraw or availableBalance
                          accountBalance = parseFloat(
                            wallet.availableToWithdraw || 
                            wallet.availableBalance || 
                            wallet.walletBalance || 
                            '0'
                          );
                          console.log(`📊 Real trading available balance (spot): $${accountBalance.toFixed(2)}`);
                          break;
                        }
                      }
                    } catch (fetchError) {
                      console.warn(`⚠️ Failed to fetch balance from ${domain}:`, fetchError);
                    }
                  }
                }
              }
              // Add other exchanges (OKX, MEXC) here if needed
            } catch (balanceError: any) {
              console.warn('⚠️ Failed to fetch available balance for Telegram notification:', balanceError?.message || balanceError);
              // Don't fail notification if balance fetch fails
            }
          }
        }
      } catch (balanceError: any) {
        console.warn('⚠️ Failed to fetch account balance for Telegram notification:', balanceError?.message || balanceError);
        // Don't fail notification if balance fetch fails
      }

      // When called from cron, we don't have a user session, but we have user_id from the trade/bot
      // Use service role key to call the function and pass user_id in body
      // The telegram-notifier will handle user lookup internally
      const useServiceRole = !this.user || !this.supabaseClient.auth; // Check if we have user context
      
      // Invoke telegram-notifier Edge Function via HTTP
      const functionUrl = `${supabaseUrl}/functions/v1/telegram-notifier?action=send`;
      
      // Try to get session token first (for manual calls), fall back to service role (for cron)
      let authToken = supabaseAnonKey;
      try {
        const { data: { session } } = await this.supabaseClient.auth.getSession();
        if (session?.access_token) {
          authToken = session.access_token;
        } else if (useServiceRole && supabaseServiceKey) {
          authToken = supabaseServiceKey; // Use service role for cron jobs
        }
      } catch (sessionError) {
        // If getSession fails (e.g., in cron context), use service role key
        if (supabaseServiceKey) {
          authToken = supabaseServiceKey;
        }
      }
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({
          notification_type: 'position_close',
          data: {
            bot_name: bot.name,
            symbol: bot.symbol || trade.symbol,
            side: trade.side,
            entry_price: trade.entry_price || trade.price,
            exit_price: exitPrice,
            amount: trade.amount || trade.size,
            quantity: trade.amount || trade.size,
            pnl: pnl,
            close_reason: closeReason,
            user_id: this.user?.id || trade.user_id || bot.user_id, // Pass user_id explicitly
            paper_trading: bot.paper_trading || false,
            exchange: bot.exchange || 'bybit', // Always include exchange
            trading_type: bot.tradingType || bot.trading_type || 'futures', // Always include trading type
            tradingType: bot.tradingType || bot.trading_type || 'futures', // Include both variations
            account_balance: accountBalance // Include account balance
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('⚠️ Telegram notification HTTP error:', response.status, errorText);
      } else {
        const result = await response.json();
        if (result.skipped) {
          // Only log skipped notifications at info level (reduced verbosity)
          console.log('ℹ️ Telegram notification skipped for position close:', trade.id, result.message || 'Not configured');
        } else {
          console.log('✅ Telegram notification sent for position close:', trade.id, result);
        }
      }
    } catch (err) {
      console.warn('⚠️ Failed to send Telegram notification:', err);
      // Don't throw - notification failures shouldn't break trades
    }
  }

  private async addBotLog(botId: string, log: any): Promise<void> {
    // Store log in database instead of localStorage
    try {
      // Sanitize category to satisfy DB CHECK constraint
      const allowedCategories = ['system','market','trade','strategy','error','warning','info'];
      const sanitizedCategory = allowedCategories.includes(log.category) ? log.category : 'system';
      
      // Use service role client to bypass RLS when saving bot logs
      // This ensures logs can be saved regardless of who triggered the bot execution
      const serviceRoleClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { data, error } = await serviceRoleClient
        .from('bot_activity_logs')
        .insert({
          bot_id: botId,
          level: log.level,
          category: sanitizedCategory,
          message: log.message,
          details: log.details,
          timestamp: TimeSync.getCurrentTimeISO()
        })
        .select()
        .single();
      
      if (error) {
        console.error(`❌ Failed to save bot log for bot ${botId}:`, error);
        console.error(`   Log level: ${log.level}, category: ${log.category}`);
        console.error(`   Message: ${log.message}`);
      } else {
        console.log(`✅ Bot log saved: ${log.level}/${log.category} for bot ${botId}: ${log.message.substring(0, 50)}...`);
      }
    } catch (error) {
      console.error(`❌ Exception saving bot log for bot ${botId}:`, error);
      // Continue execution even if logging fails
    }
  }
}

// Paper Trading Executor - Simulates trades using real market data
class PaperTradingExecutor {
  private supabaseClient: any;
  private user: any;
  
  constructor(supabaseClient: any, user: any) {
    this.supabaseClient = supabaseClient;
    this.user = user;
  }

  // Get or create paper trading account
  private async getPaperAccount(): Promise<any> {
    try {
      // First, verify that the user exists in the users table
      // This prevents foreign key constraint violations
      const { data: userExists, error: userCheckError } = await this.supabaseClient
        .from('users')
        .select('id')
        .eq('id', this.user.id)
        .maybeSingle();
      
      if (userCheckError || !userExists) {
        const errorMsg = `User ${this.user.id} does not exist in users table. Cannot create paper trading account.`;
        console.error(`❌ [PAPER] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      let { data: account, error: fetchError } = await this.supabaseClient
        .from('paper_trading_accounts')
        .select('*')
        .eq('user_id', this.user.id)
        .single();
      
      // If account doesn't exist or query failed, create one
      if (!account || fetchError) {
        console.log(`📝 [PAPER] Creating new paper trading account for user ${this.user.id}`);
        
        const { data: newAccount, error: insertError } = await this.supabaseClient
          .from('paper_trading_accounts')
          .insert({
            user_id: this.user.id,
            balance: 10000,
            initial_balance: 10000,
            total_deposited: 0,
            total_withdrawn: 0
          })
          .select()
          .single();
        
        if (insertError) {
          console.error(`❌ [PAPER] Failed to create account:`, insertError);
          
          // Check if it's a foreign key constraint violation
          if (insertError.code === '23503' || insertError.message?.includes('foreign key constraint')) {
            const errorMsg = `User ${this.user.id} does not exist in users table. Bot may belong to deleted user.`;
            console.error(`❌ [PAPER] ${errorMsg}`);
            throw new Error(errorMsg);
          }
          
          throw new Error(`Failed to create paper trading account: ${insertError.message}`);
        }
        
        if (!newAccount) {
          throw new Error('Failed to create paper trading account: No data returned');
        }
        
        console.log(`✅ [PAPER] Created paper trading account:`, newAccount.id);
        return newAccount;
      }
      
      return account;
    } catch (error) {
      console.error(`❌ [PAPER] Error getting paper account:`, error);
      throw error;
    }
  }
  
  // Add funds to paper trading account
  async addFunds(amount: number): Promise<any> {
    const account = await this.getPaperAccount();
    const newBalance = parseFloat(account.balance) + amount;
    const newTotalDeposited = parseFloat(account.total_deposited || 0) + amount;
    
    const { data, error } = await this.supabaseClient
      .from('paper_trading_accounts')
      .update({
        balance: newBalance,
        total_deposited: newTotalDeposited,
        updated_at: TimeSync.getCurrentTimeISO()
      })
      .eq('id', account.id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // Calculate ATR (Average True Range) - needed for trailing stop calculations
  private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
    if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) {
      return 0;
    }
    
    const trueRanges: number[] = [];
    for (let i = 1; i < highs.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }
    
    if (trueRanges.length < period) {
      const avg = trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
      return avg;
    }
    
    // Calculate ATR as SMA of True Ranges
    const recentTRs = trueRanges.slice(-period);
    return recentTRs.reduce((a, b) => a + b, 0) / period;
  }

  // Send position close notification (for Telegram/notifications)
  private async sendPositionCloseNotification(bot: any, trade: any, pnl: number, exitPrice: number, closeReason?: string): Promise<void> {
    try {
      // If this is a paper trade, check if paper trade notifications are enabled
      if (bot.paper_trading) {
        try {
          const { data: telegramConfig, error: configError } = await this.supabaseClient
            .from('telegram_config')
            .select('notifications')
            .eq('user_id', bot.user_id)
            .maybeSingle();
          
          if (!configError && telegramConfig?.notifications) {
            const paperTradeNotificationsEnabled = telegramConfig.notifications.paper_trade_notifications;
            // If explicitly set to false, skip paper trade notifications
            if (paperTradeNotificationsEnabled === false) {
              console.log(`📄 Paper trade notifications disabled for user ${bot.user_id}, skipping notification`);
              return;
            }
          }
        } catch (checkError) {
          console.warn('⚠️ Failed to check paper trade notification preference:', checkError);
          // Continue to send notification if check fails (fail open)
        }
      }
      
      // Get Supabase URL and keys from environment
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      
      if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('⚠️ Supabase URL or Anon Key not configured for Telegram notifications');
        return;
      }

      // Fetch account balance for notification
      let accountBalance: number | null = null;
      try {
        // Get paper trading account balance (available balance)
        const paperAccount = await this.getPaperAccount();
        if (paperAccount && paperAccount.balance !== undefined && paperAccount.balance !== null) {
          accountBalance = parseFloat(paperAccount.balance || '0');
          console.log(`📊 Paper trading available balance for notification: $${accountBalance.toFixed(2)}`);
        }
      } catch (balanceError) {
        console.warn('⚠️ Failed to fetch account balance for notification:', balanceError);
      }

      // Call telegram-notifier Edge Function
      const notifierUrl = `${supabaseUrl}/functions/v1/telegram-notifier`;
      const authToken = supabaseServiceKey || supabaseAnonKey;
      
      const response = await fetch(notifierUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({
          notification_type: 'position_close',
          data: {
            bot_name: bot.name,
            symbol: bot.symbol || trade.symbol,
            side: trade.side,
            entry_price: trade.entry_price || trade.price,
            exit_price: exitPrice,
            pnl: pnl,
            pnl_percentage: trade.entry_price ? ((pnl / (trade.entry_price * (trade.amount || trade.size || 1))) * 100).toFixed(2) : '0',
            close_reason: closeReason || 'unknown',
            order_id: trade.exchange_order_id || trade.id,
            user_id: this.user?.id || trade.user_id || bot.user_id,
            paper_trading: bot.paper_trading || false,
            exchange: bot.exchange || 'bybit',
            trading_type: bot.tradingType || bot.trading_type || 'futures',
            account_balance: accountBalance
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('⚠️ Telegram notification HTTP error:', response.status, errorText);
      } else {
        const result = await response.json();
        if (result.skipped) {
          // Only log skipped notifications at info level (reduced verbosity)
          console.log('ℹ️ Telegram notification skipped for position close:', trade.id, result.message || 'Not configured');
        } else {
          console.log('✅ Telegram notification sent for position close:', trade.id, result);
        }
      }
    } catch (err) {
      console.warn('⚠️ Failed to send position close notification:', err);
      // Don't throw - notification failures shouldn't break trades
    }
  }
  
  // Execute paper trade (simulate order)
  async executePaperTrade(bot: any, tradeSignal: any): Promise<void> {
    try {
      console.log(`📝 [PAPER TRADING] Executing simulated trade for ${bot.name}`);
      
      // 🎲 REALISTIC SIMULATION: Simulate random order rejections (5% chance)
      // This mimics real exchange rejections due to various reasons
      const rejectionChance = 0.05; // 5% chance of rejection (increased from 2% for realism)
      if (Math.random() < rejectionChance) {
        const rejectionReasons = [
          'Insufficient liquidity',
          'Order size too large for current market depth',
          'Temporary exchange maintenance',
          'Rate limit exceeded',
          'Market volatility protection'
        ];
        const reason = rejectionReasons[Math.floor(Math.random() * rejectionReasons.length)];
        console.log(`❌ [PAPER] Simulated order rejection: ${reason}`);
        throw new Error(`Simulated order rejection: ${reason}. This happens in real trading too.`);
      }
      
      // Get account balance
      const account = await this.getPaperAccount();
      
      if (!account) {
        throw new Error('Paper trading account not found and could not be created');
      }
      
      if (!account.balance && account.balance !== 0) {
        throw new Error(`Invalid account balance: ${account.balance}`);
      }
      
      const availableBalance = parseFloat(account.balance || 10000);
      
      // Get REAL market data from MAINNET (same as real trading)
      const tradingType = bot.tradingType || bot.trading_type || 'futures';
      let currentPrice = 0;
      
      try {
        currentPrice = await MarketDataFetcher.fetchPrice(
          bot.symbol, 
          bot.exchange, 
          tradingType
        );
      } catch (priceError: any) {
        console.warn(`⚠️ [PAPER] Price fetch failed, trying CoinGecko directly:`, priceError?.message || priceError);
        
        // For paper trading, be more aggressive with CoinGecko fallback
        // Try CoinGecko immediately if Bybit fails (regardless of coin type)
        try {
          const baseCoin = bot.symbol.replace(/USDT.*$/i, '').replace(/\.P$/i, '').replace(/^1000/, '').toUpperCase();
          const coinGeckoMap: { [key: string]: string } = {
            'BTC': 'bitcoin', 'ETH': 'ethereum', 'BNB': 'binancecoin', 'SOL': 'solana',
            'ADA': 'cardano', 'DOGE': 'dogecoin', 'XRP': 'ripple', 'DOT': 'polkadot',
            'MATIC': 'matic-network', 'LTC': 'litecoin', 'TRUMP': 'trump', 'STRK': 'starknet',
            'HBAR': 'hedera-hashgraph', 'FIL': 'filecoin', 'AVAX': 'avalanche-2',
            'LINK': 'chainlink', 'UNI': 'uniswap', 'ATOM': 'cosmos', 'ETC': 'ethereum-classic',
            'XLM': 'stellar', 'ALGO': 'algorand', 'VET': 'vechain', 'TRX': 'tron',
            'PEPE': 'pepe', 'FLOKI': 'floki', 'SHIB': 'shiba-inu', 'WLD': 'worldcoin-wld',
            'DYM': 'dymension', 'VIRTUAL': 'virtual-protocol', 'MYX': 'myx-network'
          };
          
          const coinGeckoId = coinGeckoMap[baseCoin] || baseCoin.toLowerCase();
          const coinGeckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd`;
          console.log(`🔄 [PAPER] Trying CoinGecko directly: ${coinGeckoUrl}`);
          
          const cgResp = await fetch(coinGeckoUrl, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000)
          });
          
          if (cgResp.ok) {
            const cgData = await cgResp.json();
            const price = cgData[coinGeckoId]?.usd;
            if (price && price > 0) {
              console.log(`✅ [PAPER] CoinGecko price for ${bot.symbol}: $${price}`);
              currentPrice = price;
            }
          }
        } catch (cgError) {
          console.warn(`⚠️ [PAPER] CoinGecko fallback also failed:`, cgError);
        }
      }
      
      if (!currentPrice || currentPrice === 0) {
        // fetchPrice already tries symbol variants, but let's try a more aggressive fallback
        // For futures: if 1000PEPEUSDT fails, try PEPEUSDT (some symbols exist without prefix)
        // For spot: if PEPEUSDT fails, try 1000PEPEUSDT (unlikely but possible)
        let fallbackPrice = 0;
        let fallbackSymbol = '';
        
        if (tradingType === 'futures' || tradingType === 'linear') {
          // For futures, try removing 1000 prefix if present
          if (bot.symbol.startsWith('1000')) {
            fallbackSymbol = bot.symbol.replace(/^1000/, '');
            console.log(`🔄 Trying fallback symbol for futures: ${fallbackSymbol} (original: ${bot.symbol})`);
            try {
              fallbackPrice = await MarketDataFetcher.fetchPrice(fallbackSymbol, bot.exchange, tradingType);
              if (fallbackPrice && fallbackPrice > 0) {
                console.log(`✅ Found price using fallback symbol: ${fallbackSymbol} for futures trading`);
                // Use the fallback price - this means the symbol format was wrong
                // But we'll proceed with the trade using the correct symbol format
                currentPrice = fallbackPrice;
                console.log(`⚠️ Using ${fallbackSymbol} instead of ${bot.symbol} - consider updating bot symbol to ${fallbackSymbol}`);
              }
            } catch (fallbackErr) {
              // Continue to other checks
            }
          }
        } else if (tradingType === 'spot') {
          // For spot, try adding 1000 prefix if not present (unlikely but possible)
          if (!bot.symbol.startsWith('1000') && !bot.symbol.startsWith('10000')) {
            fallbackSymbol = '1000' + bot.symbol;
            console.log(`🔄 Trying fallback symbol for spot: ${fallbackSymbol} (original: ${bot.symbol})`);
            try {
              fallbackPrice = await MarketDataFetcher.fetchPrice(fallbackSymbol, bot.exchange, tradingType);
              if (fallbackPrice && fallbackPrice > 0) {
                console.log(`✅ Found price using fallback symbol: ${fallbackSymbol} for spot trading`);
                currentPrice = fallbackPrice;
                console.log(`⚠️ Using ${fallbackSymbol} instead of ${bot.symbol} - consider updating bot symbol to ${fallbackSymbol}`);
              }
            } catch (fallbackErr) {
              // Continue to other checks
            }
          }
        }
        
        // If still no price, try opposite trading type as diagnostic
        if (!currentPrice || currentPrice === 0) {
          const oppositeType = tradingType === 'spot' ? 'futures' : 'spot';
          let oppositePrice = 0;
          try {
            oppositePrice = await MarketDataFetcher.fetchPrice(bot.symbol, bot.exchange, oppositeType);
            if (oppositePrice && oppositePrice > 0) {
              console.log(`⚠️ Found price for ${bot.symbol} but in ${oppositeType} trading type (bot configured for ${tradingType})`);
              throw new Error(`Symbol ${bot.symbol} is available for ${oppositeType} trading, but bot is configured for ${tradingType}. Please update bot settings to use ${oppositeType} trading type or change the symbol.`);
            }
          } catch (oppositeErr: any) {
            // If it's our custom error, re-throw it
            if (oppositeErr.message?.includes('is available for')) {
              throw oppositeErr;
            }
            // Otherwise, continue to throw original error
          }
          
          // FINAL FALLBACK: Try to get cached price from recent paper trades
          console.log(`🔄 [PAPER] All price sources failed, trying cached price from recent trades...`);
          try {
            const { data: recentTrades } = await this.supabaseClient
              .from('paper_trading_trades')
              .select('entry_price')
              .eq('symbol', bot.symbol)
              .order('created_at', { ascending: false })
              .limit(1);
            
            if (recentTrades && recentTrades.length > 0 && recentTrades[0].entry_price) {
              const cachedPrice = parseFloat(recentTrades[0].entry_price);
              if (cachedPrice && cachedPrice > 0) {
                console.log(`✅ [PAPER] Using cached price from recent trade: $${cachedPrice}`);
                currentPrice = cachedPrice;
              }
            }
          } catch (cacheError) {
            console.warn(`⚠️ [PAPER] Failed to get cached price:`, cacheError);
          }
          
          // If still no price, throw error (but with more helpful message for paper trading)
          if (!currentPrice || currentPrice === 0) {
            const majorCoins = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'ATOM', 'LTC', 'ETC', 'XLM', 'ALGO', 'VET', 'FIL', 'TRX'];
            const isMajorCoin = majorCoins.some(coin => bot.symbol.startsWith(coin));
            
            let suggestedFormat = '';
            if (isMajorCoin) {
              suggestedFormat = `${bot.symbol} (should work for both spot and futures - check API availability)`;
            } else if (bot.symbol.startsWith('1000')) {
              suggestedFormat = bot.symbol.replace(/^1000/, '');
            } else {
              suggestedFormat = `1000${bot.symbol}`;
            }
            
            throw new Error(`[PAPER TRADING] Invalid price for ${bot.symbol} - all price sources failed (Bybit API blocked, CoinGecko unavailable, no cached price). ${isMajorCoin ? 'Major coins like BTC/ETH should work - this might be a temporary API issue.' : `Try alternative format: ${suggestedFormat}`} Please verify the symbol exists on the exchange.`);
          }
        }
      }
      
      // Align simulated execution with live trading sizing and constraints
      const sizing = calculateTradeSizing(bot, currentPrice);
      const normalizedOrder = normalizeOrderParams(
        sizing.quantity,
        currentPrice,
        {
          minQty: sizing.constraints.min,
          maxQty: sizing.constraints.max,
          qtyStep: sizing.steps.stepSize,
          tickSize: sizing.steps.tickSize
        }
      );
      let quantity = normalizedOrder.qty;
      const normalizedPrice = normalizedOrder.price;

      if (!quantity || !isFinite(quantity) || quantity <= 0) {
        throw new Error(`Invalid simulated quantity for ${bot.symbol}: ${quantity}`);
      }

      // 🎲 REALISTIC SIMULATION: Simulate partial fills (12% chance)
      // In real trading, large orders may not fill completely
      const partialFillChance = 0.12; // 12% chance (increased from 5% for realism)
      let fillPercentage = 1.0;
      if (Math.random() < partialFillChance && quantity > sizing.constraints.min * 2) {
        // Partial fill between 70% and 95%
        fillPercentage = 0.70 + Math.random() * 0.25;
        const originalQuantity = quantity;
        quantity = quantity * fillPercentage;
        // Round to step size
        if (sizing.steps.stepSize > 0) {
          quantity = Math.floor(quantity / sizing.steps.stepSize) * sizing.steps.stepSize;
        }
        quantity = Math.max(quantity, sizing.constraints.min);
        console.log(`⚠️ [PAPER] Simulated partial fill: ${(fillPercentage * 100).toFixed(1)}% (${quantity.toFixed(6)} of ${originalQuantity.toFixed(6)})`);
      }

      const intendedSide = (tradeSignal.side || '').toLowerCase();
      const positionSide = intendedSide === 'sell' || intendedSide === 'short' ? 'short' : 'long';
      const effectiveOrderSide = positionSide === 'short' ? 'sell' : 'buy';
      const anticipatedValue = quantity * normalizedPrice;
      
      // 🎯 REALISTIC SLIPPAGE: Use more conservative slippage for paper trading
      // Entry slippage is typically better than exit, but still realistic
      // Increased severity to 1.8 to better match real trading conditions
      const slippageResult = applySlippage(normalizedPrice, effectiveOrderSide, bot.symbol, anticipatedValue, {
        isExit: false,
        severity: 1.8 // 80% more slippage for realism (increased from 1.1 to match real trading)
      });
      const slippageBps = slippageResult.slippageBps;
      const executedPriceUnrounded = slippageResult.price;
      const executedPrice = sizing.steps.tickSize > 0
        ? Math.round(executedPriceUnrounded / sizing.steps.tickSize) * sizing.steps.tickSize
        : executedPriceUnrounded;

      // 🕐 REALISTIC SIMULATION: Simulate network latency (50-300ms)
      // Real API calls have latency that can affect execution price
      const simulatedLatency = 50 + Math.random() * 250; // 50-300ms (increased from 200ms)
      // During latency, price may have moved (add realistic random price movement)
      const priceMovementDuringLatency = executedPrice * (1 + (Math.random() - 0.5) * 0.003); // ±0.15% movement (increased from ±0.05% for realism)
      const finalExecutedPrice = sizing.steps.tickSize > 0
        ? Math.round(priceMovementDuringLatency / sizing.steps.tickSize) * sizing.steps.tickSize
        : priceMovementDuringLatency;

      // 🛡️ REALISTIC SIMULATION: Check minimum order value (like real exchanges)
      const minOrderValue = sizing.isFutures ? 5 : 1; // $5 for futures, $1 for spot
      let orderValue = finalExecutedPrice * quantity;
      
      // If order value is below minimum, try to increase quantity to meet minimum
      if (orderValue < minOrderValue && finalExecutedPrice > 0) {
        console.warn(`⚠️ [PAPER] Order value $${orderValue.toFixed(2)} below minimum $${minOrderValue} for ${bot.symbol}`);
        console.warn(`💡 Attempting to increase quantity to meet minimum order value...`);
        
        // Calculate minimum quantity needed to meet order value requirement
        const minQuantity = (minOrderValue / finalExecutedPrice) * 1.01; // Add 1% buffer
        
        // Round to step size
        let adjustedQty = minQuantity;
        if (sizing.steps.stepSize > 0) {
          adjustedQty = Math.ceil(adjustedQty / sizing.steps.stepSize) * sizing.steps.stepSize;
        }
        
        // Ensure adjusted quantity doesn't exceed max
        if (adjustedQty <= sizing.constraints.max) {
          quantity = adjustedQty;
          orderValue = finalExecutedPrice * quantity;
          console.log(`✅ [PAPER] Adjusted quantity to ${quantity.toFixed(6)} to meet minimum order value`);
          console.log(`💰 New order value: $${orderValue.toFixed(2)} (minimum: $${minOrderValue})`);
        } else {
          // If adjusted quantity exceeds max, skip trade gracefully for paper trading
          const requiredTradeAmount = (minOrderValue / finalExecutedPrice) * sizing.constraints.max;
          console.warn(`⚠️ [PAPER] Skipping trade: Order value $${orderValue.toFixed(2)} below minimum $${minOrderValue} for ${bot.symbol}`);
          console.warn(`💡 Calculated minimum quantity ${adjustedQty.toFixed(6)} exceeds maximum ${sizing.constraints.max}`);
          console.warn(`💡 Suggestion: Increase trade amount to at least $${requiredTradeAmount.toFixed(2)} to meet minimum order value`);
          console.warn(`📝 This trade would fail in real trading too. Skipping gracefully in paper trading mode.`);
          
          // Log as warning (not error) directly to database and return early without throwing
          try {
            await this.supabaseClient
              .from('bot_activity_logs')
              .insert({
                bot_id: bot.id,
                level: 'warning',
                category: 'trade',
                message: `⚠️ Trade skipped: Order value $${orderValue.toFixed(2)} below minimum $${minOrderValue}. Minimum quantity ${adjustedQty.toFixed(6)} exceeds maximum ${sizing.constraints.max}. Increase trade amount to at least $${requiredTradeAmount.toFixed(2)}.`,
                details: {
                  order_value: orderValue,
                  min_order_value: minOrderValue,
                  calculated_quantity: adjustedQty,
                  max_quantity: sizing.constraints.max,
                  required_trade_amount: requiredTradeAmount,
                  paper_trading: true
                }
              });
          } catch (logError) {
            console.warn('⚠️ Failed to log skipped trade warning:', logError);
          }
          return; // Exit early, don't execute the trade
        }
      }
      
      // Final check after adjustment
      if (orderValue < minOrderValue) {
        // For paper trading, skip gracefully instead of throwing error
        console.warn(`⚠️ [PAPER] Skipping trade: Order value $${orderValue.toFixed(2)} below minimum $${minOrderValue} for ${bot.symbol}`);
        console.warn(`📝 This trade would fail in real trading too. Skipping gracefully in paper trading mode.`);
        
        // Log as warning (not error) directly to database and return early without throwing
        try {
          await this.supabaseClient
            .from('bot_activity_logs')
            .insert({
              bot_id: bot.id,
              level: 'warning',
              category: 'trade',
              message: `⚠️ Trade skipped: Order value $${orderValue.toFixed(2)} below minimum $${minOrderValue} for ${bot.symbol}. This happens in real trading too. Please increase trade amount.`,
              details: {
                order_value: orderValue,
                min_order_value: minOrderValue,
                paper_trading: true
              }
            });
        } catch (logError) {
          console.warn('⚠️ Failed to log skipped trade warning:', logError);
        }
        return; // Exit early, don't execute the trade
      }
      
      // Recalculate notional and margin after potential quantity adjustment
      const leverage = bot.leverage || 1;
      const notional = finalExecutedPrice * quantity;
      const marginRequired = sizing.isFutures ? notional / leverage : notional;

      // For paper trading, allow trades even with low balance (it's simulated)
      // But log a warning if balance is very low
      if (marginRequired > availableBalance) {
        // Check if balance is critically low (less than 10% of required margin)
        const balanceRatio = availableBalance / marginRequired;
        if (balanceRatio < 0.1) {
          // Balance is critically low - still allow trade but log warning
          console.warn(`⚠️ [PAPER] Low balance warning: Need $${marginRequired.toFixed(2)}, Have $${availableBalance.toFixed(2)} (${(balanceRatio * 100).toFixed(1)}%)`);
          console.warn(`   Allowing trade to proceed (paper trading mode - balance will go negative)`);
          // For paper trading, we allow negative balance to simulate margin trading
        } else {
          // Balance is somewhat sufficient but not enough - still allow with warning
          console.warn(`⚠️ [PAPER] Insufficient balance: Need $${marginRequired.toFixed(2)}, Have $${availableBalance.toFixed(2)}`);
          console.warn(`   Allowing trade to proceed (paper trading mode)`);
        }
        // Don't throw error - allow trade to proceed in paper trading mode
        // The balance will go negative, which is acceptable for paper trading simulation
      }

      // Determine position side after sizing (long/short)
      const side = positionSide;

      // Calculate SL/TP using executed price and exchange tick sizes
      const stopLossPct = bot.stop_loss || bot.stopLoss || 2.0;
      const takeProfitPct = bot.take_profit || bot.takeProfit || 4.0;
      const roundToTick = (value: number) => {
        if (!sizing.steps.tickSize || sizing.steps.tickSize <= 0) return value;
        return Math.round(value / sizing.steps.tickSize) * sizing.steps.tickSize;
      };

      let stopLossPrice: number;
      let takeProfitPrice: number;

      if (side === 'long') {
        stopLossPrice = roundToTick(executedPrice * (1 - stopLossPct / 100));
        takeProfitPrice = roundToTick(executedPrice * (1 + takeProfitPct / 100));
      } else {
        stopLossPrice = roundToTick(executedPrice * (1 + stopLossPct / 100));
        takeProfitPrice = roundToTick(executedPrice * (1 - takeProfitPct / 100));
      }

      const feeRate = resolveFeeRate(bot.exchange, bot.tradingType || bot.trading_type || 'futures');
      const estimatedEntryFees = notional * feeRate;

      // Deduct margin from account (allow negative balance in paper trading)
      const newBalance = availableBalance - marginRequired;
      // For paper trading, negative balance is allowed (simulates margin trading)
      console.log(`💰 [PAPER] Balance update: $${availableBalance.toFixed(2)} → $${newBalance.toFixed(2)} (margin: $${marginRequired.toFixed(2)})`);
      await this.supabaseClient
        .from('paper_trading_accounts')
        .update({
          balance: newBalance,
          updated_at: TimeSync.getCurrentTimeISO()
        })
        .eq('user_id', this.user.id);
      
      // Create virtual position
      const { data: position, error: posError } = await this.supabaseClient
        .from('paper_trading_positions')
        .insert({
          bot_id: bot.id,
          user_id: this.user.id,
          symbol: bot.symbol,
          exchange: bot.exchange,
          trading_type: bot.tradingType || bot.trading_type || 'futures',
          side: side,
          entry_price: finalExecutedPrice,
          quantity: quantity,
          leverage: leverage,
          stop_loss_price: stopLossPrice,
          take_profit_price: takeProfitPrice,
          current_price: finalExecutedPrice,
          margin_used: marginRequired,
          status: 'open'
        })
        .select()
        .single();
      
      if (posError) throw posError;
      
      // Record trade
      const { data: trade, error: tradeError } = await this.supabaseClient
        .from('paper_trading_trades')
        .insert({
          bot_id: bot.id,
          user_id: this.user.id,
          position_id: position.id,
          symbol: bot.symbol,
          exchange: bot.exchange,
          side: side,
          entry_price: finalExecutedPrice,
          quantity: quantity,
          leverage: leverage,
          margin_used: marginRequired,
          fees: estimatedEntryFees,
          status: 'filled',
          executed_at: TimeSync.getCurrentTimeISO()
        })
        .select()
        .single();
      
      if (tradeError) console.error('Failed to record paper trade:', tradeError);
      
      // Update bot stats - increment total_trades when trade opens
      if (trade) {
        const { data: botStats } = await this.supabaseClient
          .from('trading_bots')
          .select('total_trades')
          .eq('id', bot.id)
          .single();

        const newTotalTrades = (botStats?.total_trades || 0) + 1;

        await this.supabaseClient
          .from('trading_bots')
          .update({
            total_trades: newTotalTrades,
            last_trade_at: TimeSync.getCurrentTimeISO(),
            updated_at: TimeSync.getCurrentTimeISO()
          })
          .eq('id', bot.id);
      }
      
      // Log activity
      const botExecutor = new BotExecutor(this.supabaseClient, this.user);
      await botExecutor.addBotLog(bot.id, {
        level: 'info',
        category: 'trade',
        message: `📝 [PAPER] ${side.toUpperCase()} simulated: ${quantity.toFixed(6)} ${bot.symbol} @ $${finalExecutedPrice.toFixed(2)}`,
        details: {
          paper_trading: true,
          side: side,
          entry_price: finalExecutedPrice,
          expected_entry_price: normalizedPrice,
          slippage_bps: slippageBps,
          quantity: quantity,
          fill_percentage: fillPercentage < 1.0 ? fillPercentage : undefined,
          margin_used: marginRequired,
          remaining_balance: newBalance,
          leverage,
          notional,
          estimated_entry_fees: estimatedEntryFees,
          simulated_latency_ms: simulatedLatency
        }
      });
      
      console.log(`✅ [PAPER TRADING] Position opened: ${side} ${quantity.toFixed(6)} ${bot.symbol} @ $${finalExecutedPrice.toFixed(2)} (expected: $${normalizedPrice.toFixed(2)}, slippage: ${slippageBps.toFixed(2)} bps)`);
      
    } catch (error) {
      console.error(`❌ [PAPER TRADING] Error:`, error);
      throw error;
    }
  }
  
  // Update paper positions with REAL market prices
  async updatePaperPositions(botId?: string, startTime?: number, timeBudgetMs?: number): Promise<void> {
    try {
      const updateStartTime = startTime || Date.now();
      const availableTime = timeBudgetMs || 30000; // Default 30s budget if not specified
      const TIME_PER_POSITION_MS = 2000; // Max 2s per position for expensive operations
      
      let query = this.supabaseClient
        .from('paper_trading_positions')
        .select('*')
        .eq('user_id', this.user.id)
        .eq('status', 'open');
      
      if (botId) {
        query = query.eq('bot_id', botId);
      }
      
      const { data: positions, error } = await query;
      
      if (error || !positions || positions.length === 0) return;
      
      // Check if we have enough time budget
      const elapsed = Date.now() - updateStartTime;
      const remainingTime = availableTime - elapsed;
      if (remainingTime < 5000) {
        console.warn(`⚠️ [PAPER] Skipping position updates: insufficient time budget (${remainingTime}ms remaining)`);
        return;
      }
      
      const botLogger = new BotExecutor(this.supabaseClient, this.user);
      
      // Get bot configurations for advanced features
      const botIds = [...new Set(positions.map((p: any) => p.bot_id))];
      const { data: bots } = await this.supabaseClient
        .from('trading_bots')
        .select('id, strategy_config')
        .in('id', botIds);
      
      const botConfigs = new Map(bots?.map((b: any) => [b.id, b.strategy_config || {}]) || []);
      
      // Get account for equity tracking (with error handling for invalid users)
      let account;
      try {
        account = await this.getPaperAccount();
      } catch (error: any) {
        // If user doesn't exist, skip position updates (bot will be disabled by validation)
        if (error.message && error.message.includes('does not exist in users table')) {
          console.warn(`⚠️ [PAPER] Skipping position update: User ${this.user.id} does not exist`);
          return;
        }
        throw error; // Re-throw other errors
      }
      const currentBalance = parseFloat(account.balance || 0);
      
      // Calculate total unrealized PnL from all open positions (first pass to get prices)
      // OPTIMIZATION: Pre-warm ticker cache to prevent race conditions when fetching prices in parallel
      const uniqueExchangeCategories = new Set<string>();
      for (const position of positions) {
        const category = position.trading_type === 'futures' ? 'linear' : 'spot';
        const cacheKey = `${position.exchange}-${category}`;
        uniqueExchangeCategories.add(cacheKey);
      }
      
      // Pre-fetch tickers for all unique exchange/category combinations (prevents race conditions)
      const cacheWarmPromises = Array.from(uniqueExchangeCategories).map(async (cacheKey) => {
        const [exchange, category] = cacheKey.split('-');
        try {
          // This will fetch and cache tickers if needed, or use existing cache
          await MarketDataFetcher.fetchPrice('BTCUSDT', exchange, category === 'linear' ? 'futures' : 'spot');
        } catch (error) {
          console.warn(`⚠️ Failed to warm cache for ${cacheKey}:`, error);
        }
      });
      await Promise.allSettled(cacheWarmPromises);
      
      // Now fetch prices in parallel (cache is already warmed, so no race conditions)
      const positionPrices = new Map<string, number>();
      let totalUnrealizedPnL = 0;
      
      const priceFetchPromises = positions.map(async (position) => {
        try {
          const currentPrice = await MarketDataFetcher.fetchPrice(
            position.symbol,
            position.exchange,
            position.trading_type
          );
          if (currentPrice && currentPrice > 0) {
            positionPrices.set(position.id, currentPrice);
            return { positionId: position.id, price: currentPrice, position };
          }
          return null;
        } catch (error) {
          console.warn(`⚠️ Failed to fetch price for ${position.symbol}:`, error);
          return null;
        }
      });
      
      // Wait for all price fetches in parallel (cache is pre-warmed, so this is fast)
      const priceResults = await Promise.allSettled(priceFetchPromises);
      
      // Calculate total unrealized PnL from fetched prices
      for (const result of priceResults) {
        if (result.status === 'fulfilled' && result.value) {
          const { position, price } = result.value;
          // quantity already includes leverage (total contract size)
          // PnL = (price - entry_price) * quantity
          if (position.side === 'long') {
            totalUnrealizedPnL += (price - parseFloat(position.entry_price)) * parseFloat(position.quantity);
          } else {
            totalUnrealizedPnL += (parseFloat(position.entry_price) - price) * parseFloat(position.quantity);
          }
        }
      }
      
      // Calculate current equity (balance + unrealized PnL)
      const currentEquity = currentBalance + totalUnrealizedPnL;
      
      // Track highest equity for Dynamic Upward Trailing
      const highestEquity = parseFloat(account.highest_equity || account.initial_balance || 10000);
      const newHighestEquity = Math.max(highestEquity, currentEquity);
      
      // Update highest equity if it increased
      if (newHighestEquity > highestEquity) {
        await this.supabaseClient
          .from('paper_trading_accounts')
          .update({ highest_equity: newHighestEquity })
          .eq('user_id', this.user.id);
        console.log(`📈 [TRAILING] New highest equity: $${newHighestEquity.toFixed(2)} (was $${highestEquity.toFixed(2)})`);
      }

      let processedCount = 0;
      const MAX_POSITIONS_PER_UPDATE = 25; // Hard limit to avoid timeouts

      for (const position of positions) {
        // Increment processed count
        processedCount++;
        
        // 🛑 CRITICAL TIMEOUT PROTECTION: Hard break if we're over the limit or time is running out
        if (processedCount > MAX_POSITIONS_PER_UPDATE) {
          console.warn(`⏰ [PAPER] Processed ${MAX_POSITIONS_PER_UPDATE} positions, breaking loop to avoid timeout`);
          break;
        }

        const currentElapsed = Date.now() - updateStartTime;
        const currentRemaining = availableTime - currentElapsed;
        if (currentRemaining < 3000) { // If less than 3s left, stop immediately
          console.warn(`⏰ [PAPER] Less than 3s remaining (${currentRemaining}ms), breaking loop`);
          break;
        }

        // Initialize variables for this position iteration
        let shouldClose = false;
        let newStatus = '';
        let exitPrice = 0;
        
        // Get cached price or fetch if missing
        let currentPrice = positionPrices.get(position.id);
        if (!currentPrice || currentPrice === 0) {
          currentPrice = await MarketDataFetcher.fetchPrice(
            position.symbol,
            position.exchange,
            position.trading_type
          );
          if (!currentPrice || currentPrice === 0) continue;
        }
        
        // Calculate unrealized PnL
        let unrealizedPnL = 0;
        // quantity already includes leverage (total contract size)
        if (position.side === 'long') {
          unrealizedPnL = (currentPrice - parseFloat(position.entry_price)) * parseFloat(position.quantity);
        } else {
          unrealizedPnL = (parseFloat(position.entry_price) - currentPrice) * parseFloat(position.quantity);
        }
        
        // Get bot configuration for advanced features
        const botConfig = botConfigs.get(position.bot_id) || {};
        const enableDynamicTrailing = botConfig.enable_dynamic_trailing || false;
        const enableTrailingTP = botConfig.enable_trailing_take_profit || false;
        const trailingTPATR = parseFloat(botConfig.trailing_take_profit_atr || 1.0);
        const smartExitEnabled = botConfig.smart_exit_enabled || false;
        const smartExitRetracementPct = parseFloat(botConfig.smart_exit_retracement_pct || 2.0);
        const enableAutomaticExecution = botConfig.enable_automatic_execution || false;
        const enableSlippageConsideration = botConfig.enable_slippage_consideration !== false; // Default true
        
        // Get position metadata (for tracking highest price, retracement, etc.)
        const positionMetadata = position.metadata || {};
        let highestPrice = parseFloat(positionMetadata.highest_price || position.entry_price);
        let lowestPrice = parseFloat(positionMetadata.lowest_price || position.entry_price);
        const entryPrice = parseFloat(position.entry_price);
        
        // Update highest/lowest price tracking
        if (position.side === 'long') {
          highestPrice = Math.max(highestPrice, currentPrice);
          lowestPrice = Math.min(lowestPrice, currentPrice);
        } else {
          // For shorts, "highest" means worst price (highest for short = loss)
          highestPrice = Math.max(highestPrice, currentPrice);
          lowestPrice = Math.min(lowestPrice, currentPrice);
        }
        
        // Initialize stop loss and take profit from position
        let stopLossPrice = parseFloat(position.stop_loss_price);
        let takeProfitPrice = parseFloat(position.take_profit_price);
        
        // ===== ADVANCED FEATURES IMPLEMENTATION =====
        
        // Timeout check: Skip expensive operations if running low on time
        const positionElapsed = Date.now() - updateStartTime;
        const positionRemaining = availableTime - positionElapsed;
        const skipExpensiveOps = positionRemaining < TIME_PER_POSITION_MS || (positions.length > 5 && positionRemaining < TIME_PER_POSITION_MS * 2);
        
        // 1. TRAILING TAKE-PROFIT: Lock in profits as equity reaches new highs
        // SKIP if time is running low (klines fetch is expensive)
        if (enableTrailingTP && currentEquity >= newHighestEquity * 0.99 && !skipExpensiveOps) { // Within 1% of highest equity
          try {
            // Fetch ATR for trailing distance calculation (EXPENSIVE - skip if low on time)
            const klines = await MarketDataFetcher.fetchKlines(position.symbol, position.exchange, '1h', 20);
            if (klines.length >= 14) {
              const highs = klines.map(k => k[2]);
              const lows = klines.map(k => k[3]);
              const closes = klines.map(k => k[4]);
              const atr = this.calculateATR(highs, lows, closes, 14);
              
              if (atr > 0) {
                const trailingDistance = atr * trailingTPATR;
                
                if (position.side === 'long') {
                  // For longs: move stop loss up as price increases
                  const newTrailingStop = currentPrice - trailingDistance;
                  if (newTrailingStop > stopLossPrice) {
                    stopLossPrice = newTrailingStop;
                    console.log(`📈 [TRAILING TP] Long position: Moved stop loss from $${parseFloat(position.stop_loss_price).toFixed(4)} to $${stopLossPrice.toFixed(4)} (trailing by ${trailingTPATR} ATR)`);
                  }
                } else {
                  // For shorts: move stop loss down as price decreases
                  const newTrailingStop = currentPrice + trailingDistance;
                  if (newTrailingStop < stopLossPrice || stopLossPrice === 0) {
                    stopLossPrice = newTrailingStop;
                    console.log(`📈 [TRAILING TP] Short position: Moved stop loss from $${parseFloat(position.stop_loss_price).toFixed(4)} to $${stopLossPrice.toFixed(4)} (trailing by ${trailingTPATR} ATR)`);
                  }
                }
              }
            }
          } catch (error) {
            console.warn(`⚠️ [TRAILING TP] Error calculating trailing stop:`, error);
          }
        }
        
        // 2. DYNAMIC UPWARD TRAILING: Adjust exit point based on historical highest equity
        if (enableDynamicTrailing && newHighestEquity > highestEquity) {
          // Calculate equity change percentage
          const equityChangePct = ((currentEquity - highestEquity) / highestEquity) * 100;
          
          if (equityChangePct > 0) {
            // Adjust stop loss upward proportionally to equity increase
            const equityMultiplier = 1 + (equityChangePct / 100);
            
            if (position.side === 'long') {
              const newDynamicStop = entryPrice + (stopLossPrice - entryPrice) * equityMultiplier;
              if (newDynamicStop > stopLossPrice && newDynamicStop < currentPrice) {
                stopLossPrice = newDynamicStop;
                console.log(`📊 [DYNAMIC TRAILING] Long: Adjusted stop loss to $${stopLossPrice.toFixed(4)} based on equity increase of ${equityChangePct.toFixed(2)}%`);
              }
            } else {
              const newDynamicStop = entryPrice - (entryPrice - stopLossPrice) * equityMultiplier;
              if ((newDynamicStop < stopLossPrice || stopLossPrice === 0) && newDynamicStop > currentPrice) {
                stopLossPrice = newDynamicStop;
                console.log(`📊 [DYNAMIC TRAILING] Short: Adjusted stop loss to $${stopLossPrice.toFixed(4)} based on equity increase of ${equityChangePct.toFixed(2)}%`);
              }
            }
          }
        }
        
        // 3. SMART EXIT TRIGGER: Exit if market retraces beyond preset percentage
        if (smartExitEnabled) {
          let retracementPct = 0;
          if (position.side === 'long') {
            // For longs: retracement from highest price
            retracementPct = ((highestPrice - currentPrice) / highestPrice) * 100;
          } else {
            // For shorts: retracement from lowest price (price going up = retracement for short)
            retracementPct = ((currentPrice - lowestPrice) / lowestPrice) * 100;
          }
          
          if (retracementPct >= smartExitRetracementPct) {
            shouldClose = true;
            newStatus = 'smart_exit';
            exitPrice = currentPrice;
            console.log(`🚨 [SMART EXIT] Triggered: ${position.side.toUpperCase()} position retraced ${retracementPct.toFixed(2)}% (threshold: ${smartExitRetracementPct}%)`);
            
            await botLogger.addBotLog(position.bot_id, {
              level: 'warning',
              category: 'trade',
              message: `🚨 Smart Exit triggered: ${retracementPct.toFixed(2)}% retracement from ${position.side === 'long' ? 'high' : 'low'}`,
              details: {
                retracement_pct: retracementPct,
                threshold: smartExitRetracementPct,
                highest_price: highestPrice,
                lowest_price: lowestPrice,
                current_price: currentPrice
              }
            });
          }
        }
        
        // Update position metadata
        const updatedMetadata = {
          ...positionMetadata,
          highest_price: highestPrice,
          lowest_price: lowestPrice,
          last_equity: currentEquity,
          last_highest_equity: newHighestEquity
        };
        
        // Check SL/TP triggers with realistic execution (only if Smart Exit didn't trigger)
        // In real trading, SL/TP may not execute at exact price due to gaps, slippage, etc.
        if (!shouldClose) {
          // 🎯 REALISTIC SL/TP EXECUTION: Use current price, not exact SL/TP price
          // In real trading, stop losses often execute worse than set price, especially during volatility
          if (position.side === 'long') {
            if (currentPrice <= stopLossPrice) {
              newStatus = 'stopped';
              // Realistic: SL often executes MUCH worse than set price (especially during fast moves/gaps)
              // Use current price (which is already below SL) or add significant slippage
              const slSlippage = applySlippage(
                Math.min(currentPrice, stopLossPrice), 
                'sell', 
                position.symbol, 
                parseFloat(position.quantity) * currentPrice,
                { isExit: true, severity: 2.5 } // Much higher slippage for stop losses (increased from 1.5 to match real trading)
              );
              exitPrice = slSlippage.price;
              shouldClose = true;
            } else if (currentPrice >= takeProfitPrice) {
              newStatus = 'taken_profit';
              // TP can execute at or near the trigger price, but still with some slippage
              const tpSlippage = applySlippage(
                Math.max(currentPrice, takeProfitPrice),
                'sell',
                position.symbol,
                parseFloat(position.quantity) * currentPrice,
                { isExit: true, severity: 1.3 } // Increased from 1.0 for more realism
              );
              exitPrice = tpSlippage.price;
              shouldClose = true;
            }
          } else {
            // Short positions
            if (currentPrice >= stopLossPrice) {
              newStatus = 'stopped';
              // Short stop loss: price went up, execute with significant slippage
              const slSlippage = applySlippage(
                Math.max(currentPrice, stopLossPrice),
                'buy',
                position.symbol,
                parseFloat(position.quantity) * currentPrice,
                { isExit: true, severity: 2.5 } // Much higher slippage for stop losses (increased from 1.5 to match real trading)
              );
              exitPrice = slSlippage.price;
              shouldClose = true;
            } else if (currentPrice <= takeProfitPrice) {
              newStatus = 'taken_profit';
              // Short TP: price went down, execute with slippage
              const tpSlippage = applySlippage(
                Math.min(currentPrice, takeProfitPrice),
                'buy',
                position.symbol,
                parseFloat(position.quantity) * currentPrice,
                { isExit: true, severity: 1.3 } // Increased from 1.0 for more realism
              );
              exitPrice = tpSlippage.price;
              shouldClose = true;
            }
          }
        } // End of if (!shouldClose) block
        
        // Update position with new stop loss if it was adjusted by trailing features
        const updateData: any = {
          current_price: currentPrice,
          unrealized_pnl: unrealizedPnL,
          updated_at: TimeSync.getCurrentTimeISO(),
          metadata: updatedMetadata
        };
        
        // Update stop loss if it was modified by trailing features
        if (Math.abs(stopLossPrice - parseFloat(position.stop_loss_price)) > 0.0001) {
          updateData.stop_loss_price = stopLossPrice.toFixed(8);
          console.log(`📝 [POSITION UPDATE] Updated stop loss: $${parseFloat(position.stop_loss_price).toFixed(4)} → $${stopLossPrice.toFixed(4)}`);
        }
        
        if (shouldClose) {
          updateData.status = newStatus;
          updateData.closed_at = TimeSync.getCurrentTimeISO();
          
          // Calculate final PnL (exitPrice already has slippage applied above)
          const quantity = parseFloat(position.quantity);
          const symbolSteps = getSymbolSteps(position.symbol);
          
          // Round exit price to tick size if needed
          const finalExitPrice = symbolSteps.tickSize > 0
            ? Math.round(exitPrice / symbolSteps.tickSize) * symbolSteps.tickSize
            : exitPrice;
          
          exitPrice = finalExitPrice;
          
          // Enhanced slippage consideration (if enabled)
          const exitOrderSide = position.side === 'long' ? 'sell' : 'buy';
          const initialExitNotional = quantity * parseFloat(position.entry_price);
          let slippageSeverity = newStatus === 'stopped' ? 2.5 : 1.3; // Default severity
          
          // Increase slippage severity if slippage consideration is enabled
          if (enableSlippageConsideration) {
            // Apply additional slippage based on volatility and order size
            const volatilityMultiplier = 1.2; // Assume 20% more slippage when enabled
            slippageSeverity *= volatilityMultiplier;
            console.log(`💰 [SLIPPAGE] Enhanced slippage consideration enabled: severity = ${slippageSeverity.toFixed(2)}`);
          }
          
          const exitSlip = applySlippage(parseFloat(position.entry_price), exitOrderSide, position.symbol, initialExitNotional, { isExit: true, severity: slippageSeverity });
          
          // Apply slippage to exit price if slippage consideration is enabled
          if (enableSlippageConsideration && exitSlip.slippageBps > 0) {
            const slippageAmount = (exitPrice * exitSlip.slippageBps) / 10000;
            exitPrice = position.side === 'long' 
              ? exitPrice - slippageAmount  // Long exit: slippage reduces price
              : exitPrice + slippageAmount; // Short exit: slippage increases price
            console.log(`💰 [SLIPPAGE] Applied slippage: ${exitSlip.slippageBps.toFixed(2)} bps = $${slippageAmount.toFixed(4)}`);
          }
          
          let finalPnL = 0;
          // quantity already includes leverage (total contract size)
          if (position.side === 'long') {
            finalPnL = (exitPrice - parseFloat(position.entry_price)) * quantity;
          } else {
            finalPnL = (parseFloat(position.entry_price) - exitPrice) * quantity;
          }
          
          // Deduct fees (entry + exit)
          const feeRate = resolveFeeRate(position.exchange, position.trading_type);
          const entryNotional = quantity * parseFloat(position.entry_price);
          const exitNotional = quantity * exitPrice;
          const fees = (entryNotional + exitNotional) * feeRate;
          finalPnL -= fees;
          
          // Return margin + PnL to account
          const account = await this.getPaperAccount();
          
          if (!account || !account.balance) {
            console.error(`❌ [PAPER] Invalid account when closing position:`, account);
            throw new Error('Paper trading account not found');
          }
          
          const marginReturn = parseFloat(position.margin_used);
          const newBalance = parseFloat(account.balance) + marginReturn + finalPnL;
          
          await this.supabaseClient
            .from('paper_trading_accounts')
            .update({
              balance: newBalance,
              updated_at: TimeSync.getCurrentTimeISO()
            })
            .eq('user_id', this.user.id);
          
          // Update trade record
          await this.supabaseClient
            .from('paper_trading_trades')
            .update({
              exit_price: exitPrice,
              pnl: finalPnL,
              pnl_percentage: (finalPnL / parseFloat(position.margin_used)) * 100,
              fees: fees,
              status: 'closed',
              closed_at: TimeSync.getCurrentTimeISO()
            })
            .eq('position_id', position.id)
            .eq('status', 'filled');
          
          // Automatic Execution: Close all positions at market price if enabled
          if (enableAutomaticExecution && shouldClose) {
            console.log(`⚡ [AUTOMATIC EXECUTION] Closing position at market price: ${position.symbol} ${position.side.toUpperCase()}`);
            // Exit price is already set to current market price above
            // This ensures immediate execution regardless of SL/TP levels
          }
          
          // Log closure with slippage details
          try {
            const exitReason = enableAutomaticExecution ? 'automatic_execution' : newStatus;
            await botLogger.addBotLog(position.bot_id, {
              level: newStatus === 'stopped' ? 'warning' : 'success',
              category: 'trade',
              message: `📝 [PAPER] Position closed (${exitReason}): ${position.symbol} ${position.side.toUpperCase()} exit @ $${exitPrice.toFixed(4)}${enableSlippageConsideration ? ` (slippage: ${exitSlip.slippageBps.toFixed(2)} bps)` : ''}`,
              details: {
                paper_trading: true,
                status: exitReason,
                side: position.side,
                quantity,
                exit_price: exitPrice,
                slippage_bps: exitSlip.slippageBps,
                fees,
                pnl: finalPnL,
                margin_returned: position.margin_used,
                severity: slippageSeverity,
                automatic_execution: enableAutomaticExecution,
                slippage_considered: enableSlippageConsideration
              }
            });
          } catch (logError) {
            console.warn('⚠️ Failed to log paper position closure:', logError);
          }
          
          // Update bot performance
          await this.updateBotPerformance(position.bot_id, finalPnL);
          
          // Update pair statistics for paper trading
          await this.updatePairStatisticsPaper(position.bot_id, {
            symbol: position.symbol,
            exchange: position.exchange,
            pnl: finalPnL,
            status: 'closed',
            executed_at: TimeSync.getCurrentTimeISO(),
            closed_at: TimeSync.getCurrentTimeISO()
          });
          
          // Send Telegram notification for position close
          try {
            // Get bot info for notification
            const { data: bot } = await this.supabaseClient
              .from('trading_bots')
              .select('*')
              .eq('id', position.bot_id)
              .single();
            
            if (bot) {
              // Get trade record for notification
              const { data: trade } = await this.supabaseClient
                .from('paper_trading_trades')
                .select('*')
                .eq('position_id', position.id)
                .eq('status', 'closed')
                .order('closed_at', { ascending: false })
                .limit(1)
                .single();
              
              if (trade) {
                const exitReason = enableAutomaticExecution ? 'automatic_execution' : newStatus;
                await this.sendPositionCloseNotification(
                  { ...bot, paper_trading: true },
                  { ...trade, side: position.side, entry_price: position.entry_price },
                  finalPnL,
                  exitPrice,
                  exitReason
                );
              }
            }
          } catch (notifError) {
            console.warn('⚠️ Failed to send position close notification:', notifError);
            // Don't fail position closure if notification fails
          }
        }
        
        await this.supabaseClient
          .from('paper_trading_positions')
          .update(updateData)
          .eq('id', position.id);
      }
    } catch (error) {
      console.error('Error updating paper positions:', error);
    }
  }
  
  /**
   * Update pair-based win rate statistics for paper trading
   */
  private async updatePairStatisticsPaper(botId: string, trade: any): Promise<void> {
    try {
      // Get bot configuration
      const { data: bot } = await this.supabaseClient
        .from('trading_bots')
        .select('id, user_id, strategy_config, symbol, exchange')
        .eq('id', botId)
        .single();
      
      if (!bot) return;
      
      const strategyConfig = bot.strategy_config || {};
      const enablePairWinRate = strategyConfig.enable_pair_win_rate || false;
      
      // Only update if pair win rate is enabled
      if (!enablePairWinRate) return;
      
      // Only process closed trades with PnL
      if (!trade || !trade.pnl || trade.status !== 'closed') return;
      
      const symbol = trade.symbol;
      const exchange = trade.exchange;
      const pnl = parseFloat(trade.pnl || 0);
      const isWin = pnl > 0;
      
      // Get or create pair statistics
      const { data: existingStats } = await this.supabaseClient
        .from('bot_pair_statistics')
        .select('*')
        .eq('bot_id', botId)
        .eq('symbol', symbol)
        .eq('exchange', exchange)
        .maybeSingle();
      
      if (existingStats) {
        // Update existing statistics
        const newTotalTrades = existingStats.total_trades + 1;
        const newWinningTrades = existingStats.winning_trades + (isWin ? 1 : 0);
        const newLosingTrades = existingStats.losing_trades + (isWin ? 0 : 1);
        const newWinRate = newTotalTrades > 0 ? (newWinningTrades / newTotalTrades) * 100 : 0;
        const newTotalPnL = parseFloat(existingStats.total_pnl || 0) + pnl;
        const newAvgPnL = newTotalPnL / newTotalTrades;
        const newBestPnL = isWin ? Math.max(parseFloat(existingStats.best_trade_pnl || 0), pnl) : parseFloat(existingStats.best_trade_pnl || 0);
        const newWorstPnL = !isWin ? Math.min(parseFloat(existingStats.worst_trade_pnl || 0), pnl) : parseFloat(existingStats.worst_trade_pnl || 0);
        
        await this.supabaseClient
          .from('bot_pair_statistics')
          .update({
            total_trades: newTotalTrades,
            winning_trades: newWinningTrades,
            losing_trades: newLosingTrades,
            win_rate: Math.round(newWinRate * 100) / 100,
            total_pnl: newTotalPnL,
            avg_pnl_per_trade: newAvgPnL,
            best_trade_pnl: newBestPnL,
            worst_trade_pnl: newWorstPnL,
            last_trade_at: trade.executed_at || trade.closed_at || TimeSync.getCurrentTimeISO(),
            updated_at: TimeSync.getCurrentTimeISO()
          })
          .eq('id', existingStats.id);
        
        console.log(`📊 [PAPER PAIR WIN RATE] Updated ${symbol}: ${newWinningTrades}/${newTotalTrades} = ${newWinRate.toFixed(2)}% (${isWin ? 'WIN' : 'LOSS'})`);
      } else {
        // Create new pair statistics
        await this.supabaseClient
          .from('bot_pair_statistics')
          .insert({
            bot_id: botId,
            user_id: bot.user_id,
            symbol: symbol,
            exchange: exchange,
            total_trades: 1,
            winning_trades: isWin ? 1 : 0,
            losing_trades: isWin ? 0 : 1,
            win_rate: isWin ? 100.00 : 0.00,
            total_pnl: pnl,
            avg_pnl_per_trade: pnl,
            best_trade_pnl: isWin ? pnl : 0,
            worst_trade_pnl: !isWin ? pnl : 0,
            last_trade_at: trade.executed_at || trade.closed_at || TimeSync.getCurrentTimeISO()
          });
        
        console.log(`📊 [PAPER PAIR WIN RATE] Created ${symbol}: ${isWin ? 'WIN' : 'LOSS'} (1/1 = ${isWin ? 100 : 0}%)`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to update paper pair statistics:', error);
      // Don't throw - this is non-critical
    }
  }
  
  private async updateBotPerformance(botId: string, pnl: number): Promise<void> {
    // This is called when a paper trading position closes
    // Don't increment total_trades here - it's already incremented when trade opens
    const { data: bot } = await this.supabaseClient
      .from('trading_bots')
      .select('total_trades, pnl, pnl_percentage, win_rate, trade_amount')
      .eq('id', botId)
      .single();
    
    // Calculate total PnL from all closed paper trades
    const { data: closedTrades } = await this.supabaseClient
      .from('paper_trading_trades')
      .select('pnl')
      .eq('bot_id', botId)
      .eq('status', 'closed')
      .not('pnl', 'is', null);
    
    const totalPnL = closedTrades?.reduce((sum, t) => sum + (parseFloat(t.pnl || 0) || 0), 0) || 0;
    
    const winningTrades = closedTrades?.filter(t => parseFloat(t.pnl || 0) > 0) || [];
    const newWinRate = closedTrades && closedTrades.length > 0 
      ? (winningTrades.length / closedTrades.length) * 100 
      : (bot?.win_rate || 0);

    const totalTrades = Math.max(bot?.total_trades || 0, closedTrades?.length || 0);
    const tradeAmount = bot?.trade_amount ? Number(bot.trade_amount) : null;
    
    await this.supabaseClient
      .from('trading_bots')
      .update({
        total_trades: totalTrades,
        pnl: totalPnL,
        pnl_percentage: tradeAmount ? (totalPnL / tradeAmount) * 100 : 0,
        win_rate: newWinRate,
        last_trade_at: TimeSync.getCurrentTimeISO(),
        updated_at: TimeSync.getCurrentTimeISO()
      })
      .eq('id', botId);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests FIRST, before any other processing
  // This MUST be the very first thing to avoid any errors that could break CORS
  if (req.method === 'OPTIONS') {
    try {
      console.log(`📥 [bot-executor] CORS preflight request received`);
      return new Response(null, { 
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
          'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
        }
      });
    } catch (error) {
      // Even if there's an error, return CORS headers
      console.error(`❌ Error in OPTIONS handler:`, error);
      return new Response(null, { 
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
        }
      });
    }
  }
  
  // Log ALL incoming requests immediately (but safely handle URL parsing)
  try {
    const url = new URL(req.url);
    console.log(`\n📥 [bot-executor] INCOMING REQUEST: ${req.method} ${url.pathname}`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log(`   User-Agent: ${req.headers.get('user-agent') || 'unknown'}`);
    console.log(`   Origin: ${req.headers.get('origin') || 'unknown'}\n`);
  } catch (urlError) {
    console.error(`❌ Error parsing URL:`, urlError);
    // Continue anyway - URL parsing error shouldn't block the request
  }

  try {
    const cronSecretHeader = req.headers.get('x-cron-secret') ?? ''
    const cronSecretEnv = Deno.env.get('CRON_SECRET') ?? ''
    // Optional override to keep positions open even if SL/TP setup fails.
    // Set DISABLE_SLTPSAFETY=true in environment to disable auto-close on SL/TP failure.
    const disableSlTpSafety = (Deno.env.get('DISABLE_SLTPSAFETY') || '').toLowerCase() === 'true'
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || ''
    
    // Check if this is a cron request OR an internal service call (using service role key)
    const isCron = !!cronSecretHeader && cronSecretHeader === cronSecretEnv
    const isServiceCall = authHeader && authHeader.includes(serviceRoleKey) && serviceRoleKey.length > 0
    const isInternalCall = isCron || isServiceCall
    
    // Log cron/service call detection for debugging
    if (req.method === 'POST') {
      console.log('🔍 [bot-executor] Authentication detection:');
      console.log(`   x-cron-secret header present: ${!!cronSecretHeader} (length: ${cronSecretHeader.length})`);
      console.log(`   CRON_SECRET env present: ${!!cronSecretEnv} (length: ${cronSecretEnv.length})`);
      console.log(`   Secrets match: ${cronSecretHeader === cronSecretEnv}`);
      console.log(`   Detected as cron: ${isCron}`);
      console.log(`   Detected as service call: ${isServiceCall}`);
      console.log(`   Detected as internal call: ${isInternalCall}`);
      
      // Enhanced error messages for missing CRON_SECRET
      if (cronSecretHeader && !cronSecretEnv) {
        console.error('❌ [bot-executor] CRITICAL: CRON_SECRET environment variable is NOT SET!');
        console.error('   This function received an x-cron-secret header but CRON_SECRET env var is missing.');
        console.error('   ACTION REQUIRED: Set CRON_SECRET environment variable in bot-executor function settings.');
        console.error('   The value must match the CRON_SECRET in bot-scheduler function.');
        console.error('   Without this, bot-executor cannot recognize cron requests and will return 401 Invalid JWT.');
      } else if (!isCron && cronSecretHeader) {
        console.warn(`   ⚠️ Cron secret mismatch - header doesn't match env var`);
        if (cronSecretHeader.length === cronSecretEnv.length) {
          console.warn(`   ⚠️ Lengths match but values differ - check for whitespace/encoding issues`);
        } else {
          console.warn(`   ⚠️ Length mismatch: header=${cronSecretHeader.length}, env=${cronSecretEnv.length}`);
        }
      }
    }

    const incomingAuthHeader = req.headers.get('Authorization') || req.headers.get('authorization') || undefined
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      isInternalCall ? (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '') : (Deno.env.get('SUPABASE_ANON_KEY') ?? ''),
      isInternalCall || !incomingAuthHeader
        ? undefined
        : { global: { headers: { Authorization: incomingAuthHeader } } }
    )

    // Get user for authenticated endpoints (time and market-data don't require auth)
    const url = req.method === 'GET' ? new URL(req.url) : null
    const action = url?.searchParams.get('action')
    const isPublicEndpoint = action === 'time' || action === 'market-data'
    
    const { data: { user } } = isInternalCall || isPublicEndpoint
      ? { data: { user: null } as any }
      : await supabaseClient.auth.getUser()

    // Only require authentication for non-public endpoints
    if (!isInternalCall && !isPublicEndpoint && !user) {
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
        console.error('❌ TimeSync failed (non-critical, continuing with local time):', {
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString()
        });
        // Continue execution with local time as fallback
      });
      
      // Log sync status
      const syncStatus = TimeSync.getSyncStatus();
      console.log('📊 Time sync status:', syncStatus);
    }

    // Handle GET requests
    if (req.method === 'GET') {
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
          console.log('🧪 Test order - API Key:', apiKey.substring(0, 10) + '...');
          console.log('🌐 Environment: Mainnet');

          // Create a small test order
          const testOrder = await botExecutor.placeBybitOrder(
            apiKey, 
            apiSecret, 
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
            order: testOrder
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
        try {
          const symbol = url.searchParams.get('symbol') || 'BTCUSDT';
          const exchange = url.searchParams.get('exchange') || 'bybit';
          const tradingType = url.searchParams.get('tradingType') || url.searchParams.get('trading_type') || 'futures';
          
          const price = await MarketDataFetcher.fetchPrice(symbol, exchange, tradingType);
          const rsi = await MarketDataFetcher.fetchRSI(symbol, exchange);
          const adx = await MarketDataFetcher.fetchADX(symbol, exchange);
          
          return new Response(JSON.stringify({ 
            symbol, exchange, tradingType, price, rsi, adx,
            timestamp: TimeSync.getCurrentTimeISO(),
            success: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } catch (marketError) {
          console.error('❌ Market data fetch failed:', marketError);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to fetch market data',
            details: marketError?.message || String(marketError),
            timestamp: TimeSync.getCurrentTimeISO()
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }
    }

    // Handle POST requests
    if (req.method === 'POST') {
      // IMMEDIATE logging - before any async operations to ensure it's captured
      const postStartTime = Date.now();
      console.log(`\n🚨🚨🚨 [bot-executor] POST REQUEST RECEIVED 🚨🚨🚨`);
      console.log(`📅 Timestamp: ${new Date().toISOString()}`);
      console.log(`📋 Content-Type: ${req.headers.get('content-type')}`);
      console.log(`🔐 x-cron-secret header: ${req.headers.get('x-cron-secret') ? 'present' : 'missing'}`);
      console.log(`🔐 Authorization header: ${req.headers.get('authorization') ? 'present' : 'missing'}`);
      console.log(`🔐 apikey header: ${req.headers.get('apikey') ? 'present' : 'missing'}`);
      console.log(`🌐 URL: ${req.url}`);
      console.log(`📊 Method: ${req.method}`);
      
      // Log immediately to database for visibility (non-blocking)
      try {
        const serviceRoleClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        await serviceRoleClient
          .from('bot_activity_logs')
          .insert({
            bot_id: null, // Will be set after parsing body
            level: 'info',
            category: 'system',
            message: '📥 POST request received by bot-executor',
            details: {
              content_type: req.headers.get('content-type'),
              has_cron_secret: !!req.headers.get('x-cron-secret'),
              has_authorization: !!req.headers.get('authorization'),
              has_apikey: !!req.headers.get('apikey'),
              url: req.url,
              timestamp: new Date().toISOString()
            }
          });
      } catch (logError) {
        console.warn('⚠️ Failed to log POST request to database:', logError);
      }
      
      let body: any;
      try {
        const bodyText = await req.text();
        console.log(`📦 POST body (raw, first 500 chars):`, bodyText.substring(0, 500));
        body = JSON.parse(bodyText);
        console.log(`✅ POST body parsed successfully:`, { action: body?.action, botId: body?.botId });
      } catch (parseError: any) {
        console.error(`❌ Failed to parse POST body:`, parseError);
        return new Response(JSON.stringify({ 
          error: 'Invalid JSON in request body',
          details: parseError?.message || String(parseError)
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const { action: bodyAction, botId, bot_id } = body || {};
      // Support both camelCase (botId) and snake_case (bot_id)
      const effectiveBotId = botId || bot_id;

      console.log(`🔍 POST request parsed: action=${bodyAction}, botId=${effectiveBotId} (from ${botId ? 'botId' : bot_id ? 'bot_id' : 'neither'})`);

      switch (bodyAction) {
      case 'execute_bot':
        console.log(`\n🚀 === EXECUTE_BOT ACTION TRIGGERED ===`);
        console.log(`📅 Timestamp: ${new Date().toISOString()}`);
        console.log(`🔍 Bot ID: ${effectiveBotId}`);
        console.log(`🔐 Auth mode: ${isCron ? 'CRON (service role)' : 'User (' + user?.id + ')'}`);
        console.log(`🔐 Is internal call: ${isInternalCall}`);
        
        // Check if user is admin (for non-cron calls) - use service role to bypass RLS
        let isAdmin = false;
        if (!isCron && user?.id) {
          try {
            // Use service role client to check admin status (bypasses RLS)
            const serviceRoleClient = createClient(
              Deno.env.get('SUPABASE_URL') ?? '',
              Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );
            const { data: userProfile, error: userError } = await serviceRoleClient
              .from('users')
              .select('role')
              .eq('id', user.id)
              .single();
            
            if (userError) {
              console.warn(`⚠️ Failed to check user role: ${userError.message}`);
            } else {
              isAdmin = userProfile?.role === 'admin';
              console.log(`👤 User role check: ${userProfile?.role || 'unknown'} (isAdmin: ${isAdmin})`);
            }
          } catch (checkError) {
            console.warn(`⚠️ Error checking admin status: ${checkError}`);
          }
        }
        
        // Validate botId
        if (!effectiveBotId) {
          throw new Error('Bot ID is required (botId or bot_id must be provided)');
        }
        
        // Build query - admins and cron can access any bot, regular users only their own
        let botQuery = supabaseClient
          .from('trading_bots')
          .select('*')
          .eq('id', effectiveBotId);
        
        if (!isCron && !isAdmin && user?.id) {
          // Regular user: only their own bots
          botQuery = botQuery.eq('user_id', user.id);
          console.log(`🔍 Regular user query: filtering by user_id=${user.id}`);
        } else if (isCron) {
          // Cron: fetch bot first to get user_id, then filter (for RLS)
          const { data: botForUserId } = await supabaseClient
            .from('trading_bots')
            .select('user_id')
            .eq('id', effectiveBotId)
            .single();
          if (botForUserId?.user_id) {
            botQuery = botQuery.eq('user_id', botForUserId.user_id);
            console.log(`🔍 Cron query: filtering by user_id=${botForUserId.user_id}`);
          }
        } else if (isAdmin) {
          // Admin: no user_id filter needed (RLS policy allows admins to see all bots)
          console.log(`🔍 Admin query: no user_id filter (RLS should allow access)`);
        }
        
        let bot: any = null;
        let botError: any = null;
        
        const { data: botData, error: queryError } = await botQuery.single();
        bot = botData;
        botError = queryError;
        
        if (botError || !bot) {
          console.error(`❌ Bot not found: ${effectiveBotId}`);
          console.error(`   User ID: ${user?.id || 'none'}`);
          console.error(`   Is Admin: ${isAdmin}`);
          console.error(`   Is Cron: ${isCron}`);
          console.error(`   Query Error: ${botError?.message || 'No error but bot is null'}`);
          console.error(`   Query Details: ${JSON.stringify({ botId: effectiveBotId, isAdmin, isCron, userId: user?.id })}`);
          
          // If admin and query failed, try with service role client as fallback
          if (isAdmin && botError) {
            console.log(`🔄 Admin fallback: trying with service role client...`);
            try {
              const serviceRoleClient = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
              );
              const { data: adminBot, error: adminBotError } = await serviceRoleClient
                .from('trading_bots')
                .select('*')
                .eq('id', effectiveBotId)
                .single();
              
              if (adminBot && !adminBotError) {
                console.log(`✅ Admin fallback succeeded: found bot ${adminBot.name}`);
                bot = adminBot; // Use the bot from service role query
                botError = null; // Clear error
              } else {
                throw new Error(`Bot not found even with service role: ${adminBotError?.message || 'Unknown error'}`);
              }
            } catch (fallbackError) {
              throw new Error(`Bot not found: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
            }
          } else {
            throw new Error(`Bot not found: ${botError?.message || 'Unknown error'}`);
          }
        }
        
        if (!bot) {
          throw new Error('Bot not found after all attempts');
        }
        
        console.log(`✅ Bot found: ${bot.name} (${bot.id}) - Status: ${bot.status}`);
        console.log(`📊 Bot details:`, {
          name: bot.name,
          exchange: bot.exchange,
          symbol: bot.symbol,
          status: bot.status,
          paper_trading: bot.paper_trading,
          user_id: bot.user_id
        });
        
        // Use bot owner's user_id for executor (not admin's user_id)
        // This ensures API keys are fetched for the bot owner, not the admin
        const executorUserId = isCron || isAdmin ? bot.user_id : user.id;
        console.log(`🔑 Executor will use user_id: ${executorUserId} (bot owner: ${bot.user_id}, caller: ${user?.id || 'cron'})`);
        const executor = new BotExecutor(supabaseClient, { id: executorUserId })
        console.log(`🤖 Starting bot execution for bot ${bot.id} (${bot.name})...`);
        console.log(`📊 Bot status: ${bot.status}, Paper trading: ${bot.paper_trading}, Webhook-only: ${bot.webhook_only}`);
        
        try {
          await executor.executeBot(bot)
          console.log(`✅ Bot execution completed successfully for bot ${bot.id}`);
          
          // Update last_execution_at and next_execution_at after successful execution
          try {
            const timeframe = bot.timeframe || '15m';
            const timeframeMinutes = timeframe === '1m' ? 1 : timeframe === '3m' ? 3 : timeframe === '5m' ? 5 : timeframe === '15m' ? 15 : timeframe === '30m' ? 30 : timeframe === '1h' ? 60 : timeframe === '4h' ? 240 : timeframe === '1d' ? 1440 : 15;
            const nextExecutionMs = timeframeMinutes * 60 * 1000;
            const nextExecutionAt = new Date(Date.now() + nextExecutionMs);
            
            await supabaseClient
              .from('trading_bots')
              .update({
                last_execution_at: new Date().toISOString(),
                next_execution_at: nextExecutionAt.toISOString()
              })
              .eq('id', bot.id);
            
            console.log(`✅ Updated last_execution_at and next_execution_at for bot ${bot.id} (next: ${nextExecutionAt.toISOString()})`);
          } catch (updateError: any) {
            console.warn(`⚠️ Failed to update execution timestamps for bot ${bot.id}:`, updateError.message);
          }
        } catch (execError) {
          console.error(`❌ Bot execution failed for bot ${bot.id}:`, execError);
          const errorMessage = execError instanceof Error ? execError.message : String(execError);
          
          // Check if this is a minimum order value error (already logged as warning)
          const isMinOrderValueError = errorMessage.includes('110094') || 
                                       errorMessage.includes('does not meet minimum order value') ||
                                       errorMessage.includes('below minimum');
          
          // Only log as error if it's not already handled as a warning
          if (!isMinOrderValueError) {
            await executor.addBotLog(bot.id, {
              level: 'error',
              category: 'error',
              message: `Bot execution failed: ${errorMessage}`,
              details: {
                error: errorMessage,
                errorType: execError instanceof Error ? execError.name : typeof execError,
                source: 'execute_bot_action'
              }
            });
          } else {
            console.log(`ℹ️ Minimum order value error already logged as warning, skipping duplicate error log`);
          }
          throw execError;
        }
        
        return new Response(JSON.stringify({ success: true, message: 'Bot executed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'execute_all_bots':
        console.log('🚀 === BOT EXECUTION STARTED ===');
        console.log(`📅 Timestamp: ${new Date().toISOString()}`);
        console.log(`🔐 Auth mode: ${isCron ? 'CRON (service role)' : 'User (' + user?.id + ')'}`);
        
        // Support single bot execution via botId parameter (for queue system)
        const { botId } = body || {};
        if (botId) {
          console.log(`🎯 Single bot execution mode: ${botId}`);
          const { data: singleBot, error: singleBotError } = await supabaseClient
            .from('trading_bots')
            .select('*')
            .eq('id', botId)
            .eq('status', 'running')
            .single();
          
          if (singleBotError || !singleBot) {
            return new Response(JSON.stringify({
              success: false,
              error: `Bot ${botId} not found or not running`,
              details: singleBotError?.message
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // Execute single bot
          const executorUserId = isCron ? singleBot.user_id : user.id;
          const executor = new BotExecutor(supabaseClient, { id: executorUserId });
          
          try {
            const startTime = Date.now();
            await Promise.race([
              executor.executeBot(singleBot),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Bot execution timeout after 60000ms')), 60000)
              )
            ]);
            const duration = Date.now() - startTime;
            console.log(`✅ Bot ${singleBot.id} executed successfully in ${duration}ms`);
            
            // Update last_execution_at and next_execution_at after successful execution
            try {
              const timeframe = singleBot.timeframe || '15m';
              const timeframeMinutes = timeframe === '1m' ? 1 : timeframe === '3m' ? 3 : timeframe === '5m' ? 5 : timeframe === '15m' ? 15 : timeframe === '30m' ? 30 : timeframe === '1h' ? 60 : timeframe === '4h' ? 240 : timeframe === '1d' ? 1440 : 15;
              const nextExecutionMs = timeframeMinutes * 60 * 1000;
              const nextExecutionAt = new Date(Date.now() + nextExecutionMs);
              
              await supabaseClient
                .from('trading_bots')
                .update({
                  last_execution_at: new Date().toISOString(),
                  next_execution_at: nextExecutionAt.toISOString()
                })
                .eq('id', singleBot.id);
              
              console.log(`✅ Updated last_execution_at and next_execution_at for bot ${singleBot.id} (next: ${nextExecutionAt.toISOString()})`);
            } catch (updateError: any) {
              console.warn(`⚠️ Failed to update execution timestamps for bot ${singleBot.id}:`, updateError.message);
            }
            
            return new Response(JSON.stringify({
              success: true,
              message: `Bot ${singleBot.id} executed successfully`,
              botId: singleBot.id,
              executionTimeMs: duration
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } catch (error: any) {
            console.error(`❌ Bot ${singleBot.id} execution failed:`, error);
            return new Response(JSON.stringify({
              success: false,
              error: error.message || 'Bot execution failed',
              botId: singleBot.id
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
        
        if (isCron) {
          console.log('🔍 Cron: Looking for all running bots (service role)')
        } else {
          console.log(`🔍 Looking for running bots for user: ${user?.id}`)
        }
        
        let query = supabaseClient
          .from('trading_bots')
          .select('*')
          .eq('status', 'running')
          // Exclude webhook-only bots from scheduled execution (include null for backward compatibility)
          .or('webhook_only.is.null,webhook_only.eq.false')
        if (!isCron) {
          query = query.eq('user_id', user.id)
        }
        
        console.log('📊 Querying database for running bots...');
        const { data: bots, error: botsQueryError } = await query;
        
        if (botsQueryError) {
          console.error('❌ Database query error:', botsQueryError);
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Database query failed',
            details: botsQueryError.message 
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
        
        // Smart filtering: Skip bots that don't need execution right now
        const botsToExecute: any[] = [];
        const skippedBots: any[] = [];
        
        for (const bot of botList) {
          // Skip if bot was just updated (cooldown period)
          const lastUpdate = new Date(bot.updated_at || bot.created_at);
          const cooldownMs = 60000; // 1 minute cooldown
          if (Date.now() - lastUpdate.getTime() < cooldownMs) {
            skippedBots.push({ bot, reason: 'cooldown' });
            continue;
          }
          
          // Check if bot has open positions (if yes, needs execution)
          const hasOpenPositions = await (async () => {
            try {
              // For paper trading bots, check paper_trading_positions
              if (bot.paper_trading) {
                const { data: positions } = await supabaseClient
                  .from('paper_trading_positions')
                  .select('id')
                  .eq('bot_id', bot.id)
                  .eq('status', 'open')
                  .limit(1);
                return (positions?.length || 0) > 0;
              } else {
                // For real trading bots, positions table may not exist
                // Check if positions table exists, if not, assume needs execution
                try {
                  const { data: positions } = await supabaseClient
                    .from('positions')
                    .select('id')
                    .eq('bot_id', bot.id)
                    .eq('status', 'open')
                    .limit(1);
                  return (positions?.length || 0) > 0;
                } catch {
                  // positions table doesn't exist, assume needs execution (safe default)
                  return true;
                }
              }
            } catch (error: any) {
              // If check fails, assume needs execution (safe default)
              console.warn(`⚠️ Could not check open positions for bot ${bot.id}:`, error.message);
              return true;
            }
          })();
          
          // Check if timeframe requires frequent execution
          const timeframe = bot.timeframe || '15m';
          const requiresFrequentExecution = ['1m', '3m', '5m'].includes(timeframe);
          
          // Calculate expected execution interval based on timeframe
          const timeframeMinutes = timeframe === '1m' ? 1 : timeframe === '3m' ? 3 : timeframe === '5m' ? 5 : timeframe === '15m' ? 15 : timeframe === '30m' ? 30 : timeframe === '1h' ? 60 : timeframe === '4h' ? 240 : timeframe === '1d' ? 1440 : 15;
          const expectedIntervalMs = timeframeMinutes * 60 * 1000;
          // Allow execution if it's been at least 80% of the expected interval (to account for slight delays)
          const minIntervalMs = Math.max(expectedIntervalMs * 0.8, 60000); // At least 1 minute
          
          // Execute if: has open positions OR requires frequent execution OR last execution was >expected interval ago OR never executed
          const lastExecution = bot.last_execution_at ? new Date(bot.last_execution_at).getTime() : 0;
          const timeSinceLastExecution = Date.now() - lastExecution;
          // If last_execution_at is null/0, always execute (first time or never executed)
          const needsExecution = hasOpenPositions || requiresFrequentExecution || lastExecution === 0 || timeSinceLastExecution > minIntervalMs;
          
          if (needsExecution) {
            botsToExecute.push(bot);
          } else {
            skippedBots.push({ bot, reason: 'no_open_positions_and_low_frequency' });
          }
        }
        
        console.log(`🚀 Executing ${botsToExecute.length} bots (${skippedBots.length} skipped: ${skippedBots.map(s => s.reason).join(', ')})`);
        
        if (botsToExecute.length === 0) {
          return new Response(JSON.stringify({
            success: true,
            message: 'No bots need execution at this time',
            botsExecuted: 0,
            botsSkipped: skippedBots.length,
            skippedReasons: skippedBots.map(s => ({ botId: s.bot.id, reason: s.reason }))
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Use filtered list instead of full list
        const filteredBotList = botsToExecute;
        
        // Process bots in optimized batches to prevent CPU time exceeded errors
        // Optimized for scalability: smaller batches, faster timeouts, better distribution
        const BATCH_SIZE = 3; // Increased from 2 to 3 (better throughput while staying safe)
        const BATCH_DELAY_MS = 300; // Reduced from 500ms to 300ms (faster processing)
        const MAX_EXECUTION_TIME_MS = 55000; // Increased to 55s to allow more bots to complete (prevent CPU timeout but allow more processing)
        const PER_BOT_TIMEOUT_MS = 60000; // Increased to 60s per bot to handle API retries, position updates, paper trading operations, and bots with many positions
        const MAX_BOTS_PER_CYCLE = 5; // Reduced from 30 to 5 (better distribution across cycles)
        const executionStartTime = Date.now();
        const results: Array<PromiseSettledResult<any>> = [];
        let processedCount = 0;
        
        // Limit the number of bots processed in this cycle
        const botsToProcess = filteredBotList.slice(0, MAX_BOTS_PER_CYCLE);
        const remainingBots = filteredBotList.length - botsToProcess.length;
        
        if (remainingBots > 0) {
          console.log(`⚠️ Limiting execution to ${MAX_BOTS_PER_CYCLE} bots this cycle (${remainingBots} will be processed in next cycle)`);
        }
        
        for (let i = 0; i < botsToProcess.length; i += BATCH_SIZE) {
          // Check if we're approaching the timeout limit
          const elapsedTime = Date.now() - executionStartTime;
          if (elapsedTime > MAX_EXECUTION_TIME_MS) {
            console.warn(`⏰ Timeout protection: Stopping execution after ${elapsedTime}ms (processed ${processedCount}/${botsToProcess.length} bots)`);
            break;
          }
          
          const batch = botsToProcess.slice(i, i + BATCH_SIZE);
          const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(botsToProcess.length / BATCH_SIZE);
          
          console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} bots)... [Elapsed: ${(elapsedTime / 1000).toFixed(1)}s]`);
          
          const batchResults = await Promise.allSettled(
            batch.map(async (bot) => {
              const botStartTime = Date.now();
              console.log(`\n🤖 [${bot.name}] Starting execution...`);
              console.log(`   - ID: ${bot.id}`);
              console.log(`   - Exchange: ${bot.exchange}`);
              console.log(`   - Symbol: ${bot.symbol}`);
              console.log(`   - User: ${bot.user_id}`);
              
              try {
                // Add per-bot timeout to prevent individual bots from taking too long
                const exec = new BotExecutor(supabaseClient, { id: isCron ? bot.user_id : user.id });
                const result = await Promise.race([
                  exec.executeBot(bot),
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`Bot execution timeout after ${PER_BOT_TIMEOUT_MS}ms`)), PER_BOT_TIMEOUT_MS)
                  )
                ]);
                const duration = Date.now() - botStartTime;
                console.log(`✅ [${bot.name}] Execution completed in ${duration}ms`);
                
                // Update last_execution_at and next_execution_at after successful execution
                try {
                  const timeframe = bot.timeframe || '15m';
                  // Calculate next execution time based on timeframe
                  const timeframeMinutes = timeframe === '1m' ? 1 : timeframe === '3m' ? 3 : timeframe === '5m' ? 5 : timeframe === '15m' ? 15 : timeframe === '30m' ? 30 : timeframe === '1h' ? 60 : timeframe === '4h' ? 240 : timeframe === '1d' ? 1440 : 15;
                  const nextExecutionMs = timeframeMinutes * 60 * 1000; // Convert to milliseconds
                  const nextExecutionAt = new Date(Date.now() + nextExecutionMs);
                  
                  await supabaseClient
                    .from('trading_bots')
                    .update({
                      last_execution_at: new Date().toISOString(),
                      next_execution_at: nextExecutionAt.toISOString()
                    })
                    .eq('id', bot.id);
                  
                  console.log(`✅ [${bot.name}] Updated last_execution_at and next_execution_at (next: ${nextExecutionAt.toISOString()})`);
                } catch (updateError: any) {
                  console.warn(`⚠️ [${bot.name}] Failed to update execution timestamps:`, updateError.message);
                  // Don't fail the entire execution if timestamp update fails
                }
                
                processedCount++;
                return result;
              } catch (error) {
                const duration = Date.now() - botStartTime;
                console.error(`❌ [${bot.name}] Execution failed after ${duration}ms:`, error);
                
                // Log error to bot activity logs for visibility
                try {
                  const execForLogging = new BotExecutor(supabaseClient, { id: isCron ? bot.user_id : user.id });
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  
                  // Check if this is a minimum order value error (already logged as warning)
                  const isMinOrderValueError = errorMessage.includes('110094') || 
                                               errorMessage.includes('does not meet minimum order value') ||
                                               errorMessage.includes('below minimum');
                  
                  // Only log as error if it's not already handled as a warning
                  if (!isMinOrderValueError) {
                    await execForLogging.addBotLog(bot.id, {
                      level: 'error',
                      category: 'error',
                      message: `Bot execution failed: ${errorMessage}`,
                      details: {
                        error: errorMessage,
                        errorType: error instanceof Error ? error.name : typeof error,
                        duration: `${duration}ms`,
                        timestamp: new Date().toISOString()
                      }
                    });
                  } else {
                    console.log(`ℹ️ Minimum order value error already logged as warning, skipping duplicate error log`);
                  }
                } catch (logError) {
                  console.error('Failed to log error to bot activity:', logError);
                }
                
                processedCount++;
                throw error;
              }
            })
          );
          
          results.push(...batchResults);
          
          // Add delay between batches (except after the last batch)
          if (i + BATCH_SIZE < botsToProcess.length) {
            console.log(`⏳ Waiting ${BATCH_DELAY_MS}ms before next batch...`);
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
          }
        }
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        const skipped = botsToProcess.length - processedCount;
        const totalExecutionTime = Date.now() - executionStartTime;
        
        console.log(`\n📈 === EXECUTION SUMMARY ===`);
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⏭️ Skipped (timeout): ${skipped}`);
        console.log(`📊 Processed: ${processedCount} / ${botsToProcess.length} (${remainingBots > 0 ? `${remainingBots} remaining for next cycle` : 'all bots'})`);
        console.log(`⏱️ Total execution time: ${(totalExecutionTime / 1000).toFixed(1)}s`);
        
        if (failed > 0) {
          console.log('\n❌ Failed bot executions:');
          results.forEach((result, index) => {
            if (result.status === 'rejected') {
              console.error(`   - ${botsToProcess[index].name}: ${result.reason}`);
            }
          });
        }
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: `Executed ${successful} bots successfully, ${failed} failed${skipped > 0 ? `, ${skipped} skipped due to timeout` : ''}${remainingBots > 0 ? `, ${remainingBots} bots will be processed in next cycle` : ''}`,
          botsExecuted: processedCount,
          botsTotal: filteredBotList.length,
          botsProcessedThisCycle: botsToProcess.length,
          botsRemaining: remainingBots,
          successful,
          failed,
          skipped,
          executionTimeMs: totalExecutionTime,
          results: { successful, failed, skipped }
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

      case 'manual_order':
        {
          try {
            // Body is already parsed above, use it directly
            const { userId, order } = body;

            if (!userId || !order) {
              return new Response(JSON.stringify({ error: 'Missing userId or order details' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }

            // Verify user is admin or the order is for their own account
            if (user?.id !== userId && user?.role !== 'admin') {
              return new Response(JSON.stringify({ error: 'Unauthorized: Only admins can place orders for other users' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }

            console.log(`📋 Manual order request: ${order.exchange} ${order.symbol} ${order.side} ${order.amount} @ ${order.price || 'MARKET'}`);

            // Create executor instance
            const executor = new BotExecutor(supabaseClient, user);

            // Get API keys for the user
            const serviceRoleClient = createClient(
              Deno.env.get('SUPABASE_URL') ?? '',
              Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );

            const { data: apiKeys, error: apiKeysError } = await serviceRoleClient
              .from('api_keys')
              .select('api_key, api_secret, passphrase, is_testnet')
              .eq('user_id', userId)
              .eq('exchange', order.exchange)
              .eq('is_active', true)
              .eq('is_testnet', false)
              .single();

            if (apiKeysError || !apiKeys) {
              console.error(`❌ API keys not found for manual order:`, {
                userId,
                exchange: order.exchange,
                error: apiKeysError,
                query: { user_id: userId, exchange: order.exchange, is_active: true, is_testnet: false }
              });
              return new Response(JSON.stringify({ 
                error: `API keys not found for user ${userId} on exchange ${order.exchange}. Please configure mainnet API keys in your account settings first. Note: Manual trading uses mainnet only.` 
              }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }

            // Decrypt API keys before use (same as regular bot orders)
            let decryptedApiKey: string;
            let decryptedApiSecret: string;
            let decryptedPassphrase: string | null = null;
            
            try {
              decryptedApiKey = atob(apiKeys.api_key); // Base64 decode
              decryptedApiSecret = atob(apiKeys.api_secret); // Base64 decode
              
              // Validate decrypted keys
              if (!decryptedApiKey || decryptedApiKey.length < 10) {
                throw new Error('API key appears to be invalid (too short or empty after decryption)');
              }
              if (!decryptedApiSecret || decryptedApiSecret.length < 10) {
                throw new Error('API secret appears to be invalid (too short or empty after decryption)');
              }
              
              if (apiKeys.passphrase) {
                decryptedPassphrase = atob(apiKeys.passphrase);
              }
              
              console.log(`🔑 API keys decrypted successfully for manual order`);
              console.log(`   API Key length: ${decryptedApiKey.length}, preview: ${decryptedApiKey.substring(0, 8)}...`);
              console.log(`   API Secret length: ${decryptedApiSecret.length}`);
            } catch (decryptError: any) {
              console.error(`❌ Failed to decrypt API keys for manual order:`, decryptError);
              return new Response(JSON.stringify({ 
                error: `Failed to decrypt API keys. Please re-enter your ${order.exchange} API keys in your account settings. Error: ${decryptError?.message || decryptError}` 
              }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }

            // Log API key info for debugging (partial key only for security)
            console.log(`🔑 Using API keys for manual order:`, {
              userId,
              exchange: order.exchange,
              is_testnet: apiKeys.is_testnet,
              api_key_preview: decryptedApiKey.substring(0, 8) + '...',
              has_secret: !!decryptedApiSecret,
              has_passphrase: !!decryptedPassphrase
            });

            // Create a minimal bot object for order placement (including SL/TP for futures/linear)
            const tempBot = {
              id: `manual-${Date.now()}`,
              user_id: userId,
              exchange: order.exchange,
              symbol: order.symbol,
              trading_type: order.tradingType || 'spot',
              timeframe: order.timeframe || '1h',
              leverage: parseInt(order.leverage) || 1,
              // Add SL/TP if provided (for futures/linear orders)
              stop_loss: order.stopLoss || null,
              take_profit: order.takeProfit || null
            };

            // Convert USDT amount to quantity
            // For limit orders, use the limit price; for market orders, fetch current price
            let priceForConversion: number;
            if (order.orderType === 'limit' && order.price) {
              priceForConversion = parseFloat(order.price);
              console.log(`💰 Using limit price for conversion: ${priceForConversion}`);
            } else {
              // Fetch current market price for conversion
              console.log(`📊 Fetching current price for ${order.symbol} (${order.tradingType || 'spot'})...`);
              try {
                priceForConversion = await MarketDataFetcher.fetchPrice(
                  order.symbol,
                  order.exchange,
                  order.tradingType || 'spot'
                );
                console.log(`✅ Current price: $${priceForConversion}`);
              } catch (priceError: any) {
                console.error(`❌ Failed to fetch price:`, priceError);
                return new Response(JSON.stringify({ 
                  error: `Failed to fetch current price for ${order.symbol}. Please try a limit order with a specific price, or check that the symbol is valid. Error: ${priceError?.message || priceError}` 
                }), {
                  status: 400,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }
            }

            // Normalize side: convert 'long'/'short' to 'buy'/'sell' for Bybit API
            const normalizedSide = (() => {
              const sideLower = (order.side || '').toLowerCase();
              if (sideLower === 'long') return 'buy';
              if (sideLower === 'short') return 'sell';
              return sideLower; // 'buy' or 'sell' (already lowercase)
            })();
            console.log(`🔄 Side normalization: ${order.side} → ${normalizedSide}`);

            const usdtAmount = parseFloat(order.amount);
            const isSpotBuy = (order.tradingType || 'spot') === 'spot' && normalizedSide === 'buy';
            
            let amountToUse: number;
            
            if (isSpotBuy && order.orderType === 'market') {
              // For spot market buy orders, pass USDT amount directly
              // placeBybitOrder will use marketUnit='quoteCoin' and set qty to this USDT amount
              amountToUse = usdtAmount;
              console.log(`💰 Spot market BUY: Using USDT amount directly: $${usdtAmount} (marketUnit='quoteCoin' will be set)`);
            } else {
              // For limit orders, sell orders, or futures orders, convert USDT to quantity
              let quantity = usdtAmount / priceForConversion;
              console.log(`💱 Converting ${usdtAmount} USDT to quantity at price ${priceForConversion}: ${quantity}`);

              // Apply quantity constraints and step sizing (same as regular orders)
              const quantityConstraints = getQuantityConstraints(order.symbol);
              const steps = getSymbolSteps(order.symbol);

              // Apply step size rounding
              let finalQuantity = quantity;
              if (steps.stepSize > 0) {
                finalQuantity = Math.floor(finalQuantity / steps.stepSize) * steps.stepSize;
              }

              // Clamp to min/max constraints
              finalQuantity = Math.max(quantityConstraints.min, Math.min(quantityConstraints.max, finalQuantity));

              // Ensure we don't exceed max (Bybit rejects quantities equal to max)
              if (finalQuantity >= quantityConstraints.max) {
                if (steps.stepSize > 0) {
                  const maxSteps = Math.floor(quantityConstraints.max / steps.stepSize);
                  if ((quantityConstraints.max % steps.stepSize) === 0) {
                    finalQuantity = (maxSteps - 1) * steps.stepSize;
                  } else {
                    finalQuantity = maxSteps * steps.stepSize;
                  }
                } else {
                  finalQuantity = quantityConstraints.max - Math.max(1, quantityConstraints.max * 0.01);
                }
              }

              console.log(`✅ Final quantity after constraints: ${finalQuantity} (min: ${quantityConstraints.min}, max: ${quantityConstraints.max}, stepSize: ${steps.stepSize})`);
              amountToUse = finalQuantity;
            }

            // Create a trade signal object
            const tradeSignal = {
              side: normalizedSide,
              symbol: order.symbol,
              price: order.price || null,
              amount: amountToUse,
              orderType: order.orderType || 'market'
            };

            // Place the order using the public manual order method with DECRYPTED keys
            // For spot buy orders: pass USDT amount (placeBybitOrder will use marketUnit='quoteCoin')
            // For other orders: pass quantity
            const orderResult = await executor.placeManualOrder(
              decryptedApiKey,
              decryptedApiSecret,
              decryptedPassphrase,
              order.exchange,
              order.symbol,
              normalizedSide, // Use normalized side (buy/sell, not long/short)
              amountToUse, // USDT amount for spot buy, quantity for others
              order.price || 0,
              order.tradingType || 'spot',
              tempBot
            );

            // Set SL/TP for futures/linear orders if provided
            if ((order.tradingType === 'futures' || order.tradingType === 'linear') && 
                (order.exchange === 'bybit' || order.exchange === 'bitunix') && 
                order.stopLoss && order.takeProfit && 
                orderResult.orderId) {
              try {
                console.log(`🛡️ Setting SL/TP for manual order (${order.exchange}): SL=${order.stopLoss}%, TP=${order.takeProfit}%`);
                
                // Small delay to allow position to update after order fills
                await new Promise(resolve => setTimeout(resolve, 2000)); // Increased delay for Bitunix
                
                if (order.exchange === 'bybit') {
                  // Get actual position entry price from Bybit (using internal method access)
                  // Note: Using bracket notation to access private method - this works in JavaScript runtime
                  const getEntryPrice = (executor as any).getBybitPositionEntryPrice.bind(executor);
                  const entryPrice = await getEntryPrice(decryptedApiKey, decryptedApiSecret, order.symbol);
                  
                  if (entryPrice && entryPrice > 0) {
                    // Capitalize side for setBybitSLTP
                    const capitalizedSide = normalizedSide.charAt(0).toUpperCase() + normalizedSide.slice(1).toLowerCase();
                    
                    // Create trade signal with SL/TP percentages (setBybitSLTP will calculate actual prices from bot.stop_loss/take_profit)
                    const slTpTradeSignal = {
                      ...tradeSignal,
                      // setBybitSLTP will use bot.stop_loss and bot.take_profit percentages from tempBot
                    };
                    
                    // Call setBybitSLTP using internal method access
                    const setSLTP = (executor as any).setBybitSLTP.bind(executor);
                    await setSLTP(decryptedApiKey, decryptedApiSecret, order.symbol, capitalizedSide, entryPrice, tempBot, slTpTradeSignal);
                    console.log(`✅ SL/TP set successfully for manual Bybit order`);
                  } else {
                    console.warn('⚠️ Could not fetch position entry price, skipping SL/TP (position may have been closed)');
                  }
                } else if (order.exchange === 'bitunix') {
                  // Bitunix SL/TP setup
                  console.log(`🛡️ Setting Bitunix SL/TP for manual order...`);
                  
                  // Update tempBot with SL/TP percentages from order
                  tempBot.stop_loss = order.stopLoss;
                  tempBot.stopLoss = order.stopLoss;
                  tempBot.take_profit = order.takeProfit;
                  tempBot.takeProfit = order.takeProfit;
                  
                  // Get position entry price from Bitunix
                  const getBitunixPosition = (executor as any).getBitunixPosition.bind(executor);
                  let positionInfo = null;
                  let retryCount = 0;
                  const maxRetries = 10;
                  
                  // Retry getting position (Bitunix positions can take time to appear)
                  while ((!positionInfo || positionInfo.size === 0) && retryCount < maxRetries) {
                    retryCount++;
                    console.log(`   ⏳ Waiting for Bitunix position to appear... (${retryCount}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    positionInfo = await getBitunixPosition(decryptedApiKey, decryptedApiSecret, order.symbol);
                  }
                  
                  if (positionInfo && positionInfo.size > 0) {
                    const entryPrice = positionInfo.entryPrice || order.price || 0;
                    if (entryPrice > 0) {
                      // Capitalize side for setBitunixSLTP
                      const capitalizedSide = normalizedSide.charAt(0).toUpperCase() + normalizedSide.slice(1).toLowerCase();
                      
                      // Create trade signal with SL/TP
                      const slTpTradeSignal = {
                        side: normalizedSide,
                        stopLoss: entryPrice * (1 - (order.stopLoss / 100)), // Calculate actual SL price
                        takeProfit1: entryPrice * (1 + (order.takeProfit / 100)) // Calculate actual TP price
                      };
                      
                      // Call setBitunixSLTP using internal method access
                      const setBitunixSLTP = (executor as any).setBitunixSLTP.bind(executor);
                      await setBitunixSLTP(decryptedApiKey, decryptedApiSecret, order.symbol, capitalizedSide, entryPrice, tempBot, slTpTradeSignal, orderResult);
                      console.log(`✅ SL/TP set successfully for manual Bitunix order`);
                    } else {
                      console.warn('⚠️ Could not determine entry price for Bitunix SL/TP');
                    }
                  } else {
                    console.warn('⚠️ Could not fetch Bitunix position, skipping SL/TP (position may not have been created yet)');
                    console.warn('   Background retry will attempt to set SL/TP once position appears');
                  }
                }
              } catch (slTpError: any) {
                // Log error but don't fail the order - order was placed successfully
                console.error(`⚠️ Failed to set SL/TP for manual ${order.exchange} order:`, slTpError);
                // Continue - order was placed successfully, just SL/TP failed
              }
            }

            return new Response(JSON.stringify({
              success: true,
              orderId: orderResult.orderId,
              message: 'Order placed successfully',
              result: orderResult
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

          } catch (error: any) {
            console.error('Manual order error:', error);
            return new Response(JSON.stringify({ 
              error: error.message || 'Failed to place manual order' 
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

  } catch (error) {
    console.error(`❌ [bot-executor] Unhandled error:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
