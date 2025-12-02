import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// This Edge Function is intended to be triggered by Supabase Scheduled Triggers.
// Setup:
// 1) Set env vars: CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// 2) Deploy: supabase functions deploy crypto-news-auto-poster
// 3) Add schedule in Dashboard → Edge Functions → crypto-news-auto-poster (every hour: 0 * * * *)
// 4) Add header: x-cron-secret: <CRON_SECRET>

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-cron-secret',
}

serve(async (req) => {
  const requestStartTime = Date.now();
  const requestId = crypto.randomUUID().substring(0, 8);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 [${requestId}] Crypto News Auto-Poster INVOKED`);
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`🔍 Request method: ${req.method}`);
  console.log(`🔗 Request URL: ${req.url}`);

  if (req.method === 'OPTIONS') {
    console.log(`✅ [${requestId}] CORS preflight - returning OK`);
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify cron secret
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');
    
    if (!cronSecret || !expectedSecret || cronSecret !== expectedSecret) {
      console.error(`❌ [${requestId}] Unauthorized: CRON_SECRET mismatch or missing`);
      return new Response(JSON.stringify({ 
        error: 'Unauthorized',
        message: 'CRON_SECRET mismatch or missing'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`❌ [${requestId}] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set`);
      return new Response(JSON.stringify({ 
        error: 'Configuration error',
        message: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`📡 [${requestId}] Calling crypto-news-management with runAutoPosting action`);

    // Call the crypto-news-management function to run auto-posting
    const functionUrl = `${supabaseUrl}/functions/v1/crypto-news-management`;
    const url = new URL(functionUrl);
    url.searchParams.set('action', 'runAutoPosting');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
        'x-cron-secret': expectedSecret
      }
    });

    const responseTime = Date.now() - requestStartTime;
    console.log(`⏱️ [${requestId}] Response time: ${responseTime}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [${requestId}] Auto-posting failed:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });

      return new Response(JSON.stringify({
        error: 'Auto-posting failed',
        status: response.status,
        details: errorText
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    console.log(`✅ [${requestId}] Auto-posting completed:`, data);

    return new Response(JSON.stringify({
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      results: data.results || [],
      message: data.message || 'Auto-posting completed'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    const responseTime = Date.now() - requestStartTime;
    console.error(`❌ [${requestId}] Auto-poster error:`, error);
    console.error(`❌ [${requestId}] Error stack:`, error?.stack);

    return new Response(JSON.stringify({
      error: error?.message || 'Internal server error',
      requestId,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

