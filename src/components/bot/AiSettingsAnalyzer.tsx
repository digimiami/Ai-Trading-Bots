import { useState } from 'react';
import Button from '../base/Button';
import Card from '../base/Card';
import { aiBotAnalyzer } from '../../services/aiBotAnalyzer';

interface BotSettings {
  interval: number;
  totalCycles: number;
  stopLoss: number;
  takeProfit: number;
  maxDailyLoss: number;
  maxPositionSize: number;
  trailingStop: boolean;
  partialProfitTaking: boolean;
  rsiOversold: number;
  rsiOverbought: number;
  macdSignal: boolean;
  bollingerBands: boolean;
  volumeFilter: boolean;
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
  bestDay?: string;
  worstDay?: string;
}

interface Props {
  botId: string;
  settings: Partial<BotSettings>;
  performance: Partial<BotPerformance>;
  onSettingsUpdate?: (updatedSettings: Partial<BotSettings>) => void;
}

export default function AiSettingsAnalyzer({ botId, settings, performance, onSettingsUpdate }: Props) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const defaultSettings: BotSettings = {
    interval: 7,
    totalCycles: 10,
    stopLoss: 10,
    takeProfit: 25,
    maxDailyLoss: 5,
    maxPositionSize: 20,
    trailingStop: false,
    partialProfitTaking: false,
    rsiOversold: 30,
    rsiOverbought: 70,
    macdSignal: false,
    bollingerBands: false,
    volumeFilter: false,
    emergencyStop: true,
    maxConsecutiveLosses: 3,
    cooldown: 60
  };

  const defaultPerformance: BotPerformance = {
    totalTrades: 0,
    winRate: 0,
    totalPnL: 0,
    avgWinPnL: 0,
    avgLossPnL: 0,
    maxDrawdown: 0,
    profitFactor: 0
  };

  const fullSettings = { ...defaultSettings, ...settings };
  const fullPerformance = { ...defaultPerformance, ...performance };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setHasAnalyzed(false);
    
    try {
      const result = await aiBotAnalyzer.analyzeBotSettingsForWinRate(
        botId,
        fullSettings,
        fullPerformance
      );
      
      setAnalysis(result);
      setHasAnalyzed(true);
    } catch (error) {
      console.error('Error analyzing settings:', error);
      alert('Failed to analyze bot settings');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (!hasAnalyzed && !isAnalyzing) {
    return (
      <Card className="p-6 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-300">
        <div className="text-center">
          <i className="ri-brain-line text-5xl text-purple-600 mb-4"></i>
          <h3 className="text-xl font-bold text-gray-900 mb-2">AI Win Rate Optimizer</h3>
          <p className="text-sm text-gray-600 mb-6">
            Analyze all your bot settings and get AI-powered recommendations to improve win rate and profitability
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600">{fullPerformance.winRate}%</div>
              <div className="text-xs text-gray-500">Current Win Rate</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-2xl font-bold text-purple-600">{fullPerformance.totalTrades}</div>
              <div className="text-xs text-gray-500">Total Trades</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">${fullPerformance.totalPnL.toFixed(2)}</div>
              <div className="text-xs text-gray-500">Total PnL</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-2xl font-bold text-orange-600">{(fullPerformance.profitFactor || 0).toFixed(2)}</div>
              <div className="text-xs text-gray-500">Profit Factor</div>
            </div>
          </div>

          <Button
            variant="primary"
            onClick={handleAnalyze}
            size="lg"
            className="w-full md:w-auto"
          >
            <i className="ri-brain-3-line mr-2"></i>
            Analyze Settings & Get Recommendations
          </Button>
        </div>
      </Card>
    );
  }

  if (isAnalyzing) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <i className="ri-loader-4-line animate-spin text-4xl text-blue-600 mb-4"></i>
          <h3 className="text-lg font-semibold text-gray-900">AI Analyzing Your Bot Settings...</h3>
          <p className="text-sm text-gray-600 mt-2">
            Analyzing ${Object.keys(fullSettings).length} settings and performance metrics
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-2 border-green-200 bg-gradient-to-br from-green-50 to-blue-50">
      {/* Overall Score */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-900">AI Analysis Complete</h3>
          <div className="px-4 py-2 bg-green-600 text-white rounded-full font-bold">
            Score: {analysis?.overallScore || 0}/100
          </div>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${analysis?.overallScore || 0}%` }}
          ></div>
        </div>
      </div>

      {/* Win Rate Analysis */}
      {analysis?.winRateAnalysis && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
            <i className="ri-lightbulb-line mr-2 text-yellow-600"></i>
            Win Rate Analysis
          </h4>
          <p className="text-sm text-gray-700">{analysis.winRateAnalysis}</p>
        </div>
      )}

      {/* Critical Issues */}
      {analysis?.criticalIssues && analysis.criticalIssues.length > 0 && (
        <div className="mb-6">
          <h4 className="font-bold text-red-700 mb-3 flex items-center">
            <i className="ri-error-warning-line mr-2"></i>
            Critical Issues
          </h4>
          <div className="space-y-2">
            {analysis.criticalIssues.map((issue: string, idx: number) => (
              <div key={idx} className="p-3 bg-red-50 border border-red-300 rounded-lg">
                <span className="text-red-700 text-sm">{issue}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Wins */}
      {analysis?.quickWins && analysis.quickWins.length > 0 && (
        <div className="mb-6">
          <h4 className="font-bold text-green-700 mb-3 flex items-center">
            <i className="ri-rocket-line mr-2"></i>
            Quick Wins
          </h4>
          <div className="space-y-2">
            {analysis.quickWins.map((win: string, idx: number) => (
              <div key={idx} className="p-3 bg-green-50 border border-green-300 rounded-lg">
                <span className="text-green-700 text-sm">{win}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Recommendations */}
      {analysis?.recommendations && analysis.recommendations.length > 0 && (
        <div className="mb-6">
          <h4 className="font-bold text-gray-900 mb-4 flex items-center">
            <i className="ri-file-list-3-line mr-2 text-blue-600"></i>
            Detailed Recommendations
          </h4>
          <div className="space-y-3">
            {analysis.recommendations.map((rec: any, idx: number) => (
              <div 
                key={idx} 
                className={`p-4 border-2 rounded-lg ${getPriorityColor(rec.priority)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-sm uppercase">
                        {rec.priority}
                      </span>
                      <span className="px-2 py-1 bg-white rounded text-xs font-semibold">
                        {rec.riskLevel} Risk
                      </span>
                    </div>
                    <h5 className="font-semibold mb-1">{rec.setting}</h5>
                    <p className="text-sm mb-2">{rec.reason}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-current border-opacity-30">
                  <div>
                    <span className="text-xs opacity-75">Current:</span>
                    <span className="ml-2 font-mono font-bold">{rec.currentValue}</span>
                  </div>
                  <i className="ri-arrow-right-line mx-2"></i>
                  <div>
                    <span className="text-xs opacity-75">Recommended:</span>
                    <span className="ml-2 font-mono font-bold">{rec.recommendedValue}</span>
                  </div>
                </div>
                
                <div className="mt-2 pt-2 border-t border-current border-opacity-30">
                  <span className="text-xs font-semibold">Expected:</span>
                  <span className="ml-2 text-sm">{rec.expectedImprovement}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Apply Recommendations Handler */}
      {(() => {
        const handleApplyRecommendations = async () => {
          if (!analysis?.recommendations || analysis.recommendations.length === 0) {
            alert('No recommendations to apply');
            return;
          }

          setIsApplying(true);
          try {
            // Convert recommendations to settings updates
            const settingsUpdates: any = {};
            
            analysis.recommendations.forEach((rec: any) => {
              if (rec.recommendedValue !== undefined && rec.recommendedValue !== null) {
                // Map recommendation setting names to actual settings
                const settingKey = rec.setting;
                
                // Handle different setting types
                if (rec.setting === 'trailingStop' || rec.setting === 'partialProfitTaking' || 
                    rec.setting === 'macdSignal' || rec.setting === 'bollingerBands' || 
                    rec.setting === 'volumeFilter' || rec.setting === 'emergencyStop') {
                  settingsUpdates[settingKey] = Boolean(rec.recommendedValue);
                } else if (typeof rec.recommendedValue === 'number') {
                  settingsUpdates[settingKey] = rec.recommendedValue;
                } else if (typeof rec.recommendedValue === 'string') {
                  settingsUpdates[settingKey] = rec.recommendedValue;
                }
              }
            });

            console.log('Applying settings updates:', settingsUpdates);

            // Call the update callback if provided
            if (onSettingsUpdate) {
              await onSettingsUpdate(settingsUpdates);
            } else {
              // Otherwise use Supabase directly
              const { supabase } = await import('../../lib/supabase');
              const { error } = await supabase
                .from('trading_bots')
                .update(settingsUpdates)
                .eq('id', botId);

              if (error) throw error;
            }

            alert(`✅ ${Object.keys(settingsUpdates).length} recommendations applied successfully!`);
          } catch (error) {
            console.error('Error applying recommendations:', error);
            alert('Failed to apply recommendations. Please try again.');
          } finally {
            setIsApplying(false);
          }
        };

        return (
          /* Action Buttons */
          <div className="flex gap-3 mt-6">
            <Button
              variant="secondary"
              onClick={() => setHasAnalyzed(false)}
              className="flex-1"
              disabled={isApplying}
            >
              <i className="ri-refresh-line mr-2"></i>
              Re-Analyze
            </Button>
            <Button
              variant="primary"
              onClick={handleApplyRecommendations}
              className="flex-1"
              loading={isApplying}
              disabled={isApplying || !analysis?.recommendations || analysis.recommendations.length === 0}
            >
              <i className="ri-check-line mr-2"></i>
              {isApplying ? 'Applying...' : `Apply All (${analysis?.recommendations?.length || 0})`}
            </Button>
          </div>
        );
      })()}
    </Card>
  );
}

