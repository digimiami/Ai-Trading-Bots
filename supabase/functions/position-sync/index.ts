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
 * Recalculate bot statistics from trades
 */
async function recalculateBotStats(
  supabaseClient: any,
  botId: string,
  userId: string
): Promise<void> {
  try {
    // Fetch all closed trades for this bot
    const { data: trades, error: tradesError } = await supabaseClient
      .from('trades')
      .select('status, pnl, fee, fees, executed_at')
      .eq('bot_id', botId)
      .eq('user_id', userId)
      .order('executed_at', { ascending: true });

    if (tradesError) {
      console.warn(`   ⚠️ Error fetching trades for stats:`, tradesError);
      return;
    }

    if (!trades || trades.length === 0) {
      // No trades, reset stats
      await supabaseClient
        .from('trading_bots')
        .update({
          total_trades: 0,
          win_rate: 0,
          pnl: 0,
          fees: 0,
          drawdown: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', botId);
      return;
    }

    const executedStatuses = new Set(['filled', 'completed', 'closed', 'stopped', 'taken_profit']);
    const closedStatuses = new Set(['completed', 'closed', 'stopped', 'taken_profit']);

    let totalTrades = 0;
    let closedTrades = 0;
    let winTrades = 0;
    let lossTrades = 0;
    let totalPnL = 0;
    let totalFees = 0;
    let peakEquity = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;

    for (const trade of trades) {
      const status = (trade.status || '').toString().toLowerCase();
      const pnlValue = trade.pnl !== null && trade.pnl !== undefined ? parseFloat(trade.pnl) : NaN;
      // Handle both 'fee' and 'fees' columns
      const feeValue = (trade.fees !== null && trade.fees !== undefined ? parseFloat(trade.fees) : 0) ||
                       (trade.fee !== null && trade.fee !== undefined ? parseFloat(trade.fee) : 0);

      if (executedStatuses.has(status)) {
        totalTrades += 1;
        totalFees += feeValue;
      }

      if (closedStatuses.has(status) && !Number.isNaN(pnlValue)) {
        closedTrades += 1;
        runningPnL += pnlValue;
        totalPnL += pnlValue;
        
        if (pnlValue > 0) {
          winTrades += 1;
        } else if (pnlValue < 0) {
          lossTrades += 1;
        }

        // Calculate drawdown
        peakEquity = Math.max(peakEquity, runningPnL);
        const currentDrawdown = peakEquity - runningPnL;
        maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
      }
    }

    const winRate = closedTrades > 0 ? (winTrades / closedTrades) * 100 : 0;
    const drawdownPercent = peakEquity > 0 ? (maxDrawdown / peakEquity) * 100 : 0;

    // Update bot stats
    await supabaseClient
      .from('trading_bots')
      .update({
        total_trades: totalTrades,
        win_rate: Math.round(winRate * 100) / 100,
        pnl: Math.round(totalPnL * 100) / 100,
        fees: Math.round(totalFees * 100) / 100,
        drawdown: Math.round(drawdownPercent * 100) / 100,
        updated_at: new Date().toISOString()
      })
      .eq('id', botId);

    console.log(`   ✅ Stats recalculated for bot ${botId}: ${totalTrades} trades, ${winRate.toFixed(2)}% win rate, $${totalPnL.toFixed(2)} PnL`);
  } catch (error: any) {
    console.error(`   ❌ Error recalculating stats for bot ${botId}:`, error);
  }
}

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

    console.log(`   🔍 Fetching positions for ${symbol} (${tradingType}) from ${exchange}`);

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
      const errorText = await response.text();
      const errorMsg = `Failed to fetch positions: HTTP ${response.status} - ${errorText}`;
      console.error(`   ❌ ${errorMsg}`);
      errors.push(errorMsg);
      return { success: false, synced: 0, closed: 0, errors };
    }

    const data = await response.json();
    if (data.retCode !== 0) {
      const errorMsg = `Exchange error (retCode: ${data.retCode}): ${data.retMsg || 'Unknown error'}`;
      console.error(`   ❌ ${errorMsg}`);
      errors.push(errorMsg);
      return { success: false, synced: 0, closed: 0, errors };
    }

    if (!data.result?.list) {
      const errorMsg = `Exchange returned no result list for ${symbol}`;
      console.error(`   ❌ ${errorMsg}`);
      errors.push(errorMsg);
      return { success: false, synced: 0, closed: 0, errors };
    }

    const exchangePositions = data.result.list.filter((p: any) => parseFloat(p.size || 0) !== 0);
    console.log(`   📊 Exchange positions found: ${exchangePositions.length} for ${symbol}`);

    // Get database positions
    const { data: dbPositions, error: dbError } = await supabaseClient
      .from('trading_positions')
      .select('*')
      .eq('bot_id', bot.id)
      .eq('symbol', symbol)
      .eq('exchange', exchange)
      .eq('status', 'open');

    if (dbError) {
      console.error(`   ❌ Database error fetching positions:`, dbError);
      errors.push(`Database error: ${dbError.message}`);
      return { success: false, synced: 0, closed: 0, errors };
    }

    console.log(`   💾 Database positions found: ${dbPositions?.length || 0} for ${symbol}`);

    // If no database positions but exchange has positions, log it (positions should be created by bot-executor)
    if ((!dbPositions || dbPositions.length === 0) && exchangePositions.length > 0) {
      console.warn(`   ⚠️ Exchange has ${exchangePositions.length} position(s) but database has none for ${symbol}`);
      console.warn(`   ℹ️ This might indicate positions weren't tracked when opened. Consider checking bot-executor logs.`);
    }

    // If no exchange positions and no database positions, that's normal
    if ((!dbPositions || dbPositions.length === 0) && exchangePositions.length === 0) {
      console.log(`   ℹ️ No positions found on exchange or in database for ${symbol} - bot may not have opened any positions yet`);
      return { success: true, synced: 0, closed: 0, errors };
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
              // Update both 'fee' and 'fees' columns to handle schema variations
              const tradeUpdate: any = {
                pnl: realizedPnL,
                fee: totalFees,
                fees: totalFees,
                exit_price: currentPrice,
                status: 'closed',
                updated_at: new Date().toISOString()
              };
              
              const { error: tradeUpdateError } = await supabaseClient
                .from('trades')
                .update(tradeUpdate)
                .eq('id', dbPos.trade_id);

              if (tradeUpdateError) {
                console.error(`   ⚠️ Failed to update trade ${dbPos.trade_id}:`, tradeUpdateError);
                errors.push(`Failed to update trade ${dbPos.trade_id}: ${tradeUpdateError.message}`);
              } else {
                console.log(`   ✅ Updated trade ${dbPos.trade_id} with PnL: $${realizedPnL.toFixed(2)}`);
              }
            }

            // Recalculate bot stats after closing position
            await recalculateBotStats(supabaseClient, bot.id, bot.user_id);
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

    // If we closed any positions, recalculate stats once at the end
    if (closed > 0) {
      console.log(`   🔄 Recalculating bot stats after closing ${closed} position(s)`);
      await recalculateBotStats(supabaseClient, bot.id, bot.user_id);
    }

    return { success: true, synced, closed, errors };
  } catch (error: any) {
    const errorMsg = `Sync error for ${bot.name} (${bot.symbol}): ${error.message || String(error)}`;
    console.error(`   ❌ ${errorMsg}`);
    console.error(`   Stack: ${error.stack || 'No stack trace'}`);
    errors.push(errorMsg);
    return { success: false, synced, closed, errors };
  }
}

