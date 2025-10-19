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

    const method = req.method
    const url = new URL(req.url)
    const action = url.pathname.split('/').pop()

    switch (method) {
      case 'GET':
        if (action === 'list') {
          const { data: alerts, error } = await supabaseClient
            .from('alerts')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

          if (error) throw error

          return new Response(JSON.stringify({ alerts }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        break

      case 'POST':
        if (action === 'create') {
          const body = await req.json()
          const { type, symbol, condition } = body

          const { data: alert, error } = await supabaseClient
            .from('alerts')
            .insert({
              user_id: user.id,
              type,
              symbol,
              condition,
              is_active: true
            })
            .select()
            .single()

          if (error) throw error

          return new Response(JSON.stringify({ alert }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (action === 'trigger') {
          const body = await req.json()
          const { alertId, message } = body

          // Mark alert as triggered
          await supabaseClient
            .from('alerts')
            .update({ triggered_at: new Date().toISOString() })
            .eq('id', alertId)
            .eq('user_id', user.id)

          // Send notification (implement your preferred notification method)
          // For now, just log the alert
          console.log(`Alert triggered for user ${user.id}: ${message}`)

          return new Response(JSON.stringify({ success: true, message: 'Alert triggered' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        break

      case 'PUT':
        if (action === 'update') {
          const body = await req.json()
          const { id, ...updates } = body

          const { data: alert, error } = await supabaseClient
            .from('alerts')
            .update(updates)
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single()

          if (error) throw error

          return new Response(JSON.stringify({ alert }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        break

      case 'DELETE':
        const alertId = url.searchParams.get('id')
        if (alertId) {
          const { error } = await supabaseClient
            .from('alerts')
            .delete()
            .eq('id', alertId)
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