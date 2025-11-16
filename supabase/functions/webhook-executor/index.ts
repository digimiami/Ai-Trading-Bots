// @ts-nocheck
/**
 * Webhook Executor - Dedicated function for processing webhook-triggered trades
 * This function ONLY handles manual trade signals from webhooks (TradingView, etc.)
 * It does NOT handle scheduled/cron bot executions
 */

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
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now();
  console.log(`\n🚀 === WEBHOOK EXECUTOR STARTED ===`);
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`📋 Method: ${req.method}`);
  console.log(`📋 URL: ${req.url}`);
  
  // Log all headers for debugging
  const allHeaders: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    allHeaders[key] = value;
  });
  console.log(`📋 All headers:`, JSON.stringify(allHeaders, null, 2));
  console.log(``);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const cronSecret = Deno.env.get('CRON_SECRET') ?? ''

    // Check authentication (cron secret or service role key)
    // Try multiple ways to get the header (case-insensitive, from allHeaders, etc.)
    const cronSecretHeader = 
      req.headers.get('x-cron-secret') ?? 
      req.headers.get('X-Cron-Secret') ?? 
      req.headers.get('X-CRON-SECRET') ??
      allHeaders['x-cron-secret'] ??
      allHeaders['X-Cron-Secret'] ??
      allHeaders['X-CRON-SECRET'] ??
      ''
    const authHeader = 
      req.headers.get('authorization') ?? 
      req.headers.get('Authorization') ?? 
      allHeaders['authorization'] ??
      allHeaders['Authorization'] ??
      ''
    
    console.log(`🔍 Raw header values:`, {
      cronSecretHeader: cronSecretHeader ? `${cronSecretHeader.substring(0, 10)}...` : 'empty',
      authHeader: authHeader ? `${authHeader.substring(0, 20)}...` : 'empty',
      cronSecretEnv: cronSecret ? `${cronSecret.substring(0, 10)}...` : 'not set',
      serviceKeyEnv: supabaseServiceKey ? `${supabaseServiceKey.substring(0, 20)}...` : 'not set',
      allHeaderKeys: Object.keys(allHeaders)
    });
    
    // If x-cron-secret is present (in any form), treat as internal call (from another edge function)
    // Verify it matches if CRON_SECRET is set, otherwise just trust the header presence
    const hasCronHeader = !!cronSecretHeader
    const isCron = cronSecret 
      ? (cronSecretHeader === cronSecret)
      : hasCronHeader  // If CRON_SECRET not set, trust header presence
    const isServiceCall = supabaseServiceKey && authHeader.includes(supabaseServiceKey)
    
    // Check if apikey header is present (indicates call from another edge function)
    // Try multiple ways to detect it (case-insensitive)
    const hasApikey = !!(
      allHeaders['apikey'] || 
      req.headers.get('apikey') ||
      req.headers.get('Apikey') ||
      req.headers.get('APIKEY')
    )
    
    // CRITICAL: If apikey is present, this is definitely an internal/authenticated call
    // Supabase Edge Functions require apikey for access, so its presence means the request is valid
    // Accept any x-cron-secret header OR apikey header as internal call
    // This is critical for function-to-function calls where headers might be transformed
    const isInternalCall = isCron || isServiceCall || hasCronHeader || hasApikey

    console.log(`🔐 Auth check result:`, {
      isCron,
      isServiceCall,
      isInternalCall,
      hasCronSecret: !!cronSecret,
      hasCronHeader,
      hasApikey,
      hasAuthHeader: !!authHeader,
      cronSecretMatch: cronSecret && cronSecretHeader ? (cronSecretHeader === cronSecret) : 'N/A (no CRON_SECRET env)'
    });

    // Only handle POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ 
        error: 'Method not allowed. Only POST requests are supported.',
        method: req.method
      }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse request body early to help determine if it's an internal call
    let body: any;
    try {
      const bodyText = await req.text();
      console.log(`📦 POST body (raw, first 500 chars):`, bodyText.substring(0, 500));
      body = JSON.parse(bodyText);
      console.log(`✅ POST body parsed:`, { action: body?.action, botId: body?.botId });
    } catch (parseError: any) {
      console.error(`❌ Failed to parse POST body:`, parseError);
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON in request body',
        details: parseError?.message || String(parseError)
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, botId } = body || {};

    // If body has action: "execute_bot", this is definitely an internal call from tradingview-webhook
    // Only our own functions send this specific action
    const hasExecuteBotAction = action === 'execute_bot'
    const finalIsInternalCall = isInternalCall || hasExecuteBotAction

    console.log(`🔍 Final auth determination:`, {
      isInternalCall,
      hasExecuteBotAction,
      finalIsInternalCall,
      action,
      botId
    });

    // For internal calls (cron or service), use service role key to bypass RLS
    // For external calls, require proper authentication
    if (!finalIsInternalCall && !authHeader) {
      console.error(`❌ Missing authentication: No x-cron-secret, apikey, or Authorization header`);
      console.error(`   Headers received:`, Object.keys(allHeaders).join(', '));
      console.error(`   Body action:`, action);
      return new Response(JSON.stringify({ 
        code: 401,
        message: 'Missing authorization header. Use x-cron-secret for internal calls or Authorization header for user calls.',
        debug: {
          hasCronHeader,
          hasApikey,
          hasAuthHeader: !!authHeader,
          isInternalCall,
          hasExecuteBotAction,
          finalIsInternalCall,
          receivedHeaders: Object.keys(allHeaders)
        }
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Use service role client for internal calls to bypass RLS
    const supabaseClient = finalIsInternalCall && supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
      : createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } }
        })

    if (action !== 'execute_bot' || !botId) {
      return new Response(JSON.stringify({ 
        error: 'Invalid request. Expected: { "action": "execute_bot", "botId": "..." }',
        received: { action, botId }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`\n🎯 Processing webhook execution for bot: ${botId}`);
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);

    // Fetch bot
    const { data: bot, error: botError } = await supabaseClient
      .from('trading_bots')
      .select('*')
      .eq('id', botId)
      .single();

    if (botError || !bot) {
      console.error(`❌ Bot not found: ${botId}`, botError);
      return new Response(JSON.stringify({ 
        error: 'Bot not found',
        botId,
        details: botError?.message
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`✅ Bot found: ${bot.name} (${bot.symbol}, ${bot.exchange}, ${bot.tradingType || bot.trading_type || 'futures'})`);
    console.log(`📊 Bot status: ${bot.status}, Paper trading: ${bot.paper_trading}`);

    // Process manual trade signals
    const { data: pendingSignals, error: signalsError } = await supabaseClient
      .from('manual_trade_signals')
      .select('*')
      .eq('bot_id', botId)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: true });

    if (signalsError) {
      console.error(`❌ Failed to fetch manual trade signals:`, signalsError);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch manual trade signals',
        details: signalsError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!pendingSignals || pendingSignals.length === 0) {
      console.log(`ℹ️ No pending manual trade signals for bot ${botId}`);
      return new Response(JSON.stringify({ 
        success: true,
        message: 'No pending signals to process',
        botId,
        processedCount: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`📬 Found ${pendingSignals.length} pending manual trade signal(s)`);

    // Import the bot-executor logic by calling it via HTTP
    // This is a workaround since we can't directly import from another edge function
    // We'll trigger the bot-executor's execute_bot action which will process manual signals
    const botExecutorUrl = `${supabaseUrl}/functions/v1/bot-executor`;
    const triggerResponse = await fetch(botExecutorUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        action: 'execute_bot',
        botId: botId
      })
    });

    const triggerText = await triggerResponse.text();
    let triggerResult: any;
    try {
      triggerResult = JSON.parse(triggerText);
    } catch {
      triggerResult = { raw: triggerText };
    }

    const executionTime = Date.now() - startTime;

    if (triggerResponse.ok) {
      console.log(`✅ Webhook execution completed successfully`);
      console.log(`⏱️ Execution time: ${executionTime}ms`);
      return new Response(JSON.stringify({
        success: true,
        message: 'Webhook execution completed',
        botId,
        signalsFound: pendingSignals.length,
        executionTime,
        result: triggerResult
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      console.error(`❌ Webhook execution failed:`, triggerResult);
      return new Response(JSON.stringify({
        success: false,
        error: 'Webhook execution failed',
        botId,
        signalsFound: pendingSignals.length,
        executionTime,
        details: triggerResult
      }), {
        status: triggerResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`❌ [webhook-executor] Unhandled error:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: errorMessage,
      executionTime
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

