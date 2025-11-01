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

    // Get bot performance summary FIRST (needed for Total P&L calculation)
    const { data: botPerformanceData } = await supabaseClient
      .from('trading_bots')
      .select('id, name, symbol, exchange, trading_type, status, pnl')
      .eq('user_id', user.id)

    // Active Bots Details
    const { data: activeBotsData } = await supabaseClient
      .from('trading_bots')
      .select('*, strategy_config')
      .eq('user_id', user.id)
      .in('status', ['running', 'active'])
      .order('pnl', { ascending: false })

    // Total P&L from trades (more accurate) - filter by user_id
    const { data: tradesData } = await supabaseClient
      .from('trades')
      .select('pnl, fee, amount, price, bot_id, symbol, exchange, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Calculate total PnL from trades
    const totalPnLFromTrades = tradesData?.reduce((sum, t) => sum + (t.pnl || 0), 0) || 0
    
    // Calculate total PnL from bots (more reliable, includes all bot performance)
    const totalPnLFromBots = botPerformanceData?.reduce((sum, b) => sum + (b.pnl || 0), 0) || 0
    
    // Use bot P&L as primary source (more accurate, includes all bot performance)
    // Fall back to trades P&L only if bot P&L is unavailable
    const totalPnL = totalPnLFromBots !== 0 ? totalPnLFromBots : totalPnLFromTrades
    
    // Calculate total fees
    const totalFees = tradesData?.reduce((sum, t) => {
      const fee = t.fee || 0
      // If fee is 0, calculate from volume (0.1% default)
      if (fee === 0 && t.amount && t.price) {
        return sum + (t.amount * t.price * 0.001)
      }
      return sum + fee
    }, 0) || 0

    // Contract summary - get trades with bot info
    // First get user's bots, then get their trades
    const { data: userBots } = await supabaseClient
      .from('trading_bots')
      .select('id, trading_type, symbol, exchange, pnl')
      .eq('user_id', user.id)
    
    const botIds = userBots?.map(b => b.id) || []
    const botMap = new Map(userBots?.map(b => [b.id, b.trading_type]) || [])
    
    // Create bot P&L by contract map for fallback
    const botPnLByContract = new Map<string, number>()
    userBots?.forEach(bot => {
      const contractKey = `${bot.symbol}_${bot.exchange}`
      botPnLByContract.set(contractKey, (botPnLByContract.get(contractKey) || 0) + (bot.pnl || 0))
    })
    
    const { data: contractData } = await supabaseClient
      .from('trades')
      .select('symbol, exchange, pnl, fee, amount, price, bot_id')
      .eq('user_id', user.id)
      .in('bot_id', botIds)

    // Group by contract
    const contractSummary: any = {}
    if (contractData) {
      for (const trade of contractData) {
        const tradingType = botMap.get(trade.bot_id) || 'spot'
        const contract = `${trade.symbol}_${trade.exchange}`
        
        if (!contractSummary[contract]) {
          contractSummary[contract] = {
            contract: trade.symbol,
            exchange: trade.exchange,
            total_trades: 0,
            total_net_pnl: 0,
            total_fees_paid: 0,
            net_profit_loss: 0
          }
        }
        
        // Calculate fee if not stored
        let fee = trade.fee || 0
        if (fee === 0 && trade.amount && trade.price) {
          if (trade.exchange === 'bybit') {
            fee = tradingType === 'futures' ? trade.amount * trade.price * 0.00055 : trade.amount * trade.price * 0.001
          } else if (trade.exchange === 'okx') {
            fee = tradingType === 'futures' ? trade.amount * trade.price * 0.0005 : trade.amount * trade.price * 0.0008
          } else {
            fee = trade.amount * trade.price * 0.001 // Default 0.1%
          }
        }
        
        contractSummary[contract].total_trades++
        // Use trade P&L if available, otherwise use bot P&L
        const tradePnL = trade.pnl || 0
        contractSummary[contract].total_net_pnl += tradePnL
        contractSummary[contract].total_fees_paid += fee
        contractSummary[contract].net_profit_loss = contractSummary[contract].total_net_pnl - contractSummary[contract].total_fees_paid
      }
    }
    
    // Update contract summary with bot P&L if trades don't have P&L
    for (const contractKey in contractSummary) {
      const contract = contractSummary[contractKey]
      // If contract has no P&L from trades, use bot P&L
      if (contract.total_net_pnl === 0) {
        const botPnL = botPnLByContract.get(contractKey) || 0
        if (botPnL !== 0) {
          contract.total_net_pnl = botPnL
          contract.net_profit_loss = botPnL - contract.total_fees_paid
        }
      }
    }

    const report = {
      generated_at: new Date().toISOString(),
      overview: {
        total_bots: botPerformanceData?.length || 0,
        active_bots: botPerformanceData?.filter(b => ['running', 'active'].includes(b.status)).length || 0,
        total_pnl: totalPnL,
        total_pnl_from_trades: totalPnLFromTrades,
        total_pnl_from_bots: totalPnLFromBots,
        total_fees: totalFees,
        net_profit_loss: totalPnL - totalFees,
        total_trades: tradesData?.length || 0
      },
      active_bots: activeBotsData?.map(bot => ({
        id: bot.id,
        name: bot.name,
        symbol: bot.symbol,
        exchange: bot.exchange,
        trading_type: bot.trading_type,
        status: bot.status,
        pnl: bot.pnl || 0,
        total_trades: bot.total_trades || 0,
        win_rate: bot.win_rate || 0,
        last_trade_at: bot.last_trade_at
      })) || [],
      contract_summary: Object.values(contractSummary).map((cs: any) => ({
        contract: cs.contract,
        exchange: cs.exchange,
        total_trades: cs.total_trades,
        total_net_pnl: Math.round(cs.total_net_pnl * 100) / 100,
        total_fees_paid: Math.round(cs.total_fees_paid * 100) / 100,
        net_profit_loss: Math.round(cs.net_profit_loss * 100) / 100
      })).sort((a: any, b: any) => b.net_profit_loss - a.net_profit_loss),
      recent_trades: tradesData?.slice(0, 10).map(t => ({
        id: t.bot_id,
        symbol: (t as any).symbol,
        pnl: t.pnl || 0,
        fee: t.fee || 0,
        amount: t.amount || 0,
        price: t.price || 0,
        created_at: t.created_at
      })) || []
    }

    return new Response(
      JSON.stringify({ report }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

