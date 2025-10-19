import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import Header from '../../components/feature/Header';
import { TradingStrategy } from '../../types/trading';
import { useBots } from '../../hooks/useBots';

export default function CreateBotPage() {
  const navigate = useNavigate();
  const { createBot } = useBots();
  const [formData, setFormData] = useState({
    name: '',
    exchange: 'bybit' as 'bybit' | 'okx',
    symbol: 'BTCUSDT',
    leverage: 5,
    balance: 1000,
    riskLevel: 'medium' as 'low' | 'medium' | 'high'
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

  const [isCreating, setIsCreating] = useState(false);

  const popularSymbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT', 'AVAXUSDT',
    'BNBUSDT', 'XRPUSDT', 'MATICUSDT', 'LINKUSDT', 'UNIUSDT', 'LTCUSDT'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    
    try {
      const botData = {
        name: formData.name,
        strategy: 'advanced_ml',
        exchange: formData.exchange,
        symbol: formData.symbol,
        config: {
          leverage: formData.leverage,
          balance: formData.balance,
          riskLevel: formData.riskLevel,
          ...strategy
        },
        performance: {
          pnl: 0,
          totalTrades: 0,
          winRate: 0
        }
      };
      
      await createBot(botData);
      navigate('/', { state: { message: `Bot "${formData.name}" created successfully!` } });
    } catch (error) {
      console.error('Failed to create bot:', error);
      alert('Failed to create bot. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStrategyChange = (field: keyof TradingStrategy, value: any) => {
    setStrategy(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="pt-16 pb-6 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center mb-6">
            <button
              onClick={() => navigate('/')}
              className="mr-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <i className="ri-arrow-left-line text-xl"></i>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Create New Bot</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Configuration */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Basic Configuration</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    Initial Balance (USDT)
                  </label>
                  <input
                    type="number"
                    value={formData.balance}
                    onChange={(e) => handleInputChange('balance', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="100"
                    step="100"
                    required
                  />
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
              </div>
            </Card>

            {/* Strategy Configuration */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Strategy Parameters</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RSI Threshold
                  </label>
                  <input
                    type="number"
                    value={strategy.rsiThreshold}
                    onChange={(e) => handleStrategyChange('rsiThreshold', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="30"
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
                    onChange={(e) => handleStrategyChange('adxThreshold', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="10"
                    max="50"
                    step="5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    BB Width Threshold
                  </label>
                  <input
                    type="number"
                    value={strategy.bbWidthThreshold}
                    onChange={(e) => handleStrategyChange('bbWidthThreshold', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0.01"
                    max="0.1"
                    step="0.005"
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
                    max="2"
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
                    min="1"
                    max="10"
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
                    max="3"
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
                    min="0.1"
                    max="2"
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
                    max="500"
                    step="25"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={strategy.useMLPrediction}
                    onChange={(e) => handleStrategyChange('useMLPrediction', e.target.checked)}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Enable ML Prediction (fallback to rules until min samples)
                  </span>
                </label>
              </div>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/')}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isCreating}
                className="flex-1"
              >
                {isCreating ? 'Creating Bot...' : 'Create Bot'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}