/**
 * Pair Recommendations Component
 * Displays AI-optimized settings recommendations based on selected trading pair
 */

import { useState, useEffect } from 'react';
import Card from '../base/Card';
import Button from '../base/Button';
import { pairRecommendationsService, type PairRecommendation } from '../../services/pairRecommendations';
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

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    
    try {
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
    // Fetch recommendations when symbol changes
    if (symbol && symbol.trim()) {
      console.log('🔍 PairRecommendations - Fetching recommendations for:', symbol);
      fetchRecommendations();
    } else {
      console.log('⚠️ PairRecommendations - No symbol provided or symbol is empty');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, tradingType]);

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
            <span className="text-blue-700 font-medium">🤖 AI analyzing {symbol}...</span>
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
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRecommendations}
              className="text-xs"
            >
              Retry
            </Button>
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
            <div className="flex items-center mb-2">
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

        {/* Strategy & Advanced Config Changes */}
        {recommendation.changes.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center"
            >
              <i className={`ri-arrow-${showDetails ? 'up' : 'down'}-s-line mr-1`}></i>
              {recommendation.changes.length} Optimization{recommendation.changes.length !== 1 ? 's' : ''} Recommended
              <span className="ml-2 text-xs text-gray-500">
                ({recommendation.changes.filter(c => c.parameter.startsWith('Strategy.')).length} Strategy, {recommendation.changes.filter(c => c.parameter.startsWith('Advanced.')).length} Advanced)
              </span>
            </button>

            {showDetails && (
              <div className="mt-2 bg-white rounded-lg p-3 border border-gray-200">
                <div className="space-y-3">
                  {/* Strategy Parameters */}
                  {recommendation.changes.filter(c => c.parameter.startsWith('Strategy.')).length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                        <i className="ri-settings-3-line mr-1"></i>
                        Strategy Parameters
                      </h4>
                      <div className="space-y-1">
                        {recommendation.changes
                          .filter(c => c.parameter.startsWith('Strategy.'))
                          .map((change, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 bg-blue-50 rounded border-b border-blue-100 last:border-0">
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
                  )}

                  {/* Advanced Config Parameters */}
                  {recommendation.changes.filter(c => c.parameter.startsWith('Advanced.')).length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                        <i className="ri-settings-4-line mr-1"></i>
                        ⚙️ Advanced Strategy Configuration
                      </h4>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {recommendation.changes
                          .filter(c => c.parameter.startsWith('Advanced.'))
                          .map((change, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 bg-purple-50 rounded border-b border-purple-100 last:border-0">
                              <div className="flex-1">
                                <span className="font-medium text-gray-700">{change.parameter.replace('Advanced.', '')}:</span>
                                <span className="ml-2 text-gray-500 line-through">{String(change.defaultValue)}</span>
                                <span className="mx-2 text-gray-400">→</span>
                                <span className="text-green-600 font-semibold">{String(change.recommendedValue)}</span>
                                <span className="ml-2 text-xs text-gray-400">({change.reason})</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-purple-200">
          <Button
            onClick={handleApply}
            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold"
            disabled={!recommendation.recommended}
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

