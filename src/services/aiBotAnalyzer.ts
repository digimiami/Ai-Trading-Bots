/**
 * AI Bot Settings Analyzer
 * Analyzes all bot settings and provides win rate improvement recommendations
 */

interface BotSettings {
  // Basic settings
  interval: number;
  totalCycles: number;
  stopLoss: number;
  takeProfit: number;
  
  // Advanced Risk Management
  maxDailyLoss: number;
  maxPositionSize: number;
  trailingStop: boolean;
  partialProfitTaking: boolean;
  
  // Technical Indicators
  rsiOversold: number;
  rsiOverbought: number;
  macdSignal: boolean;
  bollingerBands: boolean;
  volumeFilter: boolean;
  
  // Safety Features
  emergencyStop: boolean;
  maxConsecutiveLosses: number;
  cooldown: number;
}

interface BotPerformance {
  totalTrades: number;
  winRate: number;
  totalPnL: number;
  avgWinPnL: number;
  avgLossPnL: number;
  maxDrawdown: number;
  profitFactor: number;
  bestDay: string;
  worstDay: string;
}

interface AIRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  setting: string;
  currentValue: any;
  recommendedValue: any;
  reason: string;
  expectedImprovement: string;
  riskLevel: 'low' | 'medium' | 'high';
}

