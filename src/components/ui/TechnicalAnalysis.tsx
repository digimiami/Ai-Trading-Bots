import React, { useState, useEffect } from 'react';
import TechnicalGauge, { GaugeData } from './TechnicalGauge';

export interface TechnicalData {
  oscillators: GaugeData;
  summary: GaugeData;
  movingAverages: GaugeData;
}

interface TechnicalAnalysisProps {
  symbol: string;
  className?: string;
  onTimeframeChange?: (timeframe: string) => void;
}

// Timeframe options
const timeframes = [
  { id: '1m', label: '1 minute' },
  { id: '5m', label: '5 minutes' },
  { id: '15m', label: '15 minutes' },
  { id: '30m', label: '30 minutes' },
  { id: '1h', label: '1 hour' },
  { id: '2h', label: '2 hours' },
  { id: '4h', label: '4 hours' },
  { id: '1D', label: '1 day' },
  { id: '1W', label: '1 week' },
  { id: '1M', label: '1 month' }
];

/**
 * Fetch technical indicators from API
 */
const fetchTechnicalData = async (symbol: string, timeframe: string): Promise<TechnicalData> => {
  try {
    const supabaseUrl = (import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '').replace('/rest/v1', '');
    const supabaseKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration');
      throw new Error('Missing Supabase configuration');
    }
    
    const apiUrl = `${supabaseUrl}/functions/v1/market-data?action=technical&symbol=${symbol}&timeframe=${timeframe}`;
    console.log('📊 Fetching technical analysis:', apiUrl);
    
    const response = await fetch(apiUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error('Technical analysis API error:', response.status, text);
      throw new Error(`API error: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Technical analysis API returned non-JSON:', text.substring(0, 200));
      throw new Error('Invalid response format');
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.error('Technical analysis API error:', data.error);
      throw new Error(data.error);
    }
    
    console.log('✅ Technical analysis received:', data);
    
    return {
      oscillators: data.signals?.oscillators || { sell: 0, neutral: 0, buy: 0 },
      summary: data.signals?.summary || { sell: 0, neutral: 0, buy: 0 },
      movingAverages: data.signals?.movingAverages || { sell: 0, neutral: 0, buy: 0 }
    };
  } catch (error) {
    console.error('Error fetching technical data:', error);
    // Return neutral data on error
    return {
      oscillators: { sell: 0, neutral: 0, buy: 0 },
      summary: { sell: 0, neutral: 0, buy: 0 },
      movingAverages: { sell: 0, neutral: 0, buy: 0 }
    };
  }
};

export const TechnicalAnalysis: React.FC<TechnicalAnalysisProps> = ({ 
  symbol, 
  className = '',
  onTimeframeChange 
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D');
  const [technicalData, setTechnicalData] = useState<TechnicalData>({
    oscillators: { sell: 0, neutral: 0, buy: 0 },
    summary: { sell: 0, neutral: 0, buy: 0 },
    movingAverages: { sell: 0, neutral: 0, buy: 0 }
  });
  const [loading, setLoading] = useState(false);

  // Fetch data when symbol or timeframe changes
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchTechnicalData(symbol, selectedTimeframe);
        setTechnicalData(data);
      } catch (error) {
        console.error('Error fetching technical data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [symbol, selectedTimeframe]);

  const handleTimeframeChange = (timeframe: string) => {
    setSelectedTimeframe(timeframe);
    onTimeframeChange?.(timeframe);
  };

  console.log('TechnicalAnalysis rendering with symbol:', symbol);

  return (
    <div className={`bg-gray-900 dark:bg-gray-800 rounded-xl p-6 border border-gray-700 dark:border-gray-600 shadow-xl ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal-500 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <span className="text-gray-400 text-sm">Technicals</span>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white">
          {symbol.replace('USDT', '')} / TetherUS
        </h2>
      </div>

      {/* Timeframe Selector */}
      <div className="mb-8 overflow-x-auto">
        <div className="flex gap-2 min-w-max pb-2">
          {timeframes.map((tf) => (
            <button
              key={tf.id}
              onClick={() => handleTimeframeChange(tf.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedTimeframe === tf.id
                  ? 'bg-gray-700 text-white'
                  : 'bg-transparent text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gauges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {loading ? (
          <>
            <div className="flex items-center justify-center py-12 bg-gray-800 rounded-xl">
              <i className="ri-loader-4-line animate-spin text-4xl text-gray-400"></i>
            </div>
            <div className="flex items-center justify-center py-12 bg-gray-800 rounded-xl">
              <i className="ri-loader-4-line animate-spin text-4xl text-gray-400"></i>
            </div>
            <div className="flex items-center justify-center py-12 bg-gray-800 rounded-xl">
              <i className="ri-loader-4-line animate-spin text-4xl text-gray-400"></i>
            </div>
          </>
        ) : (
          <>
            <TechnicalGauge
              title="Oscillators"
              data={technicalData.oscillators}
              className="bg-gray-800 rounded-xl p-6"
            />
            <TechnicalGauge
              title="Summary"
              data={technicalData.summary}
              className="bg-gray-800 rounded-xl p-6"
            />
            <TechnicalGauge
              title="Moving Averages"
              data={technicalData.movingAverages}
              className="bg-gray-800 rounded-xl p-6"
            />
          </>
        )}
      </div>

      {/* Info Footer */}
      <div className="mt-8 p-4 bg-gray-800 rounded-lg border border-gray-700">
        <div className="flex items-start gap-3">
          <i className="ri-information-line text-blue-400 text-lg mt-0.5"></i>
          <div className="text-sm text-gray-300">
            <p className="font-medium mb-1">Technical Analysis</p>
            <p className="text-gray-400">
              The technical analysis combines multiple indicators including oscillators (RSI, Stochastic, etc.) 
              and moving averages (SMA, EMA) to provide an overall market sentiment for the selected timeframe.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechnicalAnalysis;

