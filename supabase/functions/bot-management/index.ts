import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
        const { name, exchange, symbol, leverage, riskLevel, strategy, status, pnl, pnlPercentage, totalTrades, winRate, lastTradeAt } = body

        // Debug logging
        console.log('Received bot data:', { name, exchange, symbol, leverage, riskLevel, strategy, status, pnl, pnlPercentage, totalTrades, winRate, lastTradeAt })

        // Validate required fields
        if (!name || !exchange || !symbol) {
          throw new Error(`Missing required fields: name=${name}, exchange=${exchange}, symbol=${symbol}`)
        }

        const { data: bot, error } = await supabaseClient
          .from('trading_bots')
          .insert({
            user_id: user.id,
            name,
            exchange,
            symbol,
            leverage,
            risk_level: riskLevel,
            strategy: JSON.stringify(strategy),
            status: status || 'stopped',
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

      if (action === 'start') {
        const { id } = body

        const { data: bot, error } = await supabaseClient
          .from('trading_bots')
          .update({ status: 'active' })
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