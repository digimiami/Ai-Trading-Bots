/**
 * ML Auto-Retrain Scheduler
 * Periodically checks ML model performance and triggers retraining when needed
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify cron secret for scheduled execution
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');
    
    if (expectedSecret && cronSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔄 Starting ML auto-retrain check...');

    // Get all active bots with ML enabled
    const { data: bots, error: botsError } = await supabaseClient
      .from('trading_bots')
      .select('id, user_id, symbol, name, strategy')
      .eq('status', 'running')
      .not('strategy', 'is', null);

    if (botsError) throw botsError;

    if (!bots || bots.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No active bots found',
          checked: 0,
          retrained: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let checked = 0;
    let retrained = 0;
    const results: any[] = [];

    // Check each bot's ML performance
    for (const bot of bots) {
      try {
        // Parse strategy to check if ML is enabled
        let strategy = bot.strategy;
        if (typeof strategy === 'string') {
          try {
            strategy = JSON.parse(strategy);
          } catch {
            continue; // Skip bots with invalid strategy
          }
        }

        if (!strategy?.useMLPrediction) {
          continue; // Skip bots without ML enabled
        }

        checked++;

        // Call check_retrain action
        const mlPredictionsUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ml-predictions?action=check_retrain`;
        
        const response = await fetch(mlPredictionsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
          },
          body: JSON.stringify({
            bot_id: bot.id,
            days: 7
          })
        });

        if (!response.ok) {
          console.error(`❌ Failed to check retrain for bot ${bot.id}:`, await response.text());
          continue;
        }

        const result = await response.json();
        
        if (result.success && result.should_retrain) {
          // Trigger retraining (in a real implementation, this would call a training function)
          console.log(`⚠️ Bot ${bot.name} (${bot.symbol}) needs retraining: ${result.reason}`);
          
          // Log retrain recommendation
          await supabaseClient
            .from('bot_activity_logs')
            .insert({
              bot_id: bot.id,
              level: 'warning',
              category: 'ml',
              message: `🤖 ML Retraining Recommended: ${result.reason}`,
              details: {
                recent_accuracy: result.recent_accuracy,
                threshold: result.threshold,
                feature_importance: result.feature_importance,
                confidence_calibration: result.confidence_calibration
              }
            });

          retrained++;
          results.push({
            bot_id: bot.id,
            bot_name: bot.name,
            symbol: bot.symbol,
            should_retrain: true,
            reason: result.reason,
            recent_accuracy: result.recent_accuracy
          });
        } else {
          results.push({
            bot_id: bot.id,
            bot_name: bot.name,
            symbol: bot.symbol,
            should_retrain: false,
            recent_accuracy: result.recent_accuracy
          });
        }
      } catch (error) {
        console.error(`❌ Error checking bot ${bot.id}:`, error);
        // Continue with other bots
      }
    }

    console.log(`✅ ML auto-retrain check complete: ${checked} bots checked, ${retrained} need retraining`);

    return new Response(
      JSON.stringify({ 
        success: true,
        checked,
        retrained,
        results,
        message: `Checked ${checked} bots, ${retrained} need retraining`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ ML auto-retrain error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
