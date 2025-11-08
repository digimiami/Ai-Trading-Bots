import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

const DEFAULT_BALANCE = (() => {
  const envValue = Deno.env.get('PAPER_TRADING_DEFAULT_BALANCE')
  const parsed = envValue ? Number(envValue) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10000
})()

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const supabaseAdminClient = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
      : supabaseClient

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let body: any = {}
    if (req.method !== 'GET') {
      try {
        body = await req.json()
      } catch (_err) {
        body = {}
      }
    }
    const { action, amount, applyToBalance } = body

    const getOrCreateAccount = async () => {
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
            balance: DEFAULT_BALANCE,
            initial_balance: DEFAULT_BALANCE,
            total_deposited: 0,
            total_withdrawn: 0
          })
          .select()
          .single()

        if (insertError) throw insertError
        account = newAccount
      }

      return account
    }

    if (action === 'add_funds') {
      const numericAmount = Number(amount)
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid amount' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const account = await getOrCreateAccount()

      const newBalance = parseFloat(account.balance) + numericAmount
      const newTotalDeposited = parseFloat(account.total_deposited || 0) + numericAmount

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
      const account = await getOrCreateAccount()

      return new Response(JSON.stringify({ success: true, account }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'set_balance') {
      const numericAmount = Number(amount)
      if (!Number.isFinite(numericAmount) || numericAmount < 0) {
        return new Response(JSON.stringify({ error: 'Invalid amount' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const account = await getOrCreateAccount()

      const { data, error } = await supabaseClient
        .from('paper_trading_accounts')
        .update({
          balance: numericAmount,
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

    if (action === 'set_initial_balance') {
      const numericAmount = Number(amount)
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid amount' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const account = await getOrCreateAccount()

      const updates: Record<string, any> = {
        initial_balance: numericAmount,
        updated_at: new Date().toISOString()
      }

      if (applyToBalance === true) {
        updates.balance = numericAmount
        updates.total_deposited = 0
        updates.total_withdrawn = 0
      }

      const { data, error } = await supabaseClient
        .from('paper_trading_accounts')
        .update(updates)
        .eq('id', account.id)
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ success: true, account: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'reset_performance') {
      const account = await getOrCreateAccount()

      const { data: positions } = await supabaseClient
        .from('paper_trading_positions')
        .select('id, margin_used, status')
        .eq('user_id', user.id)

      const releasedMargin = (positions || [])
        .filter((position: any) => (position.status || 'open') === 'open')
        .reduce((sum: number, position: any) => {
          const margin = Number(position.margin_used) || 0
          return sum + margin
        }, 0)

      const positionIds = (positions || []).map((position: any) => position.id).filter(Boolean)

      if (positionIds.length > 0) {
        const { error: tradesByPositionDeleteError } = await supabaseAdminClient
          .from('paper_trading_trades')
          .delete()
          .in('position_id', positionIds)
          .eq('user_id', user.id)

        if (tradesByPositionDeleteError) throw tradesByPositionDeleteError
      }

      const { error: tradesDeleteError } = await supabaseAdminClient
        .from('paper_trading_trades')
        .delete()
        .eq('user_id', user.id)

      if (tradesDeleteError) throw tradesDeleteError

      const { error: positionsDeleteError } = await supabaseAdminClient
        .from('paper_trading_positions')
        .delete()
        .eq('user_id', user.id)

      if (positionsDeleteError) throw positionsDeleteError

      const updates: Record<string, any> = {
        updated_at: new Date().toISOString()
      }

      if (releasedMargin > 0) {
        const currentBalance = Number(account.balance) || 0
        updates.balance = currentBalance + releasedMargin
      }

      const { data, error } = await supabaseClient
        .from('paper_trading_accounts')
        .update(updates)
        .eq('id', account.id)
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ success: true, account: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'reset_balance') {
      const account = await getOrCreateAccount()

      const { error: tradesDeleteError } = await supabaseClient
        .from('paper_trading_trades')
        .delete()
        .eq('user_id', user.id)

      if (tradesDeleteError) throw tradesDeleteError

      const { error: positionsDeleteError } = await supabaseClient
        .from('paper_trading_positions')
        .delete()
        .eq('user_id', user.id)

      if (positionsDeleteError) throw positionsDeleteError

      const resetAmount = Number.isFinite(Number(account?.initial_balance))
        ? Number(account.initial_balance)
        : DEFAULT_BALANCE

      const { data, error } = await supabaseClient
        .from('paper_trading_accounts')
        .update({
          balance: resetAmount,
          initial_balance: resetAmount,
          total_deposited: 0,
          total_withdrawn: 0,
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

