import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Time synchronization utilities
class TimeSync {
  private static serverTimeOffset = 0;
  private static lastSync = 0;
  
  static async syncWithServer(): Promise<void> {
    try {
      const startTime = Date.now();
      const response = await fetch('https://worldtimeapi.org/api/timezone/UTC');
      const data = await response.json();
      const serverTime = new Date(data.utc_datetime).getTime();
      const endTime = Date.now();
      
      // Account for network latency
      const latency = (endTime - startTime) / 2;
      this.serverTimeOffset = serverTime - (startTime + latency);
      this.lastSync = Date.now();
      
      console.log(`Time synced. Offset: ${this.serverTimeOffset}ms`);
    } catch (error) {
      console.error('Time sync failed:', error);
    }
  }
  
  static getCurrentTime(): number {
    return Date.now() + this.serverTimeOffset;
  }
  
  static getCurrentTimeISO(): string {
    return new Date(this.getCurrentTime()).toISOString();
  }
  
  static shouldResync(): boolean {
    return Date.now() - this.lastSync > 300000; // Resync every 5 minutes
  }
}

// Market data fetcher
class MarketDataFetcher {
  static async fetchPrice(symbol: string, exchange: string): Promise<number> {
    try {
      if (exchange === 'bybit') {
        const response = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`);
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
    // Mock RSI calculation - in production, use proper technical analysis
    const price = await this.fetchPrice(symbol, exchange);
    return 30 + Math.random() * 40; // Random RSI between 30-70
  }
  
  static async fetchADX(symbol: string, exchange: string): Promise<number> {
    // Mock ADX calculation
    return 20 + Math.random() * 30; // Random ADX between 20-50
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
      console.log(`Executing bot: ${bot.name} (${bot.id})`);
      
      // Add execution log
      await this.addBotLog(bot.id, {
        level: 'info',
        category: 'system',
        message: 'Bot execution started',
        details: { timestamp: TimeSync.getCurrentTimeISO() }
      });
      
      // Fetch market data
      const currentPrice = await MarketDataFetcher.fetchPrice(bot.symbol, bot.exchange);
      const rsi = await MarketDataFetcher.fetchRSI(bot.symbol, bot.exchange);
      const adx = await MarketDataFetcher.fetchADX(bot.symbol, bot.exchange);
      
      await this.addBotLog(bot.id, {
        level: 'info',
        category: 'market',
        message: `Market data: Price=${currentPrice}, RSI=${rsi.toFixed(2)}, ADX=${adx.toFixed(2)}`,
        details: { price: currentPrice, rsi, adx }
      });
      
      // Execute trading strategy
      const strategy = typeof bot.strategy === 'string' ? JSON.parse(bot.strategy) : bot.strategy;
      const shouldTrade = this.evaluateStrategy(strategy, { price: currentPrice, rsi, adx });
      
      if (shouldTrade.shouldTrade) {
        await this.executeTrade(bot, shouldTrade);
      } else {
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
      
      // Record trade
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
          executed_at: TimeSync.getCurrentTimeISO(),
          strategy_data: tradeSignal,
          order_id: orderResult.orderId,
          exchange_response: orderResult
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update bot performance
      await this.updateBotPerformance(bot.id, trade);
      
      await this.addBotLog(bot.id, {
        level: 'success',
        category: 'trade',
        message: `${tradeSignal.side.toUpperCase()} order placed: ${tradeAmount} ${bot.symbol} at $${currentPrice}`,
        details: { trade, signal: tradeSignal, orderResult }
      });
      
    } catch (error) {
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
      const passphrase = apiKeys.passphrase ? this.decrypt(apiKeys.passphrase) : '';
      
      if (bot.exchange === 'bybit') {
        return await this.placeBybitOrder(apiKey, apiSecret, apiKeys.is_testnet, bot.symbol, tradeSignal.side, amount, price);
      } else if (bot.exchange === 'okx') {
        return await this.placeOKXOrder(apiKey, apiSecret, passphrase, apiKeys.is_testnet, bot.symbol, tradeSignal.side, amount, price);
      }
      
      throw new Error(`Unsupported exchange: ${bot.exchange}`);
    } catch (error) {
      console.error('Order placement error:', error);
      throw error;
    }
  }
  
  private async placeBybitOrder(apiKey: string, apiSecret: string, isTestnet: boolean, symbol: string, side: string, amount: number, price: number): Promise<any> {
    const baseUrl = isTestnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
    
    try {
      const timestamp = Date.now().toString();
      const recvWindow = '5000';
      
      // Bybit V5 API signature format - CORRECTED approach for POST requests
      // Step 1: Create parameters object with ALL parameters including api_key
      const params = {
        api_key: apiKey,
        category: 'spot',
        orderType: 'Market',
        qty: amount.toString(),
        recv_window: recvWindow,
        side: side,
        symbol: symbol,
        timestamp: timestamp
      };
      
      // Step 2: Sort parameters alphabetically (Bybit requirement)
      const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('&');
      
      console.log('=== BYBIT ORDER SIGNATURE DEBUG (CORRECTED) ===');
      console.log('1. Original params:', params);
      console.log('2. Sorted params string:', sortedParams);
      
      // Step 3: Create signature using the sorted parameter string
      const signature = await this.createBybitSignature(sortedParams, apiSecret);
      
      console.log('3. Generated signature:', signature);
      
      // Step 4: Build final URL with signature
      const finalUrl = `${baseUrl}/v5/order/create?${sortedParams}&sign=${signature}`;
      
      console.log('4. Final URL:', finalUrl);
      console.log('=== END DEBUG ===');
      
      const response = await fetch(finalUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Bybit Order HTTP Error:', response.status, errorText);
        throw new Error(`Bybit API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Bybit Order Response:', data);
      
      if (data.retCode !== 0) {
        throw new Error(`Bybit order error: ${data.retMsg}`);
      }
      
      return {
        orderId: data.result?.orderId,
        status: 'filled',
        exchange: 'bybit',
        response: data
      };
    } catch (error) {
      console.error('Bybit order placement error:', error);
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
        throw new Error(`OKX order error: ${data.msg}`);
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
    // Simple position sizing based on leverage and risk level
    const baseAmount = 100; // Base amount in USD
    const leverageMultiplier = bot.leverage || 1;
    const riskMultiplier = bot.risk_level === 'high' ? 2 : bot.risk_level === 'medium' ? 1.5 : 1;
    
    return (baseAmount * leverageMultiplier * riskMultiplier) / price;
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

    // Sync time with server
    if (TimeSync.shouldResync()) {
      await TimeSync.syncWithServer();
    }

    // Handle GET requests
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const action = url.searchParams.get('action')
      
      if (action === 'time') {
        return new Response(JSON.stringify({ 
          time: TimeSync.getCurrentTimeISO(),
          offset: TimeSync.serverTimeOffset 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
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
        const { data: bots } = await supabaseClient
          .from('trading_bots')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'running')
        
        const executor2 = new BotExecutor(supabaseClient, user)
        const results = await Promise.allSettled(
          bots.map(bot => executor2.executeBot(bot))
        )
        
        const successful = results.filter(r => r.status === 'fulfilled').length
        const failed = results.filter(r => r.status === 'rejected').length
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: `Executed ${successful} bots successfully, ${failed} failed`,
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
