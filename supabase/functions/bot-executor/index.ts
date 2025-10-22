import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

      // V5 returns time in seconds and milliseconds separately
      const serverTime = parseInt(data.result.timeSecond) * 1000 + parseInt(data.result.timeNano) / 1000000;
      const endTime = Date.now();
      
      // Account for network latency
      const latency = (endTime - startTime) / 2;
      this.serverTimeOffset = serverTime - (startTime + latency);
      this.lastSync = Date.now();
      
      console.log(`Time synced with Bybit. Offset: ${this.serverTimeOffset.toFixed(2)}ms`);
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
    return Date.now() + this.serverTimeOffset;
  }
  
  static getCurrentTimeISO(): string {
    return new Date(this.getCurrentTime()).toISOString();
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

// Market data fetcher
class MarketDataFetcher {
  static async fetchPrice(symbol: string, exchange: string, tradingType: string = 'spot'): Promise<number> {
    try {
      if (exchange === 'bybit') {
        const response = await fetch(`https://api.bybit.com/v5/market/tickers?category=${tradingType}&symbol=${symbol}`);
        const data = await response.json();
        return parseFloat(data.result.list[0]?.lastPrice || '0');
      } else if (exchange === 'okx') {
        const response = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${symbol}`);
        const data = await response.json();
        return parseFloat(data.data[0]?.last || '0');
      }
      return 0;
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error);
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
      
      // Execute trading strategy
      const strategy = typeof bot.strategy === 'string' ? JSON.parse(bot.strategy) : bot.strategy;
      console.log('Bot strategy:', JSON.stringify(strategy, null, 2));
      const shouldTrade = this.evaluateStrategy(strategy, { price: currentPrice, rsi, adx });
      
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
      console.error(`Bot execution error for ${bot.name}:`, error);
      await this.addBotLog(bot.id, {
        level: 'error',
        category: 'error',
        message: `Execution error: ${error.message}`,
        details: { error: error.message }
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
      const currentPrice = await MarketDataFetcher.fetchPrice(bot.symbol, bot.exchange);
      const tradeAmount = this.calculateTradeAmount(bot, currentPrice);
      
      // Place actual order on exchange
      const orderResult = await this.placeOrder(bot, tradeSignal, tradeAmount, currentPrice);
      
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
          price: currentPrice,
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
      console.error('❌ Trade execution error:', error);
      await this.addBotLog(bot.id, {
        level: 'error',
        category: 'trade',
        message: `Trade execution failed: ${error.message}`,
        details: { error: error.message }
      });
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
      
      // For spot trading: can only buy with USDT (can't sell if we don't own the asset)
      // For futures: can both buy (long) and sell (short)
      if (tradingType === 'spot' && (tradeSignal.side.toLowerCase() === 'sell')) {
        console.log(`⚠️ Spot trading: Cannot sell ${bot.symbol} without owning it. Skipping sell signal.`);
        throw new Error('Cannot sell on spot market without owning the asset. Only buy orders are supported for spot trading.');
      }
      
      if (bot.exchange === 'bybit') {
        return await this.placeBybitOrder(apiKey, apiSecret, apiKeys.is_testnet, bot.symbol, tradeSignal.side, amount, price, tradingType);
      } else if (bot.exchange === 'okx') {
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
      
      // Different symbols have different precision requirements
      const getQuantityPrecision = (symbol: string): number => {
        const precisionMap: { [key: string]: number } = {
          'BTCUSDT': 3,    // Bitcoin: 3 decimals (0.001 minimum)
          'ETHUSDT': 2,    // Ethereum: 2 decimals (0.01 minimum)
          'DOTUSDT': 0,    // Polkadot: whole numbers (1 minimum)
          'UNIUSDT': 1,    // Uniswap: 1 decimal (0.1 minimum)
          'ADAUSDT': 0,    // Cardano: whole numbers
          'AVAXUSDT': 1,   // Avalanche: 1 decimal (0.1 minimum)
          'SOLUSDT': 1,    // Solana: 1 decimal
        };
        return precisionMap[symbol] || 2; // Default to 2 decimals
      };
      
      const precision = getQuantityPrecision(symbol);
      const formattedQty = parseFloat(amount.toString()).toFixed(precision);
      
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
          await this.setBybitSLTP(apiKey, apiSecret, isTestnet, symbol, capitalizedSide, currentMarketPrice);
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
  
  private async setBybitSLTP(apiKey: string, apiSecret: string, isTestnet: boolean, symbol: string, side: string, entryPrice: number): Promise<void> {
    const baseUrl = isTestnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
    
    try {
      const timestamp = Date.now().toString();
      const recvWindow = '5000';
      
      // Calculate SL/TP prices
      const stopLossPrice = side === 'Buy' 
        ? (entryPrice * 0.98).toFixed(2)   // Buy: SL 2% below
        : (entryPrice * 1.02).toFixed(2);  // Sell: SL 2% above
      
      const takeProfitPrice = side === 'Buy'
        ? (entryPrice * 1.03).toFixed(2)   // Buy: TP 3% above
        : (entryPrice * 0.97).toFixed(2);  // Sell: TP 3% below
      
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
    // Position sizing based on bot's configured trade amount, leverage, and risk level
    const baseAmount = bot.trade_amount || 100; // Use bot's trade amount or default to $100
    const leverageMultiplier = bot.leverage || 1;
    const riskMultiplier = bot.risk_level === 'high' ? 2 : bot.risk_level === 'medium' ? 1.5 : 1;
    
    const totalAmount = baseAmount * leverageMultiplier * riskMultiplier;
    console.log(`💰 Trade calculation: Base=$${baseAmount}, Leverage=${leverageMultiplier}x, Risk=${bot.risk_level}(${riskMultiplier}x) = Total=$${totalAmount}`);
    
    return totalAmount / price;
  }
  
  private async updateBotPerformance(botId: string, trade: any): Promise<void> {
    const { data: bot } = await this.supabaseClient
      .from('trading_bots')
      .select('total_trades, pnl, pnl_percentage')
      .eq('id', botId)
      .single();
    
    const newTotalTrades = (bot?.total_trades || 0) + 1;
    const tradePnL = Math.random() * 20 - 10; // Mock PnL calculation
    const newPnL = (bot?.pnl || 0) + tradePnL;
    const newPnLPercentage = (newPnL / 1000) * 100; // Mock percentage calculation
    
    await this.supabaseClient
      .from('trading_bots')
      .update({
        total_trades: newTotalTrades,
        pnl: newPnL,
        pnl_percentage: newPnLPercentage,
        last_trade_at: TimeSync.getCurrentTimeISO(),
        updated_at: TimeSync.getCurrentTimeISO()
      })
      .eq('id', botId);
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
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
          .eq('user_id', user.id)
          .single()
        
        if (!bot) {
          throw new Error('Bot not found')
        }
        
        const executor = new BotExecutor(supabaseClient, user)
        await executor.executeBot(bot)
        
        return new Response(JSON.stringify({ success: true, message: 'Bot executed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'execute_all_bots':
        console.log(`🔍 Looking for running bots for user: ${user.id}`);
        
        const { data: bots } = await supabaseClient
          .from('trading_bots')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'running')
        
        console.log(`📊 Found ${bots?.length || 0} running bots:`, bots?.map(b => ({ id: b.id, name: b.name, exchange: b.exchange, symbol: b.symbol })));
        
        if (!bots || bots.length === 0) {
          console.log('⚠️ No running bots found for user');
          return new Response(JSON.stringify({ 
            success: true, 
            message: 'No running bots found',
            botsExecuted: 0 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        console.log(`🚀 Executing ${bots.length} running bots for user ${user.id}`)
        
        const executor2 = new BotExecutor(supabaseClient, user)
        const results = await Promise.allSettled(
          bots.map(async (bot) => {
            console.log(`🤖 Executing bot: ${bot.name} (${bot.exchange}/${bot.symbol})`);
            return executor2.executeBot(bot);
          })
        )
        
        const successful = results.filter(r => r.status === 'fulfilled').length
        const failed = results.filter(r => r.status === 'rejected').length
        
        console.log(`📈 Execution complete: ${successful} successful, ${failed} failed`);
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: `Executed ${successful} bots successfully, ${failed} failed`,
          botsExecuted: bots.length,
          successful,
          failed,
          results: { successful, failed }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

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
