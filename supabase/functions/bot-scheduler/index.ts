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
    const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
    const headerSecret = req.headers.get('x-cron-secret') ?? ''

    if (!CRON_SECRET || headerSecret !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const executorUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/bot-executor`

    const r = await fetch(executorUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': CRON_SECRET },
      body: JSON.stringify({ action: 'execute_all_bots' })
    })

    const body = await r.text()
    return new Response(body, { status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: corsHeaders
    })
  }
})


