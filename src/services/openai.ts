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
  private deepseekApiKey: string;
  private deepseekBaseUrl: string = 'https://api.deepseek.com/v1';
  private useDeepSeek: boolean = false;

  constructor() {
    // Load API keys from environment variables or localStorage
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('ai_openai_api_key') || '';
    this.deepseekApiKey = import.meta.env.VITE_DEEPSEEK_API_KEY || localStorage.getItem('ai_deepseek_api_key') || '';
    
    // Load provider preference from localStorage, default to DeepSeek if available
    const savedProvider = localStorage.getItem('ai_provider_preference');
    if (savedProvider === 'openai' || savedProvider === 'deepseek') {
      this.useDeepSeek = savedProvider === 'deepseek';
    } else {
      // Auto-detect: Prefer DeepSeek if available
      this.useDeepSeek = !!this.deepseekApiKey;
    }
  }

  /**
   * Set OpenAI API key (for UI configuration)
   */
  setOpenAIKey(apiKey: string): void {
    this.apiKey = apiKey;
    if (apiKey) {
      localStorage.setItem('ai_openai_api_key', apiKey);
      console.log('✅ OpenAI API key saved');
    } else {
      localStorage.removeItem('ai_openai_api_key');
      console.log('✅ OpenAI API key removed');
    }
  }

  /**
   * Set DeepSeek API key (for UI configuration)
   */
  setDeepSeekKey(apiKey: string): void {
    this.deepseekApiKey = apiKey;
    if (apiKey) {
      localStorage.setItem('ai_deepseek_api_key', apiKey);
      console.log('✅ DeepSeek API key saved');
    } else {
      localStorage.removeItem('ai_deepseek_api_key');
      console.log('✅ DeepSeek API key removed');
    }
  }

  /**
   * Get current API keys (masked for security)
   */
  getApiKeys(): { openai: string; deepseek: string } {
    return {
      openai: this.apiKey ? `${this.apiKey.substring(0, 7)}...${this.apiKey.substring(this.apiKey.length - 4)}` : '',
      deepseek: this.deepseekApiKey ? `${this.deepseekApiKey.substring(0, 7)}...${this.deepseekApiKey.substring(this.deepseekApiKey.length - 4)}` : ''
    };
  }

  /**
   * Set AI provider preference
   */
  setProvider(provider: 'openai' | 'deepseek'): void {
    if (provider === 'deepseek' && !this.deepseekApiKey) {
      console.warn('DeepSeek API key not configured');
      return;
    }
    if (provider === 'openai' && !this.apiKey) {
      console.warn('OpenAI API key not configured');
      return;
    }
    this.useDeepSeek = provider === 'deepseek';
    localStorage.setItem('ai_provider_preference', provider);
    console.log(`✅ AI Provider set to: ${provider}`);
  }

  /**
   * Get current AI provider preference
   */
  getProvider(): 'openai' | 'deepseek' {
    return this.useDeepSeek ? 'deepseek' : 'openai';
  }

  /**
   * Refresh API keys from localStorage (useful after saving via UI)
   */
  refreshKeys(): void {
    // Always reload from localStorage first (user-set keys take precedence)
    const storedOpenAI = localStorage.getItem('ai_openai_api_key');
    const storedDeepSeek = localStorage.getItem('ai_deepseek_api_key');
    
    // Only use env vars if localStorage doesn't have the key
    if (storedOpenAI) {
      this.apiKey = storedOpenAI;
      console.log('✅ OpenAI key refreshed from localStorage');
    } else if (import.meta.env.VITE_OPENAI_API_KEY) {
      this.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      console.log('✅ OpenAI key loaded from env var');
    } else {
      this.apiKey = '';
    }
    
    if (storedDeepSeek) {
      this.deepseekApiKey = storedDeepSeek;
      console.log('✅ DeepSeek key refreshed from localStorage');
    } else if (import.meta.env.VITE_DEEPSEEK_API_KEY) {
      this.deepseekApiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
      console.log('✅ DeepSeek key loaded from env var');
    } else {
      this.deepseekApiKey = '';
    }
    
    console.log('🔄 AI API keys refreshed:', {
      openai: !!this.apiKey,
      deepseek: !!this.deepseekApiKey
    });
  }

  private aiKeysStatus: { openai: boolean; deepseek: boolean } | null = null;
  private aiKeysCheckPromise: Promise<void> | null = null;

  /**
   * Check AI keys availability from Edge Function secrets (async)
   */
  async checkKeysFromEdgeFunction(): Promise<{ openai: boolean; deepseek: boolean }> {
    // Return cached status if available
    if (this.aiKeysStatus !== null) {
      return this.aiKeysStatus;
    }

    // If check is already in progress, wait for it
    if (this.aiKeysCheckPromise) {
      await this.aiKeysCheckPromise;
      return this.aiKeysStatus || { openai: false, deepseek: false };
    }

    // Start new check
    this.aiKeysCheckPromise = (async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
        
        if (!supabaseUrl || !supabaseAnonKey) {
          console.warn('⚠️ Supabase URL/Key not configured for AI keys check');
          this.aiKeysStatus = { openai: false, deepseek: false };
          return;
        }

        // Import supabase client
        const { createClient } = await import('../lib/supabase');
        const supabase = createClient();
        
        // Get session for auth
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await fetch(`${supabaseUrl}/functions/v1/check-ai-keys`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
            'apikey': supabaseAnonKey,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          this.aiKeysStatus = {
            openai: data.openai?.available || false,
            deepseek: data.deepseek?.available || false
          };
          console.log('✅ AI keys status from Edge Function:', this.aiKeysStatus);
          if (data.debug) {
            console.log('🔍 Debug info from Edge Function:', data.debug);
            console.log(`   DeepSeek key present: ${data.debug.deepseekKeyPresent}, length: ${data.debug.deepseekKeyLength}`);
            console.log(`   OpenAI key present: ${data.debug.openaiKeyPresent}, length: ${data.debug.openaiKeyLength}`);
          }
        } else {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error('⚠️ Failed to check AI keys from Edge Function:', response.status, errorText);
          this.aiKeysStatus = { openai: false, deepseek: false };
        }
      } catch (error) {
        console.error('❌ Error checking AI keys from Edge Function:', error);
        this.aiKeysStatus = { openai: false, deepseek: false };
      } finally {
        this.aiKeysCheckPromise = null;
      }
    })();

    await this.aiKeysCheckPromise;
    return this.aiKeysStatus || { openai: false, deepseek: false };
  }

  /**
   * Check if a provider is available (checks Edge Function secrets first, then fallback to localStorage)
   */
  async isProviderAvailableAsync(provider: 'openai' | 'deepseek'): Promise<boolean> {
    // Check Edge Function secrets first
    const status = await this.checkKeysFromEdgeFunction();
    if (provider === 'deepseek' && status.deepseek) {
      return true;
    }
    if (provider === 'openai' && status.openai) {
      return true;
    }

    // Fallback to localStorage/client-side keys
    let storedKey = '';
    if (provider === 'deepseek') {
      storedKey = localStorage.getItem('ai_deepseek_api_key') || import.meta.env.VITE_DEEPSEEK_API_KEY || '';
      if (storedKey && storedKey !== this.deepseekApiKey) {
        this.deepseekApiKey = storedKey;
      }
    } else {
      storedKey = localStorage.getItem('ai_openai_api_key') || import.meta.env.VITE_OPENAI_API_KEY || '';
      if (storedKey && storedKey !== this.apiKey) {
        this.apiKey = storedKey;
      }
    }
    
    return !!storedKey || (provider === 'deepseek' ? !!this.deepseekApiKey : !!this.apiKey);
  }

  /**
   * Synchronous version (for backwards compatibility, uses cached status or localStorage)
   */
  isProviderAvailable(provider: 'openai' | 'deepseek'): boolean {
    // Use cached Edge Function status if available
    if (this.aiKeysStatus) {
      if (provider === 'deepseek' && this.aiKeysStatus.deepseek) return true;
      if (provider === 'openai' && this.aiKeysStatus.openai) return true;
    }

    // Fallback to localStorage/client-side check
    let storedKey = '';
    if (provider === 'deepseek') {
      storedKey = localStorage.getItem('ai_deepseek_api_key') || import.meta.env.VITE_DEEPSEEK_API_KEY || '';
      if (storedKey && storedKey !== this.deepseekApiKey) {
        this.deepseekApiKey = storedKey;
      }
    } else {
      storedKey = localStorage.getItem('ai_openai_api_key') || import.meta.env.VITE_OPENAI_API_KEY || '';
      if (storedKey && storedKey !== this.apiKey) {
        this.apiKey = storedKey;
      }
    }
    
    return !!storedKey || (provider === 'deepseek' ? !!this.deepseekApiKey : !!this.apiKey);
  }

  /**
   * Analyze bot performance and generate strategy recommendations
   */
  async analyzeBotPerformance(botId: string, performanceData: PerformanceData): Promise<AIRecommendation> {
    const aiConfig = this.getAIConfig();
    if (!aiConfig.apiKey) {
      console.warn('AI API key not configured (neither DeepSeek nor OpenAI)');
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
    const aiConfig = this.getAIConfig();
    if (!aiConfig.apiKey) {
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
    const aiConfig = this.getAIConfig();
    if (!aiConfig.apiKey) {
      return {
        strategy: strategies.strategy,
        advancedConfig: strategies.advancedConfig,
        reasoning: 'AI optimization not available - configure DeepSeek API key or OpenAI API key',
        expectedImprovement: 'N/A',
        confidence: 0
      };
    }

    try {
      // Debug: Check input sizes BEFORE building prompt
      const strategySize = JSON.stringify(strategies.strategy || {}).length;
      const advancedSize = strategies.advancedConfig ? JSON.stringify(strategies.advancedConfig).length : 0;
      const tradesSize = JSON.stringify(recentTrades || []).length;
      
      console.log(`📊 [OpenAI] Input sizes: strategy=${Math.round(strategySize/1024)}KB, advanced=${Math.round(advancedSize/1024)}KB, trades=${Math.round(tradesSize/1024)}KB, total=${Math.round((strategySize + advancedSize + tradesSize)/1024)}KB`);
      
      if (strategySize > 50000 || advancedSize > 50000 || tradesSize > 50000) {
        console.warn(`⚠️ [OpenAI] Large input detected! Strategy: ${Math.round(strategySize/1024)}KB, Advanced: ${Math.round(advancedSize/1024)}KB, Trades: ${Math.round(tradesSize/1024)}KB`);
      }
      
      const prompt = this.buildOptimizationPrompt(strategies, recentTrades, performanceMetrics);
      console.log(`📊 [OpenAI] Final prompt size: ${Math.round(prompt.length/1024)}KB (${Math.round(prompt.length * 0.75 / 1000)}K tokens estimated)`);
      
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

    // Safely extract metrics with defaults to prevent undefined errors
    const winRate = metrics?.winRate ?? 0;
    const totalPnL = metrics?.totalPnL ?? 0;
    const profitFactor = metrics?.profitFactor ?? 0;
    const sharpeRatio = metrics?.sharpeRatio ?? 0;
    const maxDrawdown = metrics?.maxDrawdown ?? 0;

    return `
Optimize trading strategy.

CURRENT:
S:${strategyStr}
${advancedStr ? `A:${advancedStr}` : ''}

PERF:
WR:${Math.round(winRate)}% PnL:$${Math.round(totalPnL)} PF:${profitFactor.toFixed(2)} SR:${sharpeRatio.toFixed(2)} DD:${Math.round(maxDrawdown)}%

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
    // Extract only key numbers - handle both object and potentially string formats
    let rsi = 0;
    let adx = 0;
    
    try {
      // Handle if strategy is a string (double-encoded) or object
      let strategyObj = strategies.strategy;
      if (typeof strategyObj === 'string') {
        try {
          strategyObj = JSON.parse(strategyObj);
          // Check if still string (double-encoded)
          if (typeof strategyObj === 'string') {
            strategyObj = JSON.parse(strategyObj);
          }
        } catch (e) {
          console.warn('Could not parse strategy string:', e);
        }
      }
      
      // Extract values safely
      rsi = (strategyObj as any)?.rsiThreshold || (strategyObj as any)?.rsi || 0;
      adx = (strategyObj as any)?.adxThreshold || (strategyObj as any)?.adx || 0;
    } catch (e) {
      console.warn('Error extracting strategy values:', e);
    }
    
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
    
    const prompt = `Opt: rsi:${rsi},adx:${adx} WR:${wr}% PnL:$${pnl} PF:${pf} Trades:${trades}. Return JSON: strategy params, reasoning, confidence.`;
    
    console.log(`📊 [Minimal Prompt] Size: ${Math.round(prompt.length/1024)}KB, Content: ${prompt.substring(0, 200)}...`);
    
    return prompt;
  }

  /**
   * Get the active AI provider configuration
   */
  private getAIConfig(): { apiKey: string; baseUrl: string; model: string; provider: string } {
    if (this.useDeepSeek && this.deepseekApiKey) {
      return {
        apiKey: this.deepseekApiKey,
        baseUrl: this.deepseekBaseUrl,
        model: 'deepseek-chat',
        provider: 'DeepSeek'
      };
    }
    return {
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      model: 'gpt-4o',
      provider: 'OpenAI'
    };
  }

  /**
   * Call AI API (DeepSeek or OpenAI) with JSON mode support
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

      const aiConfig = this.getAIConfig();
      const body: any = {
      model: aiConfig.model,
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

    console.log(`🤖 Using ${aiConfig.provider} API (${aiConfig.model}) for optimization`);

    const response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiConfig.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${aiConfig.provider} API error:`, response.status, errorText);
      throw new Error(`${aiConfig.provider} API error: ${response.status}`);
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

