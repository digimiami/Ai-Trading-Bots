/**
 * OpenAI Integration Service
 * Provides self-learning capabilities for trading bots
 */

import type { TradingStrategy, AdvancedStrategyConfig } from '../types/trading';

interface TradeAnalysis {
  symbol: string;
  side?: string; // Optional: 'buy' or 'sell'
  entryPrice: number;
  exitPrice?: number; // Optional: may not be set for open positions
  pnl: number;
  indicators: {
    rsi: number;
    adx: number;
    bbWidth: number;
    volume: number;
  };
  outcome: 'win' | 'loss';
  timestamp: string;
}

interface PerformanceData {
  totalTrades: number;
  winRate: number;
  totalPnL: number;
  avgWinPnL: number;
  avgLossPnL: number;
  maxDrawdown: number;
  sharpeRatio: number;
  bestPerformingPair: string;
  worstPerformingPair: string;
  recentTrades: TradeAnalysis[];
  timeRange: string;
}

interface AIRecommendation {
  recommended: boolean;
  confidence: number;
  reasoning: string;
  suggestedParameters: {
    rsiThreshold?: number;
    adxThreshold?: number;
    stopLoss?: number;
    takeProfit?: number;
    leverage?: number;
  };
  expectedImprovement: string;
  riskAssessment: string;
}

