/**
 * Auto-Optimize Edge Function
 * Runs scheduled optimizations for all active bots with AI/ML enabled
 * Should be triggered via cron job or scheduled task
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OptimizationRequest {
  botId?: string;
  userId?: string;
  minConfidence?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get request body
    let body: OptimizationRequest = {};
    try {
      body = await req.json()
    } catch {
      // No body, that's okay for scheduled runs
    }

    // Import auto-optimizer logic (simplified version for Edge Function)
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ 
        error: 'OpenAI API key not configured',
        message: 'Set OPENAI_API_KEY environment variable'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch active bots with AI/ML enabled
    let query = supabaseClient
      .from('trading_bots')
      .select('id, user_id, name, strategy, strategy_config, ai_ml_enabled')
      .eq('status', 'running')
      .eq('ai_ml_enabled', true)

    if (body.botId) {
      query = query.eq('id', body.botId)
    }

    if (body.userId) {
      query = query.eq('user_id', body.userId)
    }

    const { data: bots, error: botsError } = await query

    if (botsError) {
      throw botsError
    }

    if (!bots || bots.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No active bots with AI/ML enabled',
        optimized: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const results = []
    const minConfidence = body.minConfidence || 0.7

    // Optimize each bot
    for (const bot of bots) {
      try {
        // Fetch recent trades (last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: trades, error: tradesError } = await supabaseClient
          .from('trades')
          .select('*')
          .eq('bot_id', bot.id)
          .gte('timestamp', thirtyDaysAgo.toISOString())
          .order('timestamp', { ascending: false })
          .limit(50)

        if (tradesError || !trades || trades.length < 10) {
          results.push({
            botId: bot.id,
            botName: bot.name,
            status: 'skipped',
            reason: `Insufficient trades (${trades?.length || 0})`
          })
          continue
        }

        // Calculate performance metrics
        const closedTrades = trades.filter(t => t.status === 'closed' && t.pnl !== null)
        const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0)
        const winRate = closedTrades.length > 0 
          ? (winningTrades.length / closedTrades.length) * 100 
          : 0

        const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
        const avgWinPnL = winningTrades.length > 0
          ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length
          : 0

        const losingTrades = closedTrades.filter(t => (t.pnl || 0) <= 0)
        const avgLossPnL = losingTrades.length > 0
          ? losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0) / losingTrades.length
          : 0

        const profitFactor = avgLossPnL !== 0 ? Math.abs(avgWinPnL / avgLossPnL) : 0

        // Call OpenAI for optimization
        const optimizationPrompt = `
You are a professional trading strategy optimizer. Optimize this trading bot's strategy.

Current Strategy:
${JSON.stringify(bot.strategy, null, 2)}

${bot.strategy_config ? `Advanced Config:
${JSON.stringify(bot.strategy_config, null, 2)}` : ''}

Performance Metrics:
- Win Rate: ${winRate}%
- Total PnL: $${totalPnL.toFixed(2)}
- Avg Win: $${avgWinPnL.toFixed(2)}
- Avg Loss: $${avgLossPnL.toFixed(2)}
- Profit Factor: ${profitFactor.toFixed(2)}

Recent Trades: ${closedTrades.length} closed trades

Provide optimized parameters as JSON with confidence score:
{
  "strategy": { optimized basic strategy parameters },
  ${bot.strategy_config ? '"advancedConfig": { optimized advanced config },' : ''}
  "reasoning": "Why these changes",
  "expectedImprovement": "Expected improvement",
  "confidence": number (0-1)
}
`

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { 
                role: 'system', 
                content: 'You are a professional trading strategist. Provide JSON responses only.' 
              },
              { role: 'user', content: optimizationPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 2000
          })
        })

        if (!openaiResponse.ok) {
          results.push({
            botId: bot.id,
            botName: bot.name,
            status: 'error',
            reason: `OpenAI API error: ${openaiResponse.status}`
          })
          continue
        }

        const openaiData = await openaiResponse.json()
        const optimization = JSON.parse(openaiData.choices[0].message.content)

        if (optimization.confidence < minConfidence) {
          results.push({
            botId: bot.id,
            botName: bot.name,
            status: 'skipped',
            reason: `Low confidence: ${optimization.confidence} < ${minConfidence}`,
            confidence: optimization.confidence
          })
          continue
        }

        // Record optimization
        const { error: recordError } = await supabaseClient
          .from('strategy_optimizations')
          .insert({
            bot_id: bot.id,
            original_strategy: bot.strategy,
            suggested_changes: {
              strategy: optimization.strategy,
              advancedConfig: optimization.advancedConfig
            },
            reasoning: optimization.reasoning,
            expected_improvement: parseFloat((optimization.expectedImprovement || '0').replace(/[^0-9.-]/g, '')) || 0,
            performance_before: {
              winRate,
              totalPnL,
              profitFactor
            },
            status: 'applied'
          })

        if (recordError) {
          console.error('Error recording optimization:', recordError)
        }

        // Apply optimization
        const { error: updateError } = await supabaseClient
          .from('trading_bots')
          .update({
            strategy: optimization.strategy,
            strategy_config: optimization.advancedConfig || bot.strategy_config,
            updated_at: new Date().toISOString()
          })
          .eq('id', bot.id)

        if (updateError) {
          results.push({
            botId: bot.id,
            botName: bot.name,
            status: 'error',
            reason: `Failed to apply: ${updateError.message}`
          })
          continue
        }

        results.push({
          botId: bot.id,
          botName: bot.name,
          status: 'optimized',
          confidence: optimization.confidence,
          changes: Object.keys(optimization.strategy || {}).length
        })

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        results.push({
          botId: bot.id,
          botName: bot.name,
          status: 'error',
          reason: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const optimizedCount = results.filter(r => r.status === 'optimized').length

    return new Response(JSON.stringify({
      message: `Optimization complete for ${bots.length} bots`,
      optimized: optimizedCount,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Auto-optimize error:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

