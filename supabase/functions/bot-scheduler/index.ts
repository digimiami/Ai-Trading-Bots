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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    console.log('📅 Bot Scheduler called at:', new Date().toISOString());
    console.log('🔍 Request method:', req.method);
    console.log('🔍 Request headers:', Object.fromEntries(req.headers.entries()));
    
    const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
    const headerSecret = req.headers.get('x-cron-secret') ?? ''
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''

    console.log('🔐 CRON_SECRET present:', !!CRON_SECRET);
    console.log('🔐 Header secret present:', !!headerSecret);
    console.log('🔐 Secrets match:', headerSecret === CRON_SECRET);
    console.log('🌐 SUPABASE_URL:', SUPABASE_URL);

    if (!CRON_SECRET || headerSecret !== CRON_SECRET) {
      console.error('❌ Unauthorized: CRON_SECRET mismatch or missing');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    if (!SUPABASE_URL) {
      console.error('❌ SUPABASE_URL is not set');
      return new Response(JSON.stringify({ error: 'SUPABASE_URL not configured' }), { 
        status: 500, 
        headers: corsHeaders 
      })
    }

    const executorUrl = `${SUPABASE_URL}/functions/v1/bot-executor`
    console.log('🚀 Calling bot-executor at:', executorUrl);
    console.log('📤 Request body:', JSON.stringify({ action: 'execute_all_bots' }));

    const startTime = Date.now();
    const r = await fetch(executorUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'x-cron-secret': CRON_SECRET,
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`
      },
      body: JSON.stringify({ action: 'execute_all_bots' })
    })

    const duration = Date.now() - startTime;
    const body = await r.text()
    
    console.log('✅ Bot-executor response:', {
      status: r.status,
      statusText: r.statusText,
      duration: `${duration}ms`,
      bodyPreview: body.substring(0, 200)
    });

    return new Response(body, { status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e) {
    console.error('❌ Bot scheduler error:', e);
    console.error('❌ Error details:', e instanceof Error ? e.stack : String(e));
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: corsHeaders
    })
  }
})


