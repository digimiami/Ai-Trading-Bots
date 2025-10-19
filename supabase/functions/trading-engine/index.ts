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
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Handle GET requests for fetching trades
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const path = url.pathname
      
      if (path.includes('/trades')) {
        const botId = url.searchParams.get('botId')
        
        let query = supabaseClient
          .from('trades')
          .select('*')
          .eq('user_id', user.id)
          .order('executed_at', { ascending: false })
        
        if (botId) {
          query = query.eq('bot_id', botId)
        }
        
        const { data: trades, error } = await query
        
        if (error) throw error
        
        return new Response(JSON.stringify({ trades: trades || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Handle POST requests for bot actions
    const body = await req.json()
    const { action, botId, tradeData } = body

    switch (action) {
      case 'start_bot':
        // Update bot status to running
        const { error: updateError } = await supabaseClient
          .from('trading_bots')
          .update({ status: 'running', updated_at: new Date().toISOString() })
          .eq('id', botId)
          .eq('user_id', user.id)

        if (updateError) throw updateError

        return new Response(JSON.stringify({ success: true, message: 'Bot started' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'stop_bot':
        // Update bot status to stopped
        const { error: stopError } = await supabaseClient
          .from('trading_bots')
          .update({ status: 'stopped', updated_at: new Date().toISOString() })
          .eq('id', botId)
          .eq('user_id', user.id)

        if (stopError) throw stopError

        return new Response(JSON.stringify({ success: true, message: 'Bot stopped' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'execute_trade':
        // Record trade in database
        const { data: trade, error: tradeError } = await supabaseClient
          .from('trades')
          .insert({
            user_id: user.id,
            bot_id: botId,
            exchange: tradeData.exchange,
            symbol: tradeData.symbol,
            side: tradeData.side,
            amount: tradeData.amount,
            price: tradeData.price,
            status: 'filled',
            executed_at: new Date().toISOString()
          })
          .select()
          .single()

        if (tradeError) throw tradeError

        // Update bot performance
        const { data: bot } = await supabaseClient
          .from('trading_bots')
          .select('performance')
          .eq('id', botId)
          .single()

        const currentPerformance = bot?.performance || {}
        const newPerformance = {
          ...currentPerformance,
          totalTrades: (currentPerformance.totalTrades || 0) + 1,
          totalVolume: (currentPerformance.totalVolume || 0) + (tradeData.amount * tradeData.price),
          lastTradeAt: new Date().toISOString()
        }

        await supabaseClient
          .from('trading_bots')
          .update({ performance: newPerformance })
          .eq('id', botId)

        return new Response(JSON.stringify({ trade, success: true }), {
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