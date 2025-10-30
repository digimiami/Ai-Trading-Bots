import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { openAIService } from '../services/openai';
import type { TradingBot } from '../types/trading';

interface AIAnalysis {
  id: string;
  bot_id: string;
  analysis_date: string;
  performance_data: any;
  recommendations: any;
  suggested_parameters: any;
  ai_confidence: number;
  expected_improvement: string;
  risk_assessment: string;
  applied: boolean;
  applied_at: string | null;
  created_at: string;
}

interface AILearning {
  bot: TradingBot;
  recentAnalysis: AIAnalysis | null;
  recommendations: any;
  canOptimize: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useAiLearning(botId: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bot, setBot] = useState<TradingBot | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeBot = async () => {
    if (!botId || !bot) return;

    try {
      setIsAnalyzing(true);
      setError(null);

      // Fetch recent trades for analysis
      const { data: trades, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('bot_id', botId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (tradesError) throw tradesError;

      // Calculate performance metrics
      const performanceData = calculatePerformanceMetrics(trades || []);

      // Get AI analysis
      const recommendation = await openAIService.analyzeBotPerformance(botId, performanceData);

      // Save analysis to database
      const { data: savedAnalysis, error: saveError } = await supabase
        .from('bot_ai_analysis')
        .insert({
          bot_id: botId,
          performance_data: performanceData,
          recommendations: recommendation,
          suggested_parameters: recommendation.suggestedParameters,
          ai_confidence: recommendation.confidence,
          expected_improvement: recommendation.expectedImprovement,
          risk_assessment: recommendation.riskAssessment
        })
        .select()
        .single();

      if (saveError) throw saveError;

      setAnalysis(savedAnalysis);
    } catch (err: any) {
      console.error('Error analyzing bot:', err);
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyOptimization = async () => {
    if (!analysis || !bot) return;

    try {
      // Apply suggested parameters
      const updatedStrategy = {
        ...bot.strategy,
        ...analysis.suggested_parameters
      };

      // Update bot with optimized strategy directly via Supabase
      const { error: updateError } = await supabase
        .from('trading_bots')
        .update({ strategy: updatedStrategy })
        .eq('id', botId);

      if (updateError) throw updateError;

      // Mark analysis as applied
      await supabase
        .from('bot_ai_analysis')
        .update({ applied: true, applied_at: new Date().toISOString() })
        .eq('id', analysis.id);

      setAnalysis({ ...analysis, applied: true, applied_at: new Date().toISOString() });
      alert('Strategy optimization applied successfully!');
    } catch (err: any) {
      console.error('Error applying optimization:', err);
      setError(err.message);
    }
  };

  const learnFromTrade = async (tradeData: any) => {
    try {
      await supabase
        .from('ai_learning_data')
        .insert({
          bot_id: botId,
          trade_id: tradeData.id,
          symbol: tradeData.symbol,
          market_conditions: {
            rsi: tradeData.indicators?.rsi,
            adx: tradeData.indicators?.adx,
            bbWidth: tradeData.indicators?.bbWidth
          },
          outcome: tradeData.pnl > 0 ? 'win' : 'loss',
          pnl: tradeData.pnl
        });
    } catch (err) {
      console.error('Error saving learning data:', err);
    }
  };

  const predictTradeSignal = async (symbol: string, marketData: any) => {
    try {
      // Fetch bot's historical trades
      const { data: trades } = await supabase
        .from('trades')
        .select('*')
        .eq('bot_id', botId)
        .eq('symbol', symbol)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!trades || trades.length === 0) {
        return { signal: 'hold' as const, confidence: 0.5, reasoning: 'Insufficient history' };
      }

      const historicalTrades = trades.map(t => ({
        symbol: t.symbol,
        entryPrice: t.entry_price,
        exitPrice: t.exit_price || t.entry_price,
        pnl: t.pnl || 0,
        indicators: {},
        outcome: (t.pnl || 0) > 0 ? 'win' as const : 'loss' as const,
        timestamp: t.created_at
      }));

      const prediction = await openAIService.predictTradeSignal(symbol, marketData, historicalTrades);
      return prediction;
    } catch (err) {
      console.error('Error predicting trade signal:', err);
      return { signal: 'hold' as const, confidence: 0.5, reasoning: 'Prediction failed' };
    }
  };

  // Calculate performance metrics
  const calculatePerformanceMetrics = (trades: any[]) => {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        avgWinPnL: 0,
        avgLossPnL: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        bestPerformingPair: 'N/A',
        worstPerformingPair: 'N/A',
        recentTrades: [],
        timeRange: 'N/A'
      };
    }

    const wins = trades.filter(t => (t.pnl || 0) > 0);
    const losses = trades.filter(t => (t.pnl || 0) < 0);
    const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const avgWinPnL = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.pnl || 0), 0) / wins.length : 0;
    const avgLossPnL = losses.length > 0 ? losses.reduce((sum, t) => sum + (t.pnl || 0), 0) / losses.length : 0;

    // Group by symbol
    const pairPerformance: Record<string, { wins: number; losses: number; pnl: number }> = {};
    trades.forEach(t => {
      if (!pairPerformance[t.symbol]) {
        pairPerformance[t.symbol] = { wins: 0, losses: 0, pnl: 0 };
      }
      pairPerformance[t.symbol].pnl += (t.pnl || 0);
      if ((t.pnl || 0) > 0) pairPerformance[t.symbol].wins++;
      else pairPerformance[t.symbol].losses++;
    });

    const bestPair = Object.entries(pairPerformance)
      .sort((a, b) => b[1].pnl - a[1].pnl)[0]?.[0] || 'N/A';
    const worstPair = Object.entries(pairPerformance)
      .sort((a, b) => a[1].pnl - b[1].pnl)[0]?.[0] || 'N/A';

    return {
      totalTrades: trades.length,
      winRate: parseFloat(winRate.toFixed(2)),
      totalPnL: parseFloat(totalPnL.toFixed(2)),
      avgWinPnL: parseFloat(avgWinPnL.toFixed(2)),
      avgLossPnL: parseFloat(avgLossPnL.toFixed(2)),
      maxDrawdown: 0, // Calculate if needed
      sharpeRatio: 0, // Calculate if needed
      bestPerformingPair: bestPair,
      worstPerformingPair: worstPair,
      recentTrades: trades.slice(0, 10),
      timeRange: `${trades.length} trades`
    };
  };

  useEffect(() => {
    // Fetch bot and latest analysis
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch bot
        const { data: botData, error: botError } = await supabase
          .from('trading_bots')
          .select('*')
          .eq('id', botId)
          .single();

        if (botError) throw botError;
        setBot(botData as any);

        // Fetch latest analysis
        const { data: analysisData, error: analysisError } = await supabase
          .from('bot_ai_analysis')
          .select('*')
          .eq('bot_id', botId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!analysisError && analysisData) {
          setAnalysis(analysisData);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (botId) {
      fetchData();
    }
  }, [botId]);

  return {
    loading,
    error,
    bot,
    analysis,
    isAnalyzing,
    analyzeBot,
    applyOptimization,
    learnFromTrade,
    predictTradeSignal
  };
}

