/**
 * Auto-Optimize Edge Function
 * Runs scheduled optimizations for all active bots with AI/ML enabled
 * Should be triggered via cron job or scheduled task
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
    // Support cron authentication (optional)
    const cronSecretHeader = req.headers.get('x-cron-secret') ?? ''
    const isCron = !!cronSecretHeader && cronSecretHeader === (Deno.env.get('CRON_SECRET') ?? '')
    
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

    // ============================================================
    // GET DEEPSEEK API KEY FROM EDGE FUNCTION SECRETS
    // ============================================================
    // This reads the secret that was set in Supabase Dashboard:
    // Project Settings → Edge Functions → Secrets
    // 
    // Secret Name: DEEPSEEK_API_KEY (exact, case-sensitive)
    // Secret Value: sk-your-actual-deepseek-api-key-here
    //
    // Edge Functions automatically inject secrets as environment variables
    // accessible via Deno.env.get(). No manual configuration needed!
    // ============================================================
    const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY')
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') // Fallback to OpenAI if DeepSeek not available
    
    const AI_API_KEY = DEEPSEEK_API_KEY || OPENAI_API_KEY
    const AI_PROVIDER = DEEPSEEK_API_KEY ? 'DeepSeek' : 'OpenAI'
    const AI_BASE_URL = DEEPSEEK_API_KEY 
      ? 'https://api.deepseek.com/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions'
    const AI_MODEL = DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o'
    
    if (!AI_API_KEY) {
      return new Response(JSON.stringify({ 
        error: 'AI API key not configured',
        message: 'Please set DEEPSEEK_API_KEY or OPENAI_API_KEY in Supabase Edge Function Secrets',
        instructions: [
          '1. Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets',
          '2. Click "Add new secret"',
          '3. Name: DEEPSEEK_API_KEY (preferred) or OPENAI_API_KEY',
          '4. Value: sk-your-actual-api-key-here',
          '5. Click "Save"',
          '6. The function will automatically use the secret after deployment'
        ]
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    console.log(`🤖 Using ${AI_PROVIDER} API for optimization`)

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
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false })
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

        console.log(`🤖 Calling ${AI_PROVIDER} API for bot ${bot.id} (${bot.name})`)
        const startTime = Date.now()
        
        const aiResponse = await fetch(AI_BASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_API_KEY}`
          },
          body: JSON.stringify({
            model: AI_MODEL,
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

        const apiCallDuration = Date.now() - startTime

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text()
          console.error(`❌ ${AI_PROVIDER} API error for bot ${bot.id}:`, aiResponse.status, errorText)
          
          // Log error to bot activity logs
          await supabaseClient
            .from('bot_activity_logs')
            .insert({
              bot_id: bot.id,
              level: 'error',
              category: 'strategy',
              message: `AI Optimization Failed: ${AI_PROVIDER} API error (${aiResponse.status})`,
              details: {
                type: 'ai_ml_optimization_error',
                provider: AI_PROVIDER,
                error: errorText.substring(0, 500),
                status: aiResponse.status
              },
              timestamp: new Date().toISOString()
            })
          
          results.push({
            botId: bot.id,
            botName: bot.name,
            status: 'error',
            reason: `${AI_PROVIDER} API error: ${aiResponse.status}`
          })
          continue
        }

        const aiData = await aiResponse.json()
        const optimization = JSON.parse(aiData.choices[0].message.content)
        
        console.log(`✅ ${AI_PROVIDER} API response received for bot ${bot.id} (${apiCallDuration}ms)`)

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

        // Record optimization with comprehensive logging
        // Store AI metadata in performance_before JSONB (works even if columns don't exist yet)
        const optimizationRecord: any = {
          bot_id: bot.id,
          original_strategy: bot.strategy,
          suggested_changes: {
            strategy: optimization.strategy,
            advancedConfig: optimization.advancedConfig
          },
          reasoning: optimization.reasoning,
          expected_improvement: Math.min(999.99, Math.max(-999.99, parseFloat((optimization.expectedImprovement || '0').replace(/[^0-9.-]/g, '')) || 0)),
          performance_before: {
            winRate,
            totalPnL,
            profitFactor,
            avgWinPnL,
            avgLossPnL,
            closedTrades: closedTrades.length,
            timestamp: new Date().toISOString(),
            // Store AI metadata in performance_before JSONB as backup
            ai_provider: AI_PROVIDER,
            ai_model: AI_MODEL,
            api_call_duration_ms: apiCallDuration,
            confidence: optimization.confidence
          },
          status: 'applied',
          applied_at: new Date().toISOString()
        }
        
        // Try to add dedicated columns if they exist (after migration)
        // These will be ignored if columns don't exist, so AI info is still in performance_before JSONB
        try {
          optimizationRecord.ai_provider = AI_PROVIDER
          optimizationRecord.ai_model = AI_MODEL
          optimizationRecord.api_call_duration_ms = apiCallDuration
          optimizationRecord.confidence = optimization.confidence
        } catch (e) {
          // Columns don't exist yet, that's okay - data is in performance_before JSONB
          console.log('Note: AI metadata columns not found, storing in performance_before JSONB')
        }
        
        const { data: optimizationData, error: recordError } = await supabaseClient
          .from('strategy_optimizations')
          .insert(optimizationRecord)
          .select()
          .single()

        if (recordError) {
          console.error('❌ Error recording optimization:', recordError)
        } else {
          console.log(`✅ Optimization record created: ${optimizationData?.id}`)
        }

        // Validate and clamp advanced config values before applying
        let validatedAdvancedConfig = optimization.advancedConfig || bot.strategy_config;
        if (validatedAdvancedConfig && typeof validatedAdvancedConfig === 'object') {
          // Clamp critical values to valid ranges
          const config: any = { ...validatedAdvancedConfig };
          
          // Clamp adx_min_htf to 15-35
          if (config.adx_min_htf !== undefined) {
            config.adx_min_htf = Math.max(15, Math.min(35, config.adx_min_htf));
          }
          
          // Clamp risk_per_trade_pct to 0.1-5.0
          if (config.risk_per_trade_pct !== undefined) {
            config.risk_per_trade_pct = Math.max(0.1, Math.min(5.0, config.risk_per_trade_pct));
          }
          
          // Validate enum values
          if (config.bias_mode && !['long-only', 'short-only', 'both', 'auto'].includes(config.bias_mode)) {
            config.bias_mode = 'auto';
          }
          if (
            config.htf_timeframe &&
            !['15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '1w'].includes(config.htf_timeframe)
          ) {
            config.htf_timeframe = '4h';
          }
          if (config.regime_mode && !['trend', 'mean-reversion', 'auto'].includes(config.regime_mode)) {
            config.regime_mode = 'auto';
          }
          
          validatedAdvancedConfig = config;
        }

        // Apply optimization
        const { error: updateError } = await supabaseClient
          .from('trading_bots')
          .update({
            strategy: optimization.strategy,
            strategy_config: validatedAdvancedConfig,
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

        // Calculate changes
        const changes: any[] = []
        const oldStrategy = bot.strategy || {}
        const newStrategy = optimization.strategy || {}
        const oldConfig = bot.strategy_config || {}
        const newConfig = optimization.advancedConfig || {}

        // Compare strategy changes
        Object.keys(newStrategy).forEach(key => {
          if (JSON.stringify(oldStrategy[key]) !== JSON.stringify(newStrategy[key])) {
            changes.push({
              parameter: `strategy.${key}`,
              oldValue: oldStrategy[key],
              newValue: newStrategy[key],
              reason: optimization.reasoning
            })
          }
        })

        // Compare advanced config changes
        Object.keys(newConfig).forEach(key => {
          if (JSON.stringify(oldConfig[key]) !== JSON.stringify(newConfig[key])) {
            changes.push({
              parameter: `advancedConfig.${key}`,
              oldValue: oldConfig[key],
              newValue: newConfig[key],
              reason: optimization.reasoning
            })
          }
        })

        // Log optimization to bot activity logs with comprehensive details
        const changeSummary = changes.map(c => 
          `${c.parameter}: ${JSON.stringify(c.oldValue)} → ${JSON.stringify(c.newValue)}`
        ).join(', ')

        const optimizationLogEntry = {
          bot_id: bot.id,
          level: 'success',
          category: 'strategy',
          message: `${AI_PROVIDER} Auto-Optimization Applied (Confidence: ${(optimization.confidence * 100).toFixed(1)}%)`,
          details: {
            type: 'ai_ml_optimization_applied',
            ai_provider: AI_PROVIDER,
            ai_model: AI_MODEL,
            optimization_id: optimizationData?.id,
            confidence: optimization.confidence,
            reasoning: optimization.reasoning,
            expectedImprovement: optimization.expectedImprovement,
            changes: changes,
            changeCount: changes.length,
            changeSummary,
            optimizedStrategy: optimization.strategy,
            optimizedAdvancedConfig: optimization.advancedConfig,
            originalStrategy: bot.strategy,
            originalAdvancedConfig: bot.strategy_config,
            performanceBefore: { 
              winRate, 
              totalPnL, 
              profitFactor,
              avgWinPnL,
              avgLossPnL,
              closedTrades: closedTrades.length,
              totalTrades: trades.length
            },
            api_call_duration_ms: apiCallDuration,
            applied_at: new Date().toISOString(),
            trigger: 'auto-pilot_mode'
          },
          timestamp: new Date().toISOString()
        }

        const { error: logError } = await supabaseClient
          .from('bot_activity_logs')
          .insert(optimizationLogEntry)

        if (logError) {
          console.error('❌ Error logging optimization:', logError)
        } else {
          console.log(`✅ Optimization logged to bot_activity_logs for bot ${bot.id}`)
        }

        results.push({
          botId: bot.id,
          botName: bot.name,
          status: 'optimized',
          confidence: optimization.confidence,
          changes: changes.length
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

