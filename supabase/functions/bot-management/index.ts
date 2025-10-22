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
      if (action === 'list') {
        const { data: bots, error } = await supabaseClient
          .from('trading_bots')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error

        // Transform the data to match frontend expectations
        const transformedBots = bots.map(bot => ({
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
          strategy: typeof bot.strategy === 'string' ? JSON.parse(bot.strategy) : bot.strategy
        }))

        return new Response(
          JSON.stringify({ bots: transformedBots }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (req.method === 'POST') {
      const body = await req.json()

      if (action === 'create') {
        const { name, exchange, tradingType, symbol, timeframe, leverage, riskLevel, tradeAmount, stopLoss, takeProfit, strategy, status, pnl, pnlPercentage, totalTrades, winRate, lastTradeAt } = body

        // Debug logging
        console.log('Received bot data:', { name, exchange, symbol, timeframe, leverage, riskLevel, tradeAmount, stopLoss, takeProfit, strategy, status, pnl, pnlPercentage, totalTrades, winRate, lastTradeAt })
        console.log('Exchange value:', exchange, 'Type:', typeof exchange, 'Is null:', exchange === null, 'Is undefined:', exchange === undefined)

        // Validate required fields
        if (!name || !exchange || !symbol) {
          throw new Error(`Missing required fields: name=${name}, exchange=${exchange}, symbol=${symbol}`)
        }

        // Check if exchange is valid
        if (exchange !== 'bybit' && exchange !== 'okx') {
          throw new Error(`Invalid exchange value: ${exchange}. Must be 'bybit' or 'okx'`)
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

        const { data: bot, error } = await supabaseClient
          .from('trading_bots')
          .insert({
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
            status: status || 'running', // Auto-start bots instead of 'stopped'
            pnl: pnl || 0,
            pnl_percentage: pnlPercentage || 0,
            total_trades: totalTrades || 0,
            win_rate: winRate || 0,
            last_trade_at: lastTradeAt,
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) {
          console.error('Database insert error:', error)
          throw error
        }

        return new Response(
          JSON.stringify({ bot }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'update') {
        const { id, ...updates } = body

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

        const { data: bot, error } = await supabaseClient
          .from('trading_bots')
          .update(dbUpdates)
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error) throw error

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
          strategy: typeof bot.strategy === 'string' ? JSON.parse(bot.strategy) : bot.strategy
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
          strategy: typeof bot.strategy === 'string' ? JSON.parse(bot.strategy) : bot.strategy
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
          strategy: typeof bot.strategy === 'string' ? JSON.parse(bot.strategy) : bot.strategy
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