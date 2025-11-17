import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

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

export default function MarketDashboardPage() {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [topGainers, setTopGainers] = useState<MarketData[]>([]);
  const [rapidChanges, setRapidChanges] = useState<MarketData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [priceUpdates, setPriceUpdates] = useState<Map<string, number>>(new Map());

  // Fetch market data
  const fetchMarketData = async () => {
    try {
      const supabaseUrl = (import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '').replace('/rest/v1', '');
      const supabaseKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase configuration');
        setLoading(false);
        return;
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/market-data?action=all`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      
      // Check if response is OK
      if (!response.ok) {
        const text = await response.text();
        console.error('Market data API error:', response.status, text.substring(0, 200));
        setLoading(false);
        return;
      }
      
      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Market data API returned non-JSON response:', text.substring(0, 200));
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      
      if (data.marketData) {
        setMarketData(data.marketData);
        setTopGainers(data.topGainers || []);
        setRapidChanges(data.rapidChanges || []);
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
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
        </div>

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

