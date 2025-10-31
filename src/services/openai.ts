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
    return `
You are an expert trading strategy optimizer. Analyze the trading bot's performance and optimize both basic strategy parameters and advanced configuration.

CURRENT BASIC STRATEGY:
${JSON.stringify(strategies.strategy, null, 2)}

${strategies.advancedConfig ? `CURRENT ADVANCED CONFIGURATION:
${JSON.stringify(strategies.advancedConfig, null, 2)}` : ''}

PERFORMANCE METRICS:
- Win Rate: ${metrics.winRate}%
- Total PnL: $${metrics.totalPnL}
- Avg Win: $${metrics.avgWin}
- Avg Loss: $${metrics.avgLoss}
- Profit Factor: ${metrics.profitFactor}
- Sharpe Ratio: ${metrics.sharpeRatio}
- Max Drawdown: ${metrics.maxDrawdown}%

RECENT TRADES (last 20):
${recentTrades.slice(0, 20).map(t => {
  const side = t.side ? t.side.toUpperCase() : 'UNKNOWN';
  const symbol = t.symbol || 'N/A';
  const outcome = t.outcome || 'unknown';
  const pnl = t.pnl?.toFixed(2) || '0.00';
  const entryPrice = t.entryPrice || 'N/A';
  const exitPrice = t.exitPrice || 'N/A';
  return `- ${symbol} ${side}: ${outcome}, PnL: $${pnl}, Entry: $${entryPrice}, Exit: $${exitPrice}`;
}).join('\n')}

Provide optimized parameters as JSON. Keep values realistic and within trading best practices:
{
  "strategy": {
    "rsiThreshold": number (0-100),
    "adxThreshold": number (0-100),
    "bbWidthThreshold": number,
    "emaSlope": number,
    "atrPercentage": number,
    "vwapDistance": number,
    "momentumThreshold": number,
    "useMLPrediction": boolean,
    "minSamplesForML": number
  },
  ${strategies.advancedConfig ? `"advancedConfig": {
    "bias_mode": "long-only|short-only|both|auto",
    "htf_timeframe": "4h|1d|1h|15m",
    "risk_per_trade_pct": number (0.5-5.0),
    "sl_atr_mult": number (1.0-3.0),
    "tp1_r": number (1.5-4.0),
    "tp2_r": number (2.0-6.0),
    "adx_min_htf": number (15-35),
    "regime_mode": "trend|mean-reversion|auto",
    "adx_trend_min": number (25-40),
    "adx_meanrev_max": number (15-25)
  },` : ''}
  "reasoning": "Detailed explanation of why these changes will improve performance",
  "expectedImprovement": "Expected win rate improvement (e.g., +5% win rate, +10% profit factor)",
  "confidence": number (0-1) representing confidence in these optimizations
}
`.trim();
  }

  /**
   * Call OpenAI API with JSON mode support
   */
  private async callOpenAI(prompt: string, useJsonMode: boolean = true): Promise<any> {
    const body: any = {
      model: 'gpt-4o', // Use latest GPT-4 model
      messages: [
        { 
          role: 'system', 
          content: 'You are a professional trading analyst and quantitative strategist. Provide detailed, data-driven recommendations. Always respond with valid JSON only.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3, // Lower temperature for more consistent, logical responses
      max_tokens: 2000 // Increased for detailed optimization responses
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

