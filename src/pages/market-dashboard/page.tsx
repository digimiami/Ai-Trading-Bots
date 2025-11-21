import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import TechnicalAnalysis from '../../components/ui/TechnicalAnalysis';

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
    
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchMarketData();
      fetchAlerts();
    }, 30000);
    
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <i className="ri-loader-4-line animate-spin text-4xl text-blue-500"></i>
            <p className="text-gray-600 dark:text-gray-400 mt-4">Loading market data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show empty state if no data
  if (!marketData || marketData.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
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
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
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
        {marketData && marketData.length > 0 && (
          <TechnicalAnalysis 
            symbol={selectedSymbol || marketData[0]?.symbol || 'BTCUSDT'}
            onTimeframeChange={(timeframe) => {
              console.log('Timeframe changed to:', timeframe);
            }}
          />
        )}

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
      </div>
    </div>
  );
}

