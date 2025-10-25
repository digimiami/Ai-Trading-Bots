/**
 * Simple AI/ML Integration Script
 * Easy way to start using AI predictions with your bots
 */

// Step 1: Check if AI/ML is enabled
export function isAiMlEnabled(): boolean {
  return import.meta.env.VITE_FEATURE_AI_ML === '1';
}

// Step 2: Simple AI decision function
export async function getSimpleAiDecision(symbol: string, price: number, volume: number) {
  if (!isAiMlEnabled()) {
    return { signal: 'HOLD', confidence: 0, reason: 'AI/ML disabled' };
  }

  try {
    // Import AI SDK (lazy load to avoid errors if not available)
    const { getAiDecision } = await import('./sdk');
    
    const snapshot = {
      symbol,
      timestamp: new Date(),
      price,
      volume,
      high: price * 1.01, // Estimate
      low: price * 0.99,  // Estimate
      open: price,
      close: price
    };

    const decision = await getAiDecision(snapshot);
    
    return {
      signal: decision.signal,
      confidence: decision.confidence,
      reason: `AI predicts ${decision.signal} with ${(decision.confidence * 100).toFixed(1)}% confidence`
    };
  } catch (error) {
    console.error('AI decision failed:', error);
    return { signal: 'HOLD', confidence: 0, reason: 'AI analysis failed' };
  }
}

// Step 3: Enhanced bot executor with AI
export class SimpleAiBot {
  private symbol: string;
  private aiEnabled: boolean;

  constructor(symbol: string) {
    this.symbol = symbol;
    this.aiEnabled = isAiMlEnabled();
  }

  async shouldTrade(currentPrice: number, volume: number): Promise<{
    shouldTrade: boolean;
    signal: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    reason: string;
  }> {
    if (!this.aiEnabled) {
      return {
        shouldTrade: false,
        signal: 'HOLD',
        confidence: 0,
        reason: 'AI/ML system disabled'
      };
    }

    const aiDecision = await getSimpleAiDecision(this.symbol, currentPrice, volume);
    
    // Only trade if AI is confident enough
    const minConfidence = 0.6; // 60% confidence threshold
    
    if (aiDecision.confidence >= minConfidence) {
      return {
        shouldTrade: true,
        signal: aiDecision.signal,
        confidence: aiDecision.confidence,
        reason: aiDecision.reason
      };
    } else {
      return {
        shouldTrade: false,
        signal: 'HOLD',
        confidence: aiDecision.confidence,
        reason: `AI confidence too low (${(aiDecision.confidence * 100).toFixed(1)}%)`
      };
    }
  }

  async executeTradeWithAi(currentPrice: number, volume: number) {
    const decision = await this.shouldTrade(currentPrice, volume);
    
    console.log(`🤖 AI Bot ${this.symbol} Decision:`, decision);
    
    if (decision.shouldTrade) {
      // Here you would call your actual trading functions
      console.log(`✅ Executing ${decision.signal} trade for ${this.symbol}`);
      console.log(`📊 Reason: ${decision.reason}`);
      
      // Return success with AI context
      return {
        success: true,
        signal: decision.signal,
        confidence: decision.confidence,
        reason: decision.reason
      };
    } else {
      console.log(`⏸️ Skipping trade: ${decision.reason}`);
      return {
        success: false,
        signal: 'HOLD',
        confidence: decision.confidence,
        reason: decision.reason
      };
    }
  }
}

// Step 4: Usage example
export async function exampleUsage() {
  // Create AI-enhanced bot
  const btcBot = new SimpleAiBot('BTCUSDT');
  
  // Get current market data (you would get this from your exchange)
  const currentPrice = 50000;
  const volume = 1000000;
  
  // Make trading decision
  const result = await btcBot.executeTradeWithAi(currentPrice, volume);
  
  console.log('Trading Result:', result);
  
  return result;
}

// Step 5: Integration with existing bot executor
export function enhanceExistingBot(botExecutor: any) {
  const originalExecuteTrade = botExecutor.executeTrade?.bind(botExecutor);
  
  if (originalExecuteTrade) {
    botExecutor.executeTrade = async function(marketData: any) {
      // Get AI decision first
      const aiDecision = await getSimpleAiDecision(
        this.symbol || 'UNKNOWN',
        marketData.price || 0,
        marketData.volume || 0
      );
      
      console.log(`🤖 AI Analysis for ${this.symbol}:`, aiDecision);
      
      // Only proceed if AI recommends trading
      if (aiDecision.confidence >= 0.6) {
        // Add AI context to market data
        const enhancedData = {
          ...marketData,
          aiSignal: aiDecision.signal,
          aiConfidence: aiDecision.confidence,
          aiReason: aiDecision.reason
        };
        
        // Execute original trade logic with AI enhancement
        return originalExecuteTrade(enhancedData);
      } else {
        console.log(`🤖 Skipping trade: ${aiDecision.reason}`);
        return { success: false, reason: aiDecision.reason };
      }
    };
  }
  
  return botExecutor;
}

// Export everything
export default {
  isAiMlEnabled,
  getSimpleAiDecision,
  SimpleAiBot,
  exampleUsage,
  enhanceExistingBot
};