class AIBotAnalyzer {
  private apiKey: string;
  private baseUrl: string = 'https://api.openai.com/v1';

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
  }

  /**
   * Analyze all bot settings and provide win rate improvement recommendations
   */
  async analyzeBotSettingsForWinRate(
    botId: string,
    settings: BotSettings,
    performance: BotPerformance
  ): Promise<{
    overallScore: number;
    winRateAnalysis: string;
    recommendations: AIRecommendation[];
    criticalIssues: string[];
    quickWins: string[];
  }> {
    if (!this.apiKey) {
      return this.getDefaultAnalysis(settings, performance);
    }

    try {
      const prompt = this.buildWinRateAnalysisPrompt(settings, performance);
      const response = await this.callOpenAI(prompt);
      
      return this.parseWinRateRecommendations(response, settings);
    } catch (error) {
      console.error('Error analyzing bot settings:', error);
      return this.getDefaultAnalysis(settings, performance);
    }
  }

  /**
   * Build comprehensive win rate analysis prompt
   */
  private buildWinRateAnalysisPrompt(settings: BotSettings, performance: BotPerformance): string {
    return `
You are an expert trading bot AI advisor specializing in improving win rates and trading performance. 

Analyze these bot settings and performance data to provide specific recommendations for improving the win rate.

CURRENT SETTINGS:
- Stop Loss: ${settings.stopLoss}%
- Take Profit: ${settings.takeProfit}%
- RSI Oversold: ${settings.rsiOversold}
- RSI Overbought: ${settings.rsiOverbought}
- Max Daily Loss: ${settings.maxDailyLoss}%
- Position Size: ${settings.maxPositionSize}%
- Trailing Stop: ${settings.trailingStop ? 'Enabled' : 'Disabled'}
- Partial Profit: ${settings.partialProfitTaking ? 'Enabled' : 'Disabled'}
- Emergency Stop: ${settings.emergencyStop ? 'Enabled' : 'Disabled'}
- Cooldown: ${settings.cooldown} minutes

CURRENT PERFORMANCE:
- Total Trades: ${performance.totalTrades}
- Win Rate: ${performance.winRate}%
- Total PnL: $${performance.totalPnL}
- Avg Win: $${performance.avgWinPnL}
- Avg Loss: $${performance.avgLossPnL}
- Profit Factor: ${performance.profitFactor}

Provide a detailed JSON response with specific recommendations to improve win rate:

{
  "overallScore": number (0-100),
  "winRateAnalysis": "Detailed analysis of what's working and what's not",
  "recommendations": [
    {
      "priority": "critical|high|medium|low",
      "setting": "setting_name",
      "currentValue": current_value,
      "recommendedValue": recommended_value,
      "reason": "Why this change will help",
      "expectedImprovement": "Expected win rate improvement",
      "riskLevel": "low|medium|high"
    }
  ],
  "criticalIssues": ["List of critical problems"],
  "quickWins": ["Easy changes for immediate improvement"]
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
          { 
            role: 'system', 
            content: 'You are a professional quantitative trading advisor. Analyze bot settings and provide specific, actionable recommendations to improve win rate and trading performance. Focus on data-driven optimizations.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  }

  /**
   * Parse AI response
   */
  private parseWinRateRecommendations(response: any, settings: BotSettings): any {
    return {
      overallScore: response.overallScore || 60,
      winRateAnalysis: response.winRateAnalysis || 'Analysis not available',
      recommendations: response.recommendations || [],
      criticalIssues: response.criticalIssues || [],
      quickWins: response.quickWins || []
    };
  }

  /**
   * Default analysis when API not available
   */
  private getDefaultAnalysis(settings: BotSettings, performance: BotPerformance): any {
    const recommendations: AIRecommendation[] = [];
    
    // Analyze settings and provide basic recommendations
    if (settings.stopLoss / settings.takeProfit > 0.5) {
      recommendations.push({
        priority: 'high',
        setting: 'stopLoss',
        currentValue: settings.stopLoss,
        recommendedValue: settings.takeProfit * 0.4,
        reason: 'Stop loss is too high relative to take profit, reducing risk/reward ratio',
        expectedImprovement: 'Improve R:R ratio for better win rate',
        riskLevel: 'low'
      });
    }

    if (settings.rsiOverbought - settings.rsiOversold < 30) {
      recommendations.push({
        priority: 'medium',
        setting: 'rsiOversold',
        currentValue: settings.rsiOversold,
        recommendedValue: 35,
        reason: 'RSI range is too narrow, missing potential trade entries',
        expectedImprovement: 'More trading opportunities without compromising quality',
        riskLevel: 'low'
      });
    }

    if (!settings.trailingStop) {
      recommendations.push({
        priority: 'high',
        setting: 'trailingStop',
        currentValue: settings.trailingStop,
        recommendedValue: true,
        reason: 'Trailing stop protects profits and lets winners run longer',
        expectedImprovement: '10-15% better profit capture',
        riskLevel: 'low'
      });
    }

    const profitFactor = performance.totalPnL / Math.abs(performance.avgLossPnL || 1);
    const profitFactorImprovement = profitFactor < 1.5 ? 'critical' : profitFactor < 2.0 ? 'high' : 'medium';

    return {
      overallScore: Math.min(performance.winRate || 0, 100),
      winRateAnalysis: `Current win rate: ${performance.winRate}%. ${profitFactor < 1.5 ? 'CRITICAL: Profit factor is below 1.5 - the bot is losing money overall.' : performance.winRate < 50 ? 'Win rate needs improvement. Focus on better entry signals and risk management.' : 'Win rate is decent but can be optimized further.'}`,
      recommendations,
      criticalIssues: profitFactor < 1.5 ? ['Profit factor below 1.5 - not profitable overall'] : [],
      quickWins: recommendations.filter(r => r.priority === 'high').map(r => `Enable ${r.setting}: ${r.reason}`)
    };
  }

  /**
   * Quick win rate prediction based on settings
   */
  calculateProjectedWinRate(settings: BotSettings): number {
    let baseWinRate = 50;
    
    // Adjust based on risk/reward ratio
    const riskRewardRatio = settings.takeProfit / settings.stopLoss;
    baseWinRate += (riskRewardRatio - 1) * 5;
    
    // Adjust based on RSI settings
    if (settings.rsiOversold < 30) baseWinRate += 2;
    if (settings.rsiOverbought > 70) baseWinRate += 2;
    
    // Trailing stop helps
    if (settings.trailingStop) baseWinRate += 3;
    
    // Emergency stop is good
    if (settings.emergencyStop) baseWinRate += 2;
    
    // Partial profit taking helps
    if (settings.partialProfitTaking) baseWinRate += 2;
    
    // Volume filter helps
    if (settings.volumeFilter) baseWinRate += 1;
    
    // MACD helps
    if (settings.macdSignal) baseWinRate += 2;
    
    // Bollinger Bands help
    if (settings.bollingerBands) baseWinRate += 2;
    
    return Math.min(Math.max(baseWinRate, 45), 75);
  }
}

export const aiBotAnalyzer = new AIBotAnalyzer();

