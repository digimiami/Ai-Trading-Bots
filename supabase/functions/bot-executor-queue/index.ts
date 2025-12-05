// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔄 === BOT EXECUTOR QUEUE STARTED ===')
    console.log(`📅 Timestamp: ${new Date().toISOString()}`)

    // Get next batch of bots to execute (prioritize by next_execution_at or updated_at)
    // Only select bots where next_execution_at is NULL or has passed
    const BOTS_PER_BATCH = 5 // Process 5 bots per queue execution
    const now = new Date().toISOString()
    const { data: bots, error: botsError } = await supabaseClient
      .from('trading_bots')
      .select('id, user_id, name, status, next_execution_at, updated_at')
      .eq('status', 'running')
      .or('webhook_only.is.null,webhook_only.eq.false')
      .or(`next_execution_at.is.null,next_execution_at.lte.${now}`)
      .order('next_execution_at', { ascending: true, nullsFirst: true })
      .order('updated_at', { ascending: true })
      .limit(BOTS_PER_BATCH)

    if (botsError) {
      console.error('❌ Error fetching bots:', botsError)
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to fetch bots',
        details: botsError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!bots || bots.length === 0) {
      console.log('ℹ️ No bots to process')
      return new Response(JSON.stringify({
        success: true,
        message: 'No bots to process',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`📊 Found ${bots.length} bots to process`)

    // Update next_execution_at for processed bots (set to 30 seconds from now)
    const nextExecutionTime = new Date(Date.now() + 30000).toISOString()
    const botIds = bots.map(b => b.id)
    await supabaseClient
      .from('trading_bots')
      .update({ next_execution_at: nextExecutionTime })
      .in('id', botIds)

    // Trigger individual bot executions via bot-executor
    const results = []
    const botExecutorUrl = `${supabaseUrl}/functions/v1/bot-executor`

    for (const bot of bots) {
      try {
        console.log(`🚀 Triggering execution for bot ${bot.id} (${bot.name})`)
        
        const response = await fetch(botExecutorUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({
            action: 'execute_all_bots',
            botId: bot.id // Single bot execution mode
          })
        })

        const responseData = await response.json().catch(() => ({}))
        const success = response.ok && responseData.success !== false

        results.push({
          botId: bot.id,
          botName: bot.name,
          success,
          error: success ? null : (responseData.error || responseData.message || 'Unknown error'),
          statusCode: response.status
        })

        if (success) {
          console.log(`✅ Bot ${bot.id} execution triggered successfully`)
        } else {
          console.error(`❌ Bot ${bot.id} execution failed:`, responseData.error || responseData.message)
        }
      } catch (error: any) {
        console.error(`❌ Error triggering bot ${bot.id}:`, error)
        results.push({
          botId: bot.id,
          botName: bot.name,
          success: false,
          error: error.message || 'Failed to trigger execution',
          statusCode: 500
        })
      }
    }

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`\n📊 === QUEUE SUMMARY ===`)
    console.log(`✅ Successful: ${successful}`)
    console.log(`❌ Failed: ${failed}`)

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${bots.length} bots`,
      processed: bots.length,
      successful,
      failed,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Queue execution error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Queue execution failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})



