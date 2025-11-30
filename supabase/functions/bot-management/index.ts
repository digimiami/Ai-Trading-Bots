import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
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
          .single()

        if (error) {
          console.error('Error fetching bot by ID:', error)
          return new Response(
            JSON.stringify({ error: error.message || 'Bot not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        const { data: bots, error } = await supabaseClient
          .from('trading_bots')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error

        // Transform the data to match frontend expectations
        const botIds = bots.map((bot: any) => bot.id);

        const statsMap = new Map<string, {
          totalTrades: number;
          closedTrades: number;
          winTrades: number;
          lossTrades: number;
          pnl: number;
          hasClosed: boolean;
        }>();

        const ensureStats = (botId: string) => {
          if (!statsMap.has(botId)) {
            statsMap.set(botId, {
              totalTrades: 0,
              closedTrades: 0,
              winTrades: 0,
              lossTrades: 0,
              pnl: 0,
              hasClosed: false
            });
          }
          return statsMap.get(botId)!;
        };

        if (botIds.length > 0) {
          const executedStatuses = new Set(['filled', 'completed', 'closed', 'stopped', 'taken_profit']);
          const closedStatuses = new Set(['completed', 'closed', 'stopped', 'taken_profit']);

          const { data: realTrades, error: realTradesError } = await supabaseClient
            .from('trades')
            .select('bot_id, status, pnl')
            .in('bot_id', botIds);

          if (realTradesError) {
            console.warn('Error fetching trades for stats:', realTradesError);
          } else if (realTrades) {
            for (const trade of realTrades) {
              if (!trade || !trade.bot_id) continue;
              const stats = ensureStats(trade.bot_id);
              const status = (trade.status || '').toString().toLowerCase();
              const pnlValue = trade.pnl !== null && trade.pnl !== undefined ? parseFloat(trade.pnl) : NaN;

              if (executedStatuses.has(status)) {
                stats.totalTrades += 1;
              }

              if (closedStatuses.has(status) && !Number.isNaN(pnlValue)) {
                stats.closedTrades += 1;
                stats.pnl += pnlValue;
                stats.hasClosed = true;
                if (pnlValue > 0) {
                  stats.winTrades += 1;
                } else if (pnlValue < 0) {
                  stats.lossTrades += 1;
                }
              }
            }
          }

          const { data: paperTrades, error: paperTradesError } = await supabaseClient
            .from('paper_trading_trades')
            .select('bot_id, status, pnl')
            .in('bot_id', botIds);

          if (paperTradesError) {
            console.warn('Error fetching paper trades for stats:', paperTradesError);
          } else if (paperTrades) {
            for (const trade of paperTrades) {
              if (!trade || !trade.bot_id) continue;
              const stats = ensureStats(trade.bot_id);
              const status = (trade.status || '').toString().toLowerCase();
              const pnlValue = trade.pnl !== null && trade.pnl !== undefined ? parseFloat(trade.pnl) : NaN;

              if (executedStatuses.has(status)) {
                stats.totalTrades += 1;
              }

              if (closedStatuses.has(status) && !Number.isNaN(pnlValue)) {
                stats.closedTrades += 1;
                stats.pnl += pnlValue;
                stats.hasClosed = true;
                if (pnlValue > 0) {
                  stats.winTrades += 1;
                } else if (pnlValue < 0) {
                  stats.lossTrades += 1;
                }
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
            hasClosed: false
          };

          const totalTrades = Math.max(bot.total_trades ?? 0, stats.totalTrades);
          const closedTrades = stats.closedTrades;
          const winTrades = stats.winTrades;
          const lossTrades = stats.lossTrades;
          const realizedPnl = stats.hasClosed ? stats.pnl : (bot.pnl ?? 0);
          const winRate = closedTrades > 0
            ? (winTrades / closedTrades) * 100
            : (bot.win_rate ?? 0);

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
          createdAt: bot.created_at,
          lastTradeAt: bot.last_trade_at,
          riskLevel: bot.risk_level || 'medium',
          strategy: typeof bot.strategy === 'string' ? JSON.parse(bot.strategy) : bot.strategy,
          aiMlEnabled: bot.ai_ml_enabled || false,
          paperTrading: bot.paper_trading || false,
          soundNotificationsEnabled: bot.sound_notifications_enabled || false,
          webhookSecret: bot.webhook_secret || null,
          webhookTriggerImmediate: bot.webhook_trigger_immediate ?? true,
          symbols: symbolsArray,
          customPairs: bot.custom_pairs || null
        });
        })

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

        // Debug logging
        console.log('Received bot data:', { name, exchange, symbol, symbols, customPairs, timeframe, leverage, riskLevel, tradeAmount, stopLoss, takeProfit, strategy, status, pnl, pnlPercentage, totalTrades, winRate, lastTradeAt })
        console.log('Exchange value:', exchange, 'Type:', typeof exchange, 'Is null:', exchange === null, 'Is undefined:', exchange === undefined)

        // Validate required fields
        if (!name || !exchange || !symbol) {
          throw new Error(`Missing required fields: name=${name}, exchange=${exchange}, symbol=${symbol}`)
        }

        // Check if exchange is valid
        if (exchange !== 'bybit' && exchange !== 'okx' && exchange !== 'bitunix') {
          throw new Error(`Invalid exchange value: ${exchange}. Must be 'bybit', 'okx', or 'bitunix'`)
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
          strategy_config: strategyConfig ? JSON.stringify(strategyConfig) : null,
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
          strategyConfig: bot.strategy_config ? (typeof bot.strategy_config === 'string' ? JSON.parse(bot.strategy_config) : bot.strategy_config) : undefined,
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
        if (updates.leverage) dbUpdates.leverage = updates.leverage
        if (updates.tradeAmount) dbUpdates.trade_amount = updates.tradeAmount
        if (updates.stopLoss) dbUpdates.stop_loss = updates.stopLoss
        if (updates.takeProfit) dbUpdates.take_profit = updates.takeProfit
        if (updates.status) dbUpdates.status = updates.status
        if (updates.pnl !== undefined) dbUpdates.pnl = updates.pnl
        if (updates.pnlPercentage !== undefined) dbUpdates.pnl_percentage = updates.pnlPercentage
        if (updates.totalTrades !== undefined) dbUpdates.total_trades = updates.totalTrades
        if (updates.winRate !== undefined) dbUpdates.win_rate = updates.winRate
        if (updates.lastTradeAt !== undefined) dbUpdates.last_trade_at = updates.lastTradeAt
        if (updates.riskLevel) dbUpdates.risk_level = updates.riskLevel
        if (updates.strategy) dbUpdates.strategy = JSON.stringify(updates.strategy)
        
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
          
          // Merge existing config with new updates
          const mergedConfig = {
            ...existingConfig,
            ...newConfig
          };
          
          // Ensure required fields have defaults if missing (for validation)
          // This prevents validation errors when updating partial configs
          if (!mergedConfig.bias_mode) {
            mergedConfig.bias_mode = 'auto';
          }
          if (!mergedConfig.regime_mode) {
            mergedConfig.regime_mode = 'auto';
          }
          if (!mergedConfig.htf_timeframe) {
            mergedConfig.htf_timeframe = '4h';
          }
          
          // Store as JSONB (Supabase will handle it automatically)
          dbUpdates.strategy_config = mergedConfig
        }
        
        // Handle AI/ML field
        if (updates.aiMlEnabled !== undefined) {
          dbUpdates.ai_ml_enabled = updates.aiMlEnabled
        }
        
        // Handle paper trading toggle
        if (updates.paperTrading !== undefined) {
          dbUpdates.paper_trading = updates.paperTrading
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
        const { id } = body

        const { data: bot, error } = await supabaseClient
          .from('trading_bots')
          .update({ status: 'paused' })
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
        const { id } = body

        const { data: bot, error } = await supabaseClient
          .from('trading_bots')
          .update({ status: 'stopped' })
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