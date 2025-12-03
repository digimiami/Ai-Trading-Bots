/**
 * Comprehensive AI/ML Dashboard Component
 * Displays ML predictions, AI performance metrics, and strategy analysis
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../src/lib/supabase';

interface MLPrediction {
  id: string;
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  timestamp: Date;
  outcome?: boolean;
  pnl?: number;
  price?: number;
  volume?: number;
  features: {
    rsi?: number;
    macd?: number;
    bollinger_position?: number;
    volume_trend?: number;
    price_momentum?: number;
    adx?: number;
    ema_diff?: number;
  };
}

interface AIPerformance {
  strategy: string;
  accuracy: number;
  total_trades: number;
  profitable_trades: number;
  avg_profit: number;
  sharpe_ratio: number;
  win_rate: number;
}

const AiMlDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [mlPredictions, setMLPredictions] = useState<MLPrediction[]>([]);
  const [aiPerformance, setAIPerformance] = useState<AIPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch ML predictions
  const fetchMLPredictions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please log in to view AI/ML dashboard');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/ml-predictions?action=get_predictions&limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch ML predictions');
      }

      const result = await response.json();
      if (result.success && result.predictions) {
        const formattedPredictions = result.predictions.map((p: any) => ({
          id: p.id,
          symbol: p.symbol,
          signal: p.prediction.toUpperCase() as 'BUY' | 'SELL' | 'HOLD',
          confidence: p.confidence,
          timestamp: new Date(p.timestamp),
          outcome: p.actual_outcome ? p.actual_outcome === p.prediction : undefined,
          pnl: p.pnl,
          price: p.price,
          volume: p.volume,
          features: p.features || {}
        }));
        setMLPredictions(formattedPredictions);
      }
    } catch (error) {
      console.error('Error fetching ML predictions:', error);
      setError('Failed to load predictions');
    }
  };

  // Fetch AI performance metrics
  const fetchAIPerformance = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/ml-predictions?action=get_performance`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch AI performance');
      }

      const result = await response.json();
      if (result.success && result.performance) {
        setAIPerformance(result.performance);
      }
    } catch (error) {
      console.error('Error fetching AI performance:', error);
    }
  };

  // Initialize AI performance data
  const initializePerformanceData = async () => {
    setIsInitializing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/ml-predictions?action=initialize_performance`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({})
        }
      );

      if (response.ok) {
        await fetchAIPerformance();
      }
    } catch (error) {
      console.error('Error initializing performance data:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  // Generate sample ML prediction
  const generateSamplePrediction = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];
      const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];

      const response = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/ml-predictions?action=predict`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            symbol: randomSymbol,
            bot_id: null
          })
        }
      );

      if (response.ok) {
        await fetchMLPredictions();
      }
    } catch (error) {
      console.error('Error generating prediction:', error);
    }
  };

  // Convert AI prediction to trading bot
  const convertPredictionToBot = (prediction: MLPrediction) => {
    // Determine trading type based on signal
    // For BUY/SELL signals, use futures trading. For HOLD, use spot
    const tradingType = prediction.signal === 'HOLD' ? 'spot' : 'futures';
    
    // Determine bias mode based on signal
    let biasMode = 'auto';
    if (prediction.signal === 'BUY') {
      biasMode = 'long-only';
    } else if (prediction.signal === 'SELL') {
      biasMode = 'short-only';
    }
    
    // Calculate recommended settings based on confidence
    const confidence = prediction.confidence;
    const riskLevel = confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low';
    const leverage = confidence > 0.8 ? 5 : confidence > 0.6 ? 3 : 2;
    const tradeAmount = confidence > 0.8 ? 100 : confidence > 0.6 ? 75 : 50;
    
    // Calculate stop loss and take profit based on confidence
    // Higher confidence = tighter stops, wider targets
    const stopLoss = confidence > 0.8 ? 1.5 : confidence > 0.6 ? 2.0 : 2.5;
    const takeProfit = confidence > 0.8 ? 4.0 : confidence > 0.6 ? 3.5 : 3.0;
    
    // Use features to set strategy parameters
    const rsiThreshold = prediction.features.rsi ? Math.round(prediction.features.rsi) : 70;
    const adxThreshold = prediction.features.adx ? Math.round(prediction.features.adx) : 25;
    
    // Build URL parameters for create-bot page
    const params = new URLSearchParams({
      symbol: prediction.symbol,
      exchange: 'bybit', // Default to bybit
      tradingType: tradingType,
      timeframe: '1h', // Default timeframe
      leverage: leverage.toString(),
      riskLevel: riskLevel,
      tradeAmount: tradeAmount.toString(),
      stopLoss: stopLoss.toString(),
      takeProfit: takeProfit.toString(),
      name: `AI Bot - ${prediction.symbol} (${prediction.signal})`,
      // Strategy parameters
      rsiThreshold: rsiThreshold.toString(),
      adxThreshold: adxThreshold.toString(),
      // Advanced config
      biasMode: biasMode,
      regimeMode: 'trend',
      // Indicate this came from AI prediction
      fromAiPrediction: 'true',
      predictionId: prediction.id,
      confidence: (confidence * 100).toFixed(1)
    });
    
    // Navigate to create-bot page with pre-filled parameters
    navigate(`/create-bot?${params.toString()}`);
  };

  // Calculate metrics from performance data
  const calculateMetrics = () => {
    if (aiPerformance.length === 0) {
      return {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        liveWinRate: 0,
        avgPnL: 0,
        profitFactor: 1.0,
        sharpeRatio: 0
      };
    }

    const totalTrades = aiPerformance.reduce((sum, s) => sum + s.total_trades, 0);
    const profitableTrades = aiPerformance.reduce((sum, s) => sum + s.profitable_trades, 0);
    const avgAccuracy = aiPerformance.reduce((sum, s) => sum + s.accuracy, 0) / aiPerformance.length;
    const avgSharpe = aiPerformance.reduce((sum, s) => sum + s.sharpe_ratio, 0) / aiPerformance.length;
    const winRate = totalTrades > 0 ? profitableTrades / totalTrades : 0;
    const avgProfit = aiPerformance.reduce((sum, s) => sum + s.avg_profit, 0) / aiPerformance.length;

    return {
      accuracy: avgAccuracy,
      precision: winRate * 0.95, // Estimated
      recall: winRate * 0.92, // Estimated
      f1Score: winRate * 0.93, // Harmonic mean estimate
      liveWinRate: winRate,
      avgPnL: avgProfit * 1000, // Convert to dollar amount
      profitFactor: winRate > 0 ? (winRate / (1 - winRate)) * 1.2 : 1.0,
      sharpeRatio: avgSharpe
    };
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchMLPredictions(), fetchAIPerformance()]);
      setIsLoading(false);
    };

    loadData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchMLPredictions();
      fetchAIPerformance();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading AI/ML Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-900 mb-2">⚠️ Error</h3>
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  const metrics = calculateMetrics();

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI/ML Trading Dashboard</h2>
          <p className="text-gray-600">Machine Learning Insights & Bot Performance</p>
        </div>
        <div className="flex items-center space-x-3">
          <select className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>Last 24 Hours</option>
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
          </select>
          <button
            onClick={generateSamplePrediction}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors flex items-center space-x-2"
          >
            <span>🎲</span>
            <span>Generate Prediction</span>
          </button>
          {aiPerformance.length === 0 && (
            <button
              onClick={initializePerformanceData}
              disabled={isInitializing}
              className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isInitializing ? 'Initializing...' : 'Initialize Data'}
            </button>
          )}
        </div>
      </div>

      {/* Performance Metrics - 4 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Model Accuracy */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Model Accuracy</h3>
            <div className="text-green-500">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{(metrics.accuracy * 100).toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-1">Overall AI Performance</p>
        </div>

        {/* Active Models */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Active Models</h3>
            <div className="text-blue-500">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{aiPerformance.length}</p>
          <p className="text-xs text-gray-500 mt-1">ML Strategies Running</p>
        </div>

        {/* Predictions Today */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Predictions Today</h3>
            <div className="text-purple-500">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{mlPredictions.length}</p>
          <p className="text-xs text-gray-500 mt-1">AI Decisions Made</p>
        </div>

        {/* Avg Confidence */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Avg Confidence</h3>
            <div className="text-orange-500">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {mlPredictions.length > 0 
              ? (mlPredictions.reduce((sum, p) => sum + p.confidence, 0) / mlPredictions.length * 100).toFixed(1)
              : '0.0'}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Prediction Confidence</p>
        </div>
      </div>

      {/* Bot ML Status Table */}
      {aiPerformance.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Bot ML Status</h3>
              <div className="flex space-x-4 text-sm">
                <span className="text-green-600 font-medium">{aiPerformance.length} Enabled</span>
                <span className="text-gray-500">0 Disabled</span>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bot Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strategy</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ML Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ML Trades</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Success Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {aiPerformance.map((strategy, index) => (
                  <tr key={strategy.strategy} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      PABLO {strategy.strategy.toUpperCase().replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {['BNBUSDT', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT'][index % 4]}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {strategy.strategy}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ● ENABLED
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {strategy.total_trades}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {(strategy.win_rate * 100).toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200">
                        ● Disable ML
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ML Predictions Confidence Chart */}
      {mlPredictions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">ML Predictions Confidence</h3>
          <div className="h-64 flex items-center justify-center text-gray-400">
            {/* Chart placeholder - showing confidence trend */}
            <div className="text-center">
              <p className="text-sm">Confidence trend over time</p>
              <p className="text-xs mt-2">Average: {mlPredictions.length > 0 
                ? (mlPredictions.reduce((sum, p) => sum + p.confidence, 0) / mlPredictions.length * 100).toFixed(1)
                : '0.0'}%</p>
            </div>
          </div>
        </div>
      )}

      {/* AI Strategy Performance Chart */}
      {aiPerformance.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Strategy Performance</h3>
          <div className="grid grid-cols-4 gap-4">
            {aiPerformance.map((strategy) => (
              <div key={strategy.strategy} className="text-center">
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-full bg-gray-100 rounded-t">
                    <div 
                      className="bg-purple-500 rounded-t transition-all"
                      style={{ height: `${strategy.accuracy * 200}px` }}
                    ></div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-t">
                    <div 
                      className="bg-green-500 rounded-t transition-all"
                      style={{ height: `${strategy.win_rate * 200}px` }}
                    ></div>
                  </div>
                  <p className="text-xs font-medium text-gray-700">
                    {strategy.strategy.replace('_', ' ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent AI Predictions */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Recent AI Predictions</h3>
          <button 
            onClick={() => {
              fetchMLPredictions();
              fetchAIPerformance();
            }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prediction</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RSI</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MACD</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ADX</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mlPredictions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No predictions yet. Click "Generate Prediction" to create AI predictions.
                  </td>
                </tr>
              ) : (
                mlPredictions.map((prediction) => (
                  <tr key={prediction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {prediction.symbol}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                        prediction.signal === 'BUY' ? 'bg-green-100 text-green-800' :
                        prediction.signal === 'SELL' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {prediction.signal}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(prediction.confidence * 100).toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {prediction.features.rsi?.toFixed(2) || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {prediction.features.macd?.toFixed(4) || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {prediction.features.adx?.toFixed(2) || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(prediction.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => convertPredictionToBot(prediction)}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        title="Convert this AI prediction to a trading bot"
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Convert to Bot
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AiMlDashboard;
