/**
 * OpenAI Integration Service
 * Provides self-learning capabilities for trading bots
 */

interface TradeAnalysis {
  symbol: string;
  entryPrice: number;
  exitPrice: number;
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
   */
  async optimizeStrategy(
    strategy: any,
    recentTrades: TradeAnalysis[],
    performanceMetrics: any
  ): Promise<any> {
    if (!this.apiKey) {
      return strategy; // Return unchanged if no API key
    }

    try {
      const prompt = this.buildOptimizationPrompt(strategy, recentTrades, performanceMetrics);
      const response = await this.callOpenAI(prompt);
      
      return this.parseOptimizationResponse(response, strategy);
    } catch (error) {
      console.error('Error optimizing strategy:', error);
      return strategy;
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
   * Build optimization prompt
   */
  private buildOptimizationPrompt(strategy: any, recentTrades: TradeAnalysis[], metrics: any): string {
    return `
Optimize this trading strategy based on recent performance.

Current Strategy:
${JSON.stringify(strategy, null, 2)}

Performance Metrics:
- Win Rate: ${metrics.winRate}%
- Avg Win: $${metrics.avgWin}
- Avg Loss: $${metrics.avgLoss}
- Profit Factor: ${metrics.profitFactor}

Recent Trades:
${recentTrades.map(t => 
  `- ${t.symbol}: ${t.outcome}, PnL: $${t.pnl}, Indicators: RSI=${t.indicators.rsi}, ADX=${t.indicators.adx}`
).join('\n')}

Suggest optimized parameters as JSON:
{
  "rsiThreshold": number,
  "adxThreshold": number,
  "stopLoss": number,
  "takeProfit": number,
  "reasoning": "Why these changes"
}
`.trim();
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a professional trading analyst. Provide JSON responses only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
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
   * Parse optimization response
   */
  private parseOptimizationResponse(response: any, currentStrategy: any): any {
    return {
      ...currentStrategy,
      ...response.suggestedParameters,
      aiOptimized: true,
      optimizationReasoning: response.reasoning
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

