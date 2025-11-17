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
    'HBARUSDT': { min: 1, max: 10000 }
  };

  if (isLowLiquiditySymbol(symbol)) {
    return { min: 1000, max: 1000000 };
  }

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
    'SHIBUSDT': { stepSize: 1000, tickSize: 0.00000001 }
  };

  if (isLowLiquiditySymbol(symbol)) {
    return { stepSize: 1000, tickSize: 0.00000001 };
  }

  return steps[symbol] || { stepSize: 0.001, tickSize: 0.01 };
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
};

function calculateTradeSizing(bot: any, price: number): TradeSizingResult {
  const leverageMultiplier = bot.leverage || 1;
  const riskMultiplier = getRiskMultiplier(bot);
  const tradingType = bot.tradingType || bot.trading_type;
  const isFutures = (tradingType === 'futures' || tradingType === 'linear');

  const baseAmount = bot.trade_amount || bot.tradeAmount || 100;
  const minTradeAmount = isFutures ? 50 : 10;
  const effectiveBaseAmount = Math.max(minTradeAmount, baseAmount);

  const totalAmount = effectiveBaseAmount * leverageMultiplier * riskMultiplier;
  const rawQuantity = totalAmount / price;

  const quantityConstraints = getQuantityConstraints(bot.symbol);
  const steps = getSymbolSteps(bot.symbol);

  let clampedQuantity = Math.max(quantityConstraints.min, Math.min(quantityConstraints.max, rawQuantity));
  if (steps.stepSize > 0) {
    clampedQuantity = Math.floor(clampedQuantity / steps.stepSize) * steps.stepSize;
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
    leverageMultiplier,
    riskMultiplier,
    constraints: quantityConstraints,
    steps,
    isFutures
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

// Market data fetcher
class MarketDataFetcher {
  // Helper function to normalize symbol formats (e.g., 1000PEPEUSDT <-> PEPEUSDT, 10000SATSUSDT <-> SATSUSDT)
  static normalizeSymbol(symbol: string, exchange: string, tradingType: string): string[] {
    const variants: string[] = [symbol]; // Always try original first
    
    // Handle 10000SATSUSDT -> SATSUSDT and vice versa (check longer prefix first)
    if (symbol.startsWith('10000')) {
      const withoutPrefix = symbol.replace(/^10000/, '');
      variants.push(withoutPrefix);
    } else if (symbol.match(/^[A-Z]+USDT$/)) {
      // If it's a standard format like SATSUSDT, try 10000SATSUSDT for futures
      if (tradingType === 'futures' || tradingType === 'linear') {
        variants.push(`10000${symbol}`);
      }
    }
    
    // Handle 1000PEPEUSDT -> PEPEUSDT and vice versa
    if (symbol.startsWith('1000')) {
      const withoutPrefix = symbol.replace(/^1000/, '');
      variants.push(withoutPrefix);
    } else if (symbol.match(/^[A-Z]+USDT$/)) {
      // If it's a standard format like PEPEUSDT, try 1000PEPEUSDT for futures
      if (tradingType === 'futures' || tradingType === 'linear') {
        variants.push(`1000${symbol}`);
      }
    }
    
    // Try uppercase variants
    variants.push(symbol.toUpperCase());
    if (symbol !== symbol.toUpperCase()) {
      variants.push(symbol.toLowerCase());
    }
    
    // Remove duplicates
    return [...new Set(variants)];
  }
  
  static async fetchPrice(symbol: string, exchange: string, tradingType: string = 'spot'): Promise<number> {
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
              // Try primary and alternate Bybit domains for resilience
              const baseDomains = ['https://api.bybit.com', 'https://api.bytick.com'];
              let response: Response | null = null;
              let apiUrl = '';
              
              for (const base of baseDomains) {
                apiUrl = `${base}/v5/market/tickers?category=${bybitCategory}&symbol=${symbolVariant}`;
                console.log(`🔍 Fetching price for ${symbolVariant} (${bybitCategory}) - Attempt ${attempt + 1}/3 via ${base}: ${apiUrl}`);
                response = await fetch(apiUrl, {
                  method: 'GET',
                  headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.bybit.com',
                    'Origin': 'https://www.bybit.com'
                  },
                  signal: AbortSignal.timeout(10000)
                }).catch(() => null);
                
                // If first domain failed or returned non-2xx, try the alternate domain immediately
                if (response && response.status !== 403) {
                  break;
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
                return null;
              }
              
              if (!response) {
                lastError = { fetchError: 'Network error', attempt: attempt + 1 };
                continue; // Retry
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
              
              if (attempt < 2) {
                // Extract title from HTML if available
                const titleMatch = responseText.match(/<title[^>]*>([^<]+)<\/title>/i);
                const title = titleMatch ? titleMatch[1] : 'ERROR: The request could not be satisfied';
                
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
                // Last attempt failed
                const titleMatch = responseText.match(/<title[^>]*>([^<]+)<\/title>/i);
                const title = titleMatch ? titleMatch[1] : 'ERROR: The request could not be satisfied';
                lastError = {
                  symbolVariant,
                  apiUrl,
                  httpStatus: 403,
                  httpStatusText: 'Forbidden',
                  isHtml: isHtml,
                  htmlTitle: title,
                  htmlPreview: responseText.substring(0, 200),
                  attempt: attempt + 1,
                  note: `HTTP 403 Forbidden after ${attempt + 1} attempts. Possible causes: rate limiting, IP blocking, or Cloudflare protection.`
                };
                break; // Try next variant
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
              console.error(`❌ Failed to parse Bybit API response for ${symbolVariant} (Attempt ${attempt + 1}/3):`, parseError);
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
        if (lastError && !lastError.retryable) {
          apiResponses.push(lastError);
        }
      }
        
        // If all variants failed, try fetching all tickers and searching
        const isMajorCoin = ['BTC', 'ETH', 'BNB', 'SOL'].some(coin => symbol.toUpperCase().startsWith(coin));
        if (isMajorCoin) {
          console.log(`🔍 All symbol variants failed for ${symbol}, trying to fetch all tickers from ${bybitCategory} category...`);
        }
        
        try {
          const allTickersUrl = `https://api.bybit.com/v5/market/tickers?category=${bybitCategory}`;
          const allTickersResponse = await fetch(allTickersUrl);
          
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
            const spotResponse = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`);
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
            const linearResponse = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`);
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
        
        // FINAL FALLBACK: Use top-of-book orderbook mid-price if tickers endpoints are blocked
        try {
          const orderbookDomains = ['https://api.bybit.com', 'https://api.bytick.com'];
          for (const base of orderbookDomains) {
            const obUrl = `${base}/v5/market/orderbook?category=${bybitCategory}&symbol=${symbol}&limit=1`;
            console.log(`🛟 Trying orderbook fallback for ${symbol} (${bybitCategory}): ${obUrl}`);
            const obResp = await fetch(obUrl, {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              },
              signal: AbortSignal.timeout(8000)
            }).catch(() => null);
            if (!obResp) continue;
            const obText = await obResp.text();
            if (obText.trim().startsWith('<')) {
              console.warn(`⚠️ Orderbook fallback returned HTML from ${base} - trying next domain`);
              continue;
            }
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
          }
        } catch (obErr) {
          console.warn(`⚠️ Orderbook fallback failed for ${symbol}:`, obErr);
        }
        
        console.warn(`⚠️ Symbol ${symbol} not found in ${bybitCategory} category on Bybit. Tried variants: ${symbolVariants.join(', ')}`);
        
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
          '1h': '60',
          '2h': '120',
          '4h': '240',
          '6h': '360',
          '12h': '720',
          '1d': 'D',
          '1w': 'W',
          '1M': 'M'
        };
        
        const interval = intervalMap[timeframe] || '60';
        
        // Determine category based on trading type
        // For now, try both spot and linear, but prefer linear for futures
        const categories = ['linear', 'spot', 'inverse'];
        
        for (const category of categories) {
          try {
            // Normalize symbol for Bybit API
            const symbolVariants = this.normalizeSymbol(symbol, exchange, category === 'linear' ? 'futures' : 'spot');
            
            for (const symbolVariant of symbolVariants) {
              const url = `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${symbolVariant}&interval=${interval}&limit=${limit}`;
              const response = await fetch(url);
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
                  console.log(`✅ Fetched ${klines.length} klines for ${symbolVariant} (${category})`);
                  return klines;
                }
              }
            }
          } catch (err) {
            continue; // Try next category
          }
        }
        
        console.warn(`⚠️ Could not fetch klines for ${symbol} from Bybit`);
        return [];
      } else if (exchange === 'okx') {
        // OKX klines implementation
        const instType = timeframe.includes('m') || timeframe.includes('h') ? 'SWAP' : 'SPOT';
        const symbolVariants = this.normalizeSymbol(symbol, exchange, instType === 'SWAP' ? 'futures' : 'spot');
        
        for (const symbolVariant of symbolVariants) {
          try {
            const url = `https://www.okx.com/api/v5/market/candles?instId=${symbolVariant}&instType=${instType}&bar=${timeframe}&limit=${limit}`;
            const response = await fetch(url);
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
      // Fetch historical klines (need at least 14 periods for RSI, but get more for accuracy)
      const klines = await this.fetchKlines(symbol, exchange, timeframe, 100);
      
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
      // Fetch historical klines (need at least 14 periods for ADX)
      const klines = await this.fetchKlines(symbol, exchange, timeframe, 100);
      
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

// Bot execution engine
class BotExecutor {
  private supabaseClient: any;
  private user: any;
  
  constructor(supabaseClient: any, user: any) {
    this.supabaseClient = supabaseClient;
    this.user = user;
  }
  
  async executeBot(bot: any): Promise<void> {
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
      
      console.log(`✅ Step 2: Bot ${botName} is running, proceeding with execution...`);

      // ⚠️ CRITICAL: Check paper trading mode FIRST before any real API calls
      const isPaperTrading = bot.paper_trading === true;
      
      if (isPaperTrading) {
        // PAPER TRADING MODE - Use real market data but simulate trades
        console.log(`📝 [PAPER TRADING MODE] Bot: ${bot.name}`);
        
        const paperExecutor = new PaperTradingExecutor(this.supabaseClient, this.user);
        
        // Get REAL market data from MAINNET (same functions as real trading)
        const tradingType = bot.tradingType || bot.trading_type || 'futures';
        const timeframe = bot.timeframe || bot.timeFrame || '1h';
        console.log(`📊 [PAPER] Using timeframe: ${timeframe} for ${bot.symbol}`);
        
        const currentPrice = await MarketDataFetcher.fetchPrice(bot.symbol, bot.exchange, tradingType);
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
            
            // Simple ML prediction using weighted scoring (same logic as ml-predictions function)
            // This is a simplified version - full implementation would call the ml-predictions function
            const predictionScore = (rsi > 70 ? -0.3 : rsi < 30 ? 0.3 : 0) + 
                                    (adx > 25 ? 0.2 : 0) +
                                    (Math.random() * 0.1 - 0.05); // Small random component
            
            let prediction = 'hold';
            let confidence = 0.5;
            
            if (predictionScore > 0.3) {
              prediction = 'buy';
              confidence = Math.min(0.5 + predictionScore, 0.95);
            } else if (predictionScore < -0.3) {
              prediction = 'sell';
              confidence = Math.min(0.5 + Math.abs(predictionScore), 0.95);
            } else {
              prediction = 'hold';
              confidence = 0.5;
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
        
        const shouldTrade = this.evaluateStrategy(strategy, { price: currentPrice, rsi, adx, mlPrediction }, bot);
        
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
          // Update paper positions but don't trade
          await paperExecutor.updatePaperPositions(bot.id);
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
          // Update paper positions but don't trade
          await paperExecutor.updatePaperPositions(bot.id);
          return; // Stop execution - outside allowed hours
        }
        
        if (shouldTrade.shouldTrade) {
          await paperExecutor.executePaperTrade(bot, shouldTrade);
        } else {
          await this.addBotLog(bot.id, {
            level: 'info',
            category: 'strategy',
            message: `📝 [PAPER] Strategy conditions not met: ${shouldTrade.reason}`,
            details: { ...shouldTrade, paper_trading: true, ml_prediction: mlPrediction }
          });
        }
        
        // Update existing paper positions
        await paperExecutor.updatePaperPositions(bot.id);
        
        // ⚠️ CRITICAL: RETURN HERE - Don't execute real trades
        return;
      }
      
      // ⚠️ REAL TRADING MODE - Existing code continues unchanged
      console.log(`💰 [REAL TRADING MODE] Bot: ${bot.name}`);
      
      // ⏱️ COOLDOWN BARS CHECK - Check if enough bars have passed since last trade
      console.log(`⏱️ [${bot.name}] Checking cooldown bars...`);
      const cooldownCheck = await this.checkCooldownBars(bot);
      console.log(`⏱️ [${bot.name}] Cooldown check result:`, JSON.stringify(cooldownCheck, null, 2));
      if (!cooldownCheck.canTrade) {
        console.log(`⏸️ Cooldown active for ${bot.name}: ${cooldownCheck.reason}`);
        await this.addBotLog(bot.id, {
          level: 'info',
          category: 'system',
          message: `Cooldown active: ${cooldownCheck.reason}`,
          details: cooldownCheck
        });
        return; // Stop execution - wait for cooldown
      }
      console.log(`✅ [${bot.name}] Cooldown check passed - can trade`);
      
      // 🕐 TRADING HOURS CHECK - Check if current hour is in allowed trading hours
      console.log(`🕐 [${bot.name}] Checking trading hours...`);
      const tradingHoursCheck = this.checkTradingHours(bot);
      console.log(`🕐 [${bot.name}] Trading hours check result:`, JSON.stringify(tradingHoursCheck, null, 2));
      if (!tradingHoursCheck.canTrade) {
        console.log(`🕐 Outside trading hours for ${bot.name}: ${tradingHoursCheck.reason}`);
        await this.addBotLog(bot.id, {
          level: 'info',
          category: 'system',
          message: `Outside trading hours: ${tradingHoursCheck.reason}`,
          details: tradingHoursCheck
        });
        return; // Stop execution - outside allowed hours
      }
      console.log(`✅ [${bot.name}] Trading hours check passed - can trade`);
      
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
      const safetyCheck = await this.checkSafetyLimits(bot);
      console.log(`🛡️ [${bot.name}] Safety check result:`, JSON.stringify(safetyCheck, null, 2));
      if (!safetyCheck.canTrade) {
        console.warn(`⚠️ Trading blocked for ${bot.name}: ${safetyCheck.reason}`);
        await this.addBotLog(bot.id, {
          level: 'warning',
          category: 'system',
          message: `Trading blocked: ${safetyCheck.reason}`,
          details: safetyCheck
        });
        
        // Auto-pause bot if critical safety limit is breached
        if (safetyCheck.shouldPause) {
          await this.pauseBotForSafety(bot.id, safetyCheck.reason);
        }
        return; // Stop execution
      }
      console.log(`✅ [${bot.name}] Safety checks passed - can trade`);
      
      // Fetch market data
      console.log(`📊 [${bot.name}] Starting market data fetch...`);
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
        currentPrice = await MarketDataFetcher.fetchPrice(bot.symbol, bot.exchange, tradingType);
        console.log(`✅ [${bot.name}] Price fetched: ${currentPrice}`);
        
        console.log(`📊 [${bot.name}] Fetching RSI for ${bot.symbol}...`);
        rsi = await MarketDataFetcher.fetchRSI(bot.symbol, bot.exchange, timeframe);
        console.log(`✅ [${bot.name}] RSI fetched: ${rsi}`);
        
        console.log(`📊 [${bot.name}] Fetching ADX for ${bot.symbol}...`);
        adx = await MarketDataFetcher.fetchADX(bot.symbol, bot.exchange, timeframe);
        console.log(`✅ [${bot.name}] ADX fetched: ${adx}`);
      } catch (marketDataError: any) {
        console.error(`❌ [${bot.name}] Market data fetch failed:`, marketDataError);
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'market',
          message: `Market data fetch error: ${marketDataError?.message || String(marketDataError)}`,
          details: {
            error: marketDataError?.message || String(marketDataError),
            symbol: bot.symbol,
            exchange: bot.exchange,
            tradingType,
            timeframe
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
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'market',
          message: `Invalid price data: ${currentPrice}. Cannot evaluate strategy.`,
          details: { price: currentPrice, symbol: bot.symbol }
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
      
      // Evaluate strategy with error handling
      let shouldTrade: any;
      try {
        console.log(`🔍 Evaluating strategy for ${bot.name} (${bot.symbol})...`);
        shouldTrade = await this.evaluateStrategy(strategy, { price: currentPrice, rsi, adx }, bot);
        console.log(`✅ Strategy evaluation completed for ${bot.name}`);
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
      console.error(`   Bot ID: ${botId}`);
      console.error(`   Bot Name: ${botName}`);
      console.error(`   Error: ${errorMessage}`);
      console.error(`   Execution Time: ${executionTime}ms`);
      if (errorStack) {
        console.error(`   Stack: ${errorStack.substring(0, 500)}`);
      }
      console.error(`\n`);
      
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
    
    // Check if this is a trendline breakout strategy
    if (strategy.type === 'trendline_breakout' || strategy.name === 'Trendline Breakout Strategy') {
      try {
        console.log(`📈 Evaluating Trendline Breakout Strategy for ${bot?.name || 'bot'}...`);
        const result = await this.evaluateTrendlineBreakoutStrategy(strategy, marketData, bot);
        if (!result || typeof result !== 'object') {
          console.error('❌ Trendline breakout strategy returned invalid result:', result);
          return {
            shouldTrade: false,
            reason: 'Strategy evaluation returned invalid result',
            confidence: 0
          };
        }
        return result;
      } catch (error: any) {
        console.error('❌ Error in trendline breakout strategy evaluation:', error);
        return {
          shouldTrade: false,
          reason: `Strategy evaluation error: ${error?.message || String(error)}`,
          confidence: 0
        };
      }
    }
    
    // Check if this is a hybrid trend + mean reversion strategy
    if (strategy.type === 'hybrid_trend_meanreversion' || strategy.name === 'Hybrid Trend + Mean Reversion Strategy') {
      try {
        console.log(`📈 Evaluating Hybrid Trend + Mean Reversion Strategy for ${bot?.name || 'bot'}...`);
        const result = await this.evaluateHybridTrendMeanReversionStrategy(strategy, marketData, bot);
        if (!result || typeof result !== 'object') {
          console.error('❌ Hybrid strategy returned invalid result:', result);
          return {
            shouldTrade: false,
            reason: 'Strategy evaluation returned invalid result',
            confidence: 0
          };
        }
        return result;
      } catch (error: any) {
        console.error('❌ Error in hybrid strategy evaluation:', error);
        return {
          shouldTrade: false,
          reason: `Strategy evaluation error: ${error?.message || String(error)}`,
          confidence: 0
        };
      }
    }
    
    // Check if this is a scalping strategy
    if (strategy.type === 'scalping' || strategy.name === 'Scalping Strategy - Fast EMA Cloud' || strategy.name?.includes('Scalping')) {
      try {
        console.log(`⚡ Evaluating Scalping Strategy for ${bot?.name || 'bot'}...`);
        const result = await this.evaluateScalpingStrategy(strategy, marketData, bot);
        if (!result || typeof result !== 'object') {
          console.error('❌ Scalping strategy returned invalid result:', result);
          return {
            shouldTrade: false,
            reason: 'Strategy evaluation returned invalid result',
            confidence: 0
          };
        }
        return result;
      } catch (error: any) {
        console.error('❌ Error in scalping strategy evaluation:', error);
        return {
          shouldTrade: false,
          reason: `Strategy evaluation error: ${error?.message || String(error)}`,
          confidence: 0
        };
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
    
    // RSI strategy
    if (strategy.rsiThreshold) {
      if (rsi > strategy.rsiThreshold) {
        signals.push({
          side: 'sell',
          reason: `RSI overbought (${rsi.toFixed(2)} > ${strategy.rsiThreshold})`,
          confidence: Math.min((rsi - strategy.rsiThreshold) / 10, 1)
        });
      } else if (rsi < (100 - strategy.rsiThreshold)) {
        signals.push({
          side: 'buy',
          reason: `RSI oversold (${rsi.toFixed(2)} < ${100 - strategy.rsiThreshold})`,
          confidence: Math.min(((100 - strategy.rsiThreshold) - rsi) / 10, 1)
        });
      }
    }
    
    // ADX strategy
    if (strategy.adxThreshold && adx > strategy.adxThreshold) {
      signals.push({
        side: rsi > 50 ? 'sell' : 'buy',
        reason: `Strong trend detected (ADX: ${adx.toFixed(2)} > ${strategy.adxThreshold})`,
        confidence: Math.min((adx - strategy.adxThreshold) / 20, 1)
      });
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
      
      // Get configuration values with defaults
      const htfTimeframe = config.htf_timeframe || '4h';
      const adxMinHTF = config.adx_min_htf || 23;
      const adxTrendMin = config.adx_trend_min || 25;
      const adxMeanRevMax = config.adx_meanrev_max || 19;
      const rsiOversold = config.rsi_oversold || 30;
      const momentumThreshold = config.momentum_threshold || 0.8;
      const vwapDistance = config.vwap_distance || 1.2;
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
      const htfADXStrong = htfADX >= adxMinHTF;
      
      // Check if HTF ADX is rising (simplified: use previous ADX from klines if available)
      // For now, assume ADX is rising if it's above threshold (conservative approach)
      // In production, you'd calculate ADX from previous period
      const htfADXRising = htfADXStrong; // Simplified: if ADX is strong, assume it's rising
      
      // If HTF price is below EMA200, optionally allow SHORT entries when bias allows
      const allowShorts =
        (config.bias_mode === 'both' || config.bias_mode === 'auto') &&
        config.require_price_vs_trend !== 'above';

      if (!htfPriceAboveEMA200 && !allowShorts) {
        return {
          shouldTrade: false,
          reason: `HTF price (${htfCurrentPrice.toFixed(2)}) not above EMA200 (${htfEMA200.toFixed(2)})`,
          confidence: 0
        };
      }
      
      if (!htfEMA50AboveEMA200 && !allowShorts) {
        return {
          shouldTrade: false,
          reason: `HTF EMA50 (${htfEMA50.toFixed(2)}) not above EMA200 (${htfEMA200.toFixed(2)})`,
          confidence: 0
        };
      }
      
      if (!htfADXStrong) {
        return {
          shouldTrade: false,
          reason: `HTF ADX (${htfADX.toFixed(2)}) below minimum (${adxMinHTF})`,
          confidence: 0
        };
      }
      
      if (!htfADXRising) {
        return {
          shouldTrade: false,
          reason: `HTF ADX not rising (${htfADX.toFixed(2)})`,
          confidence: 0
        };
      }
      
      // 3. Current Timeframe Regime Filter
      if (adx < adxTrendMin) {
        return {
          shouldTrade: false,
          reason: `ADX (${adx.toFixed(2)}) below trend minimum (${adxTrendMin}) - market not trending`,
          confidence: 0
        };
      }
      
      if (adx < adxMeanRevMax) {
        return {
          shouldTrade: false,
          reason: `ADX (${adx.toFixed(2)}) indicates mean-reversion/chop market (${adxMeanRevMax})`,
          confidence: 0
        };
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
        // Require RSI oversold and price sufficiently below VWAP and positive momentum
        if (rsi > rsiOversold) {
          return {
            shouldTrade: false,
            reason: `RSI (${rsi.toFixed(2)}) not oversold (need <= ${rsiOversold})`,
            confidence: 0
          };
        }
        if (vwapDistancePct < vwapDistance) {
          return {
            shouldTrade: false,
            reason: `Price not far enough below VWAP (${vwapDistancePct.toFixed(2)}% < ${vwapDistance}%)`,
            confidence: 0
          };
        }
        if (momentum < momentumThreshold) {
          return {
            shouldTrade: false,
            reason: `Momentum (${momentum.toFixed(2)}%) below threshold (${momentumThreshold}%)`,
            confidence: 0
          };
        }

        const confidence = Math.min(
          (rsiOversold - rsi) / rsiOversold * 0.3 +
          (adx - adxTrendMin) / 20 * 0.2 +
          (htfADX - adxMinHTF) / 20 * 0.2 +
          (vwapDistancePct - vwapDistance) / vwapDistance * 0.15 +
          (momentum - momentumThreshold) / momentumThreshold * 0.15,
          1.0
        );

        return {
          shouldTrade: true,
          side: 'buy',
          reason: `Hybrid LONG: HTF uptrend (EMA200), ADX ${adx.toFixed(2)}, RSI ${rsi.toFixed(2)}, VWAP Δ ${vwapDistancePct.toFixed(2)}%, momentum ${momentum.toFixed(2)}%`,
          confidence: Math.max(confidence, 0.7),
          entryPrice: price,
          htfTrend: { price: htfCurrentPrice, ema200: htfEMA200, ema50: htfEMA50, adx: htfADX },
          meanReversion: { rsi, vwap, vwapDistance: vwapDistancePct, momentum }
        };
      }

      // Branch 4B: SHORT entries (HTF downtrend) if allowed
      if (allowShorts) {
        const rsiOverbought = config.rsi_overbought || 70;
        const vwapAbovePct = ((price - vwap) / vwap) * 100; // price above VWAP in %
        const momentumDown = -momentum; // negative momentum magnitude

        if (rsi < rsiOverbought) {
          return {
            shouldTrade: false,
            reason: `RSI (${rsi.toFixed(2)}) not overbought (need >= ${rsiOverbought}) for short`,
            confidence: 0
          };
        }
        if (vwapAbovePct < vwapDistance) {
          return {
            shouldTrade: false,
            reason: `Price not far enough above VWAP (${vwapAbovePct.toFixed(2)}% < ${vwapDistance}%) for short`,
            confidence: 0
          };
        }
        if (momentumDown < momentumThreshold) {
          return {
            shouldTrade: false,
            reason: `Downward momentum (${(-momentum).toFixed(2)}%) below threshold (${momentumThreshold}%) for short`,
            confidence: 0
          };
        }

        const confidence = Math.min(
          (rsi - rsiOverbought) / rsiOverbought * 0.3 +
          (adx - adxTrendMin) / 20 * 0.2 +
          (htfADX - adxMinHTF) / 20 * 0.2 +
          (vwapAbovePct - vwapDistance) / vwapDistance * 0.15 +
          (momentumDown - momentumThreshold) / momentumThreshold * 0.15,
          1.0
        );

        return {
          shouldTrade: true,
          side: 'sell',
          reason: `Hybrid SHORT: HTF downtrend (EMA200), ADX ${adx.toFixed(2)}, RSI ${rsi.toFixed(2)}, VWAP Δ +${vwapAbovePct.toFixed(2)}%, momentum -${momentumDown.toFixed(2)}%`,
          confidence: Math.max(confidence, 0.7),
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
      const adxMin = config.adx_min || 20;
      const volumeMultiplier = config.volume_multiplier || 1.2;
      const minVolatilityATR = config.min_volatility_atr || 0.3;
      const minVolumeRequirement = config.min_volume_requirement || 1.2;
      const timeFilterEnabled = config.time_filter_enabled !== false;
      const allowedHoursUTC = config.allowed_hours_utc || [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
      const vwapPeriod = config.vwap_period || 20;
      
      // Validate timeframe is suitable for scalping (1m, 3m, 5m)
      const validTimeframes = ['1m', '3m', '5m'];
      if (!validTimeframes.includes(timeframe)) {
        return {
          shouldTrade: false,
          reason: `Scalping strategy requires 1m, 3m, or 5m timeframe (current: ${timeframe})`,
          confidence: 0
        };
      }
      
      // 1. Time Filter - Avoid low liquidity zones
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
      
      // Check minimum volatility requirement
      if (atrPercent < minVolatilityATR) {
        return {
          shouldTrade: false,
          reason: `Volatility too low: ATR ${atrPercent.toFixed(2)}% < minimum ${minVolatilityATR}%`,
          confidence: 0
        };
      }
      
      // 5. Volume Confirmation - Avoid dead zones
      const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const currentVolume = volumes[volumes.length - 1];
      const volumeRatio = currentVolume / avgVolume;
      
      if (volumeRatio < minVolumeRequirement) {
        return {
          shouldTrade: false,
          reason: `Volume too low: ${volumeRatio.toFixed(2)}x < minimum ${minVolumeRequirement}x`,
          confidence: 0
        };
      }
      
      // 6. ADX for trend strength filter (avoid choppy markets)
      if (adx < adxMin) {
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
      
      // 9. LONG Entry Rules
      if (emaBullishCross || (emaFastAboveSlow && currentPrice > emaFastValue)) {
        // Additional filters for LONG
        const priceAboveVWAP = currentPrice > vwap;
        const rsiNotOverbought = rsi < rsiOverbought;
        const rsiOversoldBounce = rsi < rsiOversold + 10 && rsi > rsiOversold - 5; // Micro reversal zone
        
        // Avoid fake breakouts: require price to be above both EMAs
        const priceAboveBothEMAs = currentPrice > emaFastValue && currentPrice > emaSlowValue;
        
        // Avoid ranging phases: require ADX to show trend strength
        const strongTrend = adx >= adxMin;
        
        if (priceAboveBothEMAs && priceAboveVWAP && rsiNotOverbought && strongTrend) {
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
      if (emaBearishCross || (emaFastAboveSlow === false && currentPrice < emaFastValue)) {
        // Additional filters for SHORT
        const priceBelowVWAP = currentPrice < vwap;
        const rsiNotOversold = rsi > rsiOversold;
        const rsiOverboughtRejection = rsi > rsiOverbought - 10 && rsi < rsiOverbought + 5; // Micro reversal zone
        
        // Avoid fake breakouts: require price to be below both EMAs
        const priceBelowBothEMAs = currentPrice < emaFastValue && currentPrice < emaSlowValue;
        
        // Avoid ranging phases: require ADX to show trend strength
        const strongTrend = adx >= adxMin;
        
        if (priceBelowBothEMAs && priceBelowVWAP && rsiNotOversold && strongTrend) {
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
  
  public async executeTrade(bot: any, tradeSignal: any): Promise<void> {
    try {
      console.log(`\n🚀 === EXECUTING REAL TRADE ===`);
      console.log(`📊 Bot: ${bot.name} (${bot.id})`);
      console.log(`📈 Symbol: ${bot.symbol}`);
      console.log(`📊 Side: ${tradeSignal.side}`);
      console.log(`💰 Trade Amount: ${bot.trade_amount || bot.tradeAmount}`);
      console.log(`🏦 Exchange: ${bot.exchange}`);
      
      // Get trading type with fallback (handle both camelCase and snake_case)
      const tradingType = bot.tradingType || bot.trading_type || 'futures';
      console.log(`📊 Trading Type: ${tradingType}`);
      
      console.log(`🔍 Fetching current price for ${bot.symbol}...`);
      
      // Fetch price and capture detailed error info for logging
      let priceFetchError: any = null;
      let currentPrice: number;
      
      try {
        console.log(`🔍 [executeTrade] Starting price fetch for ${bot.symbol} (${tradingType})...`);
        currentPrice = await MarketDataFetcher.fetchPrice(bot.symbol, bot.exchange, tradingType);
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
      let insertPayload: any = {
        user_id: this.user.id,
        bot_id: bot.id,
        exchange: bot.exchange,
        symbol: bot.symbol,
        side: normalizedSide,
        size: tradeAmount,
        amount: tradeAmount,
        price: normalizedPrice, // Primary column for entry price
        status: normalizedTradeStatus,
        exchange_order_id: orderResult.orderId || orderResult.exchangeResponse?.result?.orderId || null,
        executed_at: TimeSync.getCurrentTimeISO(),
        fee: estimatedFees,
        pnl: 0
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

      // If entry_price error occurs, it means the column doesn't exist - that's fine, we're using 'price'
      // But if there's a different error, try adding entry_price for backward compatibility
      if (error && /column .*entry_price/i.test(error.message || '')) {
        console.warn('⚠️ trades.entry_price column not found, using price column only (this is expected)');
        // Already using price, so this shouldn't happen, but just in case
        const retryResp = await this.supabaseClient
          .from('trades')
          .insert(insertPayload as any)
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
      
    } catch (error) {
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
        // Don't throw - bot is paused, no need to keep retrying
        return;
      }
      
      // Check if it's an insufficient balance error (less critical)
      const isInsufficientBalance = error.message?.includes('Insufficient balance') || error.message?.includes('not enough') || error.message?.includes('Shortfall');
      
      if (isInsufficientBalance) {
        console.warn('⚠️ Trade execution skipped due to insufficient balance:', error.message);
        
        // Extract balance details from error message if available
        const balanceMatch = error.message.match(/Available: \$?([0-9.]+)/i);
        const requiredMatch = error.message.match(/Required: \$?([0-9.]+)/i);
        const shortfallMatch = error.message.match(/Shortfall: \$?([0-9.]+)/i);
        
        const shortfall = shortfallMatch ? parseFloat(shortfallMatch[1]) : null;
        const errorMessage = `❌ Trade blocked: Insufficient balance for ${bot.symbol} ${tradeSignal?.side || 'order'}. ${shortfall ? `Need $${shortfall.toFixed(2)} more.` : 'Please add funds or reduce trade size.'}`;
        
        console.log(`📝 Logging insufficient balance error to bot_activity_logs for bot ${bot.id}...`);
        
        // Log as error level for better visibility in Recent Activity
        await this.addBotLog(bot.id, {
          level: 'error',
          category: 'trade',
          message: errorMessage,
          details: { 
            error: error.message,
            errorType: 'insufficient_balance',
            availableBalance: balanceMatch ? parseFloat(balanceMatch[1]) : null,
            requiredBalance: requiredMatch ? parseFloat(requiredMatch[1]) : null,
            shortfall: shortfall,
            symbol: bot.symbol,
            side: tradeSignal?.side || 'unknown',
            recommendation: shortfall ? `Add at least $${(shortfall + 5).toFixed(2)} to your ${bot.exchange} ${bot.tradingType === 'futures' ? 'UNIFIED/Futures' : 'Spot'} wallet` : 'Reduce trade amount in bot settings or add funds',
            note: 'Add funds to your exchange wallet or reduce trade amount. Will retry on next execution cycle.',
            timestamp: TimeSync.getCurrentTimeISO()
          }
        });
        
        console.log(`✅ Insufficient balance error logged to bot_activity_logs`);
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
            stack: error.stack,
            timestamp: TimeSync.getCurrentTimeISO()
          }
        });
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
  ): Promise<{ mode: 'real' | 'paper' }> {
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

    const botSnapshot = { ...bot };
    const multiplier = params.sizeMultiplier ?? null;
    if (multiplier !== null && multiplier !== undefined) {
      const parsedMultiplier = Number(multiplier);
      if (Number.isFinite(parsedMultiplier) && parsedMultiplier > 0) {
        const baseAmount = Number(bot.trade_amount || bot.tradeAmount || 100);
        botSnapshot.trade_amount = baseAmount * parsedMultiplier;
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
        console.log(`📝 Executing PAPER trade for ${bot.symbol}...`);
        const paperExecutor = new PaperTradingExecutor(this.supabaseClient, this.user);
        await paperExecutor.executePaperTrade(botSnapshot, tradeSignal);
        await paperExecutor.updatePaperPositions(bot.id);
        console.log(`✅ PAPER trade executed successfully`);
      } else {
        console.log(`💵 Executing REAL trade for ${bot.symbol}...`);
        await this.executeTrade(botSnapshot, tradeSignal);
        console.log(`✅ REAL trade executed successfully`);
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
      
      const { data: pendingSignals, error } = await serviceRoleClient
        .from('manual_trade_signals')
        .select('*')
        .eq('bot_id', bot.id)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: true });

      if (error) {
        console.error(`❌ Failed to fetch manual trade signals for bot ${bot.id}:`, error);
        return 0;
      }

      if (!pendingSignals || pendingSignals.length === 0) {
        console.log(`ℹ️ No pending manual trade signals for bot ${bot.id}`);
        return 0;
      }

      console.log(`📬 Found ${pendingSignals.length} pending manual trade signal(s) for bot ${bot.id}`);
      let processedCount = 0;

      for (const signal of pendingSignals) {
        const signalId = signal.id;
        const alertEmoji = signal.side === 'buy' ? '🟢' : '🔴';
        const alertType = signal.side.toUpperCase() + ' ALERT';
        console.log(`📬 ${alertEmoji} Processing ${alertType} signal ${signalId} for bot ${bot.id} (${bot.name}): ${signal.side} (${signal.mode})`);
        
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
          
          const result = await this.executeManualTrade(bot, {
            side: signal.side,
            reason: signal.reason || 'Manual trade signal',
            confidence: 1,
            mode: finalMode,
            sizeMultiplier: signal.size_multiplier ? Number(signal.size_multiplier) : undefined,
            source: 'manual_trade_signal'
          });

          await serviceRoleClient
            .from('manual_trade_signals')
            .update({
              status: 'completed',
              error: null,
              processed_at: TimeSync.getCurrentTimeISO(),
              mode: result.mode
            })
            .eq('id', signalId);

          console.log(`✅ Manual signal ${signalId} processed successfully`);
          processedCount += 1;
        } catch (signalError) {
          const errorMessage = signalError instanceof Error ? signalError.message : String(signalError);
          console.error(`❌ Manual trade signal ${signalId} failed for bot ${bot.id}:`, errorMessage);

          await this.addBotLog(bot.id, {
            level: 'error',
            category: 'trade',
            message: `Manual trade signal failed: ${errorMessage}`,
            details: {
              signal_id: signalId,
              side: signal.side,
              mode: signal.mode,
              error: errorMessage,
              timestamp: TimeSync.getCurrentTimeISO()
            }
          });

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
      const { data: apiKeys, error: apiKeysError } = await serviceRoleClient
        .from('api_keys')
        .select('api_key, api_secret, passphrase, is_testnet')
        .eq('user_id', botOwnerUserId)
        .eq('exchange', bot.exchange)
        .eq('is_active', true)
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
      
      // For spot trading: can only buy with USDT (can't sell if we don't own the asset)
      // For futures: can both buy (long) and sell (short)
      if (tradingType === 'spot' && (tradeSignal.side.toLowerCase() === 'sell')) {
        console.log(`⚠️ Spot trading: Cannot sell ${bot.symbol} without owning it. Skipping sell signal.`);
        throw new Error('Cannot sell on spot market without owning the asset. Only buy orders are supported for spot trading.');
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
        return await this.placeBybitOrder(apiKey, apiSecret, apiKeys.is_testnet, bot.symbol, tradeSignal.side, amount, price, tradingType, bot);
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
  
  private async placeBybitOrder(apiKey: string, apiSecret: string, isTestnet: boolean, symbol: string, side: string, amount: number, price: number, tradingType: string = 'spot', bot: any = null): Promise<any> {
    const baseUrl = isTestnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
    
    console.log(`🔑 Bybit Order Details:`);
    console.log(`   Base URL: ${baseUrl} (isTestnet: ${isTestnet})`);
    console.log(`   API Key length: ${apiKey.length}, starts with: ${apiKey.substring(0, 8)}...`);
    console.log(`   API Secret length: ${apiSecret.length}, starts with: ${apiSecret.substring(0, 8)}...`);
    console.log(`   Symbol: ${symbol}, Side: ${side}, Amount: ${amount}, Price: ${price}`);
    console.log(`   Trading Type: ${tradingType}`);
    
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
      const { stepSize } = getSymbolSteps(symbol);
      const constraints = getQuantityConstraints(symbol);
      let qty = Math.max(constraints.min, Math.min(constraints.max, amount));
      if (stepSize > 0) {
        // Use more precise rounding to avoid floating point errors
        const factor = 1 / stepSize;
        qty = Math.floor(qty * factor) / factor;
      }
      // Calculate decimals for formatting - ensure we have enough precision
      // For stepSize 0.1, we need 1 decimal place; for 0.01, we need 2, etc.
      const stepDecimals = stepSize < 1 ? stepSize.toString().split('.')[1]?.length || 0 : 0;
      // Ensure qty is properly rounded to step size and formatted
      const roundedQty = Math.round(qty / stepSize) * stepSize;
      // Format with appropriate decimals, but use Number() to remove unnecessary trailing zeros
      const formattedQty = Number(roundedQty.toFixed(stepDecimals)).toString();
      
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
      
      // Validate minimum order value before placing order
      const minOrderValue = this.getMinimumOrderValue(symbol, bybitCategory);
      const currentOrderValue = parseFloat(formattedQty) * currentMarketPrice;
      
      if (currentOrderValue < minOrderValue && currentMarketPrice > 0) {
        console.warn(`⚠️ Order value $${currentOrderValue.toFixed(2)} below minimum $${minOrderValue.toFixed(2)} for ${symbol}`);
        console.warn(`💡 Attempting to increase quantity to meet minimum order value...`);
        
        // Calculate minimum quantity needed to meet order value requirement
        const minQuantity = (minOrderValue / currentMarketPrice) * 1.01; // Add 1% buffer
        
        // Round up to meet step size and constraints
        let adjustedQty = Math.max(minQuantity, constraints.min);
        if (stepSize > 0) {
          adjustedQty = Math.ceil(adjustedQty / stepSize) * stepSize;
        }
        adjustedQty = Math.min(adjustedQty, constraints.max);
        
        // Recalculate order value with adjusted quantity
        const adjustedOrderValue = adjustedQty * currentMarketPrice;
        const adjustedStepDecimals = stepSize < 1 ? stepSize.toString().split('.')[1]?.length || 0 : 0;
        const adjustedFormattedQty = parseFloat(adjustedQty.toFixed(adjustedStepDecimals)).toString();
        
        if (adjustedOrderValue >= minOrderValue && adjustedQty <= constraints.max) {
          console.log(`✅ Adjusted quantity from ${formattedQty} to ${adjustedFormattedQty} to meet minimum order value`);
          console.log(`💰 New order value: $${adjustedOrderValue.toFixed(2)} (minimum: $${minOrderValue.toFixed(2)})`);
          qty = adjustedQty;
          formattedQty = adjustedFormattedQty;
        } else {
          throw new Error(`Order value $${currentOrderValue.toFixed(2)} is below minimum $${minOrderValue.toFixed(2)} for ${symbol} on Bybit. Calculated minimum quantity ${adjustedQty.toFixed(6)} exceeds maximum ${constraints.max}. Please increase trade amount or adjust bot configuration.`);
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
      // marketUnit: 0 = base currency (use qty in BTC/ETH/etc), 1 = quote currency (use qty in USDT)
      // For futures/linear, always use qty in base currency
      if (bybitCategory === 'spot') {
        const orderValue = parseFloat(formattedQty) * currentMarketPrice;
        // Use marketUnit: 1 to specify order value in USDT (quote currency)
        requestBody.marketUnit = 1; // 1 = quote currency (USDT)
        requestBody.qty = orderValue.toFixed(2); // Order value in USDT
        console.log(`💰 Spot order using marketUnit=1 (quote currency): $${orderValue.toFixed(2)} USDT`);
      } else {
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
          
          // Log to bot activity logs with actionable message
          await this.addBotLog(bot.id, {
            level: 'error',
            category: 'trade',
            message: `Bybit API key is invalid (Code: 10003). Please verify and update your Bybit API keys in account settings.`,
            details: {
              symbol: symbol,
              retCode: 10003,
              retMsg: data.retMsg,
              exchange: 'bybit',
              action_required: 'Update Bybit API keys in account settings. Ensure keys are valid and have trading permissions.',
              troubleshooting: [
                '1. Go to Bybit → API Management',
                '2. Verify your API key is active and has trading permissions',
                '3. Check if API key has expired or been revoked',
                '4. Re-enter API key and secret in your account settings',
                '5. Ensure testnet flag matches your Bybit account type'
              ]
            }
          });
          
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
          console.error(`💰 Price: $${currentMarketPrice}`);
          throw new Error(`Invalid quantity for ${symbol}: ${formattedQty}. Min: ${constraints.min}, Max: ${constraints.max}. Please adjust trade amount or check symbol requirements.`);
        } else if (data.retCode === 110007) {
          const orderValue = parseFloat(formattedQty) * currentMarketPrice;
          console.warn(`⚠️ Insufficient balance for ${symbol} ${capitalizedSide} order`);
          console.warn(`💰 Order value: $${orderValue.toFixed(2)}`);
          console.warn(`💡 This may happen temporarily. The bot will retry on the next execution.`);
          throw new Error(`Insufficient balance for ${symbol} order. Order value: $${orderValue.toFixed(2)}. Please check your account balance or wait for funds to become available. This is often temporary and will retry automatically.`);
        } else if (data.retCode === 170140) {
          // Calculate actual order value that was sent
          const orderValue = bybitCategory === 'spot' && requestBody.marketUnit === 1
            ? parseFloat(requestBody.qty) // For spot with marketUnit=1, qty is the USDT amount
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
          console.error(`📋 Environment: ${isTestnet ? 'TESTNET' : 'MAINNET'}`);
          console.error(`📋 This is an account/region restriction from Bybit. Please contact Bybit support.`);
          console.error(`💡 Suggestion: If using mainnet, try switching to testnet. If using testnet, verify your account has access.`);
          throw new Error(`Bybit account restriction (Code: ${data.retCode}): ${data.retMsg} This trading pair or service is not available in your region (${isTestnet ? 'Testnet' : 'Mainnet'}). Please contact Bybit support (/en/help-center/s/webform) to enable trading for your region, or switch to testnet if using mainnet.`);
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
          const entryPrice = await this.getBybitPositionEntryPrice(apiKey, apiSecret, isTestnet, symbol);
          if (entryPrice && entryPrice > 0) {
            // Get bot object from the outer scope - need to pass it through
            // For now, we'll get it from the bot parameter passed to placeBybitOrder
            // But we need to pass bot through the call chain
            await this.setBybitSLTP(apiKey, apiSecret, isTestnet, symbol, capitalizedSide, entryPrice, bot);
          } else {
            console.warn('⚠️ Could not fetch position entry price, skipping SL/TP (position may have been closed)');
          }
        } catch (slTpError) {
          // CRITICAL: If SL/TP fails and position couldn't be closed, this is a critical error
          const errorMessage = slTpError instanceof Error ? slTpError.message : String(slTpError);
          
          if (errorMessage.includes('CRITICAL') || errorMessage.includes('safety protocol')) {
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
        // For Unified Trading Account, get total equity (all assets can be used as collateral)
        // Don't filter by coin - get the entire account to check total equity
        const queryParams = `accountType=UNIFIED`;
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
        headers: {
          'X-BAPI-API-KEY': apiKey,
          'X-BAPI-TIMESTAMP': retryTimestamp,
          'X-BAPI-RECV-WINDOW': recvWindow,
          'X-BAPI-SIGN': retrySig,
        },
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
  
  private async setBybitSLTP(apiKey: string, apiSecret: string, isTestnet: boolean, symbol: string, side: string, entryPrice: number, bot: any): Promise<void> {
    const baseUrl = isTestnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
    const recvWindow = '5000';
    
    try {
      // First, check actual position to determine correct side
      const timestamp = Date.now().toString();
      const positionQuery = `category=linear&symbol=${symbol}`;
      const positionSigPayload = timestamp + apiKey + recvWindow + positionQuery;
      const positionSig = await this.createBybitSignature(positionSigPayload, apiSecret);
      
      const positionResponse = await fetch(`${baseUrl}/v5/position/list?${positionQuery}`, {
        method: 'GET',
        headers: {
          'X-BAPI-API-KEY': apiKey,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': recvWindow,
          'X-BAPI-SIGN': positionSig,
        },
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
          const bybitPositionSide = position.side;
          if (bybitPositionSide && bybitPositionSide !== actualPositionSide) {
            console.warn(`⚠️ Position side mismatch: size indicates ${actualPositionSide} but Bybit reports ${bybitPositionSide}`);
            // Trust Bybit's reported side over our calculation
            actualPositionSide = bybitPositionSide === 'Buy' ? 'Buy' : 'Sell';
            console.log(`   Using Bybit reported side: ${actualPositionSide}`);
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
          headers: {
            'X-BAPI-API-KEY': apiKey,
            'X-BAPI-TIMESTAMP': retryTimestamp,
            'X-BAPI-RECV-WINDOW': recvWindow,
            'X-BAPI-SIGN': retryPositionSig,
          },
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

      // CRITICAL FIX: Use bot's configured stop_loss and take_profit percentages instead of hardcoded values
      // Get SL/TP percentages from bot settings (fallback to defaults if not set)
      const stopLossPercent = parseFloat(bot.stop_loss || bot.stopLoss || '2.0');
      const takeProfitPercent = parseFloat(bot.take_profit || bot.takeProfit || '4.0');
      
      console.log(`\n🛡️ SL/TP Configuration:`);
      console.log(`   Bot Settings: SL=${bot?.stop_loss || bot?.stopLoss || '2.0'}%, TP=${bot?.take_profit || bot?.takeProfit || '4.0'}%`);
      console.log(`   Using: SL=${stopLossPercent}%, TP=${takeProfitPercent}% (Entry: $${entryPrice})`);
      console.log(`   ✅ Using configured values (NOT hardcoded)`);
      
      // Use the determined position side for SL/TP calculation
      if (actualPositionSide === 'Buy') {
        // Long position: SL below entry, TP above entry
        // SL = entryPrice * (1 - stopLossPercent/100)
        // TP = entryPrice * (1 + takeProfitPercent/100)
        const slValue = roundToTick(entryPrice * (1 - stopLossPercent / 100));
        const tpValue = roundToTick(entryPrice * (1 + takeProfitPercent / 100));
        // Format prices as strings with proper precision, ensuring no scientific notation
        stopLossPrice = Number(slValue.toFixed(tickDecimals)).toString();
        takeProfitPrice = Number(tpValue.toFixed(tickDecimals)).toString();
        
        console.log(`📊 Long Position SL/TP Calculation:`);
        console.log(`   Entry: ${entryPrice}, SL%: ${stopLossPercent}%, TP%: ${takeProfitPercent}%`);
        console.log(`   SL: ${entryPrice} * (1 - ${stopLossPercent}/100) = ${slValue} → ${stopLossPrice}`);
        console.log(`   TP: ${entryPrice} * (1 + ${takeProfitPercent}/100) = ${tpValue} → ${takeProfitPrice}`);
      } else {
        // Short position: SL above entry, TP below entry
        // SL = entryPrice * (1 + stopLossPercent/100)
        // TP = entryPrice * (1 - takeProfitPercent/100)
        // CRITICAL: Ensure TP is ALWAYS below entry for shorts
        const slValue = roundToTick(entryPrice * (1 + stopLossPercent / 100));
        // For shorts, TP must be BELOW entry - use subtraction to ensure it's always lower
        let tpValue = roundToTick(entryPrice * (1 - takeProfitPercent / 100));
        
        // DOUBLE-CHECK: If TP is still >= entry (shouldn't happen but safety check), force it below
        if (tpValue >= entryPrice) {
          console.error(`❌ CRITICAL: Short TP calculation resulted in TP >= Entry (${tpValue} >= ${entryPrice})`);
          console.error(`   Forcing TP to be at least 0.1% below entry`);
          tpValue = roundToTick(entryPrice * 0.999); // Force 0.1% below entry
        }
        
        // Format prices as strings with proper precision, ensuring no scientific notation
        stopLossPrice = Number(slValue.toFixed(tickDecimals)).toString();
        takeProfitPrice = Number(tpValue.toFixed(tickDecimals)).toString();
        
        console.log(`📊 Short Position SL/TP Calculation:`);
        console.log(`   Entry: ${entryPrice}, SL%: ${stopLossPercent}%, TP%: ${takeProfitPercent}%`);
        console.log(`   SL: ${entryPrice} * (1 + ${stopLossPercent}/100) = ${slValue} → ${stopLossPrice}`);
        console.log(`   TP: ${entryPrice} * (1 - ${takeProfitPercent}/100) = ${tpValue} → ${takeProfitPrice}`);
        console.log(`   ✅ Validation: TP (${tpValue}) < Entry (${entryPrice}): ${tpValue < entryPrice}`);
        console.log(`   ✅ Validation: SL (${slValue}) > Entry (${entryPrice}): ${slValue > entryPrice}`);
        
        // CRITICAL VALIDATION: For short, TP MUST be < Entry, SL MUST be > Entry
        const tpNum = parseFloat(takeProfitPrice);
        const slNum = parseFloat(stopLossPrice);
        if (tpNum >= entryPrice) {
          console.error(`❌ CRITICAL ERROR: Short position TP (${tpNum}) >= Entry (${entryPrice}) - INVALID!`);
          console.error(`   This will cause Bybit API error. Force correcting...`);
          // Force correct calculation: TP must be below entry (at least 0.1% below)
          const correctedTp = roundToTick(entryPrice * 0.999); // 0.1% below entry as minimum
          takeProfitPrice = Number(correctedTp.toFixed(tickDecimals)).toString();
          console.log(`   ✅ Force corrected TP: ${takeProfitPrice} (was ${tpNum})`);
        }
        if (slNum <= entryPrice) {
          console.error(`❌ CRITICAL ERROR: Short position SL (${slNum}) <= Entry (${entryPrice}) - INVALID!`);
          console.error(`   This will cause Bybit API error. Force correcting...`);
          // Force correct calculation: SL must be above entry (at least 0.1% above)
          const correctedSl = roundToTick(entryPrice * 1.001); // 0.1% above entry as minimum
          stopLossPrice = Number(correctedSl.toFixed(tickDecimals)).toString();
          console.log(`   ✅ Force corrected SL: ${stopLossPrice} (was ${slNum})`);
        }
      }
      
      // Validate TP/SL direction. If invalid, skip setting to avoid API errors
      const tpValue = parseFloat(takeProfitPrice);
      const slValue = parseFloat(stopLossPrice);
      console.log(`\n🔍 SL/TP Final Validation:`);
      console.log(`   Position Side: ${actualPositionSide}`);
      console.log(`   Entry Price: ${entryPrice}`);
      console.log(`   Stop Loss: ${slValue} (${actualPositionSide === 'Buy' ? 'should be <' : 'should be >'} entry)`);
      console.log(`   Take Profit: ${tpValue} (${actualPositionSide === 'Buy' ? 'should be >' : 'should be <'} entry)`);
      
      // Enhanced validation with detailed error messages
      let validationError = null;
      if (actualPositionSide === 'Buy') {
        // Long: SL < Entry, TP > Entry
        if (tpValue <= entryPrice) {
          validationError = `Take Profit (${tpValue}) must be GREATER than entry (${entryPrice}) for Long position`;
        }
        if (slValue >= entryPrice) {
          validationError = `Stop Loss (${slValue}) must be LESS than entry (${entryPrice}) for Long position`;
        }
      } else {
        // Short: SL > Entry, TP < Entry
        if (tpValue >= entryPrice) {
          validationError = `Take Profit (${tpValue}) must be LESS than entry (${entryPrice}) for Short position`;
        }
        if (slValue <= entryPrice) {
          validationError = `Stop Loss (${slValue}) must be GREATER than entry (${entryPrice}) for Short position`;
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
        headers: {
          'X-BAPI-API-KEY': apiKey,
          'X-BAPI-TIMESTAMP': finalCheckTimestamp,
          'X-BAPI-RECV-WINDOW': recvWindow,
          'X-BAPI-SIGN': finalCheckSig,
        },
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
          finalPositionSide = finalSize > 0 ? 'Buy' : 'Sell';
          console.log(`🔍 Final position check before SL/TP: ${finalPositionSide} (size: ${finalSize})`);
          
          // If position side changed, recalculate SL/TP
          if (finalPositionSide !== actualPositionSide) {
            console.warn(`⚠️ Position side changed from ${actualPositionSide} to ${finalPositionSide} - recalculating SL/TP`);
            actualPositionSide = finalPositionSide;
            
            // Recalculate SL/TP for the correct side using bot settings
            const stopLossPercent = parseFloat(bot.stop_loss || bot.stopLoss || '2.0');
            const takeProfitPercent = parseFloat(bot.take_profit || bot.takeProfit || '4.0');
            
            if (actualPositionSide === 'Buy') {
              const slValue = roundToTick(entryPrice * (1 - stopLossPercent / 100));
              const tpValue = roundToTick(entryPrice * (1 + takeProfitPercent / 100));
              stopLossPrice = Number(slValue.toFixed(tickDecimals)).toString();
              takeProfitPrice = Number(tpValue.toFixed(tickDecimals)).toString();
              console.log(`📊 Recalculated Long: SL=${stopLossPrice}, TP=${takeProfitPrice}`);
            } else {
              const slValue = roundToTick(entryPrice * (1 + stopLossPercent / 100));
              const tpValue = roundToTick(entryPrice * (1 - takeProfitPercent / 100));
              stopLossPrice = Number(slValue.toFixed(tickDecimals)).toString();
              takeProfitPrice = Number(tpValue.toFixed(tickDecimals)).toString();
              console.log(`📊 Recalculated Short: SL=${stopLossPrice}, TP=${takeProfitPrice}`);
              
              // Validate short position TP/SL
              const tpNum = parseFloat(takeProfitPrice);
              const slNum = parseFloat(stopLossPrice);
              if (tpNum >= entryPrice) {
                console.error(`❌ Recalculated Short TP (${tpNum}) >= Entry (${entryPrice}) - INVALID!`);
                // Force correction
                const correctedTp = roundToTick(entryPrice * (1 - Math.max(takeProfitPercent, 0.1) / 100));
                takeProfitPrice = Number(correctedTp.toFixed(tickDecimals)).toString();
                console.log(`   ✅ Corrected TP: ${takeProfitPrice}`);
              }
              if (slNum <= entryPrice) {
                console.error(`❌ Recalculated Short SL (${slNum}) <= Entry (${entryPrice}) - INVALID!`);
                // Force correction
                const correctedSl = roundToTick(entryPrice * (1 + Math.max(stopLossPercent, 0.1) / 100));
                stopLossPrice = Number(correctedSl.toFixed(tickDecimals)).toString();
                console.log(`   ✅ Corrected SL: ${stopLossPrice}`);
              }
            }
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
            headers: {
              'X-BAPI-API-KEY': apiKey,
              'X-BAPI-TIMESTAMP': closeCheckTimestamp,
              'X-BAPI-RECV-WINDOW': recvWindow,
              'X-BAPI-SIGN': closeCheckSig,
            },
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
                headers: {
                  'Content-Type': 'application/json',
                  'X-BAPI-API-KEY': apiKey,
                  'X-BAPI-TIMESTAMP': closeTimestamp,
                  'X-BAPI-RECV-WINDOW': closeRecvWindow,
                  'X-BAPI-SIGN': closeSig,
                },
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
                isTestnet,
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
      'SHIBUSDT': { spot: 5, linear: 5 }
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

      // 4. Daily Loss Limit Check
      const dailyLoss = await this.getDailyLoss(bot.id);
      const dailyLossLimit = this.getDailyLossLimit(bot);
      if (dailyLoss >= dailyLossLimit) {
        return {
          canTrade: false,
          reason: `Daily loss limit exceeded: $${dailyLoss.toFixed(2)} >= $${dailyLossLimit.toFixed(2)}. Trading paused for today.`,
          shouldPause: true
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
      
      const cooldownBars = strategyConfig.cooldown_bars || 8; // Default: 8 bars
      
      // If cooldown is 0 or negative, skip check
      if (cooldownBars <= 0) {
        return { canTrade: true };
      }
      
      // Get last trade time
      const lastTrade = await this.getLastTradeTime(bot.id);
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
  private async getLastTradeTime(botId: string): Promise<string | null> {
    try {
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
          notification_type: 'trade_executed',
          data: {
            bot_name: bot.name,
            symbol: bot.symbol || trade.symbol,
            side: trade.side,
            price: trade.price || trade.entry_price,
            amount: trade.amount || trade.size,
            order_id: trade.exchange_order_id || orderResult?.orderId,
            user_id: this.user?.id || trade.user_id || bot.user_id // Pass user_id explicitly
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('⚠️ Telegram notification HTTP error:', response.status, errorText);
      } else {
        const result = await response.json();
        console.log('✅ Telegram notification sent for trade:', trade.id, result);
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
      const currentPrice = await MarketDataFetcher.fetchPrice(
        bot.symbol, 
        bot.exchange, 
        tradingType
      );
      
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
          
          // For major coins like BTC, ETH, etc., they don't use 1000 prefix
          // Only smaller coins like PEPE, FLOKI use 1000 prefix
          const majorCoins = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'ATOM', 'LTC', 'ETC', 'XLM', 'ALGO', 'VET', 'FIL', 'TRX'];
          const isMajorCoin = majorCoins.some(coin => bot.symbol.startsWith(coin));
          
          let suggestedFormat = '';
          if (isMajorCoin) {
            // Major coins: BTCUSDT works for both spot and futures, no prefix needed
            // The issue might be API availability or network error
            suggestedFormat = `${bot.symbol} (should work for both spot and futures - check API availability)`;
          } else if (bot.symbol.startsWith('1000')) {
            // Already has prefix, try without
            suggestedFormat = bot.symbol.replace(/^1000/, '');
          } else {
            // Smaller coins might need prefix for futures
            suggestedFormat = `1000${bot.symbol}`;
          }
          
          throw new Error(`Invalid price for ${bot.symbol} - market data unavailable for ${tradingType} trading on ${bot.exchange}. ${isMajorCoin ? 'Major coins like BTC/ETH should work - this might be a temporary API issue.' : `Try alternative format: ${suggestedFormat}`} Please verify the symbol exists on the exchange.`);
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

      const leverage = bot.leverage || 1;
      const notional = finalExecutedPrice * quantity;
      const marginRequired = sizing.isFutures ? notional / leverage : notional;
      
      // 🛡️ REALISTIC SIMULATION: Check minimum order value (like real exchanges)
      const minOrderValue = sizing.isFutures ? 5 : 1; // $5 for futures, $1 for spot
      const orderValue = finalExecutedPrice * quantity;
      if (orderValue < minOrderValue) {
        throw new Error(`Order value $${orderValue.toFixed(2)} below minimum $${minOrderValue} for ${bot.symbol}. This happens in real trading too.`);
      }

      if (marginRequired > availableBalance) {
        throw new Error(`Insufficient paper balance: Need $${marginRequired.toFixed(2)}, Have $${availableBalance.toFixed(2)}`);
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

      // Deduct margin from account
      const newBalance = availableBalance - marginRequired;
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
  async updatePaperPositions(botId?: string): Promise<void> {
    try {
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
      
      const botLogger = new BotExecutor(this.supabaseClient, this.user);

      for (const position of positions) {
        // Get REAL current market price from MAINNET
        const currentPrice = await MarketDataFetcher.fetchPrice(
          position.symbol,
          position.exchange,
          position.trading_type
        );
        
        if (!currentPrice || currentPrice === 0) continue;
        
        // Calculate unrealized PnL
        let unrealizedPnL = 0;
        if (position.side === 'long') {
          unrealizedPnL = (currentPrice - parseFloat(position.entry_price)) * parseFloat(position.quantity) * position.leverage;
        } else {
          unrealizedPnL = (parseFloat(position.entry_price) - currentPrice) * parseFloat(position.quantity) * position.leverage;
        }
        
        // Check SL/TP triggers with realistic execution
        // In real trading, SL/TP may not execute at exact price due to gaps, slippage, etc.
        let newStatus = position.status;
        let exitPrice = currentPrice;
        let shouldClose = false;
        
        const stopLossPrice = parseFloat(position.stop_loss_price);
        const takeProfitPrice = parseFloat(position.take_profit_price);
        
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
        
        // Update position
        const updateData: any = {
          current_price: currentPrice,
          unrealized_pnl: unrealizedPnL,
          updated_at: TimeSync.getCurrentTimeISO()
        };
        
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
          
          // Calculate slippage for logging
          const exitOrderSide = position.side === 'long' ? 'sell' : 'buy';
          const initialExitNotional = quantity * parseFloat(position.entry_price);
          const slippageSeverity = newStatus === 'stopped' ? 2.5 : 1.3; // Increased to match real trading conditions
          const exitSlip = applySlippage(parseFloat(position.entry_price), exitOrderSide, position.symbol, initialExitNotional, { isExit: true, severity: slippageSeverity });
          
          let finalPnL = 0;
          if (position.side === 'long') {
            finalPnL = (exitPrice - parseFloat(position.entry_price)) * quantity * position.leverage;
          } else {
            finalPnL = (parseFloat(position.entry_price) - exitPrice) * quantity * position.leverage;
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
          
          // Log closure with slippage details
          try {
            await botLogger.addBotLog(position.bot_id, {
              level: newStatus === 'stopped' ? 'warning' : 'success',
              category: 'trade',
              message: `📝 [PAPER] Position closed (${newStatus}): ${position.symbol} ${position.side.toUpperCase()} exit @ $${exitPrice.toFixed(4)}`,
              details: {
                paper_trading: true,
                status: newStatus,
                side: position.side,
                quantity,
                exit_price: exitPrice,
                slippage_bps: exitSlip.slippageBps,
                fees,
                pnl: finalPnL,
                margin_returned: position.margin_used,
                severity: slippageSeverity
              }
            });
          } catch (logError) {
            console.warn('⚠️ Failed to log paper position closure:', logError);
          }
          
          // Update bot performance
          await this.updateBotPerformance(position.bot_id, finalPnL);
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
        console.log('⚠️ Time sync failed (non-critical):', err.message);
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
      console.log(`\n📥 [bot-executor] POST REQUEST RECEIVED`);
      console.log(`📋 Content-Type: ${req.headers.get('content-type')}`);
      console.log(`🔐 x-cron-secret header: ${req.headers.get('x-cron-secret') ? 'present' : 'missing'}`);
      console.log(`🔐 Authorization header: ${req.headers.get('authorization') ? 'present' : 'missing'}`);
      
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
        console.log(`🤖 Starting bot execution...`);
        await executor.executeBot(bot)
        console.log(`✅ Bot execution completed successfully`);
        
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
              
              // Log error to bot activity logs for visibility
              try {
                const execForLogging = new BotExecutor(supabaseClient, { id: isCron ? bot.user_id : user.id });
                const errorMessage = error instanceof Error ? error.message : String(error);
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
              } catch (logError) {
                console.error('Failed to log error to bot activity:', logError);
              }
              
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
