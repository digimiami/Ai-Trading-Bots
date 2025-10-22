import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import Header from '../../components/feature/Header';
import type { TradingStrategy } from '../../types/trading';
import { useBots } from '../../hooks/useBots';

export default function EditBotPage() {
  const navigate = useNavigate();
  const { botId } = useParams<{ botId: string }>();
  const { bots, updateBot } = useBots();
  const [formData, setFormData] = useState({
    name: '',
    exchange: 'bybit' as 'bybit' | 'okx',
    tradingType: 'spot' as 'spot' | 'futures',
    symbol: 'BTCUSDT',
    leverage: 5,
    riskLevel: 'medium' as 'low' | 'medium' | 'high',
    tradeAmount: 100,
    stopLoss: 2.0,
    takeProfit: 4.0
  });

  const [strategy, setStrategy] = useState<TradingStrategy>({
    rsiThreshold: 70,
    adxThreshold: 25,
    bbWidthThreshold: 0.02,
    emaSlope: 0.5,
    atrPercentage: 2.5,
    vwapDistance: 1.2,
    momentumThreshold: 0.8,
    useMLPrediction: true,
    minSamplesForML: 100
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const popularSymbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT', 'AVAXUSDT',
    'BNBUSDT', 'XRPUSDT', 'MATICUSDT', 'LINKUSDT', 'UNIUSDT', 'LTCUSDT'
  ];

  // Load bot data when component mounts
  useEffect(() => {
    if (botId && bots.length > 0) {
      const bot = bots.find(b => b.id === botId);
      if (bot) {
        setFormData({
          name: bot.name,
          exchange: bot.exchange as 'bybit' | 'okx',
          tradingType: bot.tradingType as 'spot' | 'futures',
          symbol: bot.symbol,
          leverage: bot.leverage || 5,
          riskLevel: bot.riskLevel as 'low' | 'medium' | 'high',
          tradeAmount: bot.tradeAmount || 100,
          stopLoss: bot.stopLoss || 2.0,
          takeProfit: bot.takeProfit || 4.0
        });
        
        if (bot.strategy) {
          setStrategy(bot.strategy as TradingStrategy);
        }
      }
    }
  }, [botId, bots]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botId) return;
    
    setIsUpdating(true);
    setError(null);
    
    try {
      const botData = {
        name: formData.name,
        exchange: formData.exchange,
        tradingType: formData.tradingType,
        symbol: formData.symbol,
        leverage: formData.leverage,
        riskLevel: formData.riskLevel,
        tradeAmount: formData.tradeAmount,
        stopLoss: formData.stopLoss,
        takeProfit: formData.takeProfit,
        strategy: strategy
      };
      
      console.log('Updating bot data:', botData);
      
      await updateBot(botId, botData);
      
      navigate('/bots', { state: { message: `Bot "${formData.name}" updated successfully!` } });
    } catch (error: any) {
      setError(error.message || 'Failed to update bot');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStrategyChange = (field: keyof TradingStrategy, value: any) => {
    setStrategy(prev => ({ ...prev, [field]: value }));
  };

  if (!botId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Edit Bot" />
        <div className="pt-16 pb-6 px-4">
          <div className="max-w-2xl mx-auto">
            <Card>
              <div className="text-center py-8">
                <p className="text-gray-500">Bot not found</p>
                <Button variant="primary" onClick={() => navigate('/bots')} className="mt-4">
                  Back to Bots
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Edit Bot" />
      
      <div className="pt-16 pb-6 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center mb-6">
            <Button 
              variant="secondary" 
              onClick={() => navigate('/bots')}
              className="mr-4"
            >
              <i className="ri-arrow-left-line mr-2"></i>
              Back to Bots
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Edit Trading Bot</h1>
          </div>

          <form onSubmit={handleSubmit}>
            <Card>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bot Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter bot name"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Exchange
                    </label>
                    <select
                      value={formData.exchange}
                      onChange={(e) => handleInputChange('exchange', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="bybit">Bybit</option>
                      <option value="okx">OKX</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Trading Type
                    </label>
                    <select
                      value={formData.tradingType}
                      onChange={(e) => handleInputChange('tradingType', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="spot">Spot Trading</option>
                      <option value="futures">Futures Trading</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Trading Pair
                    </label>
                    <select
                      value={formData.symbol}
                      onChange={(e) => handleInputChange('symbol', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {popularSymbols.map(symbol => (
                        <option key={symbol} value={symbol}>{symbol}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Leverage
                    </label>
                    <select
                      value={formData.leverage}
                      onChange={(e) => handleInputChange('leverage', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={1}>1x</option>
                      <option value={2}>2x</option>
                      <option value={3}>3x</option>
                      <option value={5}>5x</option>
                      <option value={10}>10x</option>
                      <option value={20}>20x</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Risk Level
                    </label>
                    <select
                      value={formData.riskLevel}
                      onChange={(e) => handleInputChange('riskLevel', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Low Risk</option>
                      <option value="medium">Medium Risk</option>
                      <option value="high">High Risk</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Trade Amount (USD)
                    </label>
                    <input
                      type="number"
                      value={formData.tradeAmount}
                      onChange={(e) => handleInputChange('tradeAmount', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="10"
                      max="10000"
                      step="10"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Base trade amount in USD (will be multiplied by leverage and risk level)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Stop Loss (%)
                    </label>
                    <input
                      type="number"
                      value={formData.stopLoss}
                      onChange={(e) => handleInputChange('stopLoss', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0.5"
                      max="10"
                      step="0.5"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Maximum loss percentage before closing position
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Take Profit (%)
                    </label>
                    <input
                      type="number"
                      value={formData.takeProfit}
                      onChange={(e) => handleInputChange('takeProfit', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                      max="20"
                      step="0.5"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Target profit percentage before closing position
                    </p>
                  </div>
                </div>

                {/* Strategy Settings */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategy Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        RSI Threshold
                      </label>
                      <input
                        type="number"
                        value={strategy.rsiThreshold}
                        onChange={(e) => handleStrategyChange('rsiThreshold', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="50"
                        max="90"
                        step="5"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ADX Threshold
                      </label>
                      <input
                        type="number"
                        value={strategy.adxThreshold}
                        onChange={(e) => handleStrategyChange('adxThreshold', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="15"
                        max="50"
                        step="5"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bollinger Band Width Threshold
                      </label>
                      <input
                        type="number"
                        value={strategy.bbWidthThreshold}
                        onChange={(e) => handleStrategyChange('bbWidthThreshold', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0.01"
                        max="0.1"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        EMA Slope
                      </label>
                      <input
                        type="number"
                        value={strategy.emaSlope}
                        onChange={(e) => handleStrategyChange('emaSlope', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0.1"
                        max="2.0"
                        step="0.1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ATR Percentage
                      </label>
                      <input
                        type="number"
                        value={strategy.atrPercentage}
                        onChange={(e) => handleStrategyChange('atrPercentage', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1.0"
                        max="5.0"
                        step="0.5"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        VWAP Distance
                      </label>
                      <input
                        type="number"
                        value={strategy.vwapDistance}
                        onChange={(e) => handleStrategyChange('vwapDistance', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0.5"
                        max="3.0"
                        step="0.1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Momentum Threshold
                      </label>
                      <input
                        type="number"
                        value={strategy.momentumThreshold}
                        onChange={(e) => handleStrategyChange('momentumThreshold', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Min Samples for ML
                      </label>
                      <input
                        type="number"
                        value={strategy.minSamplesForML}
                        onChange={(e) => handleStrategyChange('minSamplesForML', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="50"
                        max="1000"
                        step="50"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={strategy.useMLPrediction}
                        onChange={(e) => handleStrategyChange('useMLPrediction', e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Use Machine Learning Prediction
                      </span>
                    </label>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600">{error}</p>
                  </div>
                )}

                <div className="flex space-x-4 pt-6 border-t">
                  <Button
                    type="submit"
                    variant="primary"
                    className="flex-1"
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <>
                        <i className="ri-loader-4-line animate-spin mr-2"></i>
                        Updating Bot...
                      </>
                    ) : (
                      <>
                        <i className="ri-save-line mr-2"></i>
                        Update Bot
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => navigate('/bots')}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </form>
        </div>
      </div>
    </div>
  );
}
