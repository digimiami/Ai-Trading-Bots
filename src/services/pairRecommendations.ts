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
    totalPnL: number;
    avgPnL: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
    bestStrategy?: any;
    avgTradeAmount: number;
    avgLeverage: number;
    avgStopLoss: number;
    avgTakeProfit: number;
  } {
    const closedTrades = trades.filter(t => t.status === 'filled' || t.status === 'closed' || t.status === 'completed');
    const wins = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losses = closedTrades.filter(t => (t.pnl || 0) < 0);
    const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
    
    // Calculate total PnL (sum of all trades)
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    
    // Calculate average PnL
    const avgPnL = closedTrades.length > 0 ? totalPnL / closedTrades.length : 0;

    // Calculate Profit Factor (total profits / total losses)
    const totalProfit = wins.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLoss = Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : (totalProfit > 0 ? 999 : 0);

    // Calculate Sharpe Ratio (simplified: average return / standard deviation of returns)
    const returns = closedTrades.map(t => t.pnl || 0);
    const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0;
    const variance = returns.length > 0
      ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
      : 0;
    const sharpeRatio = variance > 0 ? avgReturn / Math.sqrt(variance) : 0;

    // Calculate Max Drawdown (simplified: maximum consecutive loss period)
    let maxDrawdown = 0;
    let runningPnL = 0;
    let peakPnL = 0;
    for (const trade of closedTrades) {
      runningPnL += (trade.pnl || 0);
      if (runningPnL > peakPnL) {
        peakPnL = runningPnL;
      }
      const drawdown = peakPnL - runningPnL;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    // Convert to percentage if peakPnL > 0
    const maxDrawdownPercent = peakPnL > 0 ? (maxDrawdown / peakPnL) * 100 : 0;

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
      totalPnL,
      avgPnL,
      profitFactor,
      sharpeRatio,
      maxDrawdown: maxDrawdownPercent,
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
      
      // Get default advanced config if not provided
      const defaultAdvancedConfig: AdvancedStrategyConfig = currentSettings?.advancedConfig || this.getDefaultAdvancedConfig(symbol, tradingType);

      // Use optimizeStrategy method with pair-specific baseline
      const result = await openAIService.optimizeStrategy(
        {
          strategy: currentSettings?.strategy || pairStrategy,
          advancedConfig: defaultAdvancedConfig
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

      // Ensure advancedConfig is complete - merge AI result with defaults
      const completeAdvancedConfig: AdvancedStrategyConfig = {
        ...defaultAdvancedConfig,
        ...(result.advancedConfig || {}),
        // Ensure all critical parameters are set
        risk_per_trade_pct: result.advancedConfig?.risk_per_trade_pct ?? defaultAdvancedConfig.risk_per_trade_pct,
        adx_min_htf: result.advancedConfig?.adx_min_htf ?? defaultAdvancedConfig.adx_min_htf,
        sl_atr_mult: result.advancedConfig?.sl_atr_mult ?? defaultAdvancedConfig.sl_atr_mult,
        tp1_r: result.advancedConfig?.tp1_r ?? defaultAdvancedConfig.tp1_r,
        tp2_r: result.advancedConfig?.tp2_r ?? defaultAdvancedConfig.tp2_r,
      };

      // Ensure strategy is complete - merge AI result with defaults
      const completeStrategy: TradingStrategy = {
        ...pairStrategy,
        ...(result.strategy || {}),
        // Ensure all required strategy parameters are set
        rsiThreshold: result.strategy?.rsiThreshold ?? pairStrategy.rsiThreshold,
        adxThreshold: result.strategy?.adxThreshold ?? pairStrategy.adxThreshold,
        bbWidthThreshold: result.strategy?.bbWidthThreshold ?? pairStrategy.bbWidthThreshold,
        emaSlope: result.strategy?.emaSlope ?? pairStrategy.emaSlope,
        atrPercentage: result.strategy?.atrPercentage ?? pairStrategy.atrPercentage,
        vwapDistance: result.strategy?.vwapDistance ?? pairStrategy.vwapDistance,
        momentumThreshold: result.strategy?.momentumThreshold ?? pairStrategy.momentumThreshold,
        useMLPrediction: result.strategy?.useMLPrediction ?? pairStrategy.useMLPrediction,
        minSamplesForML: result.strategy?.minSamplesForML ?? pairStrategy.minSamplesForML
      };

      // Build recommendation from optimization result
      // If no historical trades, customize the reasoning to be more helpful
      const hasHistoricalData = metrics.totalTrades > 0;
      const defaultReasoning = hasHistoricalData
        ? `Optimized settings for ${symbol} based on ${metrics.totalTrades} historical trades (${metrics.winRate.toFixed(1)}% win rate, $${metrics.totalPnL.toFixed(2)} PnL)`
        : `Recommended settings for ${symbol} based on pair characteristics. No historical trades found - these are baseline recommendations to get started.`;

      return {
        symbol,
        recommended: true, // Always show as recommended (even with low confidence)
        confidence: result.confidence || (hasHistoricalData ? 0.7 : 0.6), // Higher confidence if we have data
        reasoning: result.reasoning || defaultReasoning,
        strategy: completeStrategy, // Always include full strategy
        advancedConfig: completeAdvancedConfig, // Always include full advanced config
        expectedPerformance: result.expectedImprovement || 
          (hasHistoricalData 
            ? `Expected improved performance with optimized parameters for ${symbol}`
            : `These baseline settings for ${symbol} are designed to start trading safely with pair-specific optimizations`),
        riskAssessment: this.getPairRiskAssessment(symbol),
        suggestedTradeAmount: pairBasicSettings.tradeAmount,
        suggestedLeverage: pairBasicSettings.leverage,
        suggestedStopLoss: pairBasicSettings.stopLoss,
        suggestedTakeProfit: pairBasicSettings.takeProfit,
        changes: this.buildChangesList(currentSettings, {
          strategy: completeStrategy,
          advancedConfig: completeAdvancedConfig
        })
      };
    } catch (error) {
      console.error('Error getting AI recommendation:', error);
      // Return default recommendations if AI fails
      return this.getDefaultRecommendations(symbol, tradingType, metrics);
    }
  }

  /**
   * Get default advanced config for a pair
   */
  private getDefaultAdvancedConfig(symbol: string, tradingType: 'spot' | 'futures'): AdvancedStrategyConfig {
    return {
      // Directional Bias
      bias_mode: 'auto',
      htf_timeframe: '4h',
      htf_trend_indicator: 'EMA200',
      ema_fast_period: 50,
      require_price_vs_trend: 'any',
      adx_min_htf: 23,
      require_adx_rising: true,
      
      // Regime Filter
      regime_mode: 'auto',
      adx_trend_min: 25,
      adx_meanrev_max: 19,
      
      // Session/Timing
      session_filter_enabled: false,
      allowed_hours_utc: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
      cooldown_bars: 8,
      
      // Volatility/Liquidity Gates
      atr_percentile_min: 20,
      bb_width_min: 0.012,
      bb_width_max: 0.03,
      min_24h_volume_usd: 500000000,
      max_spread_bps: 3,
      
      // Risk & Exits
      risk_per_trade_pct: 0.75,
      daily_loss_limit_pct: 3.0,
      weekly_loss_limit_pct: 6.0,
      max_trades_per_day: 8,
      max_concurrent: 2,
      max_consecutive_losses: 5,
      sl_atr_mult: 1.3,
      tp1_r: 1.0,
      tp2_r: 2.0,
      tp1_size: 0.5,
      breakeven_at_r: 0.8,
      trail_after_tp1_atr: 1.0,
      time_stop_hours: 48,
      
      // Technical Indicators
      rsi_period: 14,
      rsi_oversold: 30,
      rsi_overbought: 70,
      atr_period: 14,
      atr_tp_multiplier: 3,
      
      // ML/AI Settings
      use_ml_prediction: true,
      ml_confidence_threshold: 0.6,
      ml_min_samples: 100
    };
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

    if (!optimizationResult) {
      return changes;
    }

    // Compare strategy parameters
    if (optimizationResult.strategy) {
      const currentStrategy = currentSettings?.strategy || {};
      Object.keys(optimizationResult.strategy).forEach(key => {
        const recommendedValue = (optimizationResult.strategy as any)[key];
        const currentValue = (currentStrategy as any)[key];
        if (recommendedValue !== undefined && recommendedValue !== currentValue) {
          changes.push({
            parameter: `Strategy.${key}`,
            recommendedValue,
            defaultValue: currentValue,
            reason: `Optimized for better performance`
          });
        }
      });
    }

    // Compare advanced config parameters - check ALL important parameters
    if (optimizationResult.advancedConfig) {
      const currentAdvancedConfig = currentSettings?.advancedConfig || {};
      const importantParams = [
        // Risk Management
        'risk_per_trade_pct',
        'daily_loss_limit_pct',
        'weekly_loss_limit_pct',
        'max_trades_per_day',
        'max_concurrent',
        'max_consecutive_losses',
        // Stop Loss / Take Profit
        'sl_atr_mult',
        'tp1_r',
        'tp2_r',
        'tp1_size',
        'breakeven_at_r',
        'trail_after_tp1_atr',
        'time_stop_hours',
        // Directional Bias
        'bias_mode',
        'adx_min_htf',
        'htf_timeframe',
        'htf_trend_indicator',
        'require_adx_rising',
        // Regime Filter
        'regime_mode',
        'adx_trend_min',
        'adx_meanrev_max',
        // Volatility/Liquidity
        'atr_percentile_min',
        'bb_width_min',
        'bb_width_max',
        'max_spread_bps',
        // Technical Indicators
        'rsi_oversold',
        'rsi_overbought',
        'rsi_period',
        // ML/AI
        'use_ml_prediction',
        'ml_confidence_threshold',
        'ml_min_samples'
      ];

      importantParams.forEach(key => {
        const recommendedValue = (optimizationResult.advancedConfig as any)?.[key];
        const currentValue = (currentAdvancedConfig as any)?.[key];
        // Only add if value is different and recommended value is not undefined
        if (recommendedValue !== undefined && recommendedValue !== currentValue) {
          changes.push({
            parameter: `Advanced.${key}`,
            recommendedValue,
            defaultValue: currentValue !== undefined ? currentValue : 'default',
            reason: this.getParameterReason(key)
          });
        }
      });
    }

    return changes;
  }

  /**
   * Get reason for parameter change
   */
  private getParameterReason(parameter: string): string {
    const reasonMap: { [key: string]: string } = {
      'risk_per_trade_pct': 'Optimized risk per trade',
      'adx_min_htf': 'Optimized trend strength requirement',
      'sl_atr_mult': 'Optimized stop loss multiplier',
      'tp1_r': 'Optimized take profit ratio',
      'tp2_r': 'Optimized second take profit ratio',
      'bias_mode': 'Optimized directional bias',
      'regime_mode': 'Optimized market regime filter',
      'max_trades_per_day': 'Optimized daily trade limit',
      'max_concurrent': 'Optimized concurrent positions',
      'rsi_oversold': 'Optimized RSI oversold level',
      'rsi_overbought': 'Optimized RSI overbought level',
      'use_ml_prediction': 'Optimized ML prediction usage',
      'ml_confidence_threshold': 'Optimized ML confidence threshold'
    };
    return reasonMap[parameter] || 'Optimized for better performance';
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
    const defaultAdvancedConfig = this.getDefaultAdvancedConfig(symbol, tradingType);

    // Build changes list to show all parameters that differ from defaults
    const changes = this.buildChangesList(
      {
        strategy: {
          rsiThreshold: 70,
          adxThreshold: 25,
          bbWidthThreshold: 0.02,
          emaSlope: 0.5,
          atrPercentage: 2.5,
          vwapDistance: 1.2,
          momentumThreshold: 0.8,
          useMLPrediction: true,
          minSamplesForML: 100
        },
        advancedConfig: this.getDefaultAdvancedConfig(symbol, tradingType)
      },
      {
        strategy: pairStrategy,
        advancedConfig: defaultAdvancedConfig
      }
    );

    return {
      symbol,
      recommended: true,
      confidence: 0.7,
      reasoning: `Pair-specific recommended settings for ${symbol} based on historical characteristics`,
      strategy: pairStrategy,
      advancedConfig: defaultAdvancedConfig, // Always include full advanced config
      expectedPerformance: `Optimized settings for ${symbol} - expected improved performance`,
      riskAssessment: pairRisk,
      suggestedTradeAmount: pairBasicSettings.tradeAmount,
      suggestedLeverage: pairBasicSettings.leverage,
      suggestedStopLoss: pairBasicSettings.stopLoss,
      suggestedTakeProfit: pairBasicSettings.takeProfit,
      changes: changes // Show all parameter differences
    };
  }
}

export const pairRecommendationsService = new PairRecommendationsService();

