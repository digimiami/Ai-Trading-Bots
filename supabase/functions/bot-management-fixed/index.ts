import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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
    const action = url.searchParams.get('action')

    if (req.method === 'GET') {
      if (action === 'list') {
        const { data: bots, error } = await supabaseClient
          .from('trading_bots')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error

        return new Response(
          JSON.stringify({ bots }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (req.method === 'POST') {
      const body = await req.json()

      if (action === 'create') {
        const { botData } = body
        
        const { data: bot, error } = await supabaseClient
          .from('trading_bots')
          .insert({
            user_id: user.id,
            name: botData.name,
            exchange: botData.exchange,
            symbol: botData.symbol,
            leverage: botData.leverage,
            balance: botData.balance,
            risk_level: botData.riskLevel,
            stop_loss: botData.stopLoss,
            take_profit: botData.takeProfit,
            strategy: botData.strategy,
            status: 'stopped',
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({ bot }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'toggle') {
        const { botId, status } = body
        
        const { data: bot, error } = await supabaseClient
          .from('trading_bots')
          .update({ status })
          .eq('id', botId)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({ bot }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'delete') {
        const { botId } = body
        
        const { error } = await supabaseClient
          .from('trading_bots')
          .delete()
          .eq('id', botId)
          .eq('user_id', user.id)

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})