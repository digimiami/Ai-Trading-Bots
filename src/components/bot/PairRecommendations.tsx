/**
 * Pair Recommendations Component
 * Displays AI-optimized settings recommendations based on selected trading pair
 */

import { useState, useEffect } from 'react';
import Card from '../base/Card';
import Button from '../base/Button';
import { pairRecommendationsService, type PairRecommendation } from '../../services/pairRecommendations';
import { openAIService } from '../../services/openai';
import type { TradingStrategy, AdvancedStrategyConfig } from '../../types/trading';

interface PairRecommendationsProps {
  symbol: string;
  tradingType: 'spot' | 'futures';
  currentStrategy?: TradingStrategy;
  currentAdvancedConfig?: AdvancedStrategyConfig;
  currentTradeAmount?: number;
  currentLeverage?: number;
  currentStopLoss?: number;
  currentTakeProfit?: number;
  onApplyRecommendation: (recommendation: PairRecommendation) => void;
}

export default function PairRecommendations({
  symbol,
  tradingType,
  currentStrategy,
  currentAdvancedConfig,
  currentTradeAmount,
  currentLeverage,
  currentStopLoss,
  currentTakeProfit,
  onApplyRecommendation
}: PairRecommendationsProps) {
  const [recommendation, setRecommendation] = useState<PairRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [aiProvider, setAiProvider] = useState<'openai' | 'deepseek'>(() => {
    // Load from localStorage or default
    const saved = localStorage.getItem('ai_provider_preference');
    if (saved === 'openai' || saved === 'deepseek') {
      return saved;
    }
    // Default to DeepSeek if available, otherwise OpenAI
    return openAIService.isProviderAvailable('deepseek') ? 'deepseek' : 'openai';
  });

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Set AI provider before fetching
      openAIService.setProvider(aiProvider);
      
      const rec = await pairRecommendationsService.getRecommendationsForPair(
        symbol,
        tradingType,
        {
          strategy: currentStrategy,
          advancedConfig: currentAdvancedConfig,
          tradeAmount: currentTradeAmount,
          leverage: currentLeverage,
          stopLoss: currentStopLoss,
          takeProfit: currentTakeProfit
        }
      );

      if (rec) {
        setRecommendation(rec);
        setError(null); // Clear any previous errors
      } else {
        // If service returns null, it means it fell back to defaults
        // Try to get default recommendations
        console.warn('Recommendations service returned null, using fallback');
        setError('AI recommendations unavailable, showing pair-specific defaults');
        // Service should never return null, but if it does, we'll show error state
      }
    } catch (err: any) {
      console.error('Error fetching recommendations:', err);
      setError(err.message || 'Error fetching recommendations');
      // On error, still try to show something useful
      // The service should handle errors internally and return defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch recommendations when symbol, tradingType, or AI provider changes
    if (symbol && symbol.trim()) {
      console.log('🔍 PairRecommendations - Fetching recommendations for:', symbol, 'using', aiProvider);
      fetchRecommendations();
    } else {
      console.log('⚠️ PairRecommendations - No symbol provided or symbol is empty');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, tradingType, aiProvider]);

  const handleProviderChange = (provider: 'openai' | 'deepseek') => {
    if (!openAIService.isProviderAvailable(provider)) {
      setError(`${provider === 'openai' ? 'OpenAI' : 'DeepSeek'} API key not configured. Please set it in your environment variables.`);
      return;
    }
    setAiProvider(provider);
    openAIService.setProvider(provider);
    // fetchRecommendations will be called automatically by useEffect
  };

  const handleApply = () => {
    if (recommendation) {
      onApplyRecommendation(recommendation);
    }
  };

  // Always show the component - show loading state if needed
  if (loading) {
    return (
      <Card className="p-4 border-2 border-blue-200 bg-blue-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-blue-700 font-medium">🤖 AI ({aiProvider}) analyzing {symbol}...</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-600">Using:</span>
            <select
              value={aiProvider}
              onChange={(e) => handleProviderChange(e.target.value as 'openai' | 'deepseek')}
              className="px-2 py-1 border border-gray-300 rounded bg-white text-gray-700 text-xs"
              disabled={loading}
            >
              <option value="deepseek" disabled={!openAIService.isProviderAvailable('deepseek')}>
                DeepSeek {!openAIService.isProviderAvailable('deepseek') ? '(Not configured)' : ''}
              </option>
              <option value="openai" disabled={!openAIService.isProviderAvailable('openai')}>
                OpenAI {!openAIService.isProviderAvailable('openai') ? '(Not configured)' : ''}
              </option>
            </select>
          </div>
        </div>
      </Card>
    );
  }

  // Show error state if there's an error and no recommendation
  if (error && !recommendation) {
    return (
      <Card className="p-4 border-2 border-yellow-200 bg-yellow-50">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <i className="ri-information-line text-yellow-600 mr-2"></i>
              <span className="text-yellow-700">⚠️ {error}</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={aiProvider}
                onChange={(e) => handleProviderChange(e.target.value as 'openai' | 'deepseek')}
                className="px-2 py-1 border border-gray-300 rounded bg-white text-gray-700 text-xs"
                disabled={loading}
              >
                <option value="deepseek" disabled={!openAIService.isProviderAvailable('deepseek')}>
                  DeepSeek {!openAIService.isProviderAvailable('deepseek') ? '(Not configured)' : ''}
                </option>
                <option value="openai" disabled={!openAIService.isProviderAvailable('openai')}>
                  OpenAI {!openAIService.isProviderAvailable('openai') ? '(Not configured)' : ''}
                </option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchRecommendations}
                className="text-xs"
              >
                Retry
              </Button>
            </div>
          </div>
          <p className="text-xs text-yellow-600">
            The AI recommendation service may not be available. You can still create the bot with default settings.
          </p>
        </div>
      </Card>
    );
  }

  // If no recommendation but also no error/loading, show a placeholder
  if (!recommendation && !error && !loading) {
    return (
      <Card className="p-4 border-2 border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-1">🤖 AI Recommendations</h3>
            <p className="text-xs text-gray-500">Loading recommendations for {symbol}...</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRecommendations}
            className="text-xs"
          >
            Load
          </Button>
        </div>
      </Card>
    );
  }

  // If still no recommendation at this point, return null (shouldn't happen)
  if (!recommendation) {
    return null;
  }

  return (
    <Card className="p-4 border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-blue-50">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center mb-2 flex-wrap gap-2">
              <i className="ri-magic-line text-purple-600 text-xl mr-2"></i>
              <h3 className="text-lg font-bold text-gray-900">
                🤖 AI Recommendations for {symbol}
              </h3>
              <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                recommendation.confidence >= 0.8 ? 'bg-green-100 text-green-800' :
                recommendation.confidence >= 0.6 ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {Math.round(recommendation.confidence * 100)}% Confidence
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-gray-500">AI Provider:</span>
                <select
                  value={aiProvider}
                  onChange={(e) => handleProviderChange(e.target.value as 'openai' | 'deepseek')}
                  className="px-2 py-1 border border-gray-300 rounded bg-white text-gray-700 text-xs font-medium"
                  disabled={loading}
                >
                  <option value="deepseek" disabled={!openAIService.isProviderAvailable('deepseek')}>
                    DeepSeek {!openAIService.isProviderAvailable('deepseek') ? '(Not configured)' : ''}
                  </option>
                  <option value="openai" disabled={!openAIService.isProviderAvailable('openai')}>
                    OpenAI {!openAIService.isProviderAvailable('openai') ? '(Not configured)' : ''}
                  </option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchRecommendations}
                  className="text-xs"
                  title="Refresh recommendations with current AI provider"
                >
                  <i className="ri-refresh-line mr-1"></i>
                  Refresh
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              {recommendation.reasoning}
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <span className="flex items-center">
                <i className="ri-line-chart-line mr-1"></i>
                {recommendation.expectedPerformance}
              </span>
              <span className="flex items-center">
                <i className="ri-shield-line mr-1"></i>
                Risk: <span className="font-semibold capitalize ml-1">{recommendation.riskAssessment}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Trade Amount</div>
            <div className="text-sm font-bold text-gray-900">${recommendation.suggestedTradeAmount}</div>
            {currentTradeAmount && currentTradeAmount !== recommendation.suggestedTradeAmount && (
              <div className="text-xs text-gray-400 line-through">${currentTradeAmount}</div>
            )}
          </div>
          {tradingType === 'futures' && (
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Leverage</div>
              <div className="text-sm font-bold text-gray-900">{recommendation.suggestedLeverage}x</div>
              {currentLeverage && currentLeverage !== recommendation.suggestedLeverage && (
                <div className="text-xs text-gray-400 line-through">{currentLeverage}x</div>
              )}
            </div>
          )}
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Stop Loss</div>
            <div className="text-sm font-bold text-gray-900">{recommendation.suggestedStopLoss}%</div>
            {currentStopLoss && currentStopLoss !== recommendation.suggestedStopLoss && (
              <div className="text-xs text-gray-400 line-through">{currentStopLoss}%</div>
            )}
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Take Profit</div>
            <div className="text-sm font-bold text-gray-900">{recommendation.suggestedTakeProfit}%</div>
            {currentTakeProfit && currentTakeProfit !== recommendation.suggestedTakeProfit && (
              <div className="text-xs text-gray-400 line-through">{currentTakeProfit}%</div>
            )}
          </div>
        </div>

        {/* Strategy & Advanced Config Changes - Always show */}
        <div className="mt-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center"
          >
            <i className={`ri-arrow-${showDetails ? 'up' : 'down'}-s-line mr-1`}></i>
            {recommendation.changes.length > 0 ? (
              <>
                {recommendation.changes.length} Optimization{recommendation.changes.length !== 1 ? 's' : ''} Recommended
                <span className="ml-2 text-xs text-gray-500">
                  ({recommendation.changes.filter(c => c.parameter.startsWith('Strategy.')).length} Strategy, {recommendation.changes.filter(c => c.parameter.startsWith('Advanced.')).length} Advanced)
                </span>
              </>
            ) : (
              <>
                View All Recommended Parameters
                <span className="ml-2 text-xs text-gray-500">
                  (Strategy + Advanced Config)
                </span>
              </>
            )}
          </button>

          {showDetails && (
            <div className="mt-2 bg-white rounded-lg p-3 border border-gray-200">
              <div className="space-y-3">
                {/* Strategy Parameters - Always show */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                    <i className="ri-settings-3-line mr-1"></i>
                    Strategy Parameters
                  </h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {recommendation.strategy && (
                      <>
                        <div className="flex items-center justify-between text-xs py-1 px-2 bg-blue-50 rounded">
                          <span className="font-medium text-gray-700">RSI Threshold:</span>
                          <span className="text-green-600 font-semibold">{recommendation.strategy.rsiThreshold}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs py-1 px-2 bg-blue-50 rounded">
                          <span className="font-medium text-gray-700">ADX Threshold:</span>
                          <span className="text-green-600 font-semibold">{recommendation.strategy.adxThreshold}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs py-1 px-2 bg-blue-50 rounded">
                          <span className="font-medium text-gray-700">BB Width Threshold:</span>
                          <span className="text-green-600 font-semibold">{recommendation.strategy.bbWidthThreshold}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs py-1 px-2 bg-blue-50 rounded">
                          <span className="font-medium text-gray-700">EMA Slope:</span>
                          <span className="text-green-600 font-semibold">{recommendation.strategy.emaSlope}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs py-1 px-2 bg-blue-50 rounded">
                          <span className="font-medium text-gray-700">ATR Percentage:</span>
                          <span className="text-green-600 font-semibold">{recommendation.strategy.atrPercentage}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs py-1 px-2 bg-blue-50 rounded">
                          <span className="font-medium text-gray-700">Momentum Threshold:</span>
                          <span className="text-green-600 font-semibold">{recommendation.strategy.momentumThreshold}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs py-1 px-2 bg-blue-50 rounded">
                          <span className="font-medium text-gray-700">Use ML Prediction:</span>
                          <span className="text-green-600 font-semibold">{recommendation.strategy.useMLPrediction ? 'Yes' : 'No'}</span>
                        </div>
                      </>
                    )}
                    {/* Show changes if any */}
                    {recommendation.changes
                      .filter(c => c.parameter.startsWith('Strategy.'))
                      .map((change, idx) => (
                        <div key={`change-${idx}`} className="flex items-center justify-between text-xs py-1 px-2 bg-yellow-50 rounded border border-yellow-200">
                          <div className="flex-1">
                            <span className="font-medium text-gray-700">{change.parameter.replace('Strategy.', '')}:</span>
                            <span className="ml-2 text-gray-500 line-through">{String(change.defaultValue)}</span>
                            <span className="mx-2 text-gray-400">→</span>
                            <span className="text-green-600 font-semibold">{String(change.recommendedValue)}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Advanced Config Parameters - Always show */}
                {recommendation.advancedConfig && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                      <i className="ri-settings-4-line mr-1"></i>
                      ⚙️ Advanced Strategy Configuration
                    </h4>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {/* Show key advanced config parameters */}
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <div className="py-1 px-2 bg-purple-50 rounded">
                          <span className="font-medium text-gray-700">Risk/Trade:</span>
                          <span className="ml-1 text-green-600 font-semibold">{recommendation.advancedConfig.risk_per_trade_pct}%</span>
                        </div>
                        <div className="py-1 px-2 bg-purple-50 rounded">
                          <span className="font-medium text-gray-700">Max Trades/Day:</span>
                          <span className="ml-1 text-green-600 font-semibold">{recommendation.advancedConfig.max_trades_per_day}</span>
                        </div>
                        <div className="py-1 px-2 bg-purple-50 rounded">
                          <span className="font-medium text-gray-700">SL ATR Mult:</span>
                          <span className="ml-1 text-green-600 font-semibold">{recommendation.advancedConfig.sl_atr_mult}</span>
                        </div>
                        <div className="py-1 px-2 bg-purple-50 rounded">
                          <span className="font-medium text-gray-700">TP1 Ratio:</span>
                          <span className="ml-1 text-green-600 font-semibold">{recommendation.advancedConfig.tp1_r}</span>
                        </div>
                        <div className="py-1 px-2 bg-purple-50 rounded">
                          <span className="font-medium text-gray-700">TP2 Ratio:</span>
                          <span className="ml-1 text-green-600 font-semibold">{recommendation.advancedConfig.tp2_r}</span>
                        </div>
                        <div className="py-1 px-2 bg-purple-50 rounded">
                          <span className="font-medium text-gray-700">ADX Min HTF:</span>
                          <span className="ml-1 text-green-600 font-semibold">{recommendation.advancedConfig.adx_min_htf}</span>
                        </div>
                        <div className="py-1 px-2 bg-purple-50 rounded">
                          <span className="font-medium text-gray-700">Bias Mode:</span>
                          <span className="ml-1 text-green-600 font-semibold">{recommendation.advancedConfig.bias_mode}</span>
                        </div>
                        <div className="py-1 px-2 bg-purple-50 rounded">
                          <span className="font-medium text-gray-700">Regime Mode:</span>
                          <span className="ml-1 text-green-600 font-semibold">{recommendation.advancedConfig.regime_mode}</span>
                        </div>
                      </div>
                      {/* Show changes if any */}
                      {recommendation.changes
                        .filter(c => c.parameter.startsWith('Advanced.'))
                        .map((change, idx) => (
                          <div key={`adv-change-${idx}`} className="flex items-center justify-between text-xs py-1 px-2 bg-yellow-50 rounded border border-yellow-200">
                            <div className="flex-1">
                              <span className="font-medium text-gray-700">{change.parameter.replace('Advanced.', '')}:</span>
                              <span className="ml-2 text-gray-500 line-through">{String(change.defaultValue)}</span>
                              <span className="mx-2 text-gray-400">→</span>
                              <span className="text-green-600 font-semibold">{String(change.recommendedValue)}</span>
                              <span className="ml-2 text-xs text-gray-400">({change.reason})</span>
                            </div>
                          </div>
                        ))}
                      <p className="text-xs text-gray-500 mt-2 italic">
                        All 30+ Advanced Config parameters are configured and will be applied.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>


        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-purple-200">
          <Button
            onClick={handleApply}
            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold"
          >
            <i className="ri-check-line mr-2"></i>
            Apply AI Recommendations
          </Button>
          <Button
            variant="outline"
            onClick={fetchRecommendations}
            className="px-3"
            title="Refresh recommendations"
          >
            <i className="ri-refresh-line"></i>
          </Button>
        </div>
      </div>
    </Card>
  );
}

