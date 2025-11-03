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
      .select('pnl, fee, amount, price, bot_id, symbol, exchange, created_at, executed_at, status, entry_price, exit_price, side')
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
      .select('symbol, exchange, pnl, fee, amount, price, bot_id, executed_at, status, entry_price, exit_price, side')
      .eq('user_id', user.id)
      .in('bot_id', botIds)
      .in('status', ['filled', 'closed', 'completed'])

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
            net_profit_loss: 0,
            win_trades: 0,
            loss_trades: 0,
            win_rate: 0,
            drawdown: 0,
            drawdown_percentage: 0,
            peak_pnl: 0,
            current_pnl: 0,
            trades: [] // Store trades for drawdown calculation
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
        
        // Calculate PnL: use stored pnl, or calculate from entry/exit prices if available
        let tradePnL = trade.pnl || 0
        if ((tradePnL === 0 || tradePnL === null) && trade.entry_price && trade.exit_price) {
          // Calculate PnL from entry and exit prices
          const entryPrice = parseFloat(trade.entry_price || 0)
          const exitPrice = parseFloat(trade.exit_price || 0)
          const size = parseFloat(trade.amount || 0)
          const side = (trade.side || 'long').toLowerCase()
          const tradeFee = trade.fee || fee || 0
          
          if (entryPrice > 0 && exitPrice > 0 && size > 0) {
            if (side === 'long' || side === 'buy') {
              tradePnL = (exitPrice - entryPrice) * size - tradeFee
            } else {
              tradePnL = (entryPrice - exitPrice) * size - tradeFee
            }
          }
        }
        
        contractSummary[contract].total_net_pnl += tradePnL
        contractSummary[contract].total_fees_paid += fee
        contractSummary[contract].net_profit_loss = contractSummary[contract].total_net_pnl - contractSummary[contract].total_fees_paid
        
        // Track for win/loss and drawdown (only if PnL is non-zero or we have exit_price)
        // Only count trades with actual PnL calculation for win/loss
        if (tradePnL !== 0 || trade.exit_price) {
          contractSummary[contract].trades.push({
            pnl: tradePnL,
            executed_at: trade.executed_at || trade.created_at || new Date().toISOString()
          })
          
          if (tradePnL > 0) {
            contractSummary[contract].win_trades++
          } else if (tradePnL < 0) {
            contractSummary[contract].loss_trades++
          }
        }
      }
      
      // Calculate win rate, drawdown, and peak P&L for each contract
      for (const contractKey in contractSummary) {
        const contract = contractSummary[contractKey]
        const totalFilledTrades = contract.win_trades + contract.loss_trades
        contract.win_rate = totalFilledTrades > 0 ? (contract.win_trades / totalFilledTrades) * 100 : 0
        
        // Calculate drawdown
        if (contract.trades.length > 0) {
          // Sort trades by execution time (oldest first)
          const sortedTrades = [...contract.trades].sort((a: any, b: any) => {
            const dateA = new Date(a.executed_at || 0).getTime()
            const dateB = new Date(b.executed_at || 0).getTime()
            return dateA - dateB
          })
          
          let maxDrawdown = 0
          let peakPnL = 0
          let runningPnL = 0
          
          for (const t of sortedTrades) {
            // Use the calculated PnL (which may have been computed from entry/exit prices)
            const tradePnL = t.pnl || 0
            runningPnL += tradePnL
            if (runningPnL > peakPnL) {
              peakPnL = runningPnL
            }
            const drawdown = peakPnL - runningPnL
            if (drawdown > maxDrawdown) {
              maxDrawdown = drawdown
            }
          }
          
          contract.drawdown = maxDrawdown
          contract.drawdown_percentage = peakPnL > 0 ? (maxDrawdown / peakPnL) * 100 : 0
          contract.peak_pnl = peakPnL
          contract.current_pnl = runningPnL
        }
        
        // Clean up trades array (not needed in response)
        delete contract.trades
      }
    }
    
    // Update contract summary with bot P&L if trades don't have P&L
    // But first, ensure we have at least some data even if trades don't have exit_price
    for (const contractKey in contractSummary) {
      const contract = contractSummary[contractKey]
      
      // If we have trades but no win/loss counts, try to calculate from bot P&L
      // This handles cases where trades are open positions (no exit_price yet)
      if (contract.total_trades > 0 && contract.win_trades === 0 && contract.loss_trades === 0) {
        // Try to use bot-level data if available
        const botPnL = botPnLByContract.get(contractKey) || 0
        
        // If bot has P&L but trades don't, we can't calculate win/loss accurately
        // But we can at least show the bot P&L
        if (botPnL !== 0 && contract.total_net_pnl === 0) {
          contract.total_net_pnl = botPnL
          contract.net_profit_loss = botPnL - contract.total_fees_paid
        }
      } else if (contract.total_net_pnl === 0 && contract.total_trades === 0) {
        // If no trades but bot has P&L, use bot P&L
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
      active_bots: activeBotsData?.map(bot => {
        // Calculate fees for this bot from trades
        const botTrades = tradesData?.filter(t => t.bot_id === bot.id && ['filled', 'closed', 'completed'].includes(t.status || '')) || []
        const botFees = botTrades.reduce((sum, t) => {
          let fee = t.fee || 0
          // Calculate fee if not stored
          if (fee === 0 && t.amount && t.price) {
            if (bot.exchange === 'bybit') {
              fee = bot.trading_type === 'futures' ? t.amount * t.price * 0.00055 : t.amount * t.price * 0.001
            } else if (bot.exchange === 'okx') {
              fee = bot.trading_type === 'futures' ? t.amount * t.price * 0.0005 : t.amount * t.price * 0.0008
            } else {
              fee = t.amount * t.price * 0.001
            }
          }
          return sum + fee
        }, 0)
        
        // Calculate win/loss trades and drawdown
        // Get trades with calculated PnL (either has pnl or has exit_price for calculation)
        const filledTrades = botTrades.map(t => {
          let calculatedPnL = parseFloat(t.pnl) || 0
          
          // If PnL is 0 or null but we have entry/exit prices, calculate it
          if ((calculatedPnL === 0 || t.pnl === null) && (t as any).entry_price && (t as any).exit_price) {
            const entryPrice = parseFloat((t as any).entry_price || 0)
            const exitPrice = parseFloat((t as any).exit_price || 0)
            const size = parseFloat(t.amount || 0)
            const side = ((t as any).side || 'long').toLowerCase()
            const tradeFee = parseFloat(t.fee || 0)
            
            if (entryPrice > 0 && exitPrice > 0 && size > 0) {
              if (side === 'long' || side === 'buy') {
                calculatedPnL = (exitPrice - entryPrice) * size - tradeFee
              } else {
                calculatedPnL = (entryPrice - exitPrice) * size - tradeFee
              }
            }
          }
          
          return { ...t, calculatedPnL }
        }).filter(t => {
          // Include ALL trades with status filled/closed/completed
          // Even if PnL is 0, we want to include them for fee calculation
          // But for win/loss, we only count trades with actual PnL
          return true
        })
        
        // For win/loss, only count trades with actual PnL (non-zero or has exit_price)
        const tradesWithPnL = filledTrades.filter(t => {
          return (t as any).calculatedPnL !== 0 || (t as any).exit_price || (t.pnl !== null && t.pnl !== undefined)
        })
        
        const winTrades = tradesWithPnL.filter(t => (t as any).calculatedPnL > 0).length
        const lossTrades = tradesWithPnL.filter(t => (t as any).calculatedPnL < 0).length
        const totalFilledTrades = tradesWithPnL.length
        const winRate = totalFilledTrades > 0 ? (winTrades / totalFilledTrades) * 100 : (bot.win_rate || 0)
        
        // Calculate drawdown
        let drawdown = 0
        let drawdownPercentage = 0
        let peakPnL = 0
        let currentPnL = 0
        
        // Use tradesWithPnL for drawdown calculation (only closed trades)
        if (tradesWithPnL.length > 0) {
          // Sort trades by execution time (oldest first)
          const sortedTrades = [...tradesWithPnL].sort((a, b) => {
            const dateA = new Date((a as any).executed_at || a.created_at || 0).getTime()
            const dateB = new Date((b as any).executed_at || b.created_at || 0).getTime()
            return dateA - dateB
          })
          
          let runningPnL = 0
          for (const t of sortedTrades) {
            runningPnL += ((t as any).calculatedPnL || 0)
            if (runningPnL > peakPnL) {
              peakPnL = runningPnL
            }
            const dd = peakPnL - runningPnL
            if (dd > drawdown) {
              drawdown = dd
            }
          }
          currentPnL = runningPnL
          drawdownPercentage = peakPnL > 0 ? (drawdown / peakPnL) * 100 : 0
        } else if (bot.pnl !== 0 && bot.pnl !== null) {
          // Fallback: if no trades with PnL but bot has PnL, use bot PnL for peak/current
          peakPnL = bot.pnl > 0 ? bot.pnl : 0
          currentPnL = bot.pnl
          // Can't calculate drawdown without trade history, but at least show current P&L
        }
        
        const botPnL = bot.pnl || 0
        const netProfitLoss = botPnL - botFees
        
        return {
          id: bot.id,
          name: bot.name,
          symbol: bot.symbol,
          exchange: bot.exchange,
          trading_type: bot.trading_type,
          status: bot.status,
          pnl: botPnL,
          total_fees: Math.round(botFees * 100) / 100,
          net_profit_loss: Math.round(netProfitLoss * 100) / 100,
          total_trades: bot.total_trades || 0,
          win_rate: Math.round(winRate * 10) / 10,
          win_trades: winTrades,
          loss_trades: lossTrades,
          drawdown: Math.round(drawdown * 100) / 100,
          drawdown_percentage: Math.round(drawdownPercentage * 10) / 10,
          peak_pnl: Math.round(peakPnL * 100) / 100,
          current_pnl: Math.round(currentPnL * 100) / 100,
          last_trade_at: bot.last_trade_at
        }
      }) || [],
      contract_summary: Object.values(contractSummary).map((cs: any) => ({
        contract: cs.contract,
        exchange: cs.exchange,
        total_trades: cs.total_trades,
        total_net_pnl: Math.round(cs.total_net_pnl * 100) / 100,
        total_fees_paid: Math.round(cs.total_fees_paid * 100) / 100,
        net_profit_loss: Math.round(cs.net_profit_loss * 100) / 100,
        win_trades: cs.win_trades || 0,
        loss_trades: cs.loss_trades || 0,
        win_rate: Math.round(cs.win_rate * 10) / 10,
        drawdown: Math.round(cs.drawdown * 100) / 100,
        drawdown_percentage: Math.round(cs.drawdown_percentage * 10) / 10,
        peak_pnl: Math.round(cs.peak_pnl * 100) / 100,
        current_pnl: Math.round(cs.current_pnl * 100) / 100
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

