/**
 * ML Performance Monitoring
 * Real-time monitoring and alerts for ML system performance
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

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'dashboard'

    if (req.method === 'GET') {
      if (action === 'dashboard') {
        // Get comprehensive ML performance dashboard data
        const { data: performance, error: perfError } = await supabaseClient
          .from('ml_performance_summary')
          .select('*')
          .eq('user_id', user.id)
          .order('last_prediction', { ascending: false })
          .limit(50);

        if (perfError) throw perfError;

        // Get recent predictions
        const { data: recentPredictions, error: predError } = await supabaseClient
          .from('ml_predictions')
          .select('*')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false })
          .limit(100);

        if (predError) throw predError;

        // Calculate overall stats
        const totalPredictions = recentPredictions?.length || 0;
        const predictionsWithOutcome = recentPredictions?.filter(p => p.actual_outcome).length || 0;
        const correctPredictions = recentPredictions?.filter(p => 
          p.prediction === p.actual_outcome
        ).length || 0;
        const overallAccuracy = predictionsWithOutcome > 0 
          ? correctPredictions / predictionsWithOutcome 
          : 0;

        // Get alerts (bots with low accuracy)
        const alerts = performance?.filter(p => 
          p.accuracy_percent < 55 && p.predictions_with_outcome >= 20
        ) || [];

        return new Response(
          JSON.stringify({ 
            success: true,
            dashboard: {
              overall_accuracy: overallAccuracy,
              total_predictions: totalPredictions,
              predictions_with_outcome: predictionsWithOutcome,
              correct_predictions: correctPredictions,
              performance_by_bot: performance || [],
              recent_predictions: recentPredictions || [],
              alerts: alerts.map(a => ({
                bot_id: a.bot_id,
                symbol: a.symbol,
                accuracy: a.accuracy_percent,
                message: `Low accuracy: ${a.accuracy_percent}% (threshold: 55%)`
              }))
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'alerts') {
        // Get active alerts for low performance
        const { data: performance, error } = await supabaseClient
          .from('ml_performance_summary')
          .select('*')
          .eq('user_id', user.id)
          .lt('accuracy_percent', 55)
          .gte('predictions_with_outcome', 20)
          .order('accuracy_percent', { ascending: true });

        if (error) throw error;

        return new Response(
          JSON.stringify({ 
            success: true,
            alerts: performance?.map(p => ({
              bot_id: p.bot_id,
              symbol: p.symbol,
              accuracy: p.accuracy_percent,
              total_predictions: p.total_predictions,
              correct_predictions: p.correct_predictions,
              severity: p.accuracy_percent < 45 ? 'critical' : 'warning',
              message: `ML accuracy is ${p.accuracy_percent}% (below 55% threshold)`,
              recommendation: 'Consider retraining the model or adjusting strategy parameters'
            })) || []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (req.method === 'POST') {
      if (action === 'check_alerts') {
        // Check for new alerts and send notifications
        const { bot_id } = await req.json().catch(() => ({}));
        
        const query = supabaseClient
          .from('ml_performance_summary')
          .select('*')
          .eq('user_id', user.id)
          .lt('accuracy_percent', 55)
          .gte('predictions_with_outcome', 20);
        
        if (bot_id) {
          query.eq('bot_id', bot_id);
        }
        
        const { data: alerts, error } = await query;
        
        if (error) throw error;

        // Log alerts to bot activity logs
        for (const alert of alerts || []) {
          if (alert.bot_id) {
            await supabaseClient
              .from('bot_activity_logs')
              .insert({
                bot_id: alert.bot_id,
                level: alert.accuracy_percent < 45 ? 'error' : 'warning',
                category: 'ml',
                message: `⚠️ ML Performance Alert: Accuracy is ${alert.accuracy_percent}% (below 55% threshold)`,
                details: {
                  accuracy: alert.accuracy_percent,
                  total_predictions: alert.total_predictions,
                  correct_predictions: alert.correct_predictions,
                  recommendation: 'Consider retraining the model'
                }
              });
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true,
            alerts_found: alerts?.length || 0,
            alerts: alerts || []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action or method' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('ML Monitoring error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
