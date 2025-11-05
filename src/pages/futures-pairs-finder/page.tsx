import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import { supabase } from '../../lib/supabase';

interface FuturesPair {
  symbol: string;
  exchange: string;
  currentPrice: number;
  priceChange24h: number;
  priceChange30d: number;
  volume24h: number;
  volume30d: number;
  high24h: number;
  low24h: number;
  high30d: number;
  low30d: number;
  volatility: number;
  performanceScore: number;
}

export default function FuturesPairsFinderPage() {
  const navigate = useNavigate();
  const [pairs, setPairs] = useState<FuturesPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedExchange, setSelectedExchange] = useState<'all' | 'bybit' | 'okx'>('all');
  const [sortBy, setSortBy] = useState<'performance' | 'volume' | 'change24h' | 'change30d'>('performance');
  const [minVolume, setMinVolume] = useState<number>(1000000); // Minimum 24h volume filter

  const fetchFuturesPairs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Get connected exchanges
      const { data: apiKeys } = await supabase
        .from('api_keys')
        .select('exchange')
        .eq('user_id', user.id)
        .eq('is_active', true);

      const exchanges = apiKeys?.map(k => k.exchange) || ['bybit']; // Default to bybit if no API keys

      const allPairs: FuturesPair[] = [];

      // Fetch futures pairs from each exchange
      for (const exchange of exchanges) {
        if (selectedExchange !== 'all' && selectedExchange !== exchange) continue;

        try {
          let exchangePairs: FuturesPair[] = [];

          if (exchange === 'bybit') {
            exchangePairs = await fetchBybitFuturesPairs(minVolume);
          } else if (exchange === 'okx') {
            exchangePairs = await fetchOKXFuturesPairs(minVolume);
          }

          allPairs.push(...exchangePairs);
        } catch (err) {
          console.error(`Error fetching ${exchange} pairs:`, err);
        }
      }

      // Filter by minimum volume and sort
      const filteredPairs = allPairs
        .filter(p => p.volume24h >= minVolume)
        .sort((a, b) => {
          switch (sortBy) {
            case 'performance':
              return b.performanceScore - a.performanceScore;
            case 'volume':
              return b.volume24h - a.volume24h;
            case 'change24h':
              return b.priceChange24h - a.priceChange24h;
            case 'change30d':
              return b.priceChange30d - a.priceChange30d;
            default:
              return 0;
          }
        });

      setPairs(filteredPairs);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch futures pairs');
      console.error('Error fetching futures pairs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBybitFuturesPairs = async (minVol: number): Promise<FuturesPair[]> => {
    const pairs: FuturesPair[] = [];
    
    try {
      // Fetch all futures tickers from Bybit
      const response = await fetch('https://api.bybit.com/v5/market/tickers?category=linear');
      const data = await response.json();

      if (data.retCode === 0 && data.result?.list) {
        const tickers = data.result.list;

        // Fetch 30-day historical data for each pair (sample top pairs for performance)
        const topPairs = tickers
          .filter((t: any) => parseFloat(t.volume24h || 0) > minVol)
          .slice(0, 50); // Limit to top 50 by volume for performance

        for (const ticker of topPairs) {
          try {
            const symbol = ticker.symbol;
            const currentPrice = parseFloat(ticker.lastPrice || 0);
            const priceChange24h = parseFloat(ticker.price24hPcnt || 0) * 100;
            const volume24h = parseFloat(ticker.volume24h || 0);
            const high24h = parseFloat(ticker.highPrice24h || 0);
            const low24h = parseFloat(ticker.lowPrice24h || 0);

            // Fetch 30-day price change (using klines)
            const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
            const klinesResponse = await fetch(
              `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=D&start=${thirtyDaysAgo}&limit=30`
            );
            const klinesData = await klinesResponse.json();

            let priceChange30d = 0;
            let high30d = currentPrice;
            let low30d = currentPrice;
            let volume30d = volume24h * 30; // Estimate

            if (klinesData.retCode === 0 && klinesData.result?.list?.length > 0) {
              const klines = klinesData.result.list.reverse(); // Oldest first
              const firstPrice = parseFloat(klines[0]?.[4] || currentPrice); // Close price
              priceChange30d = ((currentPrice - firstPrice) / firstPrice) * 100;

              // Calculate 30-day high/low
              for (const kline of klines) {
                const high = parseFloat(kline[2] || 0);
                const low = parseFloat(kline[3] || 0);
                if (high > high30d) high30d = high;
                if (low > 0 && low < low30d) low30d = low;
              }

              // Calculate 30-day volume
              volume30d = klines.reduce((sum: number, k: any[]) => sum + parseFloat(k[5] || 0), 0);
            }

            // Calculate volatility (simplified)
            const volatility = Math.abs(priceChange30d) / 30;

            // Calculate performance score (weighted combination of factors)
            const performanceScore = 
              (priceChange30d * 0.4) + // 30-day performance (40%)
              (priceChange24h * 0.2) + // 24h momentum (20%)
              (Math.log10(volume24h / 1000000) * 10) + // Volume score (20%)
              (100 - volatility * 10); // Low volatility bonus (20%)

            pairs.push({
              symbol,
              exchange: 'bybit',
              currentPrice,
              priceChange24h,
              priceChange30d,
              volume24h,
              volume30d,
              high24h,
              low24h,
              high30d,
              low30d,
              volatility,
              performanceScore
            });
          } catch (err) {
            console.error(`Error processing ${ticker.symbol}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching Bybit futures pairs:', err);
    }

    return pairs;
  };

  const fetchOKXFuturesPairs = async (minVol: number): Promise<FuturesPair[]> => {
    const pairs: FuturesPair[] = [];
    
    try {
      // Fetch all futures tickers from OKX
      const response = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SWAP');
      const data = await response.json();

      if (data.code === '0' && data.data) {
        const tickers = data.data
          .filter((t: any) => parseFloat(t.vol24h || 0) > minVol)
          .slice(0, 50); // Limit to top 50

        for (const ticker of tickers) {
          try {
            const symbol = ticker.instId;
            const currentPrice = parseFloat(ticker.last || 0);
            const priceChange24h = parseFloat(ticker.sodUtc8 || 0) * 100;
            const volume24h = parseFloat(ticker.vol24h || 0);
            const high24h = parseFloat(ticker.high24h || 0);
            const low24h = parseFloat(ticker.low24h || 0);

            // Fetch 30-day price change (using klines)
            const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
            const klinesResponse = await fetch(
              `https://www.okx.com/api/v5/market/candles?instId=${symbol}&bar=1D&after=${thirtyDaysAgo}&limit=30`
            );
            const klinesData = await klinesResponse.json();

            let priceChange30d = 0;
            let high30d = currentPrice;
            let low30d = currentPrice;
            let volume30d = volume24h * 30; // Estimate

            if (klinesData.code === '0' && klinesData.data?.length > 0) {
              const klines = klinesData.data.reverse(); // Oldest first
              const firstPrice = parseFloat(klines[0]?.[4] || currentPrice); // Close price
              priceChange30d = ((currentPrice - firstPrice) / firstPrice) * 100;

              // Calculate 30-day high/low
              for (const kline of klines) {
                const high = parseFloat(kline[2] || 0);
                const low = parseFloat(kline[3] || 0);
                if (high > high30d) high30d = high;
                if (low > 0 && low < low30d) low30d = low;
              }

              // Calculate 30-day volume
              volume30d = klines.reduce((sum: number, k: any[]) => sum + parseFloat(k[5] || 0), 0);
            }

            // Calculate volatility
            const volatility = Math.abs(priceChange30d) / 30;

            // Calculate performance score
            const performanceScore = 
              (priceChange30d * 0.4) +
              (priceChange24h * 0.2) +
              (Math.log10(volume24h / 1000000) * 10) +
              (100 - volatility * 10);

            pairs.push({
              symbol,
              exchange: 'okx',
              currentPrice,
              priceChange24h,
              priceChange30d,
              volume24h,
              volume30d,
              high24h,
              low24h,
              high30d,
              low30d,
              volatility,
              performanceScore
            });
          } catch (err) {
            console.error(`Error processing ${ticker.instId}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching OKX futures pairs:', err);
    }

    return pairs;
  };

  useEffect(() => {
    fetchFuturesPairs();
  }, [selectedExchange, sortBy, minVolume]);

  const handleCreateBot = (pair: FuturesPair) => {
    navigate(`/create-bot?symbol=${pair.symbol}&exchange=${pair.exchange}&tradingType=futures`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title="Futures Pairs Finder"
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchFuturesPairs}
            disabled={loading}
          >
            <i className="ri-refresh-line mr-2"></i>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        }
      />

      <div className="pt-20 pb-20 px-4">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Filters */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Exchange
                </label>
                <select
                  value={selectedExchange}
                  onChange={(e) => setSelectedExchange(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Exchanges</option>
                  <option value="bybit">Bybit</option>
                  <option value="okx">OKX</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="performance">Performance Score</option>
                  <option value="volume">24h Volume</option>
                  <option value="change24h">24h Change</option>
                  <option value="change30d">30d Change</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min 24h Volume ($)
                </label>
                <input
                  type="number"
                  value={minVolume}
                  onChange={(e) => setMinVolume(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="1000000"
                />
              </div>

              <div className="flex items-end">
                <div className="text-sm text-gray-500">
                  Found: <span className="font-bold text-gray-900">{pairs.length}</span> pairs
                </div>
              </div>
            </div>
          </Card>

          {/* Error Message */}
          {error && (
            <Card className="p-4 bg-red-50 border-red-200">
              <div className="flex items-center space-x-2 text-red-600">
                <i className="ri-error-warning-line"></i>
                <span>{error}</span>
              </div>
            </Card>
          )}

          {/* Loading State */}
          {loading && (
            <Card className="p-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Analyzing futures pairs...</p>
              </div>
            </Card>
          )}

          {/* Pairs List */}
          {!loading && pairs.length === 0 && !error && (
            <Card className="p-12">
              <div className="text-center">
                <i className="ri-search-line text-4xl text-gray-400 mb-4"></i>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No pairs found</h3>
                <p className="text-gray-500">Try adjusting your filters or check your API connections</p>
              </div>
            </Card>
          )}

          {!loading && pairs.length > 0 && (
            <div className="space-y-3">
              {pairs.map((pair) => (
                <Card key={`${pair.exchange}-${pair.symbol}`} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{pair.symbol}</h3>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                          {pair.exchange.toUpperCase()}
                        </span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                          Performance: {pair.performanceScore.toFixed(1)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Current Price:</span>
                          <p className="font-semibold text-gray-900">${pair.currentPrice.toFixed(4)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">24h Change:</span>
                          <p className={`font-semibold ${pair.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {pair.priceChange24h >= 0 ? '+' : ''}{pair.priceChange24h.toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">30d Change:</span>
                          <p className={`font-semibold ${pair.priceChange30d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {pair.priceChange30d >= 0 ? '+' : ''}{pair.priceChange30d.toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">24h Volume:</span>
                          <p className="font-semibold text-gray-900">
                            ${(pair.volume24h / 1000000).toFixed(2)}M
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
                        <div>
                          <span className="text-gray-500">24h Range:</span>
                          <p className="text-xs text-gray-600">
                            ${pair.low24h.toFixed(4)} - ${pair.high24h.toFixed(4)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">30d Range:</span>
                          <p className="text-xs text-gray-600">
                            ${pair.low30d.toFixed(4)} - ${pair.high30d.toFixed(4)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">30d Volume:</span>
                          <p className="text-xs text-gray-600">
                            ${(pair.volume30d / 1000000000).toFixed(2)}B
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Volatility:</span>
                          <p className="text-xs text-gray-600">
                            {pair.volatility.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="ml-4">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleCreateBot(pair)}
                      >
                        <i className="ri-add-line mr-1"></i>
                        Create Bot
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <Navigation />
    </div>
  );
}