class OpenAIService {
  private apiKey: string;
  private baseUrl: string = 'https://api.openai.com/v1';

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
  }

  /**
   * Analyze bot performance and generate strategy recommendations
   */
  async analyzeBotPerformance(botId: string, performanceData: PerformanceData): Promise<AIRecommendation> {
    if (!this.apiKey) {
      console.warn('OpenAI API key not configured');
      return this.getDefaultRecommendation();
    }

    try {
      const prompt = this.buildAnalysisPrompt(botId, performanceData);
      const response = await this.callOpenAI(prompt);
      
      return this.parseAIResponse(response);
    } catch (error) {
      console.error('Error analyzing bot performance:', error);
      return this.getDefaultRecommendation();
    }
  }

  /**
   * Get trading signal prediction based on current market conditions
   */
  async predictTradeSignal(
    symbol: string,
    marketData: any,
    historicalTrades: TradeAnalysis[]
  ): Promise<{ signal: 'buy' | 'sell' | 'hold'; confidence: number; reasoning: string }> {
    if (!this.apiKey) {
      return { signal: 'hold', confidence: 0.5, reasoning: 'AI not configured' };
    }

    try {
      const prompt = this.buildPredictionPrompt(symbol, marketData, historicalTrades);
      const response = await this.callOpenAI(prompt);
      
      return this.parsePredictionResponse(response);
    } catch (error) {
      console.error('Error predicting trade signal:', error);
      return { signal: 'hold', confidence: 0.5, reasoning: 'Prediction failed' };
    }
  }

  /**
   * Learn from trades and suggest parameter optimizations
   * Now supports both TradingStrategy and AdvancedStrategyConfig
   */
  async optimizeStrategy(
    strategies: {
      strategy: TradingStrategy;
      advancedConfig?: AdvancedStrategyConfig;
    },
    recentTrades: TradeAnalysis[],
    performanceMetrics: any
  ): Promise<{
    strategy: TradingStrategy;
    advancedConfig?: AdvancedStrategyConfig;
    reasoning: string;
    expectedImprovement: string;
    confidence: number;
  }> {
    if (!this.apiKey) {
      return {
        strategy: strategies.strategy,
        advancedConfig: strategies.advancedConfig,
        reasoning: 'AI optimization not available - configure OpenAI API key',
        expectedImprovement: 'N/A',
        confidence: 0
      };
    }

    try {
      const prompt = this.buildOptimizationPrompt(strategies, recentTrades, performanceMetrics);
      const response = await this.callOpenAI(prompt);
      
      return this.parseOptimizationResponse(response, strategies);
    } catch (error) {
      console.error('Error optimizing strategy:', error);
      return {
        strategy: strategies.strategy,
        advancedConfig: strategies.advancedConfig,
        reasoning: 'Optimization failed',
        expectedImprovement: 'Unknown',
        confidence: 0
      };
    }
  }

  /**
   * Build analysis prompt for OpenAI
   */
  private buildAnalysisPrompt(botId: string, performanceData: PerformanceData): string {
    return `
You are an advanced trading bot AI advisor. Analyze the following bot performance and provide recommendations.

Bot Performance Data:
- Total Trades: ${performanceData.totalTrades}
- Win Rate: ${performanceData.winRate}%
- Total PnL: $${performanceData.totalPnL}
- Sharpe Ratio: ${performanceData.sharpeRatio}
- Best Pair: ${performanceData.bestPerformingPair}
- Worst Pair: ${performanceData.worstPerformingPair}
- Max Drawdown: ${performanceData.maxDrawdown}%

Recent Trades Summary:
${performanceData.recentTrades.slice(-10).map(t => 
  `- ${t.symbol}: ${t.outcome} (PnL: $${t.pnl.toFixed(2)})`
).join('\n')}

Provide a JSON response with:
{
  "recommended": boolean,
  "confidence": number (0-1),
  "reasoning": "Detailed explanation",
  "suggestedParameters": {
    "rsiThreshold": number,
    "adxThreshold": number,
    "stopLoss": number,
    "takeProfit": number,
    "leverage": number
  },
  "expectedImprovement": "Expected performance improvement",
  "riskAssessment": "Risk level assessment"
}
`.trim();
  }

  /**
   * Build prediction prompt for trade signals
   */
  private buildPredictionPrompt(symbol: string, marketData: any, historicalTrades: TradeAnalysis[]): string {
    return `
Analyze market data for ${symbol} and provide a trading recommendation.

Current Market Data:
- RSI: ${marketData.rsi}
- ADX: ${marketData.adx}
- BB Width: ${marketData.bbWidth}
- Volume: ${marketData.volume}

Recent Trade History (this bot):
${historicalTrades.slice(-5).map(t => 
  `- ${t.symbol}: ${t.outcome}, PnL: $${t.pnl.toFixed(2)}`
).join('\n')}

Provide a JSON response with:
{
  "signal": "buy|sell|hold",
  "confidence": number (0-1),
  "reasoning": "Why this signal"
}
`.trim();
  }

  /**
   * Build optimization prompt for both strategy types
   */
  private buildOptimizationPrompt(
    strategies: { strategy: TradingStrategy; advancedConfig?: AdvancedStrategyConfig },
    recentTrades: TradeAnalysis[],
    metrics: any
  ): string {
    // Check input size first - if strategies are huge, use minimal format immediately
    // Use try-catch in case strategy has circular references or huge nested objects
    let strategyStrSize = 0;
    let advancedStrSize = 0;
    try {
      strategyStrSize = JSON.stringify(strategies.strategy || {}).length;
      advancedStrSize = strategies.advancedConfig ? JSON.stringify(strategies.advancedConfig).length : 0;
    } catch (e) {
      console.error('Error stringifying strategies:', e);
      // If stringify fails (circular refs, etc), use minimal format
      return this.buildMinimalPrompt(strategies, metrics, recentTrades);
    }
    
    // If input is already too large (over 50KB), use minimal format
    if (strategyStrSize + advancedStrSize > 50000) {
      console.warn(`⚠️ Input strategies too large (${Math.round((strategyStrSize + advancedStrSize)/1024)}KB). Using minimal format.`);
      return this.buildMinimalPrompt(strategies, metrics, recentTrades);
    }

    // Extract only essential numeric values to minimize size
    const strategySummary = {
      rsi: strategies.strategy.rsiThreshold,
      adx: strategies.strategy.adxThreshold,
      bbw: strategies.strategy.bbWidthThreshold,
      ema: strategies.strategy.emaSlope,
      atr: strategies.strategy.atrPercentage,
      vwap: strategies.strategy.vwapDistance,
      mom: strategies.strategy.momentumThreshold,
      ml: strategies.strategy.useMLPrediction
    };
    
    const advancedSummary = strategies.advancedConfig ? {
      bias: strategies.advancedConfig.bias_mode,
      risk: strategies.advancedConfig.risk_per_trade_pct,
      adxHtf: strategies.advancedConfig.adx_min_htf,
      regime: strategies.advancedConfig.regime_mode,
      sl: strategies.advancedConfig.sl_atr_mult,
      tp1: strategies.advancedConfig.tp1_r,
      tp2: strategies.advancedConfig.tp2_r
    } : null;

    // Build compact summary strings (no JSON overhead)
    const strategyStr = `rsi:${strategySummary.rsi},adx:${strategySummary.adx},bbw:${strategySummary.bbw},ema:${strategySummary.ema},atr:${strategySummary.atr},vwap:${strategySummary.vwap},mom:${strategySummary.mom},ml:${strategySummary.ml}`;
    const advancedStr = advancedSummary ? 
      `bias:${advancedSummary.bias},risk:${advancedSummary.risk},adxHtf:${advancedSummary.adxHtf},regime:${advancedSummary.regime},sl:${advancedSummary.sl},tp1:${advancedSummary.tp1},tp2:${advancedSummary.tp2}` : '';

    return `
Optimize trading strategy.

CURRENT:
S:${strategyStr}
${advancedStr ? `A:${advancedStr}` : ''}

PERF:
WR:${Math.round(metrics.winRate)}% PnL:$${Math.round(metrics.totalPnL)} PF:${metrics.profitFactor.toFixed(2)} SR:${metrics.sharpeRatio.toFixed(2)} DD:${Math.round(metrics.maxDrawdown)}%

TRADES (last 3):
${recentTrades.slice(-3).map(t => {
  const s = (t.symbol || 'X').substring(0, 3);
  const sd = t.side ? t.side[0] : '?';
  const o = (t.outcome || 'u')[0];
  const p = Math.round(t.pnl || 0);
  return `${s}${sd}:${o}$${p}`;
}).join(' ')}

Return JSON:
{
  "strategy": {"rsiThreshold":num,"adxThreshold":num,"bbWidthThreshold":num,"emaSlope":num,"atrPercentage":num,"vwapDistance":num,"momentumThreshold":num,"useMLPrediction":bool,"minSamplesForML":num},
  ${advancedSummary ? `"advancedConfig": {"bias_mode":"str","risk_per_trade_pct":num,"adx_min_htf":num,"regime_mode":"str","sl_atr_mult":num,"tp1_r":num,"tp2_r":num},` : ''}
  "reasoning": "brief",
  "expectedImprovement": "brief",
  "confidence": num
}
`.trim();
  }

  /**
   * Build ultra-minimal prompt for very large inputs
   */
  private buildMinimalPrompt(
    strategies: { strategy: TradingStrategy; advancedConfig?: AdvancedStrategyConfig },
    metrics: any,
    recentTrades: TradeAnalysis[]
  ): string {
    // Extract only key numbers - no JSON overhead
    const rsi = strategies.strategy?.rsiThreshold || 0;
    const adx = strategies.strategy?.adxThreshold || 0;
    const wr = Math.round(metrics?.winRate || 0);
    const pnl = Math.round(metrics?.totalPnL || 0);
    const pf = parseFloat((metrics?.profitFactor || 0).toFixed(1));
    
    // Last 2 trades only, minimal format
    const trades = recentTrades.slice(-2).map(t => {
      const sym = (t.symbol || 'X').substring(0, 2);
      const out = (t.outcome || 'u')[0];
      const p = Math.round(t.pnl || 0);
      return `${sym}${out}$${p}`;
    }).join(',');
    
    return `Opt: rsi:${rsi},adx:${adx} WR:${wr}% PnL:$${pnl} PF:${pf} Trades:${trades}. Return JSON: strategy params, reasoning, confidence.`;
  }

  /**
   * Call OpenAI API with JSON mode support
   */
  private async callOpenAI(prompt: string, useJsonMode: boolean = true): Promise<any> {
      // Check prompt size and warn if too large
      // More accurate token estimate: ~0.75 tokens per character for English text
      const promptTokens = Math.ceil(prompt.length * 0.75);
      if (promptTokens > 50000) {
        console.warn(`⚠️ Large prompt detected (~${Math.round(promptTokens/1000)}K tokens). Prompt size: ${Math.round(prompt.length/1024)}KB`);
        // If still too large, truncate prompt more aggressively
        if (promptTokens > 100000) {
          console.error(`❌ Prompt too large (${Math.round(promptTokens/1000)}K tokens). Truncating...`);
          // Keep only essential parts - remove advanced config entirely if too large
          const parts = prompt.split('ADVANCED');
          if (parts.length > 1) {
            prompt = parts[0] + 'PERFORMANCE: [metrics summary only]';
          } else {
            // If no ADVANCED section, just keep first 50000 chars
            prompt = prompt.substring(0, 50000);
          }
        }
      }

      const body: any = {
      model: 'gpt-4o', // Use latest GPT-4 model
      messages: [
        { 
          role: 'system', 
          content: 'You are a professional trading analyst. Provide data-driven recommendations. Always respond with valid JSON only.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3, // Lower temperature for more consistent, logical responses
      max_tokens: 1000 // Reduced to prevent token limit issues
    };

    // Use JSON mode if available (for better JSON parsing)
    if (useJsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    try {
      return JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```json\s*(\{.*\})\s*```/s) || content.match(/(\{.*\})/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      throw new Error('Failed to parse OpenAI response as JSON');
    }
  }

  /**
   * Parse AI response for recommendations
   */
  private parseAIResponse(response: any): AIRecommendation {
    return {
      recommended: response.recommended || false,
      confidence: response.confidence || 0.5,
      reasoning: response.reasoning || 'No analysis available',
      suggestedParameters: response.suggestedParameters || {},
      expectedImprovement: response.expectedImprovement || 'Unknown',
      riskAssessment: response.riskAssessment || 'Unknown'
    };
  }

  /**
   * Parse prediction response
   */
  private parsePredictionResponse(response: any): { signal: 'buy' | 'sell' | 'hold'; confidence: number; reasoning: string } {
    return {
      signal: response.signal || 'hold',
      confidence: response.confidence || 0.5,
      reasoning: response.reasoning || 'No prediction available'
    };
  }

  /**
   * Parse optimization response for both strategy types
   */
  private parseOptimizationResponse(
    response: any, 
    currentStrategies: { strategy: TradingStrategy; advancedConfig?: AdvancedStrategyConfig }
  ): {
    strategy: TradingStrategy;
    advancedConfig?: AdvancedStrategyConfig;
    reasoning: string;
    expectedImprovement: string;
    confidence: number;
  } {
    // Merge suggested strategy parameters with current strategy
    const optimizedStrategy: TradingStrategy = {
      ...currentStrategies.strategy,
      ...(response.strategy || response.suggestedParameters || {})
    };

    // Merge advanced config if provided
    let optimizedAdvancedConfig: AdvancedStrategyConfig | undefined;
    if (currentStrategies.advancedConfig || response.advancedConfig) {
      optimizedAdvancedConfig = {
        ...currentStrategies.advancedConfig,
        ...(response.advancedConfig || {})
      };
    }

    return {
      strategy: optimizedStrategy,
      advancedConfig: optimizedAdvancedConfig,
      reasoning: response.reasoning || 'AI-generated optimization',
      expectedImprovement: response.expectedImprovement || 'Performance improvement expected',
      confidence: response.confidence || 0.7
    };
  }

  /**
   * Get default recommendation when API is not available
   */
  private getDefaultRecommendation(): AIRecommendation {
    return {
      recommended: false,
      confidence: 0.5,
      reasoning: 'AI analysis not available. Configure OpenAI API key to enable self-learning features.',
      suggestedParameters: {},
      expectedImprovement: 'N/A',
      riskAssessment: 'Unable to assess without AI'
    };
  }
}

export const openAIService = new OpenAIService();

