import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import TechnicalAnalysis from '../../components/ui/TechnicalAnalysis';
import Navigation from '../../components/feature/Navigation';
import Header from '../../components/feature/Header';

interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  vwap: number;
  atr: number;
  rsi: number;
  marketCap: number;
  inflow: number;
  outflow: number;
}

interface Alert {
  type: '24h_high' | 'large_volume';
  symbol: string;
  price?: number;
  high24h?: number;
  volume24h?: number;
  timestamp: string;
}

interface FearGreedIndex {
  value: number;
  classification: string;
  timestamp: string;
  yesterday?: {
    value: number;
    classification: string;
  };
}

interface CryptoNews {
  id: string;
  title: string;
  body: string;
  url: string;
  imageUrl: string | null;
  source: string;
  publishedOn: string;
  categories: string;
  tags: string;
}

export default function MarketDashboardPage() {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [topGainers, setTopGainers] = useState<MarketData[]>([]);
  const [rapidChanges, setRapidChanges] = useState<MarketData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [fearGreedIndex, setFearGreedIndex] = useState<FearGreedIndex | null>(null);
  const [news, setNews] = useState<CryptoNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [priceUpdates, setPriceUpdates] = useState<Map<string, number>>(new Map());
  const [activeTab, setActiveTab] = useState<'overview' | 'knowledge' | 'tips'>('overview');
  const { t } = useTranslation();

  // Fetch market data
  const fetchMarketData = async () => {
    try {
      const supabaseUrl = (import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '').replace('/rest/v1', '');
      const supabaseKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      
      console.log('📊 Fetching market data...', { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!supabaseKey,
        urlLength: supabaseUrl.length,
        keyLength: supabaseKey.length
      });
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase configuration', { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey });
        setLoading(false);
        return;
      }
      
      const apiUrl = `${supabaseUrl}/functions/v1/market-data?action=all`;
      console.log('🌐 Calling market data API:', apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      
      console.log('📡 API Response:', { status: response.status, statusText: response.statusText, ok: response.ok });
      
      // Check if response is OK
      if (!response.ok) {
        const text = await response.text();
        console.error('❌ Market data API error:', response.status, text.substring(0, 200));
        setLoading(false);
        return;
      }
      
      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Market data API returned non-JSON response:', contentType, text.substring(0, 200));
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      console.log('✅ Market data received:', { 
        hasMarketData: !!data.marketData, 
        marketDataCount: data.marketData?.length || 0,
        hasTopGainers: !!data.topGainers,
        hasRapidChanges: !!data.rapidChanges
      });
      
      if (data.marketData) {
        setMarketData(data.marketData);
        setTopGainers(data.topGainers || []);
        setRapidChanges(data.rapidChanges || []);
        if (data.fearGreedIndex) {
          setFearGreedIndex(data.fearGreedIndex);
        }
        if (data.news) {
          setNews(data.news);
        }
        console.log('✅ Market data state updated:', data.marketData.length, 'items');
      } else {
        console.warn('⚠️ No marketData in response:', data);
      }
    } catch (error) {
      console.error('❌ Error fetching market data:', error);
      // If it's a JSON parse error, the Edge Function might not be deployed
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        console.warn('⚠️ Market data Edge Function may not be deployed. Deploy it with: supabase functions deploy market-data');
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch alerts
  const fetchAlerts = async () => {
    try {
      const supabaseUrl = (import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '').replace('/rest/v1', '');
      const supabaseKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase configuration');
        return;
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/market-data?action=alerts`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      
      // Check if response is OK
      if (!response.ok) {
        const text = await response.text();
        console.error('Alerts API error:', response.status, text.substring(0, 200));
        return;
      }
      
      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Alerts API returned non-JSON response:', text.substring(0, 200));
        return;
      }
      
      const data = await response.json();
      
      if (data.alerts) {
        setAlerts(data.alerts);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
      // If it's a JSON parse error, the Edge Function might not be deployed
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        console.warn('⚠️ Market data Edge Function may not be deployed. Deploy it with: supabase functions deploy market-data');
      }
    }
  };

  // WebSocket connection for real-time prices
  useEffect(() => {
    const symbols = marketData.map(d => d.symbol).join(',');
    if (!symbols) return;

    // Use Bybit WebSocket public endpoint
    const wsUrl = `wss://stream.bybit.com/v5/public/spot`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setWsConnected(true);
      
      // Subscribe to ticker updates
      const subscribeMsg = {
        op: 'subscribe',
        args: marketData.map(d => `ticker.${d.symbol}`)
      };
      
      ws.send(JSON.stringify(subscribeMsg));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.topic?.startsWith('ticker.')) {
          const symbol = data.topic.replace('ticker.', '');
          const price = parseFloat(data.data?.lastPrice || '0');
          
          if (price > 0) {
            setPriceUpdates(prev => {
              const newMap = new Map(prev);
              newMap.set(symbol, price);
              return newMap;
            });
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setWsConnected(false);
      
      // Reconnect after 5 seconds
      setTimeout(() => {
        if (marketData.length > 0) {
          // Reconnect logic would go here
        }
      }, 5000);
    };

    return () => {
      ws.close();
    };
  }, [marketData.length]);

  // Initial data fetch
  useEffect(() => {
    fetchMarketData();
    fetchAlerts();
    
    // Refresh data every 5 minutes (reduced from 120s to 300s to save egress)
    const interval = setInterval(() => {
      fetchMarketData();
      fetchAlerts();
    }, 300000);
    
    return () => clearInterval(interval);
  }, []);

  // Format number
  const formatNumber = (num: number, decimals: number = 2): string => {
    if (num >= 1e9) return (num / 1e9).toFixed(decimals) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(decimals) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(decimals) + 'K';
    return num.toFixed(decimals);
  };

  // Format price
  const formatPrice = (price: number): string => {
    if (price >= 1000) return price.toFixed(2);
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(8);
  };

  // Get current price (from WebSocket or static)
  const getCurrentPrice = (symbol: string, defaultPrice: number): number => {
    return priceUpdates.get(symbol) || defaultPrice;
  };

  // Get Fear & Greed Index color
  const getFearGreedColor = (value: number): string => {
    if (value <= 25) return 'text-red-500';
    if (value <= 45) return 'text-orange-500';
    if (value <= 55) return 'text-yellow-500';
    if (value <= 75) return 'text-green-500';
    return 'text-emerald-500';
  };

  // Calculate gauge position (0-100% for the semi-circle)
  // Calculate angle for a given value (0-100 maps to 0-180 degrees)
  const getGaugeAngle = (value: number): number => {
    // Map 0-100 to 0-180 degrees (semi-circle)
    // 0 = leftmost (180°), 100 = rightmost (0°)
    return 180 - (value / 100) * 180;
  };

  // Convert angle to radians
  const angleToRadians = (angle: number): number => {
    return (angle * Math.PI) / 180;
  };

  // Calculate point on arc for a given value
  const getPointOnArc = (value: number, radius: number = 80) => {
    const angle = getGaugeAngle(value);
    const radians = angleToRadians(angle);
    const centerX = 100;
    const centerY = 100;
    return {
      x: centerX + radius * Math.cos(radians),
      y: centerY - radius * Math.sin(radians)
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header 
          title="Market Dashboard"
          subtitle="Real-time cryptocurrency market data and analysis"
        />
        <div className="pt-20 pb-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-12">
              <i className="ri-loader-4-line animate-spin text-4xl text-blue-500"></i>
              <p className="text-gray-600 dark:text-gray-400 mt-4">Loading market data...</p>
            </div>
          </div>
        </div>
        <Navigation />
      </div>
    );
  }

  // Show empty state if no data
  if (!marketData || marketData.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header 
          title="Market Dashboard"
          subtitle="Real-time cryptocurrency market data and analysis"
        />
        <div className="pt-20 pb-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-12">
              <i className="ri-line-chart-line text-4xl text-gray-400 mb-4"></i>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">No Market Data Available</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              The market data API may be temporarily unavailable or the Edge Function needs to be deployed.
            </p>
            <Button onClick={fetchMarketData} variant="primary">
              <i className="ri-refresh-line mr-2"></i>
              Retry
            </Button>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              Check the browser console for detailed error messages.
            </p>
          </div>
        </div>
        </div>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header 
        title="Market Dashboard"
        subtitle="Real-time cryptocurrency market data and analysis"
      />
      <div className="pt-20 pb-20 px-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Market Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Real-time crypto market analysis
              {wsConnected && (
                <span className="ml-2 inline-flex items-center gap-1 text-green-500">
                  <i className="ri-circle-fill text-xs"></i>
                  Live
                </span>
              )}
            </p>
          </div>
          <Button onClick={fetchMarketData} variant="secondary" size="sm">
            <i className="ri-refresh-line mr-2"></i>
            Refresh
          </Button>
        </div>

        {/* Tabs Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              <i className="ri-line-chart-line mr-2"></i>
              {t('market.overview')}
            </button>
            <button
              onClick={() => setActiveTab('knowledge')}
              className={`${
                activeTab === 'knowledge'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              <i className="ri-book-open-line mr-2"></i>
              {t('market.knowledge')}
            </button>
            <button
              onClick={() => setActiveTab('tips')}
              className={`${
                activeTab === 'tips'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              <i className="ri-lightbulb-flash-line mr-2"></i>
              {t('market.tips')}
            </button>
          </nav>
        </div>

        {/* Overview Tab Content */}
        {activeTab === 'overview' && (
          <>
        {/* Crypto Fear & Greed Index */}
        {fearGreedIndex && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Crypto Fear & Greed Index</h2>
            <div className="flex flex-col md:flex-row gap-6">
              {/* Gauge */}
              <div className="flex-1 flex items-center justify-center">
                <div className="relative w-full max-w-md">
                  {/* Semi-circle gauge - Fixed segments based on ranges */}
                  <svg viewBox="0 0 200 120" className="w-full h-auto" style={{ minHeight: '220px' }} preserveAspectRatio="xMidYMid meet">
                    <defs>
                      <linearGradient id="fearGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="100%" stopColor="#dc2626" />
                      </linearGradient>
                      <linearGradient id="greedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                    </defs>
                    
                    {/* Background arc - full semi-circle (perfectly straight) */}
                    <path
                      d="M 20 100 A 80 80 0 0 1 180 100"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="16"
                      className="dark:stroke-gray-700"
                    />
                    
                    {/* Fixed segments based on actual ranges */}
                    {/* Extreme Fear (0-25) - Red */}
                    {(() => {
                      const start = getPointOnArc(0, 80);
                      const end = getPointOnArc(25, 80);
                      return (
                        <path
                          d={`M ${start.x} ${start.y} A 80 80 0 0 1 ${end.x} ${end.y}`}
                          fill="none"
                          stroke="url(#fearGradient)"
                          strokeWidth="16"
                          strokeLinecap="round"
                        />
                      );
                    })()}
                    
                    {/* Fear (26-45) - Orange */}
                    {(() => {
                      const start = getPointOnArc(26, 80);
                      const end = getPointOnArc(45, 80);
                      return (
                        <path
                          d={`M ${start.x} ${start.y} A 80 80 0 0 1 ${end.x} ${end.y}`}
                          fill="none"
                          stroke="#f97316"
                          strokeWidth="16"
                          strokeLinecap="round"
                        />
                      );
                    })()}
                    
                    {/* Neutral (46-55) - Yellow */}
                    {(() => {
                      const start = getPointOnArc(46, 80);
                      const end = getPointOnArc(55, 80);
                      return (
                        <path
                          d={`M ${start.x} ${start.y} A 80 80 0 0 1 ${end.x} ${end.y}`}
                          fill="none"
                          stroke="#eab308"
                          strokeWidth="16"
                          strokeLinecap="round"
                        />
                      );
                    })()}
                    
                    {/* Greed (56-75) - Green */}
                    {(() => {
                      const start = getPointOnArc(56, 80);
                      const end = getPointOnArc(75, 80);
                      return (
                        <path
                          d={`M ${start.x} ${start.y} A 80 80 0 0 1 ${end.x} ${end.y}`}
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="16"
                          strokeLinecap="round"
                        />
                      );
                    })()}
                    
                    {/* Extreme Greed (76-100) - Emerald */}
                    {(() => {
                      const start = getPointOnArc(76, 80);
                      const end = getPointOnArc(100, 80);
                      return (
                        <path
                          d={`M ${start.x} ${start.y} A 80 80 0 0 1 ${end.x} ${end.y}`}
                          fill="none"
                          stroke="url(#greedGradient)"
                          strokeWidth="16"
                          strokeLinecap="round"
                        />
                      );
                    })()}
                    
                    {/* Indicator line - points to current value */}
                    {(() => {
                      const indicatorPoint = getPointOnArc(fearGreedIndex.value, 80);
                      return (
                        <>
                          <line
                            x1="100"
                            y1="100"
                            x2={indicatorPoint.x}
                            y2={indicatorPoint.y}
                            stroke="#1f2937"
                            strokeWidth="5"
                            strokeLinecap="round"
                            className="dark:stroke-gray-200"
                          />
                          {/* Indicator dot */}
                          <circle
                            cx={indicatorPoint.x}
                            cy={indicatorPoint.y}
                            r="10"
                            fill="#1f2937"
                            stroke="#ffffff"
                            strokeWidth="3"
                            className="dark:fill-gray-200 dark:stroke-gray-800"
                          />
                        </>
                      );
                    })()}
                    
                    {/* Center point */}
                    <circle cx="100" cy="100" r="4" fill="#6b7280" className="dark:fill-gray-500" />
                  </svg>
                  {/* Value display */}
                  <div className="text-center mt-4">
                    <div className={`text-5xl font-bold ${getFearGreedColor(fearGreedIndex.value)}`}>
                      {fearGreedIndex.value}
                    </div>
                    <div className={`text-lg font-semibold mt-2 ${getFearGreedColor(fearGreedIndex.value)}`}>
                      {fearGreedIndex.classification}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Historical data and info */}
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Historical Data</h3>
                  <div className="space-y-2">
                    {fearGreedIndex.yesterday && (
                      <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Yesterday</span>
                        <div className="text-right">
                          <span className={`font-semibold ${getFearGreedColor(fearGreedIndex.yesterday.value)}`}>
                            {fearGreedIndex.yesterday.value}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            {fearGreedIndex.yesterday.classification}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">What's Crypto Fear & Greed Index?</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    The index ranges from 0 (Extreme Fear) to 100 (Extreme Greed), reflecting crypto market sentiment. 
                    A low value signals over-selling, while a high value warns of a potential market correction.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Technical Analysis Section */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Technical Analysis</h2>
            <div className="flex items-center gap-3">
              {/* Pair Selector */}
              <select
                value={selectedSymbol || (marketData && marketData.length > 0 ? marketData[0]?.symbol : 'BTCUSDT')}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {marketData.map((item) => (
                  <option key={item.symbol} value={item.symbol}>
                    {item.symbol.replace('USDT', '')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <TechnicalAnalysis 
            symbol={selectedSymbol || (marketData && marketData.length > 0 ? marketData[0]?.symbol : 'BTCUSDT')}
            onTimeframeChange={(timeframe) => {
              console.log('Timeframe changed to:', timeframe);
            }}
          />
        </Card>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert, idx) => (
              <Card key={idx} className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center gap-3">
                  <i className="ri-alarm-line text-yellow-600 dark:text-yellow-400 text-xl"></i>
                  <div>
                    <p className="font-semibold text-yellow-900 dark:text-yellow-100">
                      {alert.type === '24h_high' 
                        ? `24h High: ${alert.symbol} at $${formatPrice(alert.price || 0)}`
                        : `Large Volume: ${alert.symbol} - $${formatNumber(alert.volume24h || 0)}`}
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Top Gainers */}
        {topGainers.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Top Gainers (24h)</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {topGainers.map((item) => (
                <div key={item.symbol} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900 dark:text-white">{item.symbol.replace('USDT', '')}</span>
                    <span className={`text-sm font-medium ${item.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    ${formatPrice(getCurrentPrice(item.symbol, item.price))}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Price Tiles */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Market Overview</h2>
          {marketData && marketData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {marketData.map((item) => {
              const currentPrice = getCurrentPrice(item.symbol, item.price);
              const priceChange = currentPrice - item.price;
              const isPositive = priceChange >= 0;
              
              return (
                <Card 
                  key={item.symbol} 
                  className={`p-6 cursor-pointer transition-all hover:shadow-lg ${
                    selectedSymbol === item.symbol ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedSymbol(selectedSymbol === item.symbol ? null : item.symbol)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {item.symbol.replace('USDT', '')}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Market Cap: ${formatNumber(item.marketCap)}</p>
                    </div>
                    <div className={`text-right ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      <p className="text-sm font-medium">
                        {isPositive ? '+' : ''}{((priceChange / item.price) * 100).toFixed(2)}%
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">24h: {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">
                        ${formatPrice(currentPrice)}
                      </span>
                      {wsConnected && (
                        <span className="text-xs text-green-500">
                          <i className="ri-circle-fill text-xs"></i> Live
                        </span>
                      )}
                    </div>
                    
                    {selectedSymbol === item.symbol && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">VWAP</p>
                            <p className="font-semibold text-gray-900 dark:text-white">${formatPrice(item.vwap)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">ATR</p>
                            <p className="font-semibold text-gray-900 dark:text-white">${formatPrice(item.atr)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">RSI</p>
                            <p className={`font-semibold ${item.rsi > 70 ? 'text-red-600' : item.rsi < 30 ? 'text-green-600' : 'text-gray-900 dark:text-white'}`}>
                              {item.rsi.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Volume 24h</p>
                            <p className="font-semibold text-gray-900 dark:text-white">${formatNumber(item.volume24h)}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Inflow</p>
                            <p className="font-semibold text-green-600">${formatNumber(item.inflow)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Outflow</p>
                            <p className="font-semibold text-red-600">${formatNumber(item.outflow)}</p>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 pt-2">
                          <p>24h High: ${formatPrice(item.high24h)}</p>
                          <p>24h Low: ${formatPrice(item.low24h)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
          ) : (
            <Card className="p-6">
              <p className="text-gray-600 dark:text-gray-400 text-center">No market data available</p>
            </Card>
          )}
        </div>

        {/* Recent Crypto News */}
        {news.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recent Crypto News</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {news.slice(0, 6).map((article) => (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex gap-3">
                    {article.imageUrl && (
                      <img
                        src={article.imageUrl}
                        alt={article.title}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-2 line-clamp-2">
                        {article.title}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                        {article.body}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
                        <span>{article.source}</span>
                        <span>{new Date(article.publishedOn).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </Card>
        )}

        {/* Rapid Changes */}
        {rapidChanges.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Rapid Changes (&gt;5% in 24h)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Symbol</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Price</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Change 24h</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Volume</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">RSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {rapidChanges.map((item) => (
                    <tr key={item.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{item.symbol}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        ${formatPrice(getCurrentPrice(item.symbol, item.price))}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${item.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        ${formatNumber(item.volume24h)}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${
                        item.rsi > 70 ? 'text-red-600' : item.rsi < 30 ? 'text-green-600' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {item.rsi.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
          </>
        )}

        {/* Knowledge Tab Content */}
        {activeTab === 'knowledge' && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <i className="ri-lightbulb-line text-3xl text-yellow-500"></i>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Trading Bot Testing Guide</h2>
                  <p className="text-gray-600 dark:text-gray-400">Learn how to properly test your trading bots before risking real money</p>
                </div>
              </div>
            </Card>

            {/* Phase 1: Paper Trading */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">1</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Phase 1: Paper Trading (FREE)</h3>
                  <div className="space-y-4 text-gray-700 dark:text-gray-300">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white mb-1">⏱️ Duration: 1-4 Weeks Minimum</p>
                      <p className="text-sm">Start here! Use virtual money to test your bot's strategy without any financial risk.</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white mb-1">💰 Recommended Balance: $10,000 (Virtual)</p>
                      <p className="text-sm">This is your default paper trading balance - completely free!</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white mb-1">✅ What to Verify:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                        <li>20-30+ trades executed successfully</li>
                        <li>Win rate above 50% (depends on strategy)</li>
                        <li>No technical errors or timeouts</li>
                        <li>Stop Loss (SL) and Take Profit (TP) triggers correctly</li>
                        <li>Bot runs consistently over different market conditions</li>
                      </ul>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <p className="font-medium text-blue-900 dark:text-blue-300 mb-1">💡 Why Paper Trading First?</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200 ml-2">
                        <li>Uses REAL market data (same prices as real trading)</li>
                        <li>Zero financial risk - perfect for learning</li>
                        <li>Helps identify bugs before they cost money</li>
                        <li>Validates your strategy without emotional stress</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Phase 2: Small Real Money Testing */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <span className="text-green-600 dark:text-green-400 font-bold">2</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Phase 2: Small Real-Money Testing</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Only after paper trading shows promising results!</p>
                  <div className="space-y-4 text-gray-700 dark:text-gray-300">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white mb-1">💰 Recommended Starting Capital: $100-$500</p>
                      <p className="text-sm">This is enough to cover fees and make meaningful trades, but small enough that mistakes won't hurt.</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white mb-1">⏱️ Duration: 2-4 Weeks Minimum</p>
                      <p className="text-sm">Run your bot long enough to see consistent patterns and verify real-world execution.</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white mb-1">⚙️ Recommended Trade Settings:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                        <li>Base Amount: $20-$50 per trade</li>
                        <li>Leverage: 2x-3x (conservative)</li>
                        <li>Risk Level: Low-Medium</li>
                        <li>Total per trade: ~$60-$150</li>
                      </ul>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                      <p className="font-medium text-green-900 dark:text-green-300 mb-1">📊 Example Setup:</p>
                      <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                        <p>• Base: $30 × Leverage: 2x × Risk: Low (1x) = $60 per trade</p>
                        <p>• With $300 capital: ~5 trades possible (safe buffer)</p>
                        <p>• This gives you room to learn without overexposing your capital</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Phase 3: Scale Up Gradually */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <span className="text-purple-600 dark:text-purple-400 font-bold">3</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Phase 3: Scale Up Gradually</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Only after consistent profitability in Phase 2!</p>
                  <div className="space-y-4 text-gray-700 dark:text-gray-300">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white mb-1">📈 Scaling Timeline:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                        <li>Month 1: $100-$500 (testing phase)</li>
                        <li>Month 2: $500-$1000 (if profitable)</li>
                        <li>Month 3+: Scale based on performance</li>
                      </ul>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                      <p className="font-medium text-purple-900 dark:text-purple-300 mb-1">⚠️ Golden Rules:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-purple-800 dark:text-purple-200 ml-2">
                        <li>Never risk more than you can afford to lose</li>
                        <li>Only scale up if consistently profitable</li>
                        <li>Always keep a safety buffer (don't use 100% of capital)</li>
                        <li>Monitor closely when increasing position sizes</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Quick Reference */}
            <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">📋 Quick Reference</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white mb-2">Minimum Viable Test:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300 ml-2">
                    <li>Paper Trading: 2 weeks, 20-30 trades</li>
                    <li>Real Test: 1 month, $200-$300 capital</li>
                    <li>Trade Size: $30-$50 base, 2x leverage</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white mb-2">Red Flags to Watch:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-red-600 dark:text-red-400 ml-2">
                    <li>Win rate below 40%</li>
                    <li>CPU timeout errors</li>
                    <li>Orders not executing</li>
                    <li>Consistent losses daily</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Recommended Testing Strategy */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">🎯 Recommended Testing Strategy</h3>
              <div className="space-y-4">
                <div className="border-l-4 border-blue-500 pl-4">
                  <p className="font-medium text-gray-900 dark:text-white">Week 1-2: Paper Trading</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Enable paper trading mode, run 24/7, monitor closely, fix any bugs</p>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <p className="font-medium text-gray-900 dark:text-white">Week 3: Review Paper Results</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Win rate &gt; 50%? Proceed. Win rate &lt; 40%? Adjust strategy first.</p>
                </div>
                <div className="border-l-4 border-purple-500 pl-4">
                  <p className="font-medium text-gray-900 dark:text-white">Week 4+: Small Real Money</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Start with $200-$300, run 1 bot only, monitor daily, don't increase size yet</p>
                </div>
                <div className="border-l-4 border-orange-500 pl-4">
                  <p className="font-medium text-gray-900 dark:text-white">Month 2+: Scale If Profitable</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">If profitable, increase slowly. If not, go back to paper trading and optimize</p>
                </div>
              </div>
            </Card>

            {/* Important Notes */}
            <Card className="p-6 border-2 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
              <div className="flex items-start gap-3">
                <i className="ri-error-warning-line text-2xl text-yellow-600 dark:text-yellow-400"></i>
                <div>
                  <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-300 mb-2">⚠️ Before Using Real Money</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800 dark:text-yellow-200 ml-2">
                    <li>Fix any CPU timeout errors (currently blocking trades!)</li>
                    <li>Test in paper trading for at least 2 weeks</li>
                    <li>Verify 20+ trades execute correctly</li>
                    <li>Confirm win rate is acceptable for your strategy</li>
                    <li>Understand that past performance doesn't guarantee future results</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Bot Settings Guide */}
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <i className="ri-settings-3-line text-3xl text-blue-500"></i>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Complete Bot Settings Guide</h2>
                  <p className="text-gray-600 dark:text-gray-400">Detailed explanation of every bot setting and how they work together</p>
                </div>
              </div>

              {/* Basic Configuration */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 border-b-2 border-blue-500 pb-2">1. Basic Configuration</h3>
                <div className="space-y-4 text-sm">
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">📛 Bot Name</p>
                    <p className="text-gray-700 dark:text-gray-300">Your bot's identifier. Used for display in dashboard and logs.</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">🏦 Exchange</p>
                    <p className="text-gray-700 dark:text-gray-300 mb-1">Options: Bybit, OKX, Bitunix</p>
                    <p className="text-gray-600 dark:text-gray-400 text-xs">Determines which exchange API to use. Different exchanges have different fee structures and pair availability.</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">💱 Trading Type</p>
                    <p className="text-gray-700 dark:text-gray-300 mb-1">Options: Spot, Futures</p>
                    <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 text-xs ml-2 space-y-1">
                      <li><strong>Spot:</strong> Direct asset purchase (no leverage)</li>
                      <li><strong>Futures:</strong> Perpetual contracts (supports leverage, margin trading)</li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">📊 Trading Pair (Symbol)</p>
                    <p className="text-gray-700 dark:text-gray-300 mb-1">The crypto pair to trade (e.g., BTCUSDT, ETHUSDT)</p>
                    <p className="text-gray-600 dark:text-gray-400 text-xs">You can trade a single pair or multiple pairs. Determines which market the bot analyzes.</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">⏰ Time Frame</p>
                    <p className="text-gray-700 dark:text-gray-300 mb-1">Options: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 1d, etc.</p>
                    <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 text-xs ml-2 space-y-1">
                      <li><strong>Lower timeframes</strong> (1m-15m) = More signals, faster execution</li>
                      <li><strong>Higher timeframes</strong> (4h-1d) = Fewer signals, more reliable trends</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Trade Sizing & Risk */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 border-b-2 border-red-500 pb-2">2. Trade Sizing & Risk Settings</h3>
                <div className="space-y-4 text-sm">
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">💰 Trade Amount (USD)</p>
                    <p className="text-gray-700 dark:text-gray-300 mb-1">Range: $10-$10,000 | Default: $100</p>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">Base capital per trade. This is multiplied by leverage and risk level.</p>
                    <p className="text-xs font-mono bg-white dark:bg-gray-800 p-2 rounded">Formula: Total = Trade Amount × Leverage × Risk Multiplier</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Example: $50 × 3x × 1.5 = $225 per trade</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">⚡ Leverage</p>
                    <p className="text-gray-700 dark:text-gray-300 mb-1">Options: 1x, 2x, 3x, 5x, 10x, 20x | Default: 5x</p>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">Multiplies your position size. Only works with Futures trading.</p>
                    <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 text-xs ml-2 space-y-1">
                      <li><strong>1x:</strong> No leverage (spot equivalent)</li>
                      <li><strong>Higher leverage:</strong> Larger positions, higher risk/reward</li>
                      <li><strong>⚠️ Warning:</strong> Higher leverage increases liquidation risk</li>
                    </ul>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">📊 Risk Level</p>
                    <p className="text-gray-700 dark:text-gray-300 mb-1">Options: Low (1.0x), Medium (1.5x), High (2.0x) | Default: Medium</p>
                    <p className="text-gray-600 dark:text-gray-400 text-xs">Multiplier for trade size. Medium risk = 50% larger positions than low risk.</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">🛑 Stop Loss (%)</p>
                    <p className="text-gray-700 dark:text-gray-300 mb-1">Range: 0.5%-10% | Default: 2.0%</p>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">Maximum loss percentage before auto-closing position.</p>
                    <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 text-xs ml-2 space-y-1">
                      <li><strong>LONG:</strong> Closes if price drops by this %</li>
                      <li><strong>SHORT:</strong> Closes if price rises by this %</li>
                      <li>Smaller = tighter risk, but higher chance of premature exits</li>
                    </ul>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">🎯 Take Profit (%)</p>
                    <p className="text-gray-700 dark:text-gray-300 mb-1">Range: 1%-20% | Default: 4.0%</p>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">Target profit percentage before auto-closing position.</p>
                    <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 text-xs ml-2 space-y-1">
                      <li><strong>LONG:</strong> Closes when price rises by this %</li>
                      <li><strong>SHORT:</strong> Closes when price drops by this %</li>
                      <li>Higher = larger potential gains, but may take longer</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Strategy Parameters */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 border-b-2 border-purple-500 pb-2">3. Strategy Parameters</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-1">📈 RSI Threshold</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Range: 30-90 | Default: 70</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">RSI &gt; threshold = Overbought (SELL). RSI &lt; 30 = Oversold (BUY). Lower = more conservative.</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-1">📊 ADX Threshold</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Range: 10-50 | Default: 25</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">Trend strength filter. ADX &gt; threshold = strong trend. Higher = only trade strong trends.</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-1">📏 BB Width Threshold</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Range: 0.01-0.1 | Default: 0.02</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">Volatility filter. Narrow = low volatility. Wide = high volatility. Filters out choppy markets.</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-1">📉 EMA Slope</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Range: 0.1-2.0 | Default: 0.5</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">Measures trend steepness. Higher value = requires steeper trends to trade.</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-1">⚡ ATR Percentage</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Range: 1%-10% | Default: 2.5%</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">Volatility measurement. Used to size stops and take profits dynamically based on market volatility.</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-1">📊 VWAP Distance</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Range: 0.5-3.0 | Default: 1.2</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">Distance from Volume Weighted Average Price. Higher = trade only when price deviates significantly.</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-1">🚀 Momentum Threshold</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Range: 0.1-2.0 | Default: 0.8</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">Requires strong price momentum to enter. Higher threshold = only trade strong moves.</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-1">🤖 ML Prediction</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Enabled/Disabled</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">AI/ML trade signals. Requires minimum samples before activating (see Advanced Settings).</p>
                  </div>
                </div>
              </div>

              {/* Advanced Settings Summary */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 border-b-2 border-indigo-500 pb-2">4. Advanced Strategy Configuration</h3>
                <div className="space-y-4 text-sm">
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">🎯 Directional Bias</p>
                    <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 text-xs ml-2 space-y-1">
                      <li><strong>Bias Mode:</strong> Auto (follows HTF trend), Long Only, Short Only, or Both</li>
                      <li><strong>HTF Timeframe:</strong> Higher timeframe for trend analysis (default: 4h)</li>
                      <li><strong>HTF Trend Indicator:</strong> EMA200, Supertrend, VWAP, etc. to determine trend</li>
                      <li><strong>ADX Min (HTF):</strong> Minimum ADX on higher timeframe (default: 23) - requires strong HTF trends</li>
                    </ul>
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">📊 Regime Filter</p>
                    <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 text-xs ml-2 space-y-1">
                      <li><strong>Regime Mode:</strong> Auto Detect, Trend Only, or Mean Reversion Only</li>
                      <li><strong>ADX Trend Min:</strong> ADX ≥ this = trending market (default: 25)</li>
                      <li><strong>ADX Mean Rev Max:</strong> ADX ≤ this = ranging market (default: 19)</li>
                    </ul>
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">⏰ Session/Timing</p>
                    <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 text-xs ml-2 space-y-1">
                      <li><strong>Trading Hours:</strong> Restrict trading to specific UTC hours (default: 24/7)</li>
                      <li><strong>Cooldown (Bars):</strong> Wait X bars between trades (default: 8) - prevents overtrading</li>
                      <li>Example: 8 bars on 1h timeframe = 8 hours between trades</li>
                    </ul>
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">🛡️ Risk Management</p>
                    <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 text-xs ml-2 space-y-1">
                      <li><strong>Risk Per Trade:</strong> % of account risked per trade (default: 0.75%)</li>
                      <li><strong>Daily Loss Limit:</strong> Auto-pause if daily loss exceeds % (default: 3%)</li>
                      <li><strong>Weekly Loss Limit:</strong> Auto-pause if weekly loss exceeds % (default: 6%)</li>
                      <li><strong>Max Trades/Day:</strong> Maximum trades per 24 hours (default: 8)</li>
                      <li><strong>Max Concurrent:</strong> Max open positions simultaneously (default: 2)</li>
                      <li><strong>Max Consecutive Losses:</strong> Auto-pause after X losses (default: 5)</li>
                    </ul>
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">🎯 Exit Strategy</p>
                    <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 text-xs ml-2 space-y-1">
                      <li><strong>TP1 (R):</strong> First take profit in Risk units (default: 1.0R = 1:1 risk-reward)</li>
                      <li><strong>TP2 (R):</strong> Second take profit (default: 2.0R = 2:1 risk-reward)</li>
                      <li><strong>TP1 Size:</strong> % of position to close at TP1 (default: 50%)</li>
                      <li><strong>SL ATR Multiplier:</strong> Dynamic stop loss = ATR × multiplier (default: 1.3)</li>
                      <li><strong>Trailing Stop:</strong> Protects profits after TP1 is hit</li>
                      <li><strong>Time Stop:</strong> Auto-close position after X hours (default: 48h)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* How Settings Work Together */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 border-b-2 border-green-500 pb-2">5. How Settings Work Together</h3>
                <div className="space-y-4 text-sm">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">💰 Trade Size Calculation Example</p>
                    <div className="font-mono bg-white dark:bg-gray-800 p-3 rounded text-xs space-y-1">
                      <p>Base Amount: $50</p>
                      <p>Leverage: 3x</p>
                      <p>Risk Level: Medium (1.5x multiplier)</p>
                      <p className="border-t border-gray-300 dark:border-gray-600 pt-2 mt-2">Calculation:</p>
                      <p>$50 × 3 × 1.5 = $225 total trade value</p>
                      <p className="text-gray-600 dark:text-gray-400">If BTC price = $100,000:</p>
                      <p>Quantity = $225 / $100,000 = 0.00225 BTC</p>
                    </div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">🛡️ Risk Management Flow</p>
                    <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 text-xs ml-2 space-y-1">
                      <li>Daily Loss Limit: If bot loses 3% today → Auto-pause</li>
                      <li>Weekly Loss Limit: If bot loses 6% this week → Auto-pause</li>
                      <li>Max Consecutive Losses: After 5 losses in a row → Auto-pause</li>
                      <li>Max Trades/Day: After 8 trades today → No more trades until tomorrow</li>
                    </ol>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">⚙️ Strategy Decision Flow</p>
                    <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 text-xs ml-2 space-y-1">
                      <li>Check HTF trend (Bias Mode)</li>
                      <li>Check market regime (Trending or Ranging)</li>
                      <li>Check volatility (ATR, BB Width)</li>
                      <li>Check liquidity (24h Volume, Spread)</li>
                      <li>Check indicators (RSI, ADX, EMA)</li>
                      <li>Check timing (Trading hours, Cooldown)</li>
                      <li>Calculate entry signal</li>
                      <li>Calculate position size</li>
                      <li>Place order with Stop Loss & Take Profit</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Recommended Settings */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 border-b-2 border-orange-500 pb-2">6. Recommended Settings by Experience Level</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                    <p className="font-bold text-blue-900 dark:text-blue-300 mb-3 text-center">🐣 Beginner</p>
                    <ul className="space-y-2 text-xs text-gray-700 dark:text-gray-300">
                      <li><strong>Leverage:</strong> 2x-3x</li>
                      <li><strong>Risk Level:</strong> Low</li>
                      <li><strong>Trade Amount:</strong> $20-$50</li>
                      <li><strong>Stop Loss:</strong> 2%</li>
                      <li><strong>Take Profit:</strong> 4%</li>
                      <li><strong>Cooldown:</strong> 10-15 bars</li>
                    </ul>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border-2 border-yellow-300 dark:border-yellow-700">
                    <p className="font-bold text-yellow-900 dark:text-yellow-300 mb-3 text-center">⚖️ Intermediate</p>
                    <ul className="space-y-2 text-xs text-gray-700 dark:text-gray-300">
                      <li><strong>Leverage:</strong> 3x-5x</li>
                      <li><strong>Risk Level:</strong> Medium</li>
                      <li><strong>Trade Amount:</strong> $50-$100</li>
                      <li><strong>Stop Loss:</strong> 2%</li>
                      <li><strong>Take Profit:</strong> 3-5%</li>
                      <li><strong>Cooldown:</strong> 5-10 bars</li>
                    </ul>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border-2 border-red-300 dark:border-red-700">
                    <p className="font-bold text-red-900 dark:text-red-300 mb-3 text-center">🚀 Advanced</p>
                    <ul className="space-y-2 text-xs text-gray-700 dark:text-gray-300">
                      <li><strong>Leverage:</strong> 5x-10x</li>
                      <li><strong>Risk Level:</strong> Medium-High</li>
                      <li><strong>Trade Amount:</strong> $100+</li>
                      <li><strong>Stop Loss:</strong> Dynamic (ATR-based)</li>
                      <li><strong>Take Profit:</strong> Dynamic (ATR-based)</li>
                      <li><strong>Features:</strong> Custom filters, ML enabled</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Trading Tips Tab Content */}
        {activeTab === 'tips' && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <i className="ri-lightbulb-flash-line text-3xl text-yellow-500"></i>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Trading Tips for Better Results</h2>
                  <p className="text-gray-600 dark:text-gray-400">Expert tips and best practices to improve your trading performance</p>
                </div>
              </div>
            </Card>

            {/* Risk Management Tips */}
            <Card className="p-6 border-l-4 border-red-500">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <i className="ri-shield-line text-red-500"></i>
                Risk Management Tips
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">💡 Never Risk More Than 1-2% Per Trade</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Risk only 1-2% of your total capital per trade. This means even 10 losing trades in a row only cost you 10-20% of your account.</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">🎯 Always Use Stop Loss</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Never trade without a stop loss. It's your safety net that prevents catastrophic losses when trades go against you.</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">📊 Keep Risk-Reward Ratio at 1:2 or Better</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">If you risk $100, aim to make at least $200. This way, you only need 33% win rate to be profitable.</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">💰 Don't Trade with Money You Can't Afford to Lose</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Only trade with disposable income. Never risk money needed for bills, rent, or emergencies.</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">⏸️ Set Daily Loss Limits</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">If you lose X% in a day, stop trading. Emotional revenge trading after losses usually leads to bigger losses.</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">🔄 Diversify Your Positions</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Don't put all your capital in one trade or one asset. Spread risk across multiple positions (but limit concurrent trades).</p>
                </div>
              </div>
            </Card>

            {/* Strategy & Execution Tips */}
            <Card className="p-6 border-l-4 border-blue-500">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <i className="ri-strategy-line text-blue-500"></i>
                Strategy & Execution Tips
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">📈 Trade in the Direction of the Trend</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Use higher timeframe analysis to determine the overall trend. It's easier to profit when trading with the trend than against it.</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">⏰ Trade During High Volume Hours</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Higher volume = better liquidity = tighter spreads and less slippage. Avoid trading during low-liquidity periods.</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">🎯 Wait for Multiple Confirmations</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Don't trade on a single indicator. Wait for RSI, ADX, EMA, and volume to align before entering.</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">📊 Use Multiple Timeframe Analysis</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Check 4h/daily for trend direction, then use 1h/15m for entry timing. This improves your win rate significantly.</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">🚫 Avoid Overtrading</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Quality over quantity. Set a cooldown between trades. Not every market condition requires a trade.</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">⚡ Use Paper Trading First</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Always test new strategies in paper trading mode first. Validate your approach before risking real money.</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">📝 Keep a Trading Journal</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Record your trades, reasons for entry/exit, and outcomes. Review regularly to identify patterns and improve.</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">🎲 Let Winners Run, Cut Losers Fast</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Use trailing stops to protect profits on winning trades. Exit losing trades quickly - don't hope they'll recover.</p>
                </div>
              </div>
            </Card>

            {/* Leverage & Position Sizing Tips */}
            <Card className="p-6 border-l-4 border-purple-500">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <i className="ri-exchange-funds-line text-purple-500"></i>
                Leverage & Position Sizing Tips
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">⚡ Start with Low Leverage</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Begin with 2x-3x leverage. Only increase after consistent profitability. Higher leverage amplifies both gains AND losses.</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">💰 Never Use Maximum Leverage</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Even if exchange offers 100x, don't use it. 5x-10x is risky enough. Most professional traders use 3x-5x maximum.</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">📊 Size Positions Based on Volatility</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">More volatile pairs = smaller positions. Less volatile pairs = can use slightly larger positions (still respect risk limits).</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">🎯 Maintain Margin Buffer</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Keep 30-50% of your capital free as margin buffer. This prevents liquidation during adverse price movements.</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">⚖️ Reduce Leverage in Uncertain Markets</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">During high volatility or news events, reduce leverage or avoid trading. Protect your capital first.</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">📈 Scale Position Size with Confidence</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Only increase position sizes when your strategy is consistently profitable. Scale gradually, not all at once.</p>
                </div>
              </div>
            </Card>

            {/* Market Conditions Tips */}
            <Card className="p-6 border-l-4 border-green-500">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <i className="ri-bar-chart-line text-green-500"></i>
                Market Conditions & Timing Tips
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">📊 Trade Trending Markets, Avoid Ranging</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Use ADX to identify trends. ADX &gt; 25 = trending (good for trading). ADX &lt; 20 = ranging (avoid or use mean reversion).</p>
                  </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">⚡ Avoid Trading During Low Volume</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Low volume = wide spreads, high slippage, unpredictable moves. Wait for volume to pick up.</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">📰 Be Cautious Around News Events</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Major news can cause sudden price spikes. Either avoid trading or use wider stops during news events.</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">🌙 Consider Market Sessions</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Different times = different volatility. Asian session = lower volatility. US/EU overlap = highest volatility and volume.</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">📈 Trade Liquid Pairs</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Stick to major pairs (BTC, ETH, SOL, BNB, XRP) with high 24h volume. Avoid low-liquidity altcoins - they're harder to exit.</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">🎯 Use Volatility Filters</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Set minimum ATR or BB Width thresholds. Too low volatility = choppy markets. Too high = unpredictable moves.</p>
                </div>
              </div>
            </Card>

            {/* Psychology & Mindset Tips */}
            <Card className="p-6 border-l-4 border-orange-500">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <i className="ri-brain-line text-orange-500"></i>
                Psychology & Mindset Tips
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">🧠 Remove Emotions from Trading</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Let your bot execute the strategy. Don't manually override trades based on fear or greed. Trust your system.</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">💪 Accept Losses as Part of Trading</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Not every trade will win. Losses are normal. Focus on overall profitability, not individual trades.</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">🚫 Don't Chase Losses</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">After a loss, don't increase position size or change strategy to "win it back." This leads to bigger losses.</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">✅ Stick to Your Trading Plan</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Create a plan, test it, then stick to it. Don't change settings after every loss. Give strategies time to work.</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">📚 Continuously Learn & Adapt</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Markets change. Review your trades monthly, learn from mistakes, and adjust strategies based on market conditions.</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">⏸️ Take Breaks When Needed</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">If you're on a losing streak or feeling emotional, pause trading. Come back with a clear mind.</p>
                </div>
              </div>
            </Card>

            {/* Stop Loss & Take Profit Tips */}
            <Card className="p-6 border-l-4 border-indigo-500">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <i className="ri-price-tag-3-line text-indigo-500"></i>
                Stop Loss & Take Profit Tips
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">🛑 Never Move Stop Loss Against You</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Once a trade goes against you, don't widen the stop loss hoping it will recover. Accept the loss and move on.</p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">📈 Use Trailing Stops for Winners</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">After TP1 is hit, use trailing stops to lock in profits while allowing room for further gains.</p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">🎯 Set Stop Loss Based on ATR, Not Percentage</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">ATR-based stops adapt to volatility. Volatile pairs get wider stops, calm pairs get tighter stops.</p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">💰 Take Partial Profits</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Close 50% at TP1 (1:1 risk-reward), let the rest ride to TP2. This locks in profits while maintaining upside.</p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">✅ Move Stop Loss to Breakeven</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Once price moves 0.8R in your favor, move stop loss to entry price. This ensures at worst, you break even.</p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">⏰ Use Time Stops</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">If a trade hasn't hit TP or SL after 24-48 hours, consider closing it. Markets that don't move often reverse.</p>
                </div>
              </div>
            </Card>

            {/* Bot Management Tips */}
            <Card className="p-6 border-l-4 border-teal-500">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <i className="ri-robot-line text-teal-500"></i>
                Bot Management Tips
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">🔧 Monitor Your Bots Regularly</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Check logs daily. Ensure orders are executing correctly, stop losses are working, and there are no errors.</p>
                </div>
                <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">📊 Review Performance Weekly</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Analyze win rate, average profit/loss, and drawdowns. Adjust settings if performance degrades.</p>
                </div>
                <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">🔄 Update Settings Based on Market Conditions</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Markets change. What worked last month might not work this month. Adapt your bots to current market regime.</p>
                </div>
                <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">🚫 Don't Over-Optimize</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Too many filters and conditions can cause overfitting. Keep strategies simple and robust.</p>
                </div>
                <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">⚡ Use Multiple Bots for Different Strategies</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">One bot for trends, one for reversals. Diversify strategies across different market conditions.</p>
                </div>
                <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">🛡️ Use Safety Limits</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Enable daily/weekly loss limits and max consecutive losses. Let the bot protect itself from catastrophic drawdowns.</p>
                </div>
              </div>
            </Card>

            {/* Common Mistakes to Avoid */}
            <Card className="p-6 border-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
              <h3 className="text-xl font-semibold text-red-900 dark:text-red-300 mb-4 flex items-center gap-2">
                <i className="ri-error-warning-line text-red-600"></i>
                Common Mistakes to Avoid
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <i className="ri-close-circle-line text-red-500 text-xl mt-0.5"></i>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Trading without stop loss</p>
                    <p className="text-gray-700 dark:text-gray-300">One bad trade can wipe out months of profits. Always use stop loss.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <i className="ri-close-circle-line text-red-500 text-xl mt-0.5"></i>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Using too much leverage</p>
                    <p className="text-gray-700 dark:text-gray-300">10x+ leverage is gambling, not trading. Even 5x is very risky.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <i className="ri-close-circle-line text-red-500 text-xl mt-0.5"></i>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Overtrading</p>
                    <p className="text-gray-700 dark:text-gray-300">More trades ≠ more profits. Quality setups are rare - be patient.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <i className="ri-close-circle-line text-red-500 text-xl mt-0.5"></i>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Ignoring market conditions</p>
                    <p className="text-gray-700 dark:text-gray-300">Trading during low liquidity or major news events increases risk significantly.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <i className="ri-close-circle-line text-red-500 text-xl mt-0.5"></i>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Changing strategy after losses</p>
                    <p className="text-gray-700 dark:text-gray-300">Give strategies time. One bad week doesn't mean the strategy is broken.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <i className="ri-close-circle-line text-red-500 text-xl mt-0.5"></i>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Not testing in paper trading first</p>
                    <p className="text-gray-700 dark:text-gray-300">Always validate new strategies with paper trading before using real money.</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Quick Reference */}
            <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">⚡ Quick Reference: Golden Rules</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="font-semibold text-gray-900 dark:text-white">💰 Risk Management</p>
                  <p className="text-gray-700 dark:text-gray-300 text-xs mt-1">1-2% risk per trade, always use stop loss, keep risk-reward 1:2+</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="font-semibold text-gray-900 dark:text-white">⚡ Leverage</p>
                  <p className="text-gray-700 dark:text-gray-300 text-xs mt-1">Start low (2x-3x), never exceed 5x-10x, reduce in volatile markets</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="font-semibold text-gray-900 dark:text-white">📊 Strategy</p>
                  <p className="text-gray-700 dark:text-gray-300 text-xs mt-1">Trade with trend, wait for confirmations, use multiple timeframes</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                  <p className="font-semibold text-gray-900 dark:text-white">🧠 Psychology</p>
                  <p className="text-gray-700 dark:text-gray-300 text-xs mt-1">Remove emotions, accept losses, stick to plan, take breaks</p>
                </div>
              </div>
            </Card>
          </div>
        )}
        </div>
      </div>
      <Navigation />
    </div>
  );
}

