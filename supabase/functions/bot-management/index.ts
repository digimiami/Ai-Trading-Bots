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

    const url = new URL(req.url)
    const method = req.method
    const path = url.pathname.split('/').pop()

    switch (method) {
      case 'GET':
        if (path === 'bots') {
          const { data: bots, error } = await supabaseClient
            .from('trading_bots')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

          if (error) throw error

          return new Response(JSON.stringify({ bots }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        break

      case 'POST':
        if (path === 'create') {
          const body = await req.json()
          const { name, strategy, exchange, symbol, config } = body

          const { data: bot, error } = await supabaseClient
            .from('trading_bots')
            .insert({
              user_id: user.id,
              name,
              strategy,
              exchange,
              symbol,
              config,
              status: 'stopped'
            })
            .select()
            .single()

          if (error) throw error

          return new Response(JSON.stringify({ bot }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        break

      case 'PUT':
        if (path === 'update') {
          const body = await req.json()
          const { id, ...updates } = body

          const { data: bot, error } = await supabaseClient
            .from('trading_bots')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single()

          if (error) throw error

          return new Response(JSON.stringify({ bot }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        break

      case 'DELETE':
        const botId = url.searchParams.get('id')
        if (botId) {
          const { error } = await supabaseClient
            .from('trading_bots')
            .delete()
            .eq('id', botId)
            .eq('user_id', user.id)

          if (error) throw error

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        break
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})