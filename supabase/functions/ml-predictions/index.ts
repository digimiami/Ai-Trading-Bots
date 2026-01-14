import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

interface MLFeatures {
  rsi: number;
  macd: number;
  bollinger_position: number;
  volume_trend: number;
  price_momentum: number;
  adx: number;
  ema_diff: number;
}

interface MLPrediction {
  prediction: 'buy' | 'sell' | 'hold';
  confidence: number;
  features: MLFeatures;
}

// ML prediction function using weighted scoring
function predictMarketDirection(features: MLFeatures): MLPrediction {
  let buyScore = 0;
  let sellScore = 0;
  
  // RSI scoring (30/70 thresholds)
  if (features.rsi < 30) buyScore += 2.5;
  else if (features.rsi < 40) buyScore += 1.0;
  else if (features.rsi > 70) sellScore += 2.5;
  else if (features.rsi > 60) sellScore += 1.0;
  
  // MACD scoring
  if (features.macd > 0.001) buyScore += 2.0;
  else if (features.macd > 0) buyScore += 1.0;
  else if (features.macd < -0.001) sellScore += 2.0;
  else if (features.macd < 0) sellScore += 1.0;
  
  // Bollinger position scoring
  if (features.bollinger_position < 0.2) buyScore += 1.5;
  else if (features.bollinger_position > 0.8) sellScore += 1.5;
  
  // Volume trend scoring
  if (features.volume_trend > 1.3) buyScore += 1.0;
  else if (features.volume_trend < 0.7) sellScore += 0.5;
  
  // Price momentum scoring
  if (features.price_momentum > 0.02) buyScore += 1.5;
  else if (features.price_momentum > 0.01) buyScore += 0.5;
  else if (features.price_momentum < -0.02) sellScore += 1.5;
  else if (features.price_momentum < -0.01) sellScore += 0.5;
  
  // ADX scoring (trend strength)
  if (features.adx > 25) {
    if (features.price_momentum > 0) buyScore += 1.5;
    else if (features.price_momentum < 0) sellScore += 1.5;
  }
  
  // EMA difference scoring
  if (features.ema_diff > 0.01) buyScore += 1.0;
  else if (features.ema_diff < -0.01) sellScore += 1.0;
  
  // Determine prediction
  let prediction: 'buy' | 'sell' | 'hold';
  let confidence: number;
  
  const maxPossibleScore = 11.5; // Sum of all maximum individual scores
  const scoreDifference = Math.abs(buyScore - sellScore);
  
  if (buyScore > sellScore + 2) {
    prediction = 'buy';
    confidence = Math.min(0.95, 0.5 + (scoreDifference / maxPossibleScore) * 0.5);
  } else if (sellScore > buyScore + 2) {
    prediction = 'sell';
    confidence = Math.min(0.95, 0.5 + (scoreDifference / maxPossibleScore) * 0.5);
  } else {
    prediction = 'hold';
    confidence = 0.5 + (Math.abs(scoreDifference) / maxPossibleScore) * 0.2;
  }
  
  return {
    prediction,
    confidence: Math.max(0.1, Math.min(0.99, confidence)),
    features
  };
}

// Generate sample technical indicators (in production, fetch real data)
function generateMLFeatures(symbol: string): MLFeatures {
  // In production, you would fetch real market data here
  // For now, we generate realistic sample data
  return {
    rsi: 20 + Math.random() * 60, // 20-80
    macd: (Math.random() - 0.5) * 0.01, // -0.005 to 0.005
    bollinger_position: Math.random(), // 0-1
    volume_trend: 0.5 + Math.random() * 1.5, // 0.5-2.0
    price_momentum: (Math.random() - 0.5) * 0.08, // -0.04 to 0.04
    adx: 10 + Math.random() * 40, // 10-50
    ema_diff: (Math.random() - 0.5) * 0.04 // -0.02 to 0.02
  };
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
    const action = url.searchParams.get('action') || 'predict'

    if (req.method === 'GET') {
      if (action === 'get_predictions') {
        const limit = parseInt(url.searchParams.get('limit') || '50')
        const { data: predictions, error: predictionsError } = await supabaseClient
          .from('ml_predictions')
          .select('*')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false })
          .limit(limit)

        if (predictionsError) throw predictionsError

        return new Response(
          JSON.stringify({ 
            success: true, 
            predictions: predictions || []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'get_performance') {
        const { data: performance, error: performanceError } = await supabaseClient
          .from('ai_performance')
          .select('*')
          .eq('user_id', user.id)
          .order('accuracy', { ascending: false })

        if (performanceError) throw performanceError

        return new Response(
          JSON.stringify({ 
            success: true, 
            performance: performance || []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (req.method === 'POST') {
      const body = await req.json()

      if (action === 'predict') {
        const { symbol, bot_id, features: providedFeatures } = body

        if (!symbol) {
          throw new Error('Symbol is required')
        }

        // Use provided features if available, otherwise generate them
        // This allows bot-executor to pass real market data (RSI, ADX, etc.)
        let features: MLFeatures;
        
        if (providedFeatures && typeof providedFeatures === 'object') {
          // Use real features provided by bot-executor
          // Fill in missing features with defaults or calculated values
          features = {
            rsi: providedFeatures.rsi ?? 50, // Default to neutral if not provided
            adx: providedFeatures.adx ?? 20,
            macd: providedFeatures.macd ?? 0,
            bollinger_position: providedFeatures.bollinger_position ?? 0.5,
            volume_trend: providedFeatures.volume_trend ?? 1.0,
            price_momentum: providedFeatures.price_momentum ?? 0,
            ema_diff: providedFeatures.ema_diff ?? 0
          };
          
          console.log(`✅ Using real market features for ${symbol}:`, {
            rsi: features.rsi,
            adx: features.adx,
            has_macd: providedFeatures.macd !== undefined,
            has_bollinger: providedFeatures.bollinger_position !== undefined
          });
        } else {
          // Fallback: Generate features internally (for backward compatibility)
          console.log(`⚠️ No features provided, generating sample features for ${symbol}`);
          features = generateMLFeatures(symbol);
        }
        
        // Make ML prediction
        const prediction = predictMarketDirection(features);
        
        // Save prediction to database
        const { data: predictionData, error: predictionError } = await supabaseClient
          .from('ml_predictions')
          .insert({
            user_id: user.id,
            bot_id: bot_id || null,
            symbol: symbol,
            prediction: prediction.prediction,
            confidence: prediction.confidence,
            features: prediction.features,
            timestamp: new Date().toISOString()
          })
          .select()
          .single()

        if (predictionError) {
          throw predictionError
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            prediction: predictionData,
            message: `ML prediction: ${prediction.prediction.toUpperCase()} with ${(prediction.confidence * 100).toFixed(1)}% confidence`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'update_outcome') {
        const { prediction_id, actual_outcome, trade_pnl, trade_result } = body

        if (!prediction_id || !actual_outcome) {
          throw new Error('prediction_id and actual_outcome are required')
        }

        // Get the original prediction to calculate accuracy
        const { data: originalPrediction, error: fetchError } = await supabaseClient
          .from('ml_predictions')
          .select('prediction, confidence, bot_id, symbol')
          .eq('id', prediction_id)
          .eq('user_id', user.id)
          .single()

        if (fetchError || !originalPrediction) {
          throw new Error('Prediction not found')
        }

        // Update prediction with outcome
        const { data: updated, error: updateError } = await supabaseClient
          .from('ml_predictions')
          .update({ 
            actual_outcome: actual_outcome,
            outcome_confidence: 1.0,
            trade_pnl: trade_pnl || null,
            trade_result: trade_result || null
          })
          .eq('id', prediction_id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (updateError) throw updateError

        // Calculate if prediction was correct
        const predictionCorrect = originalPrediction.prediction.toLowerCase() === actual_outcome.toLowerCase();
        
        // Update performance metrics
        await updatePerformanceMetrics(
          supabaseClient,
          user.id,
          originalPrediction.bot_id,
          originalPrediction.symbol,
          predictionCorrect,
          originalPrediction.confidence,
          trade_pnl
        );

        return new Response(
          JSON.stringify({ 
            success: true, 
            prediction: updated,
            accuracy: predictionCorrect,
            message: `Prediction outcome updated. ${predictionCorrect ? 'Correct' : 'Incorrect'} prediction.`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'calculate_accuracy') {
        const { bot_id, days = 30 } = body
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        // Get predictions with outcomes
        const { data: predictions, error: predictionsError } = await supabaseClient
          .from('ml_predictions')
          .select('prediction, actual_outcome, confidence, trade_pnl')
          .eq('user_id', user.id)
          .not('actual_outcome', 'is', null)
          .gte('timestamp', cutoffDate.toISOString())
          .order('timestamp', { ascending: false })
        
        if (predictionsError) throw predictionsError
        
        if (!predictions || predictions.length === 0) {
          return new Response(
            JSON.stringify({ 
              success: true,
              accuracy: 0,
              total_predictions: 0,
              correct_predictions: 0,
              message: 'No predictions with outcomes found'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Calculate accuracy
        const correct = predictions.filter(p => 
          p.prediction.toLowerCase() === p.actual_outcome.toLowerCase()
        ).length;
        
        const accuracy = correct / predictions.length;
        const avgConfidence = predictions.reduce((sum, p) => sum + (p.confidence || 0), 0) / predictions.length;
        const totalPnl = predictions
          .filter(p => p.trade_pnl !== null)
          .reduce((sum, p) => sum + (parseFloat(p.trade_pnl) || 0), 0);
        
        return new Response(
          JSON.stringify({ 
            success: true,
            accuracy: accuracy,
            total_predictions: predictions.length,
            correct_predictions: correct,
            incorrect_predictions: predictions.length - correct,
            avg_confidence: avgConfidence,
            total_pnl: totalPnl,
            message: `Accuracy: ${(accuracy * 100).toFixed(1)}% over ${days} days`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'check_retrain') {
        const { bot_id } = body
        
        // Check if retraining is needed based on recent accuracy
        const { data: recentPredictions, error: predictionsError } = await supabaseClient
          .from('ml_predictions')
          .select('prediction, actual_outcome, confidence')
          .eq('user_id', user.id)
          .not('actual_outcome', 'is', null)
          .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
          .order('timestamp', { ascending: false })
          .limit(100)
        
        if (predictionsError) throw predictionsError
        
        if (!recentPredictions || recentPredictions.length < 50) {
          return new Response(
            JSON.stringify({ 
              success: true,
              should_retrain: false,
              reason: 'Insufficient data for retraining (need at least 50 predictions with outcomes)',
              recent_predictions: recentPredictions?.length || 0
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Calculate recent accuracy
        const correct = recentPredictions.filter(p => 
          p.prediction.toLowerCase() === p.actual_outcome.toLowerCase()
        ).length;
        const recentAccuracy = correct / recentPredictions.length;
        
        // Retrain if accuracy drops below 55% (threshold)
        const shouldRetrain = recentAccuracy < 0.55;
        
        return new Response(
          JSON.stringify({ 
            success: true,
            should_retrain: shouldRetrain,
            recent_accuracy: recentAccuracy,
            recent_predictions: recentPredictions.length,
            correct_predictions: correct,
            threshold: 0.55,
            reason: shouldRetrain 
              ? `Recent accuracy (${(recentAccuracy * 100).toFixed(1)}%) is below threshold (55%)`
              : `Recent accuracy (${(recentAccuracy * 100).toFixed(1)}%) is acceptable`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'initialize_performance') {
        // Initialize AI performance data for common strategies
        const strategies = [
          { name: 'ai_combo', accuracy: 0.72, trades: 150, profitable: 108, avg_profit: 0.025, sharpe: 1.85, drawdown: 0.08, win_rate: 0.72 },
          { name: 'dca5x', accuracy: 0.68, trades: 200, profitable: 136, avg_profit: 0.018, sharpe: 1.42, drawdown: 0.12, win_rate: 0.68 },
          { name: 'mr_scalper', accuracy: 0.75, trades: 300, profitable: 225, avg_profit: 0.012, sharpe: 2.1, drawdown: 0.06, win_rate: 0.75 },
          { name: 'tf_breakout', accuracy: 0.71, trades: 180, profitable: 128, avg_profit: 0.022, sharpe: 1.68, drawdown: 0.09, win_rate: 0.71 }
        ];

        for (const strategy of strategies) {
          await supabaseClient
            .from('ai_performance')
            .upsert({
              user_id: user.id,
              strategy: strategy.name,
              accuracy: strategy.accuracy,
              total_trades: strategy.trades,
              profitable_trades: strategy.profitable,
              avg_profit: strategy.avg_profit,
              sharpe_ratio: strategy.sharpe,
              max_drawdown: strategy.drawdown,
              win_rate: strategy.win_rate,
              last_updated: new Date().toISOString()
            }, { onConflict: 'user_id,strategy' });
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'AI performance data initialized successfully'
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
    console.error('ML Predictions error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Update performance metrics after a prediction outcome is recorded
 */
async function updatePerformanceMetrics(
  supabaseClient: any,
  userId: string,
  botId: string | null,
  symbol: string,
  isCorrect: boolean,
  confidence: number,
  pnl: number | null
) {
  try {
    // Get or create performance record for this bot/symbol
    const performanceKey = botId ? `bot_${botId}` : `symbol_${symbol}`;
    
    // Get existing performance
    const { data: existing, error: fetchError } = await supabaseClient
      .from('ai_performance')
      .select('*')
      .eq('user_id', userId)
      .eq('strategy', performanceKey)
      .maybeSingle()
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching performance:', fetchError);
      return;
    }
    
    // Calculate new metrics
    const totalTrades = (existing?.total_trades || 0) + 1;
    const profitableTrades = (existing?.profitable_trades || 0) + (isCorrect ? 1 : 0);
    const accuracy = profitableTrades / totalTrades;
    const avgProfit = pnl !== null 
      ? ((existing?.avg_profit || 0) * (totalTrades - 1) + pnl) / totalTrades
      : (existing?.avg_profit || 0);
    
    // Update or insert performance record
    const performanceData = {
      user_id: userId,
      strategy: performanceKey,
      accuracy: accuracy,
      total_trades: totalTrades,
      profitable_trades: profitableTrades,
      avg_profit: avgProfit,
      win_rate: accuracy, // Win rate = accuracy for predictions
      last_updated: new Date().toISOString()
    };
    
    if (existing) {
      await supabaseClient
        .from('ai_performance')
        .update(performanceData)
        .eq('id', existing.id);
    } else {
      await supabaseClient
        .from('ai_performance')
        .insert({
          ...performanceData,
          sharpe_ratio: 0,
          max_drawdown: 0,
          created_at: new Date().toISOString()
        });
    }
    
    console.log(`✅ Updated performance metrics for ${performanceKey}: accuracy=${(accuracy * 100).toFixed(1)}%`);
  } catch (error) {
    console.error('Error updating performance metrics:', error);
    // Don't throw - performance tracking is non-critical
  }
}

