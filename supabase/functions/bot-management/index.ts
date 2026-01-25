import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests FIRST, before any other processing
  if (req.method === 'OPTIONS') {
    try {
      return new Response(null, { 
        status: 204,
        headers: {
          ...corsHeaders,
          'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
        }
      })
    } catch (error) {
      // Even if there's an error, return CORS headers
      console.error(`❌ Error in OPTIONS handler:`, error);
      return new Response(null, { 
        status: 204,
        headers: corsHeaders
      })
    }
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const accessToken = authHeader?.replace('Bearer', '').trim() || ''
    if (!authHeader || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // IMPORTANT: pass token explicitly for server-side usage
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(accessToken)
    if (authError || !user) {
      console.error('❌ Auth error:', authError?.message || 'No user found');
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message || 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'list'

    if (req.method === 'GET') {
      if (action === 'get-by-id') {
        // Get bot by ID (public read - allows cloning from other users)
        const botId = url.searchParams.get('botId')
        
        if (!botId) {
          return new Response(
            JSON.stringify({ error: 'botId parameter is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Use service role client to bypass RLS and allow reading any bot
        const serviceClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { data: bot, error } = await serviceClient
          .from('trading_bots')
          .select('*')
          .eq('id', botId)
          .maybeSingle()

        if (error) {
          console.error('Error fetching bot by ID:', error)
          // Check if it's a "no rows" error
          if (error.code === 'PGRST116' || error.message?.includes('JSON object')) {
            return new Response(
              JSON.stringify({ error: 'Bot not found' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          return new Response(
            JSON.stringify({ error: error.message || 'Failed to fetch bot' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (!bot) {
          return new Response(
            JSON.stringify({ error: 'Bot not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Return bot data (without sensitive user info)
        return new Response(
          JSON.stringify({ bot }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'list') {
        console.log(`📊 Fetching bots for user: ${user.id}`);
        const { data: bots, error } = await supabaseClient
          .from('trading_bots')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('❌ Error fetching bots:', error);
          throw error;
        }

        console.log(`📊 Found ${bots?.length || 0} bots for user ${user.id}`);

        // Transform the data to match frontend expectations
        const botIds = bots.map((bot: any) => bot.id);

        const statsMap = new Map<string, {
          totalTrades: number;
          closedTrades: number;
          winTrades: number;
          lossTrades: number;
          pnl: number;
          totalFees: number;
          maxDrawdown: number;
          peakEquity: number;
          hasClosed: boolean;
        }>();
        const seenTradeIds = new Set<string>();
        const countedTradeIds = new Set<string>();
        const tradeFeesById = new Map<string, number>();

        const ensureStats = (botId: string) => {
          if (!statsMap.has(botId)) {
            statsMap.set(botId, {
              totalTrades: 0,
              closedTrades: 0,
              winTrades: 0,
              lossTrades: 0,
              pnl: 0,
              totalFees: 0,
              maxDrawdown: 0,
              peakEquity: 0,
              hasClosed: false
            });
          }
          return statsMap.get(botId)!;
        };

        if (botIds.length > 0) {
          const executedStatuses = new Set(['filled', 'completed', 'closed', 'stopped', 'taken_profit', 'open']);
          const closedStatuses = new Set(['completed', 'closed', 'stopped', 'taken_profit']);

          const { data: realTrades, error: realTradesError } = await supabaseClient
            .from('trades')
            .select('id, bot_id, status, pnl, fee, executed_at, amount, side, price')
            .eq('user_id', user.id)
            .in('bot_id', botIds)
            .order('executed_at', { ascending: true });

          if (realTradesError) {
            console.warn('Error fetching trades for stats:', realTradesError);
          } else if (realTrades) {
            for (const trade of realTrades) {
              if (!trade || !trade.bot_id) continue;
              const stats = ensureStats(trade.bot_id);
              if (trade.id) {
                seenTradeIds.add(trade.id);
              }
              const status = (trade.status || '').toString().toLowerCase();
              let pnlValue = trade.pnl !== null && trade.pnl !== undefined ? parseFloat(trade.pnl) : NaN;
              const feeValue = trade.fee !== null && trade.fee !== undefined ? parseFloat(trade.fee) : 0;
              if (trade.id && !Number.isNaN(feeValue)) {
                tradeFeesById.set(trade.id, feeValue);
              }
              const hasExitPrice = trade.exit_price !== null && trade.exit_price !== undefined;
              if (Number.isNaN(pnlValue) && hasExitPrice) {
                const entryPrice = parseFloat(trade.entry_price || trade.price || 0);
                const exitPrice = parseFloat(trade.exit_price || 0);
                const size = parseFloat(trade.amount || trade.size || 0);
                const side = (trade.side || 'long').toLowerCase();
                if (entryPrice > 0 && exitPrice > 0 && size > 0) {
                  if (side === 'short' || side === 'sell') {
                    pnlValue = (entryPrice - exitPrice) * size;
                  } else {
                    pnlValue = (exitPrice - entryPrice) * size;
                  }
                  if (!Number.isNaN(feeValue)) {
                    pnlValue -= feeValue;
                  }
                }
              }

              // Count as executed if status is in executedStatuses
              if (executedStatuses.has(status)) {
                stats.totalTrades += 1;
                stats.totalFees += feeValue;
              }

              // Count as closed if:
              // 1. Status is in closedStatuses, OR
              // 2. Trade has a PnL value (meaning it's been closed)
              const isClosed = closedStatuses.has(status)
                || (!Number.isNaN(pnlValue) && pnlValue !== 0)
                || hasExitPrice;
              
              if (isClosed && !Number.isNaN(pnlValue)) {
                stats.closedTrades += 1;
                stats.pnl += pnlValue;
                stats.hasClosed = true;
                if (pnlValue > 0) {
                  stats.winTrades += 1;
                } else if (pnlValue < 0) {
                  stats.lossTrades += 1;
                }
                if (trade.id) {
                  countedTradeIds.add(trade.id);
                }
              }

              // Calculate drawdown: track peak equity and current drawdown
              if (stats.hasClosed) {
                stats.peakEquity = Math.max(stats.peakEquity, stats.pnl);
                const currentDrawdown = stats.peakEquity - stats.pnl;
                stats.maxDrawdown = Math.max(stats.maxDrawdown, currentDrawdown);
              }
            }
          }

          const { data: paperTrades, error: paperTradesError } = await supabaseClient
            .from('paper_trading_trades')
            .select('id, bot_id, status, pnl, fees, executed_at, exit_price, entry_price, quantity, side')
            .eq('user_id', user.id)
            .in('bot_id', botIds)
            .order('executed_at', { ascending: true });

          if (paperTradesError) {
            console.warn('Error fetching paper trades for stats:', paperTradesError);
          } else if (paperTrades) {
            for (const trade of paperTrades) {
              if (!trade || !trade.bot_id) continue;
              const stats = ensureStats(trade.bot_id);
              if (trade.id) {
                seenTradeIds.add(trade.id);
              }
              const status = (trade.status || '').toString().toLowerCase();
              let pnlValue = trade.pnl !== null && trade.pnl !== undefined ? parseFloat(trade.pnl) : NaN;
              const feeValue = trade.fees !== null && trade.fees !== undefined ? parseFloat(trade.fees) : 0;
              const hasExitPrice = trade.exit_price !== null && trade.exit_price !== undefined;
              if (Number.isNaN(pnlValue) && hasExitPrice) {
                const entryPrice = parseFloat(trade.entry_price || 0);
                const exitPrice = parseFloat(trade.exit_price || 0);
                const quantity = parseFloat(trade.quantity || 0);
                const side = (trade.side || 'long').toLowerCase();
                if (entryPrice > 0 && exitPrice > 0 && quantity > 0) {
                  if (side === 'short' || side === 'sell') {
                    pnlValue = (entryPrice - exitPrice) * quantity;
                  } else {
                    pnlValue = (exitPrice - entryPrice) * quantity;
                  }
                  if (!Number.isNaN(feeValue)) {
                    pnlValue -= feeValue;
                  }
                }
              }
              if (trade.id && !Number.isNaN(feeValue)) {
                tradeFeesById.set(trade.id, feeValue);
              }

              // Count as executed if status is in executedStatuses
              if (executedStatuses.has(status)) {
                stats.totalTrades += 1;
                stats.totalFees += feeValue;
              }

              // Count as closed if:
              // 1. Status is in closedStatuses, OR
              // 2. Trade has a PnL value (meaning it's been closed), OR
              // 3. Trade has an exit_price (meaning position was closed)
              const isClosed = closedStatuses.has(status)
                || (!Number.isNaN(pnlValue) && pnlValue !== 0)
                || hasExitPrice;
              
              // If trade is closed but PnL is NaN, try to calculate it again from entry/exit prices
              if (isClosed && Number.isNaN(pnlValue) && hasExitPrice) {
                const entryPrice = parseFloat(trade.entry_price || 0);
                const exitPrice = parseFloat(trade.exit_price || 0);
                const quantity = parseFloat(trade.quantity || 0);
                const side = (trade.side || 'long').toLowerCase();
                if (entryPrice > 0 && exitPrice > 0 && quantity > 0) {
                  if (side === 'short' || side === 'sell') {
                    pnlValue = (entryPrice - exitPrice) * quantity;
                  } else {
                    pnlValue = (exitPrice - entryPrice) * quantity;
                  }
                  if (!Number.isNaN(feeValue)) {
                    pnlValue -= feeValue;
                  }
                }
              }
              
              // Count as closed if it's marked as closed, even if PnL calculation failed
              if (isClosed) {
                // Use 0 as default PnL if calculation failed but trade is clearly closed
                const finalPnL = Number.isNaN(pnlValue) ? 0 : pnlValue;
                stats.closedTrades += 1;
                stats.pnl += finalPnL;
                stats.hasClosed = true;
                if (finalPnL > 0) {
                  stats.winTrades += 1;
                } else if (finalPnL < 0) {
                  stats.lossTrades += 1;
                }
                if (trade.id) {
                  countedTradeIds.add(trade.id);
                }
              }

              // Calculate drawdown: track peak equity and current drawdown
              if (stats.hasClosed) {
                stats.peakEquity = Math.max(stats.peakEquity, stats.pnl);
                const currentDrawdown = stats.peakEquity - stats.pnl;
                stats.maxDrawdown = Math.max(stats.maxDrawdown, currentDrawdown);
              }
            }
          }

          const { data: closedPositions, error: positionsError } = await supabaseClient
            .from('trading_positions')
            .select('bot_id, trade_id, realized_pnl, fees, entry_price, exit_price, quantity, side')
            .eq('user_id', user.id)
            .in('bot_id', botIds)
            .in('status', ['closed', 'stopped', 'taken_profit', 'manual_close', 'liquidated']);

          if (positionsError) {
            console.warn('Error fetching closed positions for stats:', positionsError);
          } else if (closedPositions) {
            const positionsWithPnL = closedPositions.filter(p => p.realized_pnl !== null && p.realized_pnl !== undefined);
            const positionsWithExit = closedPositions.filter(p => p.exit_price !== null && p.exit_price !== undefined);
            console.log(`📊 Closed positions: total=${closedPositions.length}, withPnL=${positionsWithPnL.length}, withExitPrice=${positionsWithExit.length}`);
            for (const position of closedPositions) {
              if (!position || !position.bot_id) continue;
              const stats = ensureStats(position.bot_id);
              let pnlValue = position.realized_pnl !== null && position.realized_pnl !== undefined
                ? parseFloat(position.realized_pnl)
                : NaN;
              if (Number.isNaN(pnlValue)) {
                const entryPrice = parseFloat(position.entry_price || 0);
                const exitPrice = parseFloat(position.exit_price || 0);
                const quantity = parseFloat(position.quantity || 0);
                const side = (position.side || 'long').toLowerCase();
                if (entryPrice > 0 && exitPrice > 0 && quantity > 0) {
                  if (side === 'short' || side === 'sell') {
                    pnlValue = (entryPrice - exitPrice) * quantity;
                  } else {
                    pnlValue = (exitPrice - entryPrice) * quantity;
                  }
                  const feeValue = parseFloat(position.fees || 0);
                  if (!Number.isNaN(feeValue)) {
                    pnlValue -= feeValue;
                  }
                }
              }
              if (Number.isNaN(pnlValue)) continue;

              const tradeId = position.trade_id;
              if (tradeId && countedTradeIds.has(tradeId)) {
                continue;
              }

              stats.closedTrades += 1;
              stats.pnl += pnlValue;
              stats.hasClosed = true;
              if (pnlValue > 0) {
                stats.winTrades += 1;
              } else if (pnlValue < 0) {
                stats.lossTrades += 1;
              }

              if (!tradeId || !seenTradeIds.has(tradeId)) {
                stats.totalTrades += 1;
              }

              const feeValue = position.fees !== null && position.fees !== undefined
                ? parseFloat(position.fees)
                : 0;
              if (!Number.isNaN(feeValue) && feeValue > 0) {
                if (tradeId && seenTradeIds.has(tradeId)) {
                  const existingFee = tradeFeesById.get(tradeId) ?? 0;
                  if (!existingFee) {
                    stats.totalFees += feeValue;
                  }
                } else {
                  stats.totalFees += feeValue;
                }
              }

              if (stats.hasClosed) {
                stats.peakEquity = Math.max(stats.peakEquity, stats.pnl);
                const currentDrawdown = stats.peakEquity - stats.pnl;
                stats.maxDrawdown = Math.max(stats.maxDrawdown, currentDrawdown);
              }

              if (tradeId) {
                countedTradeIds.add(tradeId);
              }
            }
          }
        }

        const transformedBots = bots.map(bot => {
          const stats = statsMap.get(bot.id) || {
            totalTrades: 0,
            closedTrades: 0,
            winTrades: 0,
            lossTrades: 0,
            pnl: 0,
            totalFees: 0,
            maxDrawdown: 0,
            peakEquity: 0,
            hasClosed: false
          };

          const totalTrades = Math.max(bot.total_trades ?? 0, stats.totalTrades);
          const closedTrades = stats.closedTrades;
          const winTrades = stats.winTrades;
          const lossTrades = stats.lossTrades;
          const realizedPnl = stats.hasClosed ? stats.pnl : (bot.pnl ?? 0);
          const totalFees = stats.totalFees || (bot.total_fees ?? 0);
          const maxDrawdown = stats.maxDrawdown || (bot.max_drawdown ?? 0);
          
          // Calculate win rate from closed trades, or use bot's stored value if no closed trades
          const winRate = closedTrades > 0
            ? (winTrades / closedTrades) * 100
            : (bot.win_rate ?? 0);

          // Calculate drawdown percentage based on peak equity
          const drawdownPercentage = stats.peakEquity > 0
            ? (maxDrawdown / stats.peakEquity) * 100
            : (bot.drawdown_percentage ?? 0);

          const tradeAmount = bot.trade_amount || bot.tradeAmount;
          const pnlPercentage = closedTrades > 0 && tradeAmount
            ? (realizedPnl / (tradeAmount * closedTrades)) * 100
            : (bot.pnl_percentage ?? 0);

          // Parse symbols if it's a JSON string, otherwise use as-is
          let symbolsArray: string[] | undefined = undefined;
          if (bot.symbols) {
            if (typeof bot.symbols === 'string') {
              try {
                symbolsArray = JSON.parse(bot.symbols);
              } catch (e) {
                console.warn('Failed to parse symbols JSON:', e);
              }
            } else if (Array.isArray(bot.symbols)) {
              symbolsArray = bot.symbols;
            }
          }

          return ({
          id: bot.id,
          name: bot.name,
          exchange: bot.exchange,
          tradingType: bot.trading_type || 'spot',
          symbol: bot.symbol,
          timeframe: bot.timeframe || '1h',
          status: bot.status,
          pauseReason: bot.pause_reason || null,
          leverage: bot.leverage ?? 1,
          tradeAmount: bot.trade_amount || 100,
          stopLoss: bot.stop_loss || 2.0,
          takeProfit: bot.take_profit || 4.0,
          pnl: realizedPnl,
          pnlPercentage,
          totalTrades,
          winRate,
          winTrades,
          lossTrades,
          closedTrades,
          realizedPnl,
          totalFees,
          total_fees: totalFees,
          drawdown: maxDrawdown,
          maxDrawdown,
          drawdownPercentage,
          drawdown_percentage: drawdownPercentage,
          createdAt: bot.created_at,
          lastTradeAt: bot.last_trade_at,
          riskLevel: bot.risk_level || 'medium',
          strategy: typeof bot.strategy === 'string' ? JSON.parse(bot.strategy) : bot.strategy,
          strategyConfig: bot.strategy_config
            ? (typeof bot.strategy_config === 'string' ? JSON.parse(bot.strategy_config) : bot.strategy_config)
            : undefined,
          strategy_config: bot.strategy_config ?? null,
          strategyConfig: bot.strategy_config
            ? (typeof bot.strategy_config === 'string' ? JSON.parse(bot.strategy_config) : bot.strategy_config)
            : undefined,
          strategy_config: bot.strategy_config ?? null,
          aiMlEnabled: bot.ai_ml_enabled || false,
          paperTrading: bot.paper_trading || false,
          soundNotificationsEnabled: bot.sound_notifications_enabled || false,
          webhookSecret: bot.webhook_secret || null,
          webhookTriggerImmediate: bot.webhook_trigger_immediate ?? true,
          symbols: symbolsArray,
          customPairs: bot.custom_pairs || null
        });
        })

        console.log(`✅ Returning ${transformedBots.length} transformed bots`);
        return new Response(
          JSON.stringify({ bots: transformedBots }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (req.method === 'POST') {
      const body = await req.json()

      if (action === 'create') {
        const { name, exchange, tradingType, symbol, symbols, customPairs, timeframe, leverage, riskLevel, tradeAmount, stopLoss, takeProfit, strategy, strategyConfig, status, pnl, pnlPercentage, totalTrades, winRate, lastTradeAt, paperTrading, soundNotificationsEnabled } = body

        // #region agent log
        await fetch('http://127.0.0.1:7242/ingest/4c7e68c2-00cd-41d9-aaf6-c7e5035d647a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bot-management/index.ts:307',message:'Bot create action started',data:{userId:user.id,name,exchange},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
        // #endregion

        // Debug logging
        console.log('Received bot data:', { name, exchange, symbol, symbols, customPairs, timeframe, leverage, riskLevel, tradeAmount, stopLoss, takeProfit, strategy, status, pnl, pnlPercentage, totalTrades, winRate, lastTradeAt })
        console.log('Exchange value:', exchange, 'Type:', typeof exchange, 'Is null:', exchange === null, 'Is undefined:', exchange === undefined)

        // Check subscription limits before creating bot
        // #region agent log
        await fetch('http://127.0.0.1:7242/ingest/4c7e68c2-00cd-41d9-aaf6-c7e5035d647a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bot-management/index.ts:315',message:'Checking subscription limits',data:{userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
        // #endregion
        const { data: limitCheck, error: limitError } = await supabaseClient
          .rpc('can_user_create_bot', { p_user_id: user.id })
        
        // #region agent log
        await fetch('http://127.0.0.1:7242/ingest/4c7e68c2-00cd-41d9-aaf6-c7e5035d647a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bot-management/index.ts:320',message:'Limit check result',data:{hasError:!!limitError,error:limitError?.message,hasData:!!limitCheck,dataValue:limitCheck},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
        // #endregion
        
        if (!limitError && limitCheck) {
          const result = typeof limitCheck === 'object' ? limitCheck : { allowed: limitCheck }
          if (result.allowed !== true) {
            // #region agent log
            await fetch('http://127.0.0.1:7242/ingest/4c7e68c2-00cd-41d9-aaf6-c7e5035d647a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bot-management/index.ts:325',message:'Bot creation blocked by limit',data:{reason:result.reason,currentBots:result.current_bots},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
            // #endregion
            return new Response(
              JSON.stringify({ 
                error: result.reason || 'You have reached your bot creation limit. Please upgrade your plan.'
              }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }

        // Validate required fields
        if (!name || !exchange || !symbol) {
          throw new Error(`Missing required fields: name=${name}, exchange=${exchange}, symbol=${symbol}`)
        }

        // Check if exchange is valid
        if (exchange !== 'bybit' && exchange !== 'okx' && exchange !== 'bitunix' && exchange !== 'mexc') {
          throw new Error(`Invalid exchange value: ${exchange}. Must be 'bybit', 'okx', 'bitunix', or 'mexc'`)
        }

        // Check if table exists by trying to select from it
        const { data: tableCheck, error: tableError } = await supabaseClient
          .from('trading_bots')
          .select('id')
          .limit(1)

        if (tableError) {
          console.error('Table check error:', tableError)
          throw new Error(`Database table error: ${tableError.message}`)
        }

        console.log('Table exists, proceeding with insert...')

        // Fetch user's risk management settings
        let userRiskSettings: any = null;
        try {
          const { data: userSettings } = await supabaseClient
            .from('user_settings')
            .select('risk_settings')
            .eq('user_id', user.id)
            .single();
          
          if (userSettings?.risk_settings) {
            userRiskSettings = userSettings.risk_settings as any;
            console.log('✅ Loaded user risk management settings:', userRiskSettings);
          }
        } catch (error) {
          console.warn('⚠️ Could not load user risk settings, using defaults:', error);
        }

        // Start with frontend's strategyConfig to preserve all user settings
        let finalStrategyConfig: any = strategyConfig || {};
        console.log('📋 [bot-management] Received strategyConfig from frontend:', JSON.stringify(strategyConfig, null, 2));
        
        // Only merge user risk settings for fields that aren't already set in strategyConfig
        if (userRiskSettings) {
          // Map user_settings.risk_settings to strategy_config risk management fields
          // Only apply if the field is not already set in the frontend's config
          const mergedRiskSettings: any = {};
          if (finalStrategyConfig.daily_loss_limit_pct === undefined || finalStrategyConfig.daily_loss_limit_pct === null) {
            mergedRiskSettings.daily_loss_limit_pct = userRiskSettings.maxDailyLoss ? userRiskSettings.maxDailyLoss / 100 : 3.0;
          }
          if (finalStrategyConfig.max_position_size === undefined || finalStrategyConfig.max_position_size === null) {
            mergedRiskSettings.max_position_size = userRiskSettings.maxPositionSize ?? 1000;
          }
          if (finalStrategyConfig.stop_loss_percentage === undefined || finalStrategyConfig.stop_loss_percentage === null) {
            mergedRiskSettings.stop_loss_percentage = userRiskSettings.stopLossPercentage ?? 5.0;
          }
          if (finalStrategyConfig.take_profit_percentage === undefined || finalStrategyConfig.take_profit_percentage === null) {
            mergedRiskSettings.take_profit_percentage = userRiskSettings.takeProfitPercentage ?? 10.0;
          }
          if (finalStrategyConfig.max_concurrent === undefined || finalStrategyConfig.max_concurrent === null) {
            mergedRiskSettings.max_concurrent = userRiskSettings.maxOpenPositions ?? 5;
          }
          if (finalStrategyConfig.risk_per_trade_pct === undefined || finalStrategyConfig.risk_per_trade_pct === null) {
            mergedRiskSettings.risk_per_trade_pct = userRiskSettings.riskPerTrade ? userRiskSettings.riskPerTrade / 100 : 0.02;
          }
          if (finalStrategyConfig.emergency_stop_loss === undefined || finalStrategyConfig.emergency_stop_loss === null) {
            mergedRiskSettings.emergency_stop_loss = userRiskSettings.emergencyStopLoss ?? 20.0;
          }
          
          finalStrategyConfig = {
            ...finalStrategyConfig,
            ...mergedRiskSettings
          };
          console.log('✅ Merged risk management settings into strategy_config (preserving frontend values)');
        }


        const defaultRiskEngine = {
          volatility_low: 0.6,
          volatility_high: 2.5,
          high_volatility_multiplier: 0.75,
          low_volatility_multiplier: 1.05,
          max_spread_bps: 20,
          spread_penalty_multiplier: 0.75,
          low_liquidity_multiplier: 0.6,
          medium_liquidity_multiplier: 0.8,
          drawdown_moderate: 10,
          drawdown_severe: 20,
          moderate_drawdown_multiplier: 0.8,
          severe_drawdown_multiplier: 0.6,
          loss_streak_threshold: 3,
          loss_streak_step: 0.15,
          min_size_multiplier: 0.35,
          max_size_multiplier: 1.5,
          max_slippage_bps: 25,
          min_execution_size_multiplier: 0.35,
          limit_spread_bps: 8,
          signal_learning_rate: 0.05,
          min_signal_weight: 0.6,
          max_signal_weight: 1.4
        };

        // Preserve user's risk_engine settings from frontend, only fill in missing defaults
        const userRiskEngine = finalStrategyConfig.risk_engine || {};
        const toNumber = (value: any, fallback: number) => {
          const next = Number(value);
          return Number.isFinite(next) ? next : fallback;
        };
        const clampValue = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
        
        // Merge defaults with user's risk_engine, preserving user values
        // Only fill in defaults for fields that are missing
        const mergedRiskEngine = { ...defaultRiskEngine, ...userRiskEngine };
        
        // Validate and clamp values for safety, but preserve user's values if they're valid
        const validateRiskEngineValue = (key: string, userValue: any, defaultValue: number, validator: (val: number) => number) => {
          if (userValue !== undefined && userValue !== null && userRiskEngine.hasOwnProperty(key)) {
            // User provided this value, validate it
            return validator(toNumber(userValue, defaultValue));
          }
          // Use default and validate
          return validator(defaultValue);
        };
        
        const volatilityLow = validateRiskEngineValue('volatility_low', userRiskEngine.volatility_low, defaultRiskEngine.volatility_low, (v) => Math.max(0, v));
        const volatilityHigh = validateRiskEngineValue('volatility_high', userRiskEngine.volatility_high, defaultRiskEngine.volatility_high, (v) => Math.max(volatilityLow + 0.1, v));
        const drawdownModerate = validateRiskEngineValue('drawdown_moderate', userRiskEngine.drawdown_moderate, defaultRiskEngine.drawdown_moderate, (v) => Math.max(0, v));
        const drawdownSevere = validateRiskEngineValue('drawdown_severe', userRiskEngine.drawdown_severe, defaultRiskEngine.drawdown_severe, (v) => Math.max(drawdownModerate + 1, v));
        const minSizeMultiplier = validateRiskEngineValue('min_size_multiplier', userRiskEngine.min_size_multiplier, defaultRiskEngine.min_size_multiplier, (v) => clampValue(v, 0.1, 3));
        const maxSizeMultiplier = validateRiskEngineValue('max_size_multiplier', userRiskEngine.max_size_multiplier, defaultRiskEngine.max_size_multiplier, (v) => clampValue(v, minSizeMultiplier, 3));
        const minSignalWeight = validateRiskEngineValue('min_signal_weight', userRiskEngine.min_signal_weight, defaultRiskEngine.min_signal_weight, (v) => clampValue(v, 0.1, 2));
        const maxSignalWeight = validateRiskEngineValue('max_signal_weight', userRiskEngine.max_signal_weight, defaultRiskEngine.max_signal_weight, (v) => clampValue(v, minSignalWeight, 2));

        // Build risk_engine: preserve all user values, only validate/clamp for safety
        finalStrategyConfig = {
          ...finalStrategyConfig,
          risk_engine: {
            // Start with merged values (user values override defaults)
            ...mergedRiskEngine,
            // Validate critical interdependent values
            volatility_low: volatilityLow,
            volatility_high: volatilityHigh,
            high_volatility_multiplier: validateRiskEngineValue('high_volatility_multiplier', userRiskEngine.high_volatility_multiplier, defaultRiskEngine.high_volatility_multiplier, (v) => clampValue(v, 0.1, 3)),
            low_volatility_multiplier: validateRiskEngineValue('low_volatility_multiplier', userRiskEngine.low_volatility_multiplier, defaultRiskEngine.low_volatility_multiplier, (v) => clampValue(v, 0.1, 3)),
            max_spread_bps: validateRiskEngineValue('max_spread_bps', userRiskEngine.max_spread_bps, defaultRiskEngine.max_spread_bps, (v) => Math.max(1, v)),
            spread_penalty_multiplier: validateRiskEngineValue('spread_penalty_multiplier', userRiskEngine.spread_penalty_multiplier, defaultRiskEngine.spread_penalty_multiplier, (v) => clampValue(v, 0.1, 3)),
            low_liquidity_multiplier: validateRiskEngineValue('low_liquidity_multiplier', userRiskEngine.low_liquidity_multiplier, defaultRiskEngine.low_liquidity_multiplier, (v) => clampValue(v, 0.1, 3)),
            medium_liquidity_multiplier: validateRiskEngineValue('medium_liquidity_multiplier', userRiskEngine.medium_liquidity_multiplier, defaultRiskEngine.medium_liquidity_multiplier, (v) => clampValue(v, 0.1, 3)),
            drawdown_moderate: drawdownModerate,
            drawdown_severe: drawdownSevere,
            moderate_drawdown_multiplier: validateRiskEngineValue('moderate_drawdown_multiplier', userRiskEngine.moderate_drawdown_multiplier, defaultRiskEngine.moderate_drawdown_multiplier, (v) => clampValue(v, 0.1, 3)),
            severe_drawdown_multiplier: validateRiskEngineValue('severe_drawdown_multiplier', userRiskEngine.severe_drawdown_multiplier, defaultRiskEngine.severe_drawdown_multiplier, (v) => clampValue(v, 0.1, 3)),
            loss_streak_threshold: validateRiskEngineValue('loss_streak_threshold', userRiskEngine.loss_streak_threshold, defaultRiskEngine.loss_streak_threshold, (v) => Math.max(1, Math.round(v))),
            loss_streak_step: validateRiskEngineValue('loss_streak_step', userRiskEngine.loss_streak_step, defaultRiskEngine.loss_streak_step, (v) => clampValue(v, 0.01, 1)),
            min_size_multiplier: minSizeMultiplier,
            max_size_multiplier: maxSizeMultiplier,
            max_slippage_bps: validateRiskEngineValue('max_slippage_bps', userRiskEngine.max_slippage_bps, defaultRiskEngine.max_slippage_bps, (v) => Math.max(1, v)),
            min_execution_size_multiplier: validateRiskEngineValue('min_execution_size_multiplier', userRiskEngine.min_execution_size_multiplier, defaultRiskEngine.min_execution_size_multiplier, (v) => clampValue(v, 0.1, 1)),
            limit_spread_bps: validateRiskEngineValue('limit_spread_bps', userRiskEngine.limit_spread_bps, defaultRiskEngine.limit_spread_bps, (v) => Math.max(1, v)),
            signal_learning_rate: validateRiskEngineValue('signal_learning_rate', userRiskEngine.signal_learning_rate, defaultRiskEngine.signal_learning_rate, (v) => clampValue(v, 0.01, 1)),
            min_signal_weight: minSignalWeight,
            max_signal_weight: maxSignalWeight
          }
        };

        // Log final strategy config before saving
        console.log('💾 [bot-management] Final strategyConfig to save:', JSON.stringify(finalStrategyConfig, null, 2));
        
        // Prepare insert data
        const insertData: any = {
          user_id: user.id,
          name,
          exchange,
          trading_type: tradingType || 'spot',
          symbol,
          timeframe: timeframe || '1h',
          leverage,
          risk_level: riskLevel,
          trade_amount: tradeAmount || 100,
          stop_loss: stopLoss || 2.0,
          take_profit: takeProfit || 4.0,
          strategy: JSON.stringify(strategy),
          strategy_config: JSON.stringify(finalStrategyConfig),
          paper_trading: paperTrading || false,
          sound_notifications_enabled: soundNotificationsEnabled || false,
          status: status || 'running', // Auto-start bots instead of 'stopped'
          pnl: pnl || 0,
          pnl_percentage: pnlPercentage || 0,
          total_trades: totalTrades || 0,
          win_rate: winRate || 0,
          last_trade_at: lastTradeAt,
          created_at: new Date().toISOString()
        }

        // Add symbols array if multiple pairs provided
        if (symbols && Array.isArray(symbols) && symbols.length > 0) {
          insertData.symbols = JSON.stringify(symbols)
          console.log('Adding multiple symbols:', symbols)
        } else {
          // Default to single symbol array
          insertData.symbols = JSON.stringify([symbol])
        }

        // Add custom pairs if provided
        if (customPairs) {
          insertData.custom_pairs = customPairs
          console.log('Adding custom pairs:', customPairs)
        }

        const { data: bot, error } = await supabaseClient
          .from('trading_bots')
          .insert(insertData)
          .select()
          .single()

        if (error) {
          console.error('Database insert error:', error)
          throw error
        }

        // Transform bot to match frontend expectations (same as list endpoint)
        let symbolsArray: string[] | undefined = undefined;
        if (bot.symbols) {
          if (typeof bot.symbols === 'string') {
            try {
              symbolsArray = JSON.parse(bot.symbols);
            } catch (e) {
              console.warn('Failed to parse symbols JSON:', e);
            }
          } else if (Array.isArray(bot.symbols)) {
            symbolsArray = bot.symbols;
          }
        }

        const transformedBot = {
          id: bot.id,
          name: bot.name,
          exchange: bot.exchange,
          tradingType: bot.trading_type || 'spot',
          symbol: bot.symbol,
          timeframe: bot.timeframe || '1h',
          status: bot.status,
          leverage: bot.leverage ?? 1,
          tradeAmount: bot.trade_amount || 100,
          stopLoss: bot.stop_loss || 2.0,
          takeProfit: bot.take_profit || 4.0,
          pnl: bot.pnl ?? 0,
          pnlPercentage: bot.pnl_percentage ?? 0,
          totalTrades: bot.total_trades ?? 0,
          winRate: bot.win_rate ?? 0,
          createdAt: bot.created_at,
          lastTradeAt: bot.last_trade_at,
          riskLevel: bot.risk_level || 'medium',
          strategy: typeof bot.strategy === 'string' ? JSON.parse(bot.strategy) : bot.strategy,
          strategyConfig: bot.strategy_config
            ? (typeof bot.strategy_config === 'string' ? JSON.parse(bot.strategy_config) : bot.strategy_config)
            : undefined,
          strategy_config: bot.strategy_config ?? null,
          aiMlEnabled: bot.ai_ml_enabled || false,
          paperTrading: bot.paper_trading || false,
          soundNotificationsEnabled: bot.sound_notifications_enabled || false,
          webhookSecret: bot.webhook_secret || null,
          webhookTriggerImmediate: bot.webhook_trigger_immediate ?? true,
          symbols: symbolsArray,
          customPairs: bot.custom_pairs || null
        };

        return new Response(
          JSON.stringify({ bot: transformedBot }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'update') {
        const { id, ...updates } = body

        // Validate bot ID
        if (!id) {
          throw new Error('Bot ID is required for update')
        }

        // Transform frontend field names to database field names
        const dbUpdates: any = {}
        if (updates.name) dbUpdates.name = updates.name
        if (updates.exchange) dbUpdates.exchange = updates.exchange
        if (updates.tradingType) dbUpdates.trading_type = updates.tradingType
        if (updates.symbol) dbUpdates.symbol = updates.symbol
        if (updates.timeframe) dbUpdates.timeframe = updates.timeframe
        if (updates.leverage !== undefined) dbUpdates.leverage = updates.leverage
        if (updates.tradeAmount !== undefined) dbUpdates.trade_amount = updates.tradeAmount
        if (updates.stopLoss !== undefined) dbUpdates.stop_loss = updates.stopLoss
        if (updates.takeProfit !== undefined) dbUpdates.take_profit = updates.takeProfit
        if (updates.status) dbUpdates.status = updates.status
        if (updates.pnl !== undefined) dbUpdates.pnl = updates.pnl
        if (updates.pnlPercentage !== undefined) dbUpdates.pnl_percentage = updates.pnlPercentage
        if (updates.totalTrades !== undefined) dbUpdates.total_trades = updates.totalTrades
        if (updates.winRate !== undefined) dbUpdates.win_rate = updates.winRate
        if (updates.lastTradeAt !== undefined) dbUpdates.last_trade_at = updates.lastTradeAt
        if (updates.riskLevel) dbUpdates.risk_level = updates.riskLevel
        if (updates.strategy) dbUpdates.strategy = JSON.stringify(updates.strategy)
        
        // Always update the updated_at timestamp when any field changes
        // This ensures bot-executor always gets the latest data
        dbUpdates.updated_at = new Date().toISOString()
        
        // Handle strategyConfig (Advanced Strategy Configuration)
        if (updates.strategyConfig !== undefined) {
          // Get existing strategy_config to merge with new values
          const { data: botData } = await supabaseClient
            .from('trading_bots')
            .select('strategy_config')
            .eq('id', id)
            .single()
          
          let existingConfig = {}
          if (botData?.strategy_config) {
            // Parse if it's a string, otherwise use as-is
            existingConfig = typeof botData.strategy_config === 'string'
              ? JSON.parse(botData.strategy_config)
              : botData.strategy_config
          }
          
          // Parse new config
          const newConfig = typeof updates.strategyConfig === 'string' 
            ? JSON.parse(updates.strategyConfig)
            : updates.strategyConfig;
          
          // Fetch user's risk management settings
          let userRiskSettings: any = null;
          try {
            const { data: userSettings } = await supabaseClient
              .from('user_settings')
              .select('risk_settings')
              .eq('user_id', user.id)
              .single();
            
            if (userSettings?.risk_settings) {
              userRiskSettings = userSettings.risk_settings as any;
              console.log('✅ Loaded user risk management settings for update:', userRiskSettings);
            }
          } catch (error) {
            console.warn('⚠️ Could not load user risk settings, using existing values:', error);
          }

          // Merge existing config with new updates
          let mergedConfig: any = {
            ...existingConfig,
            ...newConfig
          };

          // Apply user's risk management settings (overrides any existing values if not explicitly set in newConfig)
          if (userRiskSettings) {
            // Only apply risk management if not explicitly provided in newConfig
            if (!newConfig.hasOwnProperty('daily_loss_limit_pct')) {
              mergedConfig.daily_loss_limit_pct = mergedConfig.daily_loss_limit_pct ?? (userRiskSettings.maxDailyLoss ? userRiskSettings.maxDailyLoss / 100 : 3.0);
            }
            if (!newConfig.hasOwnProperty('max_position_size')) {
              mergedConfig.max_position_size = mergedConfig.max_position_size ?? userRiskSettings.maxPositionSize ?? 1000;
            }
            if (!newConfig.hasOwnProperty('stop_loss_percentage')) {
              mergedConfig.stop_loss_percentage = mergedConfig.stop_loss_percentage ?? userRiskSettings.stopLossPercentage ?? 5.0;
            }
            if (!newConfig.hasOwnProperty('take_profit_percentage')) {
              mergedConfig.take_profit_percentage = mergedConfig.take_profit_percentage ?? userRiskSettings.takeProfitPercentage ?? 10.0;
            }
            if (!newConfig.hasOwnProperty('max_concurrent')) {
              mergedConfig.max_concurrent = mergedConfig.max_concurrent ?? userRiskSettings.maxOpenPositions ?? 5;
            }
            if (!newConfig.hasOwnProperty('risk_per_trade_pct')) {
              mergedConfig.risk_per_trade_pct = mergedConfig.risk_per_trade_pct ?? (userRiskSettings.riskPerTrade ? userRiskSettings.riskPerTrade / 100 : 0.02);
            }
            if (!newConfig.hasOwnProperty('emergency_stop_loss')) {
              mergedConfig.emergency_stop_loss = mergedConfig.emergency_stop_loss ?? userRiskSettings.emergencyStopLoss ?? 20.0;
            }
            console.log('✅ Applied risk management settings to updated bot');
          }
          
          // Ensure required fields have defaults if missing (for validation)
          // This prevents validation errors when updating partial configs
          // Validate and fix bias_mode - must be one of the valid values
          if (!mergedConfig.bias_mode || !['long-only', 'short-only', 'both', 'auto'].includes(mergedConfig.bias_mode)) {
            mergedConfig.bias_mode = 'auto';
          }
          if (!mergedConfig.regime_mode || !['trend', 'mean-reversion', 'auto'].includes(mergedConfig.regime_mode)) {
            mergedConfig.regime_mode = 'auto';
          }
          if (!mergedConfig.htf_timeframe || !['15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '1w'].includes(mergedConfig.htf_timeframe)) {
            mergedConfig.htf_timeframe = '4h';
          }
          
          // Store as JSONB (Supabase will handle it automatically)
          dbUpdates.strategy_config = mergedConfig
        } else {
          // Even if strategyConfig is not being updated, ensure risk management is applied
          // Fetch user's risk management settings
          let userRiskSettings: any = null;
          try {
            const { data: userSettings } = await supabaseClient
              .from('user_settings')
              .select('risk_settings')
              .eq('user_id', user.id)
              .single();
            
            if (userSettings?.risk_settings) {
              userRiskSettings = userSettings.risk_settings as any;
            }
          } catch (error) {
            console.warn('⚠️ Could not load user risk settings:', error);
          }

          // Get existing strategy_config to merge risk management
          if (userRiskSettings) {
            const { data: botData } = await supabaseClient
              .from('trading_bots')
              .select('strategy_config')
              .eq('id', id)
              .single()
            
            let existingConfig: any = {}
            if (botData?.strategy_config) {
              existingConfig = typeof botData.strategy_config === 'string'
                ? JSON.parse(botData.strategy_config)
                : botData.strategy_config
            }

            // Apply risk management settings to existing config
            const updatedConfig: any = {
              ...existingConfig,
              daily_loss_limit_pct: existingConfig.daily_loss_limit_pct ?? (userRiskSettings.maxDailyLoss ? userRiskSettings.maxDailyLoss / 100 : 3.0),
              max_position_size: existingConfig.max_position_size ?? userRiskSettings.maxPositionSize ?? 1000,
              stop_loss_percentage: existingConfig.stop_loss_percentage ?? userRiskSettings.stopLossPercentage ?? 5.0,
              take_profit_percentage: existingConfig.take_profit_percentage ?? userRiskSettings.takeProfitPercentage ?? 10.0,
              max_concurrent: existingConfig.max_concurrent ?? userRiskSettings.maxOpenPositions ?? 5,
              risk_per_trade_pct: existingConfig.risk_per_trade_pct ?? (userRiskSettings.riskPerTrade ? userRiskSettings.riskPerTrade / 100 : 0.02),
              emergency_stop_loss: existingConfig.emergency_stop_loss ?? userRiskSettings.emergencyStopLoss ?? 20.0
            };

            // Validate and fix enum fields to prevent database constraint errors
            if (!updatedConfig.bias_mode || !['long-only', 'short-only', 'both', 'auto'].includes(updatedConfig.bias_mode)) {
              updatedConfig.bias_mode = 'auto';
            }
            if (!updatedConfig.regime_mode || !['trend', 'mean-reversion', 'auto'].includes(updatedConfig.regime_mode)) {
              updatedConfig.regime_mode = 'auto';
            }
            if (!updatedConfig.htf_timeframe || !['15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '1w'].includes(updatedConfig.htf_timeframe)) {
              updatedConfig.htf_timeframe = '4h';
            }

            dbUpdates.strategy_config = updatedConfig;
            console.log('✅ Applied risk management settings to bot (no strategyConfig update)');
          }
        }
        
        // Handle AI/ML field
        if (updates.aiMlEnabled !== undefined) {
          dbUpdates.ai_ml_enabled = updates.aiMlEnabled
        }
        
        // Handle paper trading toggle
        if (updates.paperTrading !== undefined) {
          dbUpdates.paper_trading = updates.paperTrading
          
          // When toggling paper trading, ensure strategy_config is valid
          // This prevents database constraint errors if existing config has invalid values
          if (!dbUpdates.strategy_config) {
            const { data: botData } = await supabaseClient
              .from('trading_bots')
              .select('strategy_config')
              .eq('id', id)
              .single()
            
            if (botData?.strategy_config) {
              let existingConfig: any = typeof botData.strategy_config === 'string'
                ? JSON.parse(botData.strategy_config)
                : botData.strategy_config
              
              // Validate and fix enum fields
              if (!existingConfig.bias_mode || !['long-only', 'short-only', 'both', 'auto'].includes(existingConfig.bias_mode)) {
                existingConfig.bias_mode = 'auto';
              }
              if (!existingConfig.regime_mode || !['trend', 'mean-reversion', 'auto'].includes(existingConfig.regime_mode)) {
                existingConfig.regime_mode = 'auto';
              }
              if (!existingConfig.htf_timeframe || !['15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '1w'].includes(existingConfig.htf_timeframe)) {
                existingConfig.htf_timeframe = '4h';
              }
              
              dbUpdates.strategy_config = existingConfig;
            }
          }
        }

        // Handle sound notifications toggle
        if (updates.soundNotificationsEnabled !== undefined) {
          dbUpdates.sound_notifications_enabled = updates.soundNotificationsEnabled
        }

        if (updates.webhookSecret !== undefined) {
          dbUpdates.webhook_secret = updates.webhookSecret
        }

        if (updates.webhookTriggerImmediate !== undefined) {
          dbUpdates.webhook_trigger_immediate = updates.webhookTriggerImmediate
        }

        // First check if bot exists and belongs to user
        const { data: existingBot, error: checkError } = await supabaseClient
          .from('trading_bots')
          .select('id')
          .eq('id', id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (checkError) {
          console.error('Bot existence check error:', checkError)
          throw new Error(`Failed to verify bot: ${checkError.message}`)
        }

        if (!existingBot) {
          throw new Error('Bot not found or access denied')
        }

        // Before updating, ensure strategy_config is valid if it exists
        // This prevents database constraint errors
        if (dbUpdates.strategy_config) {
          const config = dbUpdates.strategy_config;
          // Validate and fix enum fields
          if (config.bias_mode && !['long-only', 'short-only', 'both', 'auto'].includes(config.bias_mode)) {
            config.bias_mode = 'auto';
            console.warn(`⚠️ Fixed invalid bias_mode, set to 'auto'`);
          }
          if (config.regime_mode && !['trend', 'mean-reversion', 'auto'].includes(config.regime_mode)) {
            config.regime_mode = 'auto';
            console.warn(`⚠️ Fixed invalid regime_mode, set to 'auto'`);
          }
          if (config.htf_timeframe && !['15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '1w'].includes(config.htf_timeframe)) {
            config.htf_timeframe = '4h';
            console.warn(`⚠️ Fixed invalid htf_timeframe, set to '4h'`);
          }
        }
        
        // Now update the bot
        const { data: bots, error } = await supabaseClient
          .from('trading_bots')
          .update(dbUpdates)
          .eq('id', id)
          .eq('user_id', user.id)
          .select()

        if (error) {
          console.error('Bot update error:', error)
          throw error
        }

        // Check if update succeeded
        if (!bots || bots.length === 0) {
          throw new Error('Bot update failed - no rows affected')
        }

        const bot = bots[0]

        // Transform response to match frontend expectations
        const transformedBot = {
          id: bot.id,
          name: bot.name,
          exchange: bot.exchange,
          tradingType: bot.trading_type || 'spot',
          symbol: bot.symbol,
          timeframe: bot.timeframe || '1h',
          status: bot.status,
          pauseReason: bot.pause_reason || null,
          leverage: bot.leverage,
          tradeAmount: bot.trade_amount || 100,
          stopLoss: bot.stop_loss || 2.0,
          takeProfit: bot.take_profit || 4.0,
          pnl: bot.pnl,
          pnlPercentage: bot.pnl_percentage,
          totalTrades: bot.total_trades,
          winRate: bot.win_rate,
          createdAt: bot.created_at,
          lastTradeAt: bot.last_trade_at,
          riskLevel: bot.risk_level,
          strategy: typeof bot.strategy === 'string' ? JSON.parse(bot.strategy) : bot.strategy,
          aiMlEnabled: bot.ai_ml_enabled || false,
          paperTrading: bot.paper_trading || false,
          soundNotificationsEnabled: bot.sound_notifications_enabled || false,
          webhookSecret: bot.webhook_secret || null,
          webhookTriggerImmediate: bot.webhook_trigger_immediate ?? true
        }

        return new Response(
          JSON.stringify({ bot: transformedBot }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'start') {
        const { id } = body

        const { data: bot, error } = await supabaseClient
          .from('trading_bots')
          .update({ status: 'running' })
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error) throw error

        // Log bot start activity
        console.log(`Bot ${id} started by user ${user.id}`)
        
        // Also log the bot status for debugging
        console.log(`Bot ${id} status updated to: ${bot.status}`)

        const transformedBot = {
          id: bot.id,
          name: bot.name,
          exchange: bot.exchange,
          symbol: bot.symbol,
          status: bot.status,
          pauseReason: bot.pause_reason || null,
          leverage: bot.leverage,
          pnl: bot.pnl,
          pnlPercentage: bot.pnl_percentage,
          totalTrades: bot.total_trades,
          winRate: bot.win_rate,
          createdAt: bot.created_at,
          lastTradeAt: bot.last_trade_at,
          riskLevel: bot.risk_level,
          strategy: typeof bot.strategy === 'string' ? JSON.parse(bot.strategy) : bot.strategy,
          aiMlEnabled: bot.ai_ml_enabled || false,
          paperTrading: bot.paper_trading || false,
          soundNotificationsEnabled: bot.sound_notifications_enabled || false,
          webhookSecret: bot.webhook_secret || null,
          webhookTriggerImmediate: bot.webhook_trigger_immediate ?? true
        }

        return new Response(
          JSON.stringify({ bot: transformedBot }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'pause') {
        const { id, reason: rawReason } = body
        const pauseReason = typeof rawReason === 'string' && rawReason.trim().length > 0
          ? rawReason.trim()
          : 'Paused by user'

        const { data: bot, error } = await supabaseClient
          .from('trading_bots')
          .update({ status: 'paused', updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error) throw error

        const transformedBot = {
          id: bot.id,
          name: bot.name,
          exchange: bot.exchange,
          symbol: bot.symbol,
          status: bot.status,
          pauseReason: null, // pause_reason column not available in database
          leverage: bot.leverage,
          pnl: bot.pnl,
          pnlPercentage: bot.pnl_percentage,
          totalTrades: bot.total_trades,
          winRate: bot.win_rate,
          createdAt: bot.created_at,
          lastTradeAt: bot.last_trade_at,
          riskLevel: bot.risk_level,
          strategy: typeof bot.strategy === 'string' ? JSON.parse(bot.strategy) : bot.strategy,
          aiMlEnabled: bot.ai_ml_enabled || false,
          paperTrading: bot.paper_trading || false,
          soundNotificationsEnabled: bot.sound_notifications_enabled || false,
          webhookSecret: bot.webhook_secret || null,
          webhookTriggerImmediate: bot.webhook_trigger_immediate ?? true
        }

        return new Response(
          JSON.stringify({ bot: transformedBot }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'stop') {
        const { id, reason: rawReason } = body
        const stopReason = typeof rawReason === 'string' && rawReason.trim().length > 0
          ? rawReason.trim()
          : 'Stopped by user'

        const { data: bot, error } = await supabaseClient
          .from('trading_bots')
          .update({ status: 'stopped', updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error) throw error

        const transformedBot = {
          id: bot.id,
          name: bot.name,
          exchange: bot.exchange,
          symbol: bot.symbol,
          status: bot.status,
          pauseReason: bot.pause_reason || stopReason || null,
          leverage: bot.leverage,
          pnl: bot.pnl,
          pnlPercentage: bot.pnl_percentage,
          totalTrades: bot.total_trades,
          winRate: bot.win_rate,
          createdAt: bot.created_at,
          lastTradeAt: bot.last_trade_at,
          riskLevel: bot.risk_level,
          strategy: typeof bot.strategy === 'string' ? JSON.parse(bot.strategy) : bot.strategy,
          aiMlEnabled: bot.ai_ml_enabled || false,
          paperTrading: bot.paper_trading || false,
          soundNotificationsEnabled: bot.sound_notifications_enabled || false,
          webhookSecret: bot.webhook_secret || null,
          webhookTriggerImmediate: bot.webhook_trigger_immediate ?? true
        }

        return new Response(
          JSON.stringify({ bot: transformedBot }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'refresh-stats') {
        // Get all existing bots for the user (any status)
        const { data: bots, error: botsError } = await supabaseClient
          .from('trading_bots')
          .select('*')
          .eq('user_id', user.id)
          // No status filter - update all existing bots

        if (botsError) throw botsError
        if (!bots || bots.length === 0) {
          return new Response(
            JSON.stringify({ success: true, message: 'No bots to refresh', updated: 0 }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

      const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
      const POSITION_SYNC_SECRET = Deno.env.get('POSITION_SYNC_SECRET') ?? Deno.env.get('CRON_SECRET') ?? ''

      if (SUPABASE_URL && POSITION_SYNC_SECRET) {
        try {
          console.log('🔄 Triggering position-sync before stats refresh...');
          const syncResponse = await fetch(`${SUPABASE_URL}/functions/v1/position-sync`, {
            method: 'POST',
            headers: {
              'x-cron-secret': POSITION_SYNC_SECRET,
              'Content-Type': 'application/json'
            }
          });
          const syncText = await syncResponse.text();
          if (!syncResponse.ok) {
            console.warn(`⚠️ position-sync failed: ${syncResponse.status} ${syncText}`);
          } else {
            console.log(`✅ position-sync triggered: ${syncText.substring(0, 200)}`);
          }
        } catch (syncError: any) {
          console.warn('⚠️ Failed to call position-sync:', syncError?.message || syncError);
        }
      } else {
        console.warn('⚠️ position-sync not triggered (missing SUPABASE_URL or POSITION_SYNC_SECRET)');
      }

        console.log(`🔄 Refreshing stats for ${bots.length} bot(s)`);
        const botIds = bots.map((bot: any) => bot.id);
        const statsMap = new Map<string, {
          totalTrades: number;
          closedTrades: number;
          winTrades: number;
          lossTrades: number;
          pnl: number;
          totalFees: number;
          maxDrawdown: number;
          peakEquity: number;
          hasClosed: boolean;
        }>();
        const seenTradeIds = new Set<string>();
        const countedTradeIds = new Set<string>();
        const tradeFeesById = new Map<string, number>();

        const ensureStats = (botId: string) => {
          if (!statsMap.has(botId)) {
            statsMap.set(botId, {
              totalTrades: 0,
              closedTrades: 0,
              winTrades: 0,
              lossTrades: 0,
              pnl: 0,
              totalFees: 0,
              maxDrawdown: 0,
              peakEquity: 0,
              hasClosed: false
            });
          }
          return statsMap.get(botId)!;
        };

        if (botIds.length > 0) {
          const executedStatuses = new Set(['filled', 'completed', 'closed', 'stopped', 'taken_profit']);
          const closedStatuses = new Set(['completed', 'closed', 'stopped', 'taken_profit']);

          // STEP 1: Fetch closed positions from trading_positions and update trades with missing PnL
          console.log('📊 Step 1: Fetching closed positions to update trades with missing PnL...');
          const { data: closedPositions, error: positionsError } = await supabaseClient
            .from('trading_positions')
            .select('id, bot_id, trade_id, realized_pnl, exit_price, entry_price, quantity, side, fees, status, closed_at')
            .eq('user_id', user.id)
            .in('bot_id', botIds)
            .in('status', ['closed', 'stopped', 'taken_profit', 'manual_close', 'liquidated']);

          if (positionsError) {
            console.warn('⚠️ Error fetching closed positions:', positionsError);
          } else if (closedPositions && closedPositions.length > 0) {
            const positionsWithPnL = closedPositions.filter(p => p.realized_pnl !== null && p.realized_pnl !== undefined);
            const positionsWithExit = closedPositions.filter(p => p.exit_price !== null && p.exit_price !== undefined);
            console.log(`📊 Closed positions: total=${closedPositions.length}, withPnL=${positionsWithPnL.length}, withExitPrice=${positionsWithExit.length}`);
            
            // Update trades with PnL from positions
            const tradesToUpdateFromPositions: Array<{ id: string; pnl: number; fee: number; status: string }> = [];
            const positionsToUpdate: Array<{ id: string; realized_pnl: number; fees: number }> = [];
            
            for (const position of closedPositions) {
              if (position.trade_id) {
                let realizedPnL = position.realized_pnl !== null && position.realized_pnl !== undefined
                  ? parseFloat(position.realized_pnl)
                  : NaN;
                const fees = parseFloat(position.fees || 0);
                if (Number.isNaN(realizedPnL)) {
                  const entryPrice = parseFloat(position.entry_price || 0);
                  const exitPrice = parseFloat(position.exit_price || 0);
                  const quantity = parseFloat(position.quantity || 0);
                  const side = (position.side || 'long').toLowerCase();
                  if (entryPrice > 0 && exitPrice > 0 && quantity > 0) {
                    if (side === 'short' || side === 'sell') {
                      realizedPnL = (entryPrice - exitPrice) * quantity;
                    } else {
                      realizedPnL = (exitPrice - entryPrice) * quantity;
                    }
                    if (!Number.isNaN(fees)) {
                      realizedPnL -= fees;
                    }
                  }
                }
                
                if ((position.realized_pnl === null || position.realized_pnl === undefined) && !Number.isNaN(realizedPnL)) {
                  positionsToUpdate.push({
                    id: position.id,
                    realized_pnl: realizedPnL,
                    fees: Number.isNaN(fees) ? 0 : fees
                  });
                }

                // Only update if PnL is not zero (zero might mean it's already set or position had no PnL)
                if (!Number.isNaN(realizedPnL)) {
                  tradesToUpdateFromPositions.push({
                    id: position.trade_id,
                    pnl: realizedPnL,
                    fee: fees,
                    status: 'closed'
                  });
                }
              }
            }
            
            // Batch update trades with PnL from positions
            if (tradesToUpdateFromPositions.length > 0) {
              console.log(`📊 Updating ${tradesToUpdateFromPositions.length} trades with PnL from closed positions`);
              for (const tradeUpdate of tradesToUpdateFromPositions) {
                try {
                  // Check if trade already has PnL
                  const { data: existingTrade } = await supabaseClient
                    .from('trades')
                    .select('pnl')
                    .eq('id', tradeUpdate.id)
                    .eq('user_id', user.id)
                    .single();
                  
                  // Only update if trade doesn't have PnL or PnL is zero/null
                  if (!existingTrade || existingTrade.pnl === null || existingTrade.pnl === undefined || parseFloat(existingTrade.pnl || 0) === 0) {
                    await supabaseClient
                      .from('trades')
                      .update({
                        pnl: tradeUpdate.pnl,
                        fee: tradeUpdate.fee,
                        status: tradeUpdate.status,
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', tradeUpdate.id)
                      .eq('user_id', user.id);
                  }
                } catch (updateError) {
                  console.warn(`⚠️ Failed to update trade ${tradeUpdate.id} from position:`, updateError);
                }
              }
            }

            if (positionsToUpdate.length > 0) {
              console.log(`📊 Updating ${positionsToUpdate.length} closed positions with computed PnL`);
              for (const positionUpdate of positionsToUpdate) {
                try {
                  await supabaseClient
                    .from('trading_positions')
                    .update({
                      realized_pnl: positionUpdate.realized_pnl,
                      fees: positionUpdate.fees,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', positionUpdate.id)
                    .eq('user_id', user.id);
                } catch (updateError) {
                  console.warn(`⚠️ Failed to update position ${positionUpdate.id} with PnL:`, updateError);
                }
              }
            }
          }

          // STEP 2: Fetch real trades with all necessary fields
          // Note: trades table uses 'price' (not entry_price) and 'amount' (not size)
          // Also, trades table does NOT have exit_price column - only trading_positions has it
          console.log('📊 Step 2: Fetching trades for stats calculation...');
          const { data: realTrades, error: realTradesError } = await supabaseClient
            .from('trades')
            .select('id, bot_id, status, pnl, fee, executed_at, price, amount, side')
            .eq('user_id', user.id)
            .in('bot_id', botIds)
            .order('executed_at', { ascending: true });

          if (realTradesError) {
            console.warn('Error fetching trades for stats:', realTradesError);
          } else if (realTrades) {
            for (const trade of realTrades) {
              if (!trade || !trade.bot_id) continue;
              const stats = ensureStats(trade.bot_id);
              if (trade.id) {
                seenTradeIds.add(trade.id);
              }
              const status = (trade.status || '').toString().toLowerCase();
              let pnlValue = trade.pnl !== null && trade.pnl !== undefined ? parseFloat(trade.pnl) : NaN;
              const feeValue = trade.fee !== null && trade.fee !== undefined ? parseFloat(trade.fee) : 0;
              if (trade.id && !Number.isNaN(feeValue)) {
                tradeFeesById.set(trade.id, feeValue);
              }
              const hasExitPrice = trade.exit_price !== null && trade.exit_price !== undefined;
              if (Number.isNaN(pnlValue) && hasExitPrice) {
                const entryPrice = parseFloat(trade.entry_price || trade.price || 0);
                const exitPrice = parseFloat(trade.exit_price || 0);
                const size = parseFloat(trade.amount || trade.size || 0);
                const side = (trade.side || 'long').toLowerCase();
                if (entryPrice > 0 && exitPrice > 0 && size > 0) {
                  if (side === 'short' || side === 'sell') {
                    pnlValue = (entryPrice - exitPrice) * size;
                  } else {
                    pnlValue = (exitPrice - entryPrice) * size;
                  }
                  if (!Number.isNaN(feeValue)) {
                    pnlValue -= feeValue;
                  }
                }
              }

              // Count as executed if status is in executedStatuses
              if (executedStatuses.has(status)) {
                stats.totalTrades += 1;
                stats.totalFees += feeValue;
              }

              // Count as closed if:
              // 1. Status is in closedStatuses, OR
              // 2. Trade has a PnL value (meaning it's been closed)
              const isClosed = closedStatuses.has(status)
                || (!Number.isNaN(pnlValue) && pnlValue !== 0)
                || hasExitPrice;
              
              if (isClosed && !Number.isNaN(pnlValue)) {
                stats.closedTrades += 1;
                stats.pnl += pnlValue;
                stats.hasClosed = true;
                if (pnlValue > 0) {
                  stats.winTrades += 1;
                } else if (pnlValue < 0) {
                  stats.lossTrades += 1;
                }
                if (trade.id) {
                  countedTradeIds.add(trade.id);
                }
              }

              // Calculate drawdown: track peak equity and current drawdown
              if (stats.hasClosed) {
                stats.peakEquity = Math.max(stats.peakEquity, stats.pnl);
                const currentDrawdown = stats.peakEquity - stats.pnl;
                stats.maxDrawdown = Math.max(stats.maxDrawdown, currentDrawdown);
              }
            }
          }

          // STEP 3: Fetch paper trades with exit_price and calculate missing PnL
          console.log('📊 Step 3: Fetching paper trades with exit_price to calculate missing PnL...');
          const { data: paperTradesWithExit, error: paperTradesError } = await supabaseClient
            .from('paper_trading_trades')
            .select('id, bot_id, entry_price, exit_price, quantity, side, pnl, fees, status')
            .eq('user_id', user.id)
            .in('bot_id', botIds)
            .not('exit_price', 'is', null);

          if (paperTradesError) {
            console.warn('⚠️ Error fetching paper trades with exit_price:', paperTradesError);
          } else if (paperTradesWithExit && paperTradesWithExit.length > 0) {
            console.log(`📊 Found ${paperTradesWithExit.length} paper trades with exit_price`);
            
            // Calculate PnL for paper trades that don't have it
            const paperTradesToUpdate: Array<{ id: string; pnl: number; status: string }> = [];
            
            for (const trade of paperTradesWithExit) {
              // Skip if trade already has PnL
              if (trade.pnl && parseFloat(trade.pnl || 0) !== 0) {
                continue;
              }
              
              if (trade.entry_price && trade.exit_price && trade.quantity) {
                const entryPrice = parseFloat(trade.entry_price);
                const exitPrice = parseFloat(trade.exit_price);
                const quantity = parseFloat(trade.quantity);
                const side = (trade.side || '').toLowerCase();
                
                if (!Number.isNaN(entryPrice) && !Number.isNaN(exitPrice) && !Number.isNaN(quantity) && quantity > 0) {
                  let calculatedPnL = 0;
                  if (side === 'long' || side === 'buy') {
                    calculatedPnL = (exitPrice - entryPrice) * quantity;
                  } else if (side === 'short' || side === 'sell') {
                    calculatedPnL = (entryPrice - exitPrice) * quantity;
                  }
                  
                  // Subtract fees if available
                  const fees = parseFloat(trade.fees || 0);
                  const finalPnL = calculatedPnL - fees;
                  
                  paperTradesToUpdate.push({
                    id: trade.id,
                    pnl: finalPnL,
                    status: trade.status || 'closed'
                  });
                }
              }
            }
            
            // Batch update paper trades with calculated PnL
            if (paperTradesToUpdate.length > 0) {
              console.log(`📊 Updating ${paperTradesToUpdate.length} paper trades with calculated PnL`);
              for (const tradeUpdate of paperTradesToUpdate) {
                try {
                  await supabaseClient
                    .from('paper_trading_trades')
                    .update({
                      pnl: tradeUpdate.pnl,
                      status: tradeUpdate.status,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', tradeUpdate.id)
                    .eq('user_id', user.id);
                } catch (updateError) {
                  console.warn(`⚠️ Failed to update paper trade ${tradeUpdate.id}:`, updateError);
                }
              }
            }
          }

          // STEP 4: Fetch paper trades with all necessary fields
          console.log('📊 Step 4: Fetching paper trades for stats calculation...');
          const { data: paperTrades, error: paperTradesStatsError } = await supabaseClient
            .from('paper_trading_trades')
            .select('id, bot_id, status, pnl, fees, executed_at, exit_price, entry_price, quantity, side')
            .eq('user_id', user.id)
            .in('bot_id', botIds)
            .order('executed_at', { ascending: true });

          if (paperTradesStatsError) {
            console.warn('Error fetching paper trades for stats:', paperTradesStatsError);
          } else if (paperTrades) {
            for (const trade of paperTrades) {
              if (!trade || !trade.bot_id) continue;
              const stats = ensureStats(trade.bot_id);
              if (trade.id) {
                seenTradeIds.add(trade.id);
              }
              const status = (trade.status || '').toString().toLowerCase();
              const pnlValue = trade.pnl !== null && trade.pnl !== undefined ? parseFloat(trade.pnl) : NaN;
              const feeValue = trade.fees !== null && trade.fees !== undefined ? parseFloat(trade.fees) : 0;
              const hasExitPrice = trade.exit_price !== null && trade.exit_price !== undefined;
              if (trade.id && !Number.isNaN(feeValue)) {
                tradeFeesById.set(trade.id, feeValue);
              }

              // Count as executed if status is in executedStatuses
              if (executedStatuses.has(status)) {
                stats.totalTrades += 1;
                stats.totalFees += feeValue;
              }

              // Count as closed if:
              // 1. Status is in closedStatuses, OR
              // 2. Trade has a PnL value (meaning it's been closed), OR
              // 3. Trade has an exit_price (meaning position was closed)
              const isClosed = closedStatuses.has(status) || (!Number.isNaN(pnlValue) && pnlValue !== 0) || hasExitPrice;
              
              // If trade is closed but PnL is NaN, try to calculate it from entry/exit prices
              let finalPnLValue = pnlValue;
              if (isClosed && Number.isNaN(pnlValue) && hasExitPrice) {
                const entryPrice = parseFloat(trade.entry_price || 0);
                const exitPrice = parseFloat(trade.exit_price || 0);
                const quantity = parseFloat(trade.quantity || 0);
                const side = (trade.side || 'long').toLowerCase();
                if (entryPrice > 0 && exitPrice > 0 && quantity > 0) {
                  if (side === 'short' || side === 'sell') {
                    finalPnLValue = (entryPrice - exitPrice) * quantity;
                  } else {
                    finalPnLValue = (exitPrice - entryPrice) * quantity;
                  }
                  if (!Number.isNaN(feeValue)) {
                    finalPnLValue -= feeValue;
                  }
                }
              }
              
              // Count as closed if it's marked as closed, using 0 as default if PnL calculation failed
              if (isClosed) {
                const finalPnL = Number.isNaN(finalPnLValue) ? 0 : finalPnLValue;
                stats.closedTrades += 1;
                stats.pnl += finalPnL;
                stats.hasClosed = true;
                if (finalPnL > 0) {
                  stats.winTrades += 1;
                } else if (finalPnL < 0) {
                  stats.lossTrades += 1;
                }
                if (trade.id) {
                  countedTradeIds.add(trade.id);
                }
              }

              // Calculate drawdown: track peak equity and current drawdown
              if (stats.hasClosed) {
                stats.peakEquity = Math.max(stats.peakEquity, stats.pnl);
                const currentDrawdown = stats.peakEquity - stats.pnl;
                stats.maxDrawdown = Math.max(stats.maxDrawdown, currentDrawdown);
              }
            }
          }

          if (closedPositions && closedPositions.length > 0) {
            for (const position of closedPositions) {
              if (!position || !position.bot_id) continue;
              const stats = ensureStats(position.bot_id);
              let pnlValue = position.realized_pnl !== null && position.realized_pnl !== undefined
                ? parseFloat(position.realized_pnl)
                : NaN;
              if (Number.isNaN(pnlValue)) {
                const entryPrice = parseFloat(position.entry_price || 0);
                const exitPrice = parseFloat(position.exit_price || 0);
                const quantity = parseFloat(position.quantity || 0);
                const side = (position.side || 'long').toLowerCase();
                if (entryPrice > 0 && exitPrice > 0 && quantity > 0) {
                  if (side === 'short' || side === 'sell') {
                    pnlValue = (entryPrice - exitPrice) * quantity;
                  } else {
                    pnlValue = (exitPrice - entryPrice) * quantity;
                  }
                  const feeValue = parseFloat(position.fees || 0);
                  if (!Number.isNaN(feeValue)) {
                    pnlValue -= feeValue;
                  }
                }
              }
              if (Number.isNaN(pnlValue)) continue;

              const tradeId = position.trade_id;
              if (tradeId && countedTradeIds.has(tradeId)) {
                continue;
              }

              stats.closedTrades += 1;
              stats.pnl += pnlValue;
              stats.hasClosed = true;
              if (pnlValue > 0) {
                stats.winTrades += 1;
              } else if (pnlValue < 0) {
                stats.lossTrades += 1;
              }

              if (!tradeId || !seenTradeIds.has(tradeId)) {
                stats.totalTrades += 1;
              }

              const feeValue = position.fees !== null && position.fees !== undefined
                ? parseFloat(position.fees)
                : 0;
              if (!Number.isNaN(feeValue) && feeValue > 0) {
                if (tradeId && seenTradeIds.has(tradeId)) {
                  const existingFee = tradeFeesById.get(tradeId) ?? 0;
                  if (!existingFee) {
                    stats.totalFees += feeValue;
                  }
                } else {
                  stats.totalFees += feeValue;
                }
              }

              if (stats.hasClosed) {
                stats.peakEquity = Math.max(stats.peakEquity, stats.pnl);
                const currentDrawdown = stats.peakEquity - stats.pnl;
                stats.maxDrawdown = Math.max(stats.maxDrawdown, currentDrawdown);
              }

              if (tradeId) {
                countedTradeIds.add(tradeId);
              }
            }
          }
        }

        // Update all bots with recalculated stats
        let updatedCount = 0;
        for (const bot of bots) {
          const stats = statsMap.get(bot.id) || {
            totalTrades: 0,
            closedTrades: 0,
            winTrades: 0,
            lossTrades: 0,
            pnl: 0,
            totalFees: 0,
            maxDrawdown: 0,
            peakEquity: 0,
            hasClosed: false
          };

          const totalTrades = Math.max(bot.total_trades ?? 0, stats.totalTrades);
          const winRate = stats.closedTrades > 0
            ? (stats.winTrades / stats.closedTrades) * 100
            : (bot.win_rate ?? 0);
          const realizedPnl = stats.hasClosed ? stats.pnl : (bot.pnl ?? 0);
          const drawdownPercentage = stats.peakEquity > 0
            ? (stats.maxDrawdown / stats.peakEquity) * 100
            : (bot.drawdown_percentage ?? 0);
          const tradeAmount = bot.trade_amount || bot.tradeAmount;
          const pnlPercentage = stats.closedTrades > 0 && tradeAmount
            ? (realizedPnl / (tradeAmount * stats.closedTrades)) * 100
            : (bot.pnl_percentage ?? 0);

          // Get last trade date
          let lastTradeAt = bot.last_trade_at;
          if (stats.closedTrades > 0 || stats.totalTrades > 0) {
            // Try to get the most recent trade date from real trades
            const { data: realTradesList } = await supabaseClient
              .from('trades')
              .select('executed_at')
              .eq('bot_id', bot.id)
              .eq('user_id', user.id)
              .order('executed_at', { ascending: false })
              .limit(1);
            
            if (realTradesList && realTradesList.length > 0) {
              lastTradeAt = realTradesList[0].executed_at;
            } else {
              // Try paper trades if no real trades
              const { data: paperTradesList } = await supabaseClient
                .from('paper_trading_trades')
                .select('executed_at')
                .eq('bot_id', bot.id)
                .eq('user_id', user.id)
                .order('executed_at', { ascending: false })
                .limit(1);
              
              if (paperTradesList && paperTradesList.length > 0) {
                lastTradeAt = paperTradesList[0].executed_at;
              }
            }
          }

          // Update bot with recalculated stats
          // Build update object with only essential fields (some columns may not exist in all deployments)
          const updateData: any = {
            total_trades: totalTrades,
            win_rate: Math.round(winRate * 100) / 100, // Round to 2 decimals
            pnl: Math.round(realizedPnl * 100) / 100,
            pnl_percentage: Math.round(pnlPercentage * 100) / 100,
            last_trade_at: lastTradeAt,
            updated_at: new Date().toISOString()
          };

          // Try to update with optional columns, but fall back to essential columns only if they don't exist
          try {
            // First try with all columns
            const fullUpdateData = { ...updateData };
            if (stats.totalFees !== undefined) {
              fullUpdateData.total_fees = Math.round(stats.totalFees * 100) / 100;
            }
            if (stats.maxDrawdown !== undefined) {
              fullUpdateData.max_drawdown = Math.round(stats.maxDrawdown * 100) / 100;
            }
            if (drawdownPercentage !== undefined) {
              fullUpdateData.drawdown_percentage = Math.round(drawdownPercentage * 100) / 100;
            }

            const { data: updateResult, error: updateError } = await supabaseClient
              .from('trading_bots')
              .update(fullUpdateData)
              .eq('id', bot.id)
              .eq('user_id', user.id)
              .select();

            if (updateError) {
              // If error mentions missing columns, try again with only essential columns
              if (updateError.message && (
                updateError.message.includes('column') || 
                updateError.message.includes('does not exist')
              )) {
                console.warn(`⚠️ Optional columns missing for bot ${bot.id}, using essential columns only`);
                const { data: essentialResult, error: essentialError } = await supabaseClient
                  .from('trading_bots')
                  .update(updateData)
                  .eq('id', bot.id)
                  .eq('user_id', user.id)
                  .select();
                
                if (essentialError) {
                  throw essentialError;
                }
                
                if (essentialResult && essentialResult.length > 0) {
                  updatedCount++;
                  console.log(`✅ Updated stats for bot ${bot.id} (${bot.name}): Trades=${totalTrades}, WinRate=${winRate.toFixed(2)}%, PnL=$${realizedPnl.toFixed(2)}`);
                } else {
                  console.warn(`⚠️ Update succeeded but no rows affected for bot ${bot.id} (${bot.name})`);
                }
              } else {
                throw updateError;
              }
            } else {
              if (updateResult && updateResult.length > 0) {
                updatedCount++;
                console.log(`✅ Updated stats for bot ${bot.id} (${bot.name}): Trades=${totalTrades}, WinRate=${winRate.toFixed(2)}%, PnL=$${realizedPnl.toFixed(2)}`);
              } else {
                console.warn(`⚠️ Update succeeded but no rows affected for bot ${bot.id} (${bot.name})`);
              }
            }
          } catch (error: any) {
            console.warn(`❌ Failed to update stats for bot ${bot.id} (${bot.name}):`, error?.message || error);
          }
        }

        console.log(`📊 Stats refresh complete: ${updatedCount}/${bots.length} bots updated`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Refreshed stats for ${updatedCount} bot(s)`,
            updated: updatedCount,
            total: bots.length
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (req.method === 'DELETE') {
      const body = await req.json()
      const { id } = body

      const { error } = await supabaseClient
        .from('trading_bots')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})