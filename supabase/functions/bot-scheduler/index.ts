import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// This Edge Function is intended to be triggered by Supabase Scheduled Triggers.
// Setup:
// 1) Set env vars: CRON_SECRET, SUPABASE_URL (project), SUPABASE_SERVICE_ROLE_KEY (on bot-executor only)
// 2) Deploy: supabase functions deploy bot-scheduler
// 3) Add schedule in Dashboard → Edge Functions → bot-scheduler (e.g. every 5 minutes)
// 4) Add header: x-cron-secret: <CRON_SECRET>

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-cron-secret',
}

serve(async (req) => {
  const requestStartTime = Date.now();
  const requestId = crypto.randomUUID().substring(0, 8);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 [${requestId}] Bot Scheduler INVOKED`);
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`🔍 Request method: ${req.method}`);
  console.log(`🔗 Request URL: ${req.url}`);
  
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${requestId}] CORS preflight - returning OK`);
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Log all headers (masking sensitive values)
    const allHeaders = Object.fromEntries(req.headers.entries());
    const maskedHeaders = { ...allHeaders };
    if (maskedHeaders['x-cron-secret']) {
      const secret = maskedHeaders['x-cron-secret'];
      maskedHeaders['x-cron-secret'] = secret ? `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}` : '(empty)';
    }
    if (maskedHeaders['authorization']) {
      maskedHeaders['authorization'] = maskedHeaders['authorization'] ? 'Bearer ***' : '(empty)';
    }
    console.log(`📋 [${requestId}] Request headers:`, JSON.stringify(maskedHeaders, null, 2));
    
    // Environment variables check
    const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
    const headerSecret = req.headers.get('x-cron-secret') ?? '';
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    console.log(`🔐 [${requestId}] Environment check:`);
    console.log(`   CRON_SECRET present: ${!!CRON_SECRET} (length: ${CRON_SECRET.length})`);
    console.log(`   Header secret present: ${!!headerSecret} (length: ${headerSecret.length})`);
    console.log(`   SUPABASE_URL present: ${!!SUPABASE_URL}`);
    console.log(`   SERVICE_ROLE_KEY present: ${!!SERVICE_ROLE_KEY} (length: ${SERVICE_ROLE_KEY.length})`);
    
    // Detailed secret comparison
    if (CRON_SECRET && headerSecret) {
      const secretsMatch = headerSecret === CRON_SECRET;
      console.log(`   🔑 Secrets match: ${secretsMatch}`);
      if (!secretsMatch) {
        console.error(`   ❌ [${requestId}] SECRET MISMATCH:`);
        console.error(`      Expected (first 4): ${CRON_SECRET.substring(0, 4)}...${CRON_SECRET.substring(CRON_SECRET.length - 4)}`);
        console.error(`      Received (first 4): ${headerSecret.substring(0, 4)}...${headerSecret.substring(headerSecret.length - 4)}`);
      }
    } else {
      console.warn(`   ⚠️ [${requestId}] Missing secrets:`);
      if (!CRON_SECRET) console.warn(`      - CRON_SECRET env var is empty`);
      if (!headerSecret) console.warn(`      - x-cron-secret header is missing or empty`);
    }

    // Authentication check
    if (!CRON_SECRET || headerSecret !== CRON_SECRET) {
      const error = 'Unauthorized: CRON_SECRET mismatch or missing';
      console.error(`❌ [${requestId}] AUTHENTICATION FAILED: ${error}`);
      console.error(`   This usually means:`);
      console.error(`   1. x-cron-secret header doesn't match CRON_SECRET env var`);
      console.error(`   2. Header is missing from the scheduled trigger`);
      console.error(`   3. Environment variable is not set`);
      console.error(`📊 [${requestId}] Request duration: ${Date.now() - requestStartTime}ms`);
      console.log(`${'='.repeat(60)}\n`);
      return new Response(JSON.stringify({ 
        error: 'Unauthorized',
        message: error,
        requestId,
        timestamp: new Date().toISOString()
      }), { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    // SUPABASE_URL check
    if (!SUPABASE_URL) {
      const error = 'SUPABASE_URL not configured';
      console.error(`❌ [${requestId}] CONFIGURATION ERROR: ${error}`);
      console.error(`   Set SUPABASE_URL environment variable in function settings`);
      console.error(`📊 [${requestId}] Request duration: ${Date.now() - requestStartTime}ms`);
      console.log(`${'='.repeat(60)}\n`);
      return new Response(JSON.stringify({ 
        error: 'Configuration error',
        message: error,
        requestId,
        timestamp: new Date().toISOString()
      }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // SERVICE_ROLE_KEY check (warning, not blocking)
    if (!SERVICE_ROLE_KEY) {
      console.warn(`⚠️ [${requestId}] SERVICE_ROLE_KEY not set - bot-executor may reject the request`);
    }

    const executorUrl = `${SUPABASE_URL}/functions/v1/bot-executor`;
    console.log(`🚀 [${requestId}] Calling bot-executor:`);
    console.log(`   URL: ${executorUrl}`);
    console.log(`   Method: POST`);
    console.log(`   Body: ${JSON.stringify({ action: 'execute_all_bots' })}`);

    const callStartTime = Date.now();
    let executorResponse: Response;
    let responseBody: string;
    
    try {
      executorResponse = await fetch(executorUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'x-cron-secret': CRON_SECRET,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ action: 'execute_all_bots' })
      });
      
      const duration = Date.now() - callStartTime;
      responseBody = await executorResponse.text();
      
      console.log(`📥 [${requestId}] Bot-executor response received:`);
      console.log(`   Status: ${executorResponse.status} ${executorResponse.statusText}`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Response length: ${responseBody.length} bytes`);
      
      // Try to parse and log response details
      try {
        const parsedBody = JSON.parse(responseBody);
        console.log(`   Response data:`, JSON.stringify(parsedBody, null, 2));
        
        // Check for specific response patterns
        if (parsedBody.success) {
          console.log(`   ✅ Execution successful`);
          if (parsedBody.botsExecuted !== undefined) {
            console.log(`   🤖 Bots executed: ${parsedBody.botsExecuted}`);
          }
          if (parsedBody.successful !== undefined) {
            console.log(`   ✅ Successful: ${parsedBody.successful}`);
          }
          if (parsedBody.failed !== undefined) {
            console.log(`   ❌ Failed: ${parsedBody.failed}`);
          }
        } else {
          console.warn(`   ⚠️ Execution returned success: false`);
          if (parsedBody.error) {
            console.error(`   Error: ${parsedBody.error}`);
          }
          if (parsedBody.details) {
            console.error(`   Details: ${parsedBody.details}`);
          }
        }
      } catch (parseError) {
        console.warn(`   ⚠️ Could not parse response as JSON (first 500 chars):`);
        console.warn(`   ${responseBody.substring(0, 500)}`);
      }
      
      // Check for error status codes
      if (!executorResponse.ok) {
        console.error(`❌ [${requestId}] Bot-executor returned error status: ${executorResponse.status}`);
        console.error(`   Full response: ${responseBody.substring(0, 1000)}`);
      } else {
        console.log(`✅ [${requestId}] Bot-executor call completed successfully`);
      }
      
    } catch (fetchError) {
      const duration = Date.now() - callStartTime;
      console.error(`❌ [${requestId}] FETCH ERROR when calling bot-executor:`);
      console.error(`   Error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      console.error(`   Duration before error: ${duration}ms`);
      if (fetchError instanceof Error && fetchError.stack) {
        console.error(`   Stack: ${fetchError.stack}`);
      }
      console.error(`   This could mean:`);
      console.error(`   1. bot-executor function is not deployed`);
      console.error(`   2. Network connectivity issue`);
      console.error(`   3. SUPABASE_URL is incorrect`);
      console.error(`   4. Function timeout`);
      
      throw fetchError; // Re-throw to be caught by outer catch
    }

    const totalDuration = Date.now() - requestStartTime;
    console.log(`📊 [${requestId}] Total request duration: ${totalDuration}ms`);
    console.log(`✅ [${requestId}] Bot scheduler completed successfully`);
    console.log(`${'='.repeat(60)}\n`);

    return new Response(responseBody, { 
      status: executorResponse.status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (e) {
    const totalDuration = Date.now() - requestStartTime;
    const errorMessage = e instanceof Error ? e.message : String(e);
    const errorStack = e instanceof Error ? e.stack : undefined;
    
    console.error(`\n${'='.repeat(60)}`);
    console.error(`❌ [${requestId}] BOT SCHEDULER ERROR`);
    console.error(`📅 Timestamp: ${new Date().toISOString()}`);
    console.error(`⏱️ Duration before error: ${totalDuration}ms`);
    console.error(`💥 Error type: ${e instanceof Error ? e.constructor.name : typeof e}`);
    console.error(`📝 Error message: ${errorMessage}`);
    
    if (errorStack) {
      console.error(`📚 Stack trace:`);
      console.error(errorStack);
    }
    
    // Log error context
    console.error(`🔍 Error context:`);
    console.error(`   Request method: ${req.method}`);
    console.error(`   Request URL: ${req.url}`);
    // Note: Request body may have already been consumed, so we skip reading it here
    console.error(`   Request body: (check original request if needed)`);
    
    console.error(`📊 [${requestId}] Request failed after ${totalDuration}ms`);
    console.error(`${'='.repeat(60)}\n`);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: errorMessage,
      requestId,
      timestamp: new Date().toISOString(),
      duration: `${totalDuration}ms`
    }), {
      status: 500, 
      headers: corsHeaders
    });
  }
})


