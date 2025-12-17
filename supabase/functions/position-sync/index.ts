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

/**
 * Create Bybit signature for API requests
 */
async function createBybitSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);
  
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

/**
 * Sync positions from exchange for a single bot
 */
async function syncPositionsForBot(
  supabaseClient: any,
  bot: any,
  apiKeys: any
): Promise<{ success: boolean; synced: number; closed: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;
  let closed = 0;

  try {
    const tradingType = bot.tradingType || bot.trading_type || 'futures';
    const symbol = bot.symbol;
    const exchange = bot.exchange || 'bybit';

    // Fetch positions from exchange
    const baseUrl = 'https://api.bybit.com';
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    const category = tradingType === 'futures' ? 'linear' : tradingType === 'spot' ? 'spot' : 'linear';

    const queryParams = `category=${category}&symbol=${symbol}`;
    const signaturePayload = timestamp + apiKeys.api_key + recvWindow + queryParams;
    const signature = await createBybitSignature(signaturePayload, apiKeys.api_secret);

    const response = await fetch(`${baseUrl}/v5/position/list?${queryParams}`, {
      method: 'GET',
      headers: {
        'X-BAPI-API-KEY': apiKeys.api_key,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'X-BAPI-SIGN': signature,
      },
    });

    if (!response.ok) {
      errors.push(`Failed to fetch positions: HTTP ${response.status}`);
      return { success: false, synced: 0, closed: 0, errors };
    }

    const data = await response.json();
    if (data.retCode !== 0 || !data.result?.list) {
      errors.push(`Exchange error: ${data.retMsg || 'Unknown error'}`);
      return { success: false, synced: 0, closed: 0, errors };
    }

    const exchangePositions = data.result.list.filter((p: any) => parseFloat(p.size || 0) !== 0);

    // Get database positions
    const { data: dbPositions, error: dbError } = await supabaseClient
      .from('trading_positions')
      .select('*')
      .eq('bot_id', bot.id)
      .eq('symbol', symbol)
      .eq('exchange', exchange)
      .eq('status', 'open');

    if (dbError) {
      errors.push(`Database error: ${dbError.message}`);
      return { success: false, synced: 0, closed: 0, errors };
    }

    // Update or close positions based on exchange data
    for (const dbPos of dbPositions || []) {
      const exchangePos = exchangePositions.find((ep: any) => {
        const epSide = ep.side?.toLowerCase();
        const dbSide = dbPos.side?.toLowerCase();
        return ep.symbol === symbol && (
          epSide === dbSide ||
          (epSide === 'buy' && dbSide === 'long') ||
          (epSide === 'sell' && dbSide === 'short')
        );
      });

      if (!exchangePos || parseFloat(exchangePos.size || 0) === 0) {
        // Position closed on exchange, close in database
        const currentPrice = parseFloat(exchangePos?.markPrice || exchangePos?.lastPrice || dbPos.current_price || 0);
        
        if (currentPrice > 0) {
          // Calculate realized PnL
          const entryPrice = parseFloat(dbPos.entry_price);
          const quantity = parseFloat(dbPos.quantity);
          const entryFees = parseFloat(dbPos.entry_fees || 0);
          
          // Calculate exit fees
          const feeRate = resolveFeeRate(exchange, tradingType);
          const exitNotional = quantity * currentPrice;
          const exitFees = exitNotional * feeRate;
          const totalFees = entryFees + exitFees;
          
          // Calculate PnL based on side
          let realizedPnL: number;
          const normalizedSide = dbPos.side?.toLowerCase();
          if (normalizedSide === 'long') {
            realizedPnL = (currentPrice - entryPrice) * quantity - totalFees;
          } else {
            realizedPnL = (entryPrice - currentPrice) * quantity - totalFees;
          }

          // Update position to closed
          const { error: updateError } = await supabaseClient
            .from('trading_positions')
            .update({
              exit_price: currentPrice,
              realized_pnl: realizedPnL,
              fees: totalFees,
              exit_fees: exitFees,
              status: 'closed',
              close_reason: 'exchange_sync',
              closed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', dbPos.id);

          if (updateError) {
            errors.push(`Failed to close position ${dbPos.id}: ${updateError.message}`);
          } else {
            closed++;
            
            // Update trade if trade_id exists
            if (dbPos.trade_id) {
              await supabaseClient
                .from('trades')
                .update({
                  pnl: realizedPnL,
                  fees: totalFees,
                  exit_price: currentPrice,
                  status: 'closed',
                  updated_at: new Date().toISOString()
                })
                .eq('id', dbPos.trade_id);
            }
          }
        } else {
          // Close without price update if we can't get current price
          await supabaseClient
            .from('trading_positions')
            .update({
              status: 'closed',
              close_reason: 'exchange_sync_no_price',
              closed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', dbPos.id);
          closed++;
        }
      } else {
        // Update position with current price and unrealized PnL
        const currentPrice = parseFloat(exchangePos.markPrice || exchangePos.lastPrice || 0);
        const unrealizedPnL = parseFloat(exchangePos.unrealisedPnl || 0);

        if (currentPrice > 0) {
          const { error: updateError } = await supabaseClient
            .from('trading_positions')
            .update({
              current_price: currentPrice,
              unrealized_pnl: unrealizedPnL,
              quantity: parseFloat(exchangePos.size || dbPos.quantity),
              updated_at: new Date().toISOString()
            })
            .eq('id', dbPos.id);

          if (updateError) {
            errors.push(`Failed to update position ${dbPos.id}: ${updateError.message}`);
          } else {
            synced++;
          }
        }
      }
    }

    return { success: true, synced, closed, errors };
  } catch (error: any) {
    errors.push(`Sync error: ${error.message || String(error)}`);
    return { success: false, synced, closed, errors };
  }
}

serve(async (req) => {
  const requestStartTime = Date.now();
  const requestId = crypto.randomUUID().substring(0, 8);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 [${requestId}] Position Sync Cron Job STARTED`);
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authentication check
    // Use POSITION_SYNC_SECRET to avoid conflicts with other functions' CRON_SECRET
    // Falls back to CRON_SECRET for backward compatibility
    const POSITION_SYNC_SECRET = Deno.env.get('POSITION_SYNC_SECRET') ?? Deno.env.get('CRON_SECRET') ?? '';
    const headerSecret = req.headers.get('x-cron-secret') ?? '';

    if (!POSITION_SYNC_SECRET || headerSecret !== POSITION_SYNC_SECRET) {
      console.error(`❌ [${requestId}] Authentication failed`);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', requestId }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Initialize Supabase client
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`❌ [${requestId}] Missing Supabase configuration`);
      return new Response(
        JSON.stringify({ error: 'Configuration error', requestId }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all running bots (non-paper trading only)
    console.log(`🔍 [${requestId}] Fetching running bots...`);
    const { data: bots, error: botsError } = await supabaseClient
      .from('trading_bots')
      .select('id, user_id, name, symbol, exchange, trading_type, tradingType, paper_trading, status')
      .eq('status', 'running')
      .eq('paper_trading', false);

    if (botsError) {
      console.error(`❌ [${requestId}] Failed to fetch bots:`, botsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch bots', details: botsError.message, requestId }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!bots || bots.length === 0) {
      console.log(`ℹ️ [${requestId}] No running bots found`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No running bots to sync',
          botsProcessed: 0,
          requestId 
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log(`📊 [${requestId}] Found ${bots.length} running bot(s) to sync`);

    // Group bots by user_id to batch API key fetches
    const botsByUser = new Map<string, any[]>();
    for (const bot of bots) {
      const userId = bot.user_id;
      if (!botsByUser.has(userId)) {
        botsByUser.set(userId, []);
      }
      botsByUser.get(userId)!.push(bot);
    }

    const results = {
      totalBots: bots.length,
      synced: 0,
      closed: 0,
      errors: [] as string[],
      botResults: [] as any[]
    };

    // Process each user's bots
    for (const [userId, userBots] of botsByUser.entries()) {
      // Get API keys for this user
      const { data: apiKeys, error: apiKeysError } = await supabaseClient
        .from('api_keys')
        .select('*')
        .eq('user_id', userId)
        .eq('is_testnet', false)
        .eq('is_active', true);

      if (apiKeysError || !apiKeys || apiKeys.length === 0) {
        const errorMsg = `No API keys found for user ${userId}`;
        console.warn(`⚠️ [${requestId}] ${errorMsg}`);
        results.errors.push(errorMsg);
        continue;
      }

      // Create map of exchange -> API keys
      const apiKeysByExchange = new Map<string, any>();
      for (const key of apiKeys) {
        apiKeysByExchange.set(key.exchange.toLowerCase(), key);
      }

      // Sync positions for each bot
      for (const bot of userBots) {
        const exchange = (bot.exchange || 'bybit').toLowerCase();
        const apiKey = apiKeysByExchange.get(exchange);

        if (!apiKey) {
          const errorMsg = `No API keys for ${exchange} for bot ${bot.name} (${bot.id})`;
          console.warn(`⚠️ [${requestId}] ${errorMsg}`);
          results.errors.push(errorMsg);
          continue;
        }

        console.log(`🔄 [${requestId}] Syncing positions for bot: ${bot.name} (${bot.symbol})`);
        
        const syncResult = await syncPositionsForBot(supabaseClient, bot, apiKey);
        
        results.synced += syncResult.synced;
        results.closed += syncResult.closed;
        results.errors.push(...syncResult.errors);
        results.botResults.push({
          botId: bot.id,
          botName: bot.name,
          symbol: bot.symbol,
          ...syncResult
        });

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const duration = Date.now() - requestStartTime;
    console.log(`✅ [${requestId}] Position sync completed in ${duration}ms`);
    console.log(`   Bots processed: ${results.totalBots}`);
    console.log(`   Positions synced: ${results.synced}`);
    console.log(`   Positions closed: ${results.closed}`);
    console.log(`   Errors: ${results.errors.length}`);
    console.log(`${'='.repeat(60)}\n`);

    return new Response(
      JSON.stringify({
        success: true,
        requestId,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        ...results
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    const duration = Date.now() - requestStartTime;
    console.error(`❌ [${requestId}] Position sync failed:`, error);
    console.log(`${'='.repeat(60)}\n`);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message || String(error),
        requestId,
        duration: `${duration}ms`
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
