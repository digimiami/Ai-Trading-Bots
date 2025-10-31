/**
 * AI Pair-Based Recommendations Service
 * Provides optimized settings recommendations based on trading pair selection
 */

import { supabase } from '../lib/supabase';
import { openAIService } from './openai';
import type { TradingStrategy, AdvancedStrategyConfig } from '../types/trading';

export interface PairRecommendation {
  symbol: string;
  recommended: boolean;
  confidence: number;
  reasoning: string;
  strategy: TradingStrategy;
  advancedConfig?: AdvancedStrategyConfig;
  expectedPerformance: string;
  riskAssessment: 'low' | 'medium' | 'high';
  suggestedTradeAmount: number;
  suggestedLeverage: number;
  suggestedStopLoss: number;
  suggestedTakeProfit: number;
  changes: {
    parameter: string;
    recommendedValue: any;
    defaultValue: any;
    reason: string;
  }[];
}

class PairRecommendationsService {
  /**
   * Get AI recommendations for a trading pair
   */
  async getRecommendationsForPair(
    symbol: string,
    tradingType: 'spot' | 'futures',
    currentSettings?: {
      strategy?: TradingStrategy;
      advancedConfig?: AdvancedStrategyConfig;
      tradeAmount?: number;
      leverage?: number;
      stopLoss?: number;
      takeProfit?: number;
    }
  ): Promise<PairRecommendation | null> {
    try {
      // Fetch historical data for this pair from database
      const { data: historicalTrades, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('symbol', symbol)
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // Last 90 days
        .order('created_at', { ascending: false })
        .limit(100);

      if (tradesError) {
        console.error('Error fetching historical trades:', tradesError);
      }

      // Fetch existing bot configurations for this pair
      const { data: existingBots, error: botsError } = await supabase
        .from('trading_bots')
        .select('strategy, strategy_config, trade_amount, leverage, status, win_rate, pnl')
        .eq('symbol', symbol)
        .in('status', ['running', 'paused'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (botsError) {
        console.error('Error fetching existing bots:', botsError);
      }

      // Calculate performance metrics
      const performanceMetrics = this.calculatePerformanceMetrics(
        historicalTrades || [],
        existingBots || []
      );

      // Build recommendation prompt
      const recommendation = await this.buildRecommendation(
        symbol,
        tradingType,
        performanceMetrics,
        currentSettings
      );

      return recommendation;
    } catch (error) {
      console.error('Error getting pair recommendations:', error);
      // Always return a default recommendation instead of null
      return this.getDefaultRecommendations(symbol, tradingType, {
        totalTrades: 0,
        winRate: 0,
        avgPnL: 0,
        bestStrategy: undefined,
        avgTradeAmount: 100,
        avgLeverage: tradingType === 'futures' ? 5 : 1,
        avgStopLoss: 2.0,
        avgTakeProfit: 4.0
      });
    }
  }

  /**
   * Calculate performance metrics from historical data
   */
  private calculatePerformanceMetrics(
    trades: any[],
    bots: any[]
  ): {
    totalTrades: number;
    winRate: number;
    avgPnL: number;
    bestStrategy?: any;
    avgTradeAmount: number;
    avgLeverage: number;
    avgStopLoss: number;
    avgTakeProfit: number;
  } {
    const closedTrades = trades.filter(t => t.status === 'filled' || t.status === 'closed');
    const wins = closedTrades.filter(t => (t.pnl || 0) > 0);
    const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
    const avgPnL = closedTrades.length > 0
      ? closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / closedTrades.length
      : 0;

    // Find best performing bot configuration
    const bestBot = bots.reduce((best, bot) => {
      const currentWinRate = bot.win_rate || 0;
      const bestWinRate = best?.win_rate || 0;
      return currentWinRate > bestWinRate ? bot : best;
    }, null);

    const avgTradeAmount = bots.length > 0
      ? bots.reduce((sum, b) => sum + (b.trade_amount || 100), 0) / bots.length
      : 100;

    const avgLeverage = bots.length > 0
      ? bots.reduce((sum, b) => sum + (b.leverage || 5), 0) / bots.length
      : 5;

    // Default SL/TP if not available
    const avgStopLoss = 2.0;
    const avgTakeProfit = 4.0;

    return {
      totalTrades: closedTrades.length,
      winRate,
      avgPnL,
      bestStrategy: bestBot?.strategy,
      avgTradeAmount,
      avgLeverage,
      avgStopLoss,
      avgTakeProfit
    };
  }

  /**
   * Build AI recommendation using OpenAI
   */
  private async buildRecommendation(
    symbol: string,
    tradingType: 'spot' | 'futures',
    metrics: any,
    currentSettings?: any
  ): Promise<PairRecommendation> {
    try {
      // Get pair-specific recommended strategy
      const pairStrategy = this.getPairSpecificStrategy(symbol);

      // Use optimizeStrategy method with pair-specific baseline
      const result = await openAIService.optimizeStrategy(
        {
          strategy: currentSettings?.strategy || pairStrategy,
          advancedConfig: currentSettings?.advancedConfig
        },
        [], // No recent trades for new bot
        {
          ...metrics,
          symbol,
          tradingType,
          pairCharacteristics: this.getPairCharacteristics(symbol)
        }
      );

      // Get pair-specific basic settings
      const pairBasicSettings = this.getPairBasicSettings(symbol, tradingType);

      // Build recommendation from optimization result
      return {
        symbol,
        recommended: result.confidence > 0.5,
        confidence: result.confidence,
        reasoning: result.reasoning || `Optimized settings for ${symbol} based on pair characteristics and historical performance`,
        strategy: result.strategy,
        advancedConfig: result.advancedConfig,
        expectedPerformance: result.expectedImprovement || `Expected improved performance with optimized parameters for ${symbol}`,
        riskAssessment: this.getPairRiskAssessment(symbol),
        suggestedTradeAmount: pairBasicSettings.tradeAmount,
        suggestedLeverage: pairBasicSettings.leverage,
        suggestedStopLoss: pairBasicSettings.stopLoss,
        suggestedTakeProfit: pairBasicSettings.takeProfit,
        changes: this.buildChangesList(currentSettings, result)
      };
    } catch (error) {
      console.error('Error getting AI recommendation:', error);
      // Return default recommendations if AI fails
      return this.getDefaultRecommendations(symbol, tradingType, metrics);
    }
  }

  /**
   * Get pair-specific strategy baseline
   */
  private getPairSpecificStrategy(symbol: string): TradingStrategy {
    const pairStrategies: { [key: string]: Partial<TradingStrategy> } = {
      'BTCUSDT': { rsiThreshold: 70, adxThreshold: 25, momentumThreshold: 0.8 },
      'ETHUSDT': { rsiThreshold: 68, adxThreshold: 23, momentumThreshold: 0.85 },
      'SOLUSDT': { rsiThreshold: 65, adxThreshold: 27, momentumThreshold: 0.9 },
      'ADAUSDT': { rsiThreshold: 72, adxThreshold: 22, momentumThreshold: 0.75 },
      'DOTUSDT': { rsiThreshold: 70, adxThreshold: 24, momentumThreshold: 0.8 },
      'AVAXUSDT': { rsiThreshold: 65, adxThreshold: 28, momentumThreshold: 0.9 },
      'BNBUSDT': { rsiThreshold: 70, adxThreshold: 25, momentumThreshold: 0.8 },
      'XRPUSDT': { rsiThreshold: 72, adxThreshold: 20, momentumThreshold: 0.7 },
      'MATICUSDT': { rsiThreshold: 70, adxThreshold: 24, momentumThreshold: 0.8 },
      'LINKUSDT': { rsiThreshold: 68, adxThreshold: 26, momentumThreshold: 0.85 },
      'UNIUSDT': { rsiThreshold: 70, adxThreshold: 25, momentumThreshold: 0.8 },
      'LTCUSDT': { rsiThreshold: 72, adxThreshold: 22, momentumThreshold: 0.75 }
    };

    const pairStrategy = pairStrategies[symbol] || {};

    return {
      rsiThreshold: 70,
      adxThreshold: 25,
      bbWidthThreshold: 0.02,
      emaSlope: 0.5,
      atrPercentage: 2.5,
      vwapDistance: 1.2,
      momentumThreshold: 0.8,
      useMLPrediction: true,
      minSamplesForML: 100,
      ...pairStrategy
    };
  }

  /**
   * Get pair-specific basic settings
   */
  private getPairBasicSettings(
    symbol: string,
    tradingType: 'spot' | 'futures'
  ): {
    tradeAmount: number;
    leverage: number;
    stopLoss: number;
    takeProfit: number;
  } {
    const pairSettings: { [key: string]: { tradeAmount: number; stopLoss: number; takeProfit: number } } = {
      'BTCUSDT': { tradeAmount: 100, stopLoss: 2.0, takeProfit: 4.0 },
      'ETHUSDT': { tradeAmount: 100, stopLoss: 2.2, takeProfit: 4.5 },
      'SOLUSDT': { tradeAmount: 75, stopLoss: 2.5, takeProfit: 5.0 },
      'ADAUSDT': { tradeAmount: 100, stopLoss: 2.0, takeProfit: 4.0 },
      'DOTUSDT': { tradeAmount: 100, stopLoss: 2.2, takeProfit: 4.5 },
      'AVAXUSDT': { tradeAmount: 75, stopLoss: 2.5, takeProfit: 5.0 },
      'BNBUSDT': { tradeAmount: 100, stopLoss: 2.0, takeProfit: 4.0 },
      'XRPUSDT': { tradeAmount: 100, stopLoss: 1.8, takeProfit: 3.5 },
      'MATICUSDT': { tradeAmount: 100, stopLoss: 2.2, takeProfit: 4.5 },
      'LINKUSDT': { tradeAmount: 100, stopLoss: 2.2, takeProfit: 4.5 },
      'UNIUSDT': { tradeAmount: 100, stopLoss: 2.0, takeProfit: 4.0 },
      'LTCUSDT': { tradeAmount: 100, stopLoss: 2.0, takeProfit: 4.0 }
    };

    const settings = pairSettings[symbol] || { tradeAmount: 100, stopLoss: 2.0, takeProfit: 4.0 };

    return {
      ...settings,
      leverage: tradingType === 'futures' ? 5 : 1
    };
  }

  /**
   * Get pair-specific risk assessment
   */
  private getPairRiskAssessment(symbol: string): 'low' | 'medium' | 'high' {
    const riskMap: { [key: string]: 'low' | 'medium' | 'high' } = {
      'BTCUSDT': 'medium',
      'ETHUSDT': 'medium',
      'SOLUSDT': 'high',
      'ADAUSDT': 'medium',
      'DOTUSDT': 'medium',
      'AVAXUSDT': 'high',
      'BNBUSDT': 'medium',
      'XRPUSDT': 'medium',
      'MATICUSDT': 'medium',
      'LINKUSDT': 'medium',
      'UNIUSDT': 'medium',
      'LTCUSDT': 'low'
    };

    return riskMap[symbol] || 'medium';
  }

  /**
   * Get pair characteristics based on symbol
   */
  private getPairCharacteristics(symbol: string): string {
    const pairMap: { [key: string]: string } = {
      'BTCUSDT': 'High liquidity, moderate volatility, trend-following preferred',
      'ETHUSDT': 'High liquidity, moderate-high volatility, good for momentum',
      'SOLUSDT': 'High volatility, strong trends, momentum strategies work well',
      'ADAUSDT': 'Medium volatility, mean-reversion opportunities',
      'DOTUSDT': 'Medium-high volatility, trend-following preferred',
      'AVAXUSDT': 'High volatility, strong momentum, aggressive strategies',
      'BNBUSDT': 'High liquidity, moderate volatility, stable trends',
      'XRPUSDT': 'Medium volatility, news-sensitive, cautious approach',
      'MATICUSDT': 'Medium volatility, good for both trend and mean-reversion',
      'LINKUSDT': 'Medium-high volatility, momentum strategies',
      'UNIUSDT': 'Medium volatility, DeFi correlation, trend-following',
      'LTCUSDT': 'Medium volatility, stable trends, conservative approach'
    };

    return pairMap[symbol] || 'Medium volatility, standard trading approach recommended';
  }

  /**
   * Build changes list comparing current vs recommended settings
   */
  private buildChangesList(
    currentSettings?: any,
    optimizationResult?: any
  ): PairRecommendation['changes'] {
    const changes: PairRecommendation['changes'] = [];

    if (!currentSettings || !optimizationResult) {
      return changes;
    }

    // Compare strategy parameters
    if (currentSettings.strategy && optimizationResult.strategy) {
      Object.keys(optimizationResult.strategy).forEach(key => {
        const recommendedValue = (optimizationResult.strategy as any)[key];
        const currentValue = (currentSettings.strategy as any)[key];
        if (recommendedValue !== undefined && recommendedValue !== currentValue) {
          changes.push({
            parameter: key,
            recommendedValue,
            defaultValue: currentValue,
            reason: `Optimized for better performance`
          });
        }
      });
    }

    // Compare advanced config parameters
    if (currentSettings.advancedConfig && optimizationResult.advancedConfig) {
      const importantParams = [
        'risk_per_trade_pct',
        'adx_min_htf',
        'sl_atr_mult',
        'tp1_r',
        'tp2_r'
      ];

      importantParams.forEach(key => {
        const recommendedValue = (optimizationResult.advancedConfig as any)?.[key];
        const currentValue = (currentSettings.advancedConfig as any)?.[key];
        if (recommendedValue !== undefined && recommendedValue !== currentValue) {
          changes.push({
            parameter: key,
            recommendedValue,
            defaultValue: currentValue,
            reason: `Optimized for better risk/reward`
          });
        }
      });
    }

    return changes;
  }

  /**
   * Get default recommendations if AI fails
   */
  private getDefaultRecommendations(
    symbol: string,
    tradingType: 'spot' | 'futures',
    metrics: any
  ): PairRecommendation {
    // Use pair-specific defaults instead of generic ones
    const pairStrategy = this.getPairSpecificStrategy(symbol);
    const pairBasicSettings = this.getPairBasicSettings(symbol, tradingType);
    const pairRisk = this.getPairRiskAssessment(symbol);

    return {
      symbol,
      recommended: true,
      confidence: 0.7,
      reasoning: `Pair-specific recommended settings for ${symbol} based on historical characteristics`,
      strategy: pairStrategy,
      expectedPerformance: `Optimized settings for ${symbol} - expected improved performance`,
      riskAssessment: pairRisk,
      suggestedTradeAmount: pairBasicSettings.tradeAmount,
      suggestedLeverage: pairBasicSettings.leverage,
      suggestedStopLoss: pairBasicSettings.stopLoss,
      suggestedTakeProfit: pairBasicSettings.takeProfit,
      changes: []
    };
  }
}

export const pairRecommendationsService = new PairRecommendationsService();