serve(async (req) => {
  const requestStartTime = Date.now();
  const requestId = crypto.randomUUID().substring(0, 8);

  // Log immediately - this should always appear
  // Use multiple log statements to ensure at least one appears
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 [${requestId}] Position Sync Cron Job STARTED`);
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`📡 Method: ${req.method}`);
  console.log(`🌐 URL: ${req.url}`);
  console.error(`[${requestId}] ERROR LEVEL LOG TEST - Function is executing`); // Use error level to ensure visibility
  console.warn(`[${requestId}] WARN LEVEL LOG TEST - Function is executing`); // Use warn level to ensure visibility

  if (req.method === 'OPTIONS') {
    console.log(`✅ [${requestId}] OPTIONS request - returning CORS headers`);
    return new Response('ok', { headers: corsHeaders });
  }

  // Health check endpoint for GET requests (no auth required)
  if (req.method === 'GET') {
    console.log(`ℹ️ [${requestId}] GET request - health check`);
    return new Response(
      JSON.stringify({
        status: 'ok',
        service: 'position-sync',
        timestamp: new Date().toISOString(),
        requestId
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // Log available environment variables (names only, for security)
    const envVarNames = ['POSITION_SYNC_SECRET', 'CRON_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
    const envVarsStatus: Record<string, boolean> = {};
    envVarNames.forEach(name => {
      envVarsStatus[name] = !!Deno.env.get(name);
    });
    console.log(`🔍 [${requestId}] Environment variables status:`, JSON.stringify(envVarsStatus));

    // Authentication check with detailed logging
    // Use POSITION_SYNC_SECRET to avoid conflicts with other functions' CRON_SECRET
    // Falls back to CRON_SECRET for backward compatibility
    const POSITION_SYNC_SECRET = Deno.env.get('POSITION_SYNC_SECRET') ?? Deno.env.get('CRON_SECRET') ?? '';
    const headerSecret = req.headers.get('x-cron-secret') ?? '';

    // Log all headers for debugging (check multiple possible header names)
    const allHeaders: Record<string, string> = {};
    const headerNames: string[] = [];
    req.headers.forEach((value, key) => {
      headerNames.push(key);
      allHeaders[key] = key.toLowerCase().includes('secret') || key.toLowerCase().includes('cron') ? '[REDACTED]' : value;
    });
    console.log(`📋 [${requestId}] Request headers (${headerNames.length} total):`, JSON.stringify(headerNames));
    
    // Check for header with different casing
    const headerVariations = [
      'x-cron-secret',
      'X-Cron-Secret',
      'X-CRON-SECRET',
      'x-Cron-Secret',
      'cron-secret',
      'Cron-Secret'
    ];
    const foundHeaders: Record<string, boolean> = {};
    headerVariations.forEach(headerName => {
      foundHeaders[headerName] = req.headers.has(headerName);
    });
    console.log(`🔍 [${requestId}] Header variations check:`, JSON.stringify(foundHeaders));
    
    // Try to get header with different casings
    let headerSecretAlt = '';
    for (const headerName of headerVariations) {
      const value = req.headers.get(headerName);
      if (value) {
        headerSecretAlt = value;
        console.log(`   Found header "${headerName}" with value (length: ${value.length})`);
        break;
      }
    }
    
    // Use the found header if x-cron-secret wasn't found
    const actualHeaderSecret = headerSecret || headerSecretAlt;

    // Detailed authentication logging
    console.log(`🔐 [${requestId}] Authentication check:`);
    console.log(`   POSITION_SYNC_SECRET present: ${!!POSITION_SYNC_SECRET} (length: ${POSITION_SYNC_SECRET.length})`);
    console.log(`   Header secret present: ${!!actualHeaderSecret} (length: ${actualHeaderSecret.length})`);
    console.log(`   Using header: ${actualHeaderSecret ? 'found' : 'NOT FOUND'}`);
    
    // Log character codes to detect hidden characters/whitespace
    if (POSITION_SYNC_SECRET) {
      const envFirstChars = POSITION_SYNC_SECRET.substring(0, Math.min(10, POSITION_SYNC_SECRET.length));
      const envCharCodes = Array.from(envFirstChars).map(c => c.charCodeAt(0)).join(',');
      console.log(`   Env secret (first 10 chars): "${envFirstChars}" (char codes: ${envCharCodes})`);
    }
    if (actualHeaderSecret) {
      const headerFirstChars = actualHeaderSecret.substring(0, Math.min(10, actualHeaderSecret.length));
      const headerCharCodes = Array.from(headerFirstChars).map(c => c.charCodeAt(0)).join(',');
      console.log(`   Header secret (first 10 chars): "${headerFirstChars}" (char codes: ${headerCharCodes})`);
    }
    
    if (POSITION_SYNC_SECRET && actualHeaderSecret) {
      // Trim both values to handle whitespace issues
      const envSecretTrimmed = POSITION_SYNC_SECRET.trim();
      const headerSecretTrimmed = actualHeaderSecret.trim();
      
      const secretsMatch = actualHeaderSecret === POSITION_SYNC_SECRET;
      const secretsMatchTrimmed = headerSecretTrimmed === envSecretTrimmed;
      
      console.log(`   🔑 Secrets match (exact): ${secretsMatch}`);
      console.log(`   🔑 Secrets match (trimmed): ${secretsMatchTrimmed}`);
      
      if (!secretsMatch) {
        console.error(`   ❌ SECRET MISMATCH:`);
        console.error(`      Expected (first 10): "${POSITION_SYNC_SECRET.substring(0, Math.min(10, POSITION_SYNC_SECRET.length))}"`);
        console.error(`      Received (first 10): "${actualHeaderSecret.substring(0, Math.min(10, actualHeaderSecret.length))}"`);
        console.error(`      Expected (last 10): "${POSITION_SYNC_SECRET.substring(Math.max(0, POSITION_SYNC_SECRET.length - 10))}"`);
        console.error(`      Received (last 10): "${actualHeaderSecret.substring(Math.max(0, actualHeaderSecret.length - 10))}"`);
        console.error(`      Expected length: ${POSITION_SYNC_SECRET.length}, Received length: ${actualHeaderSecret.length}`);
        
        // Check for common issues
        if (POSITION_SYNC_SECRET.length !== actualHeaderSecret.length) {
          console.error(`      ⚠️ Length mismatch detected!`);
        }
        if (envSecretTrimmed !== headerSecretTrimmed) {
          console.error(`      ⚠️ Even after trimming, secrets don't match!`);
        } else {
          console.warn(`      ℹ️ Secrets match after trimming - likely whitespace issue`);
        }
      }
    } else {
      console.warn(`   ⚠️ Missing secrets:`);
      if (!POSITION_SYNC_SECRET) console.warn(`      - POSITION_SYNC_SECRET env var is empty`);
      if (!actualHeaderSecret) console.warn(`      - x-cron-secret header is missing or empty (checked variations: ${headerVariations.join(', ')})`);
    }

    // Check authentication - try exact match first, then trimmed match
    const envSecretTrimmed = POSITION_SYNC_SECRET.trim();
    const headerSecretTrimmed = actualHeaderSecret.trim();
    const exactMatch = actualHeaderSecret === POSITION_SYNC_SECRET;
    const trimmedMatch = headerSecretTrimmed === envSecretTrimmed;
    
    if (!POSITION_SYNC_SECRET || !actualHeaderSecret || (!exactMatch && !trimmedMatch)) {
      console.error(`❌ [${requestId}] Authentication failed - Secret mismatch or missing`);
      console.error(`   Exact match: ${exactMatch}, Trimmed match: ${trimmedMatch}`);
      console.error(`   Env secret available: ${!!POSITION_SYNC_SECRET}, Header secret available: ${!!actualHeaderSecret}`);
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized', 
          message: 'POSITION_SYNC_SECRET mismatch or missing',
          requestId,
          hint: 'Check that POSITION_SYNC_SECRET environment variable matches x-cron-secret header value (check for whitespace)',
          debug: {
            envSecretPresent: !!POSITION_SYNC_SECRET,
            envSecretLength: POSITION_SYNC_SECRET.length,
            envSecretTrimmedLength: envSecretTrimmed.length,
            headerSecretPresent: !!actualHeaderSecret,
            headerSecretLength: actualHeaderSecret.length,
            headerSecretTrimmedLength: headerSecretTrimmed.length,
            exactMatch,
            trimmedMatch,
            headerVariationsChecked: headerVariations,
            allHeadersFound: headerNames,
            envFirstChars: POSITION_SYNC_SECRET.substring(0, Math.min(10, POSITION_SYNC_SECRET.length)),
            headerFirstChars: actualHeaderSecret.substring(0, Math.min(10, actualHeaderSecret.length))
          }
        }),
        { status: 401, headers: corsHeaders }
      );
    }
    
    // Log if we used trimmed match (indicates whitespace issue)
    if (!exactMatch && trimmedMatch) {
      console.warn(`⚠️ [${requestId}] Authentication succeeded with trimmed match (whitespace detected)`);
    }

    console.log(`✅ [${requestId}] Authentication successful`);

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
      .select('id, user_id, name, symbol, exchange, trading_type, paper_trading, status')
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
        
        // Log detailed results for this bot
        if (syncResult.synced > 0 || syncResult.closed > 0) {
          console.log(`   ✅ ${bot.name}: ${syncResult.synced} synced, ${syncResult.closed} closed`);
        }
        
        // Log errors for this bot
        if (syncResult.errors.length > 0) {
          console.error(`   ❌ [${requestId}] Errors syncing ${bot.name} (${bot.symbol}):`);
          syncResult.errors.forEach((err, idx) => {
            console.error(`      ${idx + 1}. ${err}`);
          });
        }
        
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
    console.error(`   Error type: ${error?.constructor?.name || typeof error}`);
    console.error(`   Error message: ${error?.message || String(error)}`);
    console.error(`   Error stack: ${error?.stack || 'No stack trace'}`);
    console.log(`${'='.repeat(60)}\n`);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message || String(error),
        requestId,
        duration: `${duration}ms`,
        errorType: error?.constructor?.name || typeof error,
        stack: error?.stack || undefined
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
