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
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { action, amount } = body

    if (action === 'add_funds') {
      if (!amount || amount <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid amount' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Get or create account
      let { data: account } = await supabaseClient
        .from('paper_trading_accounts')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!account) {
        const { data: newAccount, error: insertError } = await supabaseClient
          .from('paper_trading_accounts')
          .insert({
            user_id: user.id,
            balance: 10000,
            initial_balance: 10000
          })
          .select()
          .single()
        
        if (insertError) throw insertError
        account = newAccount
      }

      const newBalance = parseFloat(account.balance) + amount
      const newTotalDeposited = parseFloat(account.total_deposited || 0) + amount

      const { data, error } = await supabaseClient
        .from('paper_trading_accounts')
        .update({
          balance: newBalance,
          total_deposited: newTotalDeposited,
          updated_at: new Date().toISOString()
        })
        .eq('id', account.id)
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ success: true, account: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'get_balance') {
      let { data: account } = await supabaseClient
        .from('paper_trading_accounts')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!account) {
        // Create default account
        const { data: newAccount } = await supabaseClient
          .from('paper_trading_accounts')
          .insert({
            user_id: user.id,
            balance: 10000,
            initial_balance: 10000
          })
          .select()
          .single()
        account = newAccount
      }

      return new Response(JSON.stringify({ success: true, account }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Paper trading error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

