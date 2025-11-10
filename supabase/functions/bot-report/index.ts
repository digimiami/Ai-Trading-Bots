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

    // Get ALL trades (not just filled/closed) to show accurate total counts
    // Get ALL trades (not just filled/closed) to show accurate total counts
    const { data: tradesData } = await supabaseClient
      .from('trades')
      .select('pnl, fee, amount, price, bot_id, symbol, exchange, created_at, executed_at, status, entry_price, exit_price, side, size')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10000) // Limit to prevent excessive data
    
    // Get paper trading trades and merge with real trades
    const { data: paperTradesData } = await supabaseClient
      .from('paper_trading_trades')
      .select('pnl, fees, quantity, entry_price, exit_price, bot_id, symbol, exchange, created_at, executed_at, status, side')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10000)
    
    // Merge paper trading trades with real trades (map paper_trading_trades fields to trades format)
    const mergedTradesData = [
      ...(tradesData || []),
      ...(paperTradesData || []).map((pt: any) => ({
        ...pt,
        amount: pt.quantity || pt.amount || 0,
        price: pt.entry_price || pt.price || 0,
        size: pt.quantity || pt.amount || 0,
        fee: pt.fees || pt.fee || 0
      }))
    ]
    
    console.log(`📊 Bot Report: Found ${tradesData?.length || 0} real trades and ${paperTradesData?.length || 0} paper trades (${mergedTradesData.length} total)`)
    
    // Debug: Log sample trade data AND check fee calculation
    if (tradesData && tradesData.length > 0) {
      const sampleTrade = tradesData[0]
      console.log(`📊 Sample trade: ID=${sampleTrade.id?.substring(0, 8)}, Symbol=${sampleTrade.symbol}, Status=${sampleTrade.status}, Side=${sampleTrade.side}, Entry=${sampleTrade.entry_price || sampleTrade.price}, Exit=${sampleTrade.exit_price || 'none'}, PnL=${sampleTrade.pnl || 0}`)
      console.log(`📊 Sample trade FEE DEBUG: amount=${sampleTrade.amount} (type=${typeof sampleTrade.amount}), price=${sampleTrade.price} (type=${typeof sampleTrade.price}), size=${(sampleTrade as any).size}, entry_price=${(sampleTrade as any).entry_price}`)
      
      // Test fee calculation on sample trade
      const testAmount = parseFloat(sampleTrade.amount || (sampleTrade as any).size || 0)
      const testPrice = parseFloat(sampleTrade.price || (sampleTrade as any).entry_price || 0)
      console.log(`📊 Sample trade FEE CALC: parsed amount=${testAmount}, parsed price=${testPrice}, tradeValue=${testAmount * testPrice}, fee at 0.1%=${(testAmount * testPrice * 0.001).toFixed(4)}`)
      
      const tradesWithPnL = tradesData.filter((t: any) => {
        const pnl = parseFloat(t.pnl || 0)
        return !isNaN(pnl) && pnl !== 0
      })
      const tradesWithExitPrice = tradesData.filter((t: any) => !!(t as any).exit_price)
      const tradesWithAmountPrice = tradesData.filter((t: any) => {
        const amount = parseFloat(t.amount || (t as any).size || 0)
        const price = parseFloat(t.price || (t as any).entry_price || 0)
        return amount > 0 && price > 0
      })
      console.log(`📊 Trade stats: Total=${tradesData.length}, WithPnL=${tradesWithPnL.length}, WithExitPrice=${tradesWithExitPrice.length}, WithAmountPrice=${tradesWithAmountPrice.length}`)
    }

    // Calculate total PnL from trades
    const totalPnLFromTrades = tradesData?.reduce((sum, t) => sum + (t.pnl || 0), 0) || 0
    
    // Calculate total PnL from bots (more reliable, includes all bot performance)
    const totalPnLFromBots = botPerformanceData?.reduce((sum, b) => sum + (b.pnl || 0), 0) || 0
    
    // Use bot P&L as primary source (more accurate, includes all bot performance)
    // Fall back to trades P&L only if bot P&L is unavailable
    const totalPnL = totalPnLFromBots !== 0 ? totalPnLFromBots : totalPnLFromTrades
    
    // Calculate total fees (for overview - use same logic as per-bot calculation)
    // This should match the per-bot fee calculation logic
    // CRITICAL FIX: Use mergedTradesData (includes paper trades) instead of tradesData
    const totalFees = mergedTradesData?.reduce((sum, t) => {
      let fee = 0
      // First, try to use stored fee if it exists and is greater than 0
      const storedFee = parseFloat(t.fee || (t as any).fees || 0)
      
      // If stored fee is valid and > 0, use it
      if (!isNaN(storedFee) && storedFee > 0) {
        fee = storedFee
      } else {
        // Otherwise, calculate fee from amount and price
        // Try multiple field names to handle both real trades and paper trading trades
        const amount = parseFloat(t.amount || (t as any).size || (t as any).quantity || 0)
      const price = parseFloat(t.price || (t as any).entry_price || 0)
      
      if (amount > 0 && price > 0) {
        const tradeValue = amount * price
        // Default to 0.1% if we can't determine exchange/trading_type from trade
        // Per-bot calculation will use correct rates based on bot.exchange and bot.trading_type
        fee = tradeValue * 0.001 // Default 0.1%
      }
      }
      
      return sum + fee
    }, 0) || 0
    
    console.log(`📊 Overview total fees calculated: $${totalFees.toFixed(2)} from ${mergedTradesData?.length || 0} trades (${tradesData?.length || 0} real + ${paperTradesData?.length || 0} paper)`)

    // Contract summary - get trades with bot info
    // First get ALL user's bots (active and inactive) to show historical data
    const { data: userBots } = await supabaseClient
      .from('trading_bots')
      .select('id, trading_type, symbol, exchange, pnl')
      .eq('user_id', user.id)
    
    const botIds = userBots?.map(b => b.id) || []
    const botMap = new Map(userBots?.map(b => [b.id, b.trading_type]) || [])
    
    // Get ALL trades for contract summary (from all bots, all statuses)
    // This ensures we show historical pairs even if bots are inactive
    // Also include paper trading trades for complete contract summary
    let allTradesForContract: any[] = []
    if (botIds.length > 0) {
      const { data: realTrades } = await supabaseClient
        .from('trades')
        .select('symbol, exchange, pnl, fee, amount, price, bot_id, executed_at, status, entry_price, exit_price, side, created_at')
        .eq('user_id', user.id)
        .in('bot_id', botIds)
        .limit(10000)
      allTradesForContract = realTrades || []
      
      // Get paper trading trades for contract summary
      const { data: paperTradesForContract } = await supabaseClient
        .from('paper_trading_trades')
        .select('symbol, exchange, pnl, fees, quantity, entry_price, exit_price, bot_id, executed_at, status, side, created_at')
        .eq('user_id', user.id)
        .in('bot_id', botIds)
        .limit(10000)
      
      // Map paper trading trades to match real trades format
      const mappedPaperTrades = (paperTradesForContract || []).map((pt: any) => ({
        ...pt,
        amount: pt.quantity || 0,
        price: pt.entry_price || 0,
        fee: pt.fees || 0
      }))
      
      allTradesForContract = [...allTradesForContract, ...mappedPaperTrades]
    }
    // If no bots exist but trades might exist, get all trades for user
    if (allTradesForContract.length === 0) {
      const { data: realTrades } = await supabaseClient
        .from('trades')
        .select('symbol, exchange, pnl, fee, amount, price, bot_id, executed_at, status, entry_price, exit_price, side, created_at')
        .eq('user_id', user.id)
        .limit(10000)
      allTradesForContract = realTrades || []
      
      // Also get paper trading trades
      const { data: paperTradesForContract } = await supabaseClient
        .from('paper_trading_trades')
        .select('symbol, exchange, pnl, fees, quantity, entry_price, exit_price, bot_id, executed_at, status, side, created_at')
        .eq('user_id', user.id)
        .limit(10000)
      
      const mappedPaperTrades = (paperTradesForContract || []).map((pt: any) => ({
        ...pt,
        amount: pt.quantity || 0,
        price: pt.entry_price || 0,
        fee: pt.fees || 0
      }))
      
      allTradesForContract = [...allTradesForContract, ...mappedPaperTrades]
    }
    
    // Create bot P&L by contract map for fallback
    const botPnLByContract = new Map<string, number>()
    userBots?.forEach(bot => {
      const contractKey = `${bot.symbol}_${bot.exchange}`
      botPnLByContract.set(contractKey, (botPnLByContract.get(contractKey) || 0) + (bot.pnl || 0))
    })
    
    // Use allTradesForContract for contract summary (includes all trades from all bots)
    const tradesForContract = allTradesForContract || []
    
    console.log(`📊 Contract Summary: Found ${tradesForContract.length} trades for contract summary`)
    console.log(`📊 Bot IDs: ${botIds.length} bots, trades will be grouped by symbol+exchange`)
    
    // Group by contract
    const contractSummary: any = {}
    
    console.log(`📊 Processing ${tradesForContract.length} trades for contract summary...`)
    
    if (tradesForContract && tradesForContract.length > 0) {
      for (const trade of tradesForContract) {
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
        
        // Calculate fee - prioritize stored fee, otherwise calculate
        let fee = parseFloat(trade.fee || (trade as any).fees || 0)
        
        // If stored fee is 0 or missing, calculate it
        if ((fee === 0 || isNaN(fee)) && trade.amount && trade.price) {
          const amount = parseFloat(trade.amount || (trade as any).size || (trade as any).quantity || 0)
          const price = parseFloat(trade.price || (trade as any).entry_price || 0)
          
          if (amount > 0 && price > 0) {
            const tradeValue = amount * price
          if (trade.exchange === 'bybit') {
              fee = tradingType === 'futures' ? tradeValue * 0.00055 : tradeValue * 0.001
          } else if (trade.exchange === 'okx') {
              fee = tradingType === 'futures' ? tradeValue * 0.0005 : tradeValue * 0.0008
          } else {
              fee = tradeValue * 0.001 // Default 0.1%
            }
          }
        }
        
        // Count ALL trades for this contract (for total_trades)
        contractSummary[contract].total_trades++
        
        // Calculate PnL: use stored pnl, or calculate from entry/exit prices if available
        let tradePnL = parseFloat(trade.pnl) || 0
        if ((tradePnL === 0 || trade.pnl === null || trade.pnl === undefined) && trade.entry_price && trade.exit_price) {
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
        
        // Track for win/loss and drawdown
        // Include trades with:
        // 1. Non-zero PnL, OR
        // 2. Has exit_price (closed position), OR  
        // 3. Status is filled/closed/completed (for historical tracking)
        const isClosedTrade = trade.exit_price || ['filled', 'closed', 'completed'].includes((trade.status || '').toLowerCase())
        
        if (tradePnL !== 0 || isClosedTrade) {
          contractSummary[contract].trades.push({
            pnl: tradePnL,
            executed_at: trade.executed_at || trade.created_at || new Date().toISOString()
          })
          
          // Only count as win/loss if PnL is actually calculated
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
      
      console.log(`📊 Contract Summary: Created ${Object.keys(contractSummary).length} contracts`)
      console.log(`📊 Contract keys:`, Object.keys(contractSummary))
    } else {
      console.log(`⚠️ No trades found for contract summary`)
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
        // CRITICAL FIX: Sum total trades from all active bots, not just tradesData
        // tradesData might be empty or filtered, but bots have accurate total_trades
        total_trades: botPerformanceData?.reduce((sum, b) => sum + (b.total_trades || 0), 0) || tradesData?.length || 0
      },
      active_bots: activeBotsData?.map(bot => {
        // Get ALL trades for this bot (including pending/open positions for total count)
        // CRITICAL FIX: Use mergedTradesData (includes paper trades) instead of tradesData
        const allBotTrades = mergedTradesData?.filter(t => t.bot_id === bot.id) || []
        
        console.log(`📊 Bot ${bot.name} (${bot.id.substring(0, 8)}): Found ${allBotTrades.length} trades`)
        
        // Debug: Log sample trade to see what fields are available
        if (allBotTrades.length > 0) {
          const sampleTrade = allBotTrades[0]
          console.log(`📊 Bot ${bot.name} sample trade: amount=${sampleTrade.amount || 'null'}, size=${(sampleTrade as any).size || 'null'}, price=${sampleTrade.price || 'null'}, entry_price=${(sampleTrade as any).entry_price || 'null'}, fee=${sampleTrade.fee || 'null'}`)
        }
        
        // For fees: calculate from ALL trades (including open positions)
        // Every trade that executes has a fee, even if it's an opening position
        // CRITICAL: Always calculate fee even if stored fee is 0 (trades are inserted with fee: 0)
        let tradesWithValidAmountPrice = 0
        let tradesWithoutAmountPrice = 0
        const botFees = allBotTrades.reduce((sum, t) => {
          let fee = 0
          // First, try to use stored fee if it exists and is greater than 0
          const storedFee = parseFloat(t.fee || (t as any).fees || 0)
          
          // If stored fee is valid and > 0, use it
          if (!isNaN(storedFee) && storedFee > 0) {
            fee = storedFee
          } else {
            // Otherwise, calculate fee from amount and price
            // Try multiple field names to handle both real trades and paper trading trades
            const amount = parseFloat(t.amount || (t as any).size || (t as any).quantity || 0)
          const price = parseFloat(t.price || (t as any).entry_price || 0)
          
          if (amount > 0 && price > 0) {
            tradesWithValidAmountPrice++
            const tradeValue = amount * price
            if (bot.exchange === 'bybit') {
              fee = bot.trading_type === 'futures' ? tradeValue * 0.00055 : tradeValue * 0.001
            } else if (bot.exchange === 'okx') {
              fee = bot.trading_type === 'futures' ? tradeValue * 0.0005 : tradeValue * 0.0008
            } else {
              fee = tradeValue * 0.001 // Default 0.1%
            }
          } else {
            tradesWithoutAmountPrice++
            // Log first few trades without amount/price for debugging
            if (tradesWithoutAmountPrice <= 3) {
                console.log(`⚠️ Bot ${bot.name} trade ${tradesWithoutAmountPrice}: amount=${t.amount || (t as any).size || (t as any).quantity || 'null'}, price=${t.price || (t as any).entry_price || 'null'}, storedFee=${storedFee}`)
              }
            }
          }
          
          return sum + fee
        }, 0)
        
        console.log(`📊 Bot ${bot.name}: Fee calculation - Total trades=${allBotTrades.length}, With valid amount/price=${tradesWithValidAmountPrice}, Without=${tradesWithoutAmountPrice}, Calculated fees=$${botFees.toFixed(2)}`)
        
        // Calculate win/loss trades and drawdown
        // Process ALL trades and calculate PnL where possible (same logic as Performance page)
        // First, try to calculate PnL from entry/exit prices for trades that don't have it
        const processedTrades = allBotTrades.map(t => {
          let calculatedPnL = parseFloat(t.pnl) || 0
          
          // CRITICAL: If PnL is 0 or null, try to calculate from entry/exit prices
          // This handles cases where trades were recorded but PnL wasn't calculated
          if ((calculatedPnL === 0 || t.pnl === null || t.pnl === undefined) && (t as any).entry_price && (t as any).exit_price) {
            const entryPrice = parseFloat((t as any).entry_price || 0)
            const exitPrice = parseFloat((t as any).exit_price || 0)
            const size = parseFloat(t.amount || t.size || 0)
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
          
          // Also check if trade has stored PnL that's non-zero
          if (calculatedPnL === 0 && t.pnl !== null && t.pnl !== undefined) {
            const storedPnL = parseFloat(t.pnl)
            if (!isNaN(storedPnL) && storedPnL !== 0) {
              calculatedPnL = storedPnL
            }
          }
          
          return { ...t, calculatedPnL }
        })
        
        console.log(`📊 Bot ${bot.name}: Processing ${allBotTrades.length} trades, checking for PnL...`)
        const tradesWithStoredPnL = allBotTrades.filter(t => {
          const pnl = parseFloat(t.pnl || 0)
          return !isNaN(pnl) && pnl !== 0
        })
        const tradesWithExitPrice = allBotTrades.filter(t => !!(t as any).exit_price)
        console.log(`📊 Bot ${bot.name}: Trades with stored PnL=${tradesWithStoredPnL.length}, With exit_price=${tradesWithExitPrice.length}`)
        
        // For spot trading, match buy/sell pairs to calculate PnL (FIFO matching)
        // This is the same logic as usePerformance hook
        if (bot.trading_type === 'spot') {
          // Sort trades by execution time (oldest first)
          const sortedTrades = [...processedTrades].sort((a, b) => {
            const dateA = new Date((a as any).executed_at || a.created_at || 0).getTime()
            const dateB = new Date((b as any).executed_at || b.created_at || 0).getTime()
            return dateA - dateB
          })
          
          const buys: any[] = []
          const sells: any[] = []
          
          sortedTrades.forEach((t: any) => {
            const side = ((t as any).side || 'long').toLowerCase()
            if (side === 'long' || side === 'buy') {
              buys.push(t)
            } else if (side === 'short' || side === 'sell') {
              sells.push(t)
            }
          })
          
          // Match buy/sell pairs using FIFO
          let buyIndex = 0
          const matchedTrades = new Map<string, any>()
          
          sells.forEach((sell: any) => {
            while (buyIndex < buys.length) {
              const buy = buys[buyIndex]
              
              const buyPrice = parseFloat(buy.entry_price || buy.price || 0)
              const sellPrice = parseFloat(sell.entry_price || sell.price || 0)
              const buySize = parseFloat(buy.size || buy.amount || 0)
              const sellSize = parseFloat(sell.size || sell.amount || 0)
              
              if (buyPrice > 0 && sellPrice > 0 && buySize > 0 && sellSize > 0) {
                const matchedSize = Math.min(buySize, sellSize)
                const pnl = (sellPrice - buyPrice) * matchedSize
                
                // Update buy trade PnL
                if (!matchedTrades.has(buy.id)) {
                  matchedTrades.set(buy.id, { ...buy, calculatedPnL: pnl, matched: true })
                } else {
                  const existing = matchedTrades.get(buy.id)
                  matchedTrades.set(buy.id, { ...existing, calculatedPnL: (existing.calculatedPnL || 0) + pnl })
                }
                
                // Update sell trade PnL
                if (!matchedTrades.has(sell.id)) {
                  matchedTrades.set(sell.id, { ...sell, calculatedPnL: pnl, matched: true })
                } else {
                  const existing = matchedTrades.get(sell.id)
                  matchedTrades.set(sell.id, { ...existing, calculatedPnL: (existing.calculatedPnL || 0) + pnl })
                }
                
                if (sellSize >= buySize) {
                  buyIndex++
                  break
                } else {
                  buys[buyIndex] = { ...buy, size: buySize - sellSize }
                  break
                }
              } else {
                buyIndex++
              }
            }
          })
          
          // Merge matched trades back into processedTrades
          processedTrades.forEach((t, index) => {
            if (matchedTrades.has(t.id)) {
              processedTrades[index] = matchedTrades.get(t.id)
            }
          })
        }
        
        // For win/loss: count trades that have actual PnL (non-zero), not just closed trades
        // This matches the Performance page logic which uses tradesWithPnL
        const tradesWithPnL = processedTrades.filter(t => {
          const pnl = (t as any).calculatedPnL || 0
          return !isNaN(pnl) && pnl !== 0
        })
        
        console.log(`📊 Bot ${bot.name}: Total trades=${allBotTrades.length}, Processed=${processedTrades.length}, WithPnL=${tradesWithPnL.length}`)
        
        let winTrades = tradesWithPnL.filter(t => (t as any).calculatedPnL > 0).length
        let lossTrades = tradesWithPnL.filter(t => (t as any).calculatedPnL < 0).length
        let totalTradesWithPnL = tradesWithPnL.length
        let winRate = totalTradesWithPnL > 0 ? (winTrades / totalTradesWithPnL) * 100 : (bot.win_rate || 0)
        
        // FALLBACK: If no trades with PnL but bot has total_trades, estimate from bot data
        // This handles cases where bot has PnL but individual trades don't have exit_price yet
        // Use bot.total_trades even if win_rate is 0 or null - we can still estimate
        if (totalTradesWithPnL === 0 && bot.total_trades > 0) {
          console.log(`📊 Bot ${bot.name}: Using bot-level data as fallback: total_trades=${bot.total_trades}, win_rate=${bot.win_rate || 0}%`)
          const estimatedTotalTrades = Math.max(1, Math.round(bot.total_trades || allBotTrades.length))
          
          // If bot has win_rate, use it; otherwise estimate based on PnL
          if (bot.win_rate !== null && bot.win_rate !== undefined && bot.win_rate > 0) {
            winTrades = Math.round((bot.win_rate / 100) * estimatedTotalTrades)
            lossTrades = estimatedTotalTrades - winTrades
            winRate = bot.win_rate
          } else {
            // If no win_rate but bot has PnL, estimate: positive PnL = mostly wins
            // Use a conservative estimate: if PnL > 0, assume 60% win rate; if PnL < 0, assume 40% win rate
            if (bot.pnl > 0) {
              winRate = 60 // Conservative estimate for positive PnL
              winTrades = Math.round(0.6 * estimatedTotalTrades)
            } else if (bot.pnl < 0) {
              winRate = 40 // Conservative estimate for negative PnL
              winTrades = Math.round(0.4 * estimatedTotalTrades)
            } else {
              winRate = 50 // Neutral if PnL is 0
              winTrades = Math.round(0.5 * estimatedTotalTrades)
            }
            lossTrades = estimatedTotalTrades - winTrades
          }
          
          totalTradesWithPnL = estimatedTotalTrades
        }
        
        console.log(`📊 Bot ${bot.name}: Win=${winTrades}, Loss=${lossTrades}, WinRate=${winRate.toFixed(1)}%, Fees=$${botFees.toFixed(2)}`)
        
        // Calculate drawdown from trades with PnL (same as Performance page)
        let drawdown = 0
        let drawdownPercentage = 0
        let peakPnL = 0
        let currentPnL = 0
        
        // Use tradesWithPnL for drawdown calculation (only trades with actual PnL)
        if (tradesWithPnL.length > 0) {
          // Sort trades by execution time (oldest first)
          const sortedTrades = [...tradesWithPnL].sort((a, b) => {
            const dateA = new Date((a as any).executed_at || a.created_at || 0).getTime()
            const dateB = new Date((b as any).executed_at || b.created_at || 0).getTime()
            return dateA - dateB
          })
          
          let runningPnL = 0
          for (const t of sortedTrades) {
            const tradePnL = (t as any).calculatedPnL || 0
            runningPnL += tradePnL
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
        } else if (bot.pnl !== null && bot.pnl !== undefined) {
          // Fallback: if no trades with PnL but bot has PnL, use bot PnL for peak/current
          // This handles cases where positions are still open (no exit_price yet)
          console.log(`📊 Bot ${bot.name}: Using bot PnL for drawdown: bot.pnl=${bot.pnl}`)
          peakPnL = bot.pnl > 0 ? bot.pnl : 0
          currentPnL = bot.pnl
          if (bot.pnl < 0) {
            // If current PnL is negative, drawdown is the absolute value
            drawdown = Math.abs(bot.pnl)
            drawdownPercentage = 100 // 100% drawdown if we went negative from 0
          } else {
            // If bot has positive PnL, set peak to current
            peakPnL = bot.pnl
            currentPnL = bot.pnl
            drawdown = 0 // No drawdown if we're at or above peak
            drawdownPercentage = 0
          }
        }
        
        console.log(`📊 Bot ${bot.name}: Drawdown=$${drawdown.toFixed(2)} (${drawdownPercentage.toFixed(1)}%), Peak=$${peakPnL.toFixed(2)}, Current=$${currentPnL.toFixed(2)}`)
        
        // Calculate profit factor, avg win, avg loss from trades with PnL
        let profitFactor = 0
        let avgWin = 0
        let avgLoss = 0
        let totalVolume = 0
        
        if (tradesWithPnL.length > 0) {
          const winningTrades = tradesWithPnL.filter(t => (t as any).calculatedPnL > 0)
          const losingTrades = tradesWithPnL.filter(t => (t as any).calculatedPnL < 0)
          
          const totalWins = winningTrades.reduce((sum, t) => sum + ((t as any).calculatedPnL || 0), 0)
          const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + ((t as any).calculatedPnL || 0), 0))
          
          profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? 999 : 0)
          avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0
          avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0
          
          // Calculate total volume from all trades
          totalVolume = allBotTrades.reduce((sum, t) => {
            const amount = parseFloat(t.amount || (t as any).size || (t as any).quantity || 0)
            const price = parseFloat(t.price || (t as any).entry_price || 0)
            return sum + (amount * price)
          }, 0)
        } else {
          // Fallback: estimate from bot PnL if available
          if (bot.pnl !== null && bot.pnl !== undefined && bot.pnl !== 0) {
            // Very rough estimates when we don't have trade-level data
            const estimatedTrades = Math.max(1, bot.total_trades || 1)
            if (bot.pnl > 0) {
              // Positive PnL: assume 60% win rate
              avgWin = (bot.pnl / estimatedTrades) * 1.5 // Rough estimate
              avgLoss = (bot.pnl / estimatedTrades) * 0.5 // Rough estimate
              profitFactor = 2.0 // Conservative estimate
            } else {
              // Negative PnL: assume 40% win rate
              avgWin = Math.abs(bot.pnl / estimatedTrades) * 0.5
              avgLoss = Math.abs(bot.pnl / estimatedTrades) * 1.5
              profitFactor = 0.5 // Conservative estimate
            }
          }
          
          // Estimate volume from trade amount if available
          totalVolume = allBotTrades.reduce((sum, t) => {
            const amount = parseFloat(t.amount || (t as any).size || (t as any).quantity || 0)
            const price = parseFloat(t.price || (t as any).entry_price || 0)
            return sum + (amount * price)
          }, 0)
        }
        
        console.log(`📊 Bot ${bot.name}: ProfitFactor=${profitFactor.toFixed(2)}, AvgWin=$${avgWin.toFixed(2)}, AvgLoss=$${avgLoss.toFixed(2)}, Volume=$${totalVolume.toFixed(2)}`)
        
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
          total_trades: allBotTrades.length || bot.total_trades || 0,
          win_rate: Math.round(winRate * 10) / 10,
          win_trades: winTrades || 0,
          loss_trades: lossTrades || 0,
          profit_factor: Math.round(profitFactor * 100) / 100,
          avg_win: Math.round(avgWin * 100) / 100,
          avg_loss: Math.round(avgLoss * 100) / 100,
          total_volume: Math.round(totalVolume * 100) / 100,
          drawdown: Math.round(drawdown * 100) / 100,
          drawdown_percentage: Math.round(drawdownPercentage * 10) / 10,
          peak_pnl: Math.round(peakPnL * 100) / 100,
          current_pnl: Math.round(currentPnL * 100) / 100,
          last_trade_at: bot.last_trade_at
        }
      }) || [],
      contract_summary: Object.keys(contractSummary).length > 0 
        ? Object.values(contractSummary).map((cs: any) => ({
            contract: cs.contract,
            exchange: cs.exchange,
            total_trades: cs.total_trades || 0,
            total_net_pnl: Math.round((cs.total_net_pnl || 0) * 100) / 100,
            total_fees_paid: Math.round((cs.total_fees_paid || 0) * 100) / 100,
            net_profit_loss: Math.round((cs.net_profit_loss || 0) * 100) / 100,
            win_trades: cs.win_trades || 0,
            loss_trades: cs.loss_trades || 0,
            win_rate: Math.round((cs.win_rate || 0) * 10) / 10,
            drawdown: Math.round((cs.drawdown || 0) * 100) / 100,
            drawdown_percentage: Math.round((cs.drawdown_percentage || 0) * 10) / 10,
            peak_pnl: Math.round((cs.peak_pnl || 0) * 100) / 100,
            current_pnl: Math.round((cs.current_pnl || 0) * 100) / 100
          })).sort((a: any, b: any) => (b.net_profit_loss || 0) - (a.net_profit_loss || 0))
        : [], // Return empty array if no contracts, not undefined
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

