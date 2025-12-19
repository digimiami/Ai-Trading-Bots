import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import { API_ENDPOINTS, apiCall } from '../../lib/supabase';
import FuturesPairShareCard from '../../components/bot/FuturesPairShareCard';

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

interface SuggestedBotSettings {
  leverage: number;
  riskLevel: 'low' | 'medium' | 'high';
  tradeAmount: number;
  stopLoss: number;
  takeProfit: number;
  timeframe: string;
  reasoning: string;
}

export default function FuturesPairsFinderPage() {
  const navigate = useNavigate();
  const [pairs, setPairs] = useState<FuturesPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedExchange, setSelectedExchange] = useState<'all' | 'bybit' | 'okx' | 'bitunix'>('all');
  
  // Ensure only enabled exchanges can be selected
  const handleExchangeChange = (value: string) => {
    if (value === 'okx' || value === 'bitunix') {
      // If disabled exchange is selected, default to 'all' (which will only show Bybit)
      setSelectedExchange('all');
    } else {
      setSelectedExchange(value as 'all' | 'bybit');
    }
  };
  const [sortBy, setSortBy] = useState<'performance' | 'volume' | 'change24h' | 'change30d'>('performance');
  const [minVolume, setMinVolume] = useState<number>(1000000); // Minimum 24h volume filter
  const [expandedPair, setExpandedPair] = useState<string | null>(null);
  const [sharingPairKey, setSharingPairKey] = useState<string | null>(null);

  const fetchFuturesPairs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const allPairs: FuturesPair[] = [];

      const exchangesToFetch: Array<'bybit' | 'okx' | 'bitunix'> = [];
      // Only fetch from Bybit (OKX and Bitunix are disabled)
      if (selectedExchange === 'all' || selectedExchange === 'bybit') {
        exchangesToFetch.push('bybit');
      }
      // OKX and Bitunix are disabled - don't fetch from them

      for (const exchange of exchangesToFetch) {

        try {
          let exchangePairs: FuturesPair[] = [];

          if (exchange === 'bybit') {
            exchangePairs = await fetchBybitFuturesPairs(minVolume);
          } else if (exchange === 'okx') {
            exchangePairs = await fetchOKXFuturesPairs(minVolume);
          } else if (exchange === 'bitunix') {
            exchangePairs = await fetchBitunixFuturesPairs(minVolume);
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
      // Fetch all futures tickers from Bybit via Supabase Edge Function (avoids CORS)
      const response = await apiCall(`${API_ENDPOINTS.FUTURES_PAIRS}?action=tickers&exchange=bybit`);
      const data = response;

      if (data.retCode === 0 && data.result?.list) {
        const tickers = data.result.list as any[];

        const rankedTickers = tickers
          .map(ticker => {
            const volumeUsd = parseFloat(ticker.turnover24h || ticker.volume24h || '0');
            return { ticker, volumeUsd };
          })
          .filter(item => item.volumeUsd >= minVol)
          .sort((a, b) => b.volumeUsd - a.volumeUsd)
          .slice(0, 50);

        for (const { ticker, volumeUsd } of rankedTickers) {
          try {
            const symbol = ticker.symbol;
            const currentPrice = parseFloat(ticker.lastPrice || 0);
            const priceChange24h = parseFloat(ticker.price24hPcnt || 0) * 100;
            const volume24h = volumeUsd; // turnover24h is quoted in USD
            const high24h = parseFloat(ticker.highPrice24h || 0);
            const low24h = parseFloat(ticker.lowPrice24h || 0);

            // Fetch 30-day price change (using klines) via Edge Function
            const thirtyDaysAgoMs = Date.now() - (30 * 24 * 60 * 60 * 1000);
            const klinesData = await apiCall(
              `${API_ENDPOINTS.FUTURES_PAIRS}?action=klines&exchange=bybit&symbol=${symbol}&interval=D&start=${thirtyDaysAgoMs}&limit=30`
            );

            let priceChange30d = 0;
            let high30d = currentPrice;
            let low30d = currentPrice;
            let volume30d = volume24h * 30; // Estimate fallback

            if (klinesData.retCode === 0 && klinesData.result?.list?.length > 0) {
              const klines = klinesData.result.list.reverse(); // Oldest first
              const firstPrice = parseFloat(klines[0]?.[4] || currentPrice); // Close
              priceChange30d = ((currentPrice - firstPrice) / firstPrice) * 100;

              // Calculate 30-day high/low
              for (const kline of klines) {
                const high = parseFloat(kline[2] || 0);
                const low = parseFloat(kline[3] || 0);
                if (high > high30d) high30d = high;
                if (low > 0 && low < low30d) low30d = low;
              }

              // Calculate 30-day volume
              volume30d = klines.reduce((sum: number, k: any[]) => {
                const turnover = parseFloat(k[6] || k[5] || 0);
                return sum + turnover;
              }, 0);
            }

            // Calculate volatility (simplified)
            const volatility = Math.abs(priceChange30d) / 30;

            // Calculate performance score (weighted combination of factors)
            const performanceScore = 
              (priceChange30d * 0.4) + // 30-day performance (40%)
              (priceChange24h * 0.2) + // 24h momentum (20%)
              (volume24h > 0 ? Math.log10(volume24h / 1000000) * 10 : 0) + // Volume score (20%)
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
      // Fetch all futures tickers from OKX via Supabase Edge Function (avoids CORS)
      const response = await apiCall(`${API_ENDPOINTS.FUTURES_PAIRS}?action=tickers&exchange=okx`);
      const data = response;

      if (data.code === '0' && data.data) {
        const tickers = (data.data as any[])
          .map(ticker => {
            const volumeUsd = parseFloat(ticker.volUsd24h || ticker.volCcyQuote24h || ticker.volCcy24h || ticker.vol24h || '0');
            return { ticker, volumeUsd };
          })
          .filter(item => item.volumeUsd >= minVol)
          .sort((a, b) => b.volumeUsd - a.volumeUsd)
          .slice(0, 50);

        for (const { ticker, volumeUsd } of tickers) {
          try {
            const symbol = ticker.instId;
            const currentPrice = parseFloat(ticker.last || 0);
            const open24h = parseFloat(ticker.open24h || 0);
            const priceChange24h = open24h > 0 ? ((currentPrice - open24h) / open24h) * 100 : 0;
            const volume24h = volumeUsd;
            const high24h = parseFloat(ticker.high24h || 0);
            const low24h = parseFloat(ticker.low24h || 0);

            // Fetch 30-day price change (using klines) via Edge Function
            const thirtyDaysAgoMs = Date.now() - (30 * 24 * 60 * 60 * 1000);
            const klinesData = await apiCall(
              `${API_ENDPOINTS.FUTURES_PAIRS}?action=klines&exchange=okx&symbol=${symbol}&interval=1D&start=${thirtyDaysAgoMs}&limit=30`
            );

            let priceChange30d = 0;
            let high30d = currentPrice;
            let low30d = currentPrice;
            let volume30d = volume24h * 30; // Estimate fallback

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
              volume30d = klines.reduce((sum: number, k: any[]) => {
                const quoteVolume = parseFloat(k[6] || k[5] || 0);
                return sum + quoteVolume;
              }, 0);
            }

            // Calculate volatility
            const volatility = Math.abs(priceChange30d) / 30;

            // Calculate performance score
            const performanceScore = 
              (priceChange30d * 0.4) +
              (priceChange24h * 0.2) +
              (volume24h > 0 ? Math.log10(volume24h / 1000000) * 10 : 0) +
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

  const fetchBitunixFuturesPairs = async (minVol: number): Promise<FuturesPair[]> => {
    const pairs: FuturesPair[] = [];
    
    try {
      // Fetch all futures tickers from Bitunix via Supabase Edge Function (avoids CORS)
      const response = await apiCall(`${API_ENDPOINTS.FUTURES_PAIRS}?action=tickers&exchange=bitunix`);
      const data = response;

      // Bitunix response format: { code: 0, data: [{ symbol, lastPrice, volume24h, ... }] }
      if (data.code === 0 && data.data && Array.isArray(data.data)) {
        const tickers = (data.data as any[])
          .map(ticker => {
            // Bitunix response format: { symbol, lastPrice, volume24h, high24h, low24h, open24h, etc. }
            // Volume might be in different fields, try multiple
            const volumeUsd = parseFloat(
              ticker.volume24h || 
              ticker.volume || 
              ticker.vol || 
              ticker.quoteVolume || 
              ticker.quoteVolume24h || 
              ticker.turnover24h || 
              '0'
            );
            return { ticker, volumeUsd };
          })
          .filter(item => item.volumeUsd >= minVol)
          .sort((a, b) => b.volumeUsd - a.volumeUsd)
          .slice(0, 50);

        for (const { ticker, volumeUsd } of tickers) {
          try {
            const symbol = ticker.symbol || ticker.pair || ticker.instrumentId || '';
            if (!symbol) {
              console.warn('Skipping ticker with no symbol:', ticker);
              continue;
            }
            const currentPrice = parseFloat(ticker.lastPrice || ticker.last || ticker.price || ticker.close || 0);
            const open24h = parseFloat(ticker.open24h || ticker.open || ticker.openPrice || currentPrice);
            const priceChange24h = open24h > 0 ? ((currentPrice - open24h) / open24h) * 100 : 0;
            const volume24h = volumeUsd;
            const high24h = parseFloat(ticker.high24h || ticker.high || ticker.highPrice || currentPrice);
            const low24h = parseFloat(ticker.low24h || ticker.low || ticker.lowPrice || currentPrice);

            // Fetch 30-day price change (using klines) via Edge Function
            const thirtyDaysAgoMs = Date.now() - (30 * 24 * 60 * 60 * 1000);
            const klinesData = await apiCall(
              `${API_ENDPOINTS.FUTURES_PAIRS}?action=klines&exchange=bitunix&symbol=${symbol}&interval=1D&start=${thirtyDaysAgoMs}&limit=30`
            );

            let priceChange30d = 0;
            let high30d = currentPrice;
            let low30d = currentPrice;
            let volume30d = volume24h * 30; // Estimate fallback

            if (klinesData.code === 0 && klinesData.data?.length > 0) {
              const klines = Array.isArray(klinesData.data) ? klinesData.data : [];
              if (klines.length > 0) {
                const firstKline = klines[0];
                const firstPrice = parseFloat(firstKline[4] || firstKline.close || currentPrice); // Close price
                priceChange30d = ((currentPrice - firstPrice) / firstPrice) * 100;

                // Calculate 30-day high/low
                for (const kline of klines) {
                  const high = parseFloat(kline[2] || kline.high || 0);
                  const low = parseFloat(kline[3] || kline.low || 0);
                  if (high > high30d) high30d = high;
                  if (low > 0 && low < low30d) low30d = low;
                }

                // Calculate 30-day volume
                volume30d = klines.reduce((sum: number, k: any[]) => {
                  const quoteVolume = parseFloat(k[6] || k.volume || k.quoteVolume || 0);
                  return sum + quoteVolume;
                }, 0);
              }
            }

            // Calculate volatility
            const volatility = Math.abs(priceChange30d) / 30;

            // Calculate performance score
            const performanceScore = 
              (priceChange30d * 0.4) +
              (priceChange24h * 0.2) +
              (volume24h > 0 ? Math.log10(volume24h / 1000000) * 10 : 0) +
              (100 - volatility * 10);

            pairs.push({
              symbol,
              exchange: 'bitunix',
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
            console.error(`Error processing ${ticker.symbol || ticker.pair}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching Bitunix futures pairs:', err);
    }

    return pairs;
  };

  useEffect(() => {
    fetchFuturesPairs();
  }, [selectedExchange, sortBy, minVolume]);

  // Calculate suggested bot settings based on pair characteristics
  const calculateSuggestedSettings = (pair: FuturesPair): SuggestedBotSettings => {
    const volatility = pair.volatility;
    const volume24h = pair.volume24h;
    const priceChange30d = pair.priceChange30d;
    const priceChange24h = pair.priceChange24h;
    
    // Determine risk level based on volatility and performance
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    if (volatility < 1.5 && priceChange30d > 0 && priceChange24h > -5) {
      riskLevel = 'low';
    } else if (volatility > 3 || Math.abs(priceChange24h) > 15 || Math.abs(priceChange30d) > 50) {
      riskLevel = 'high';
    }

    // Calculate leverage based on volatility (lower volatility = higher safe leverage)
    // High volatility pairs should use lower leverage
    let leverage = 5;
    if (volatility < 1.0) {
      leverage = 7; // Low volatility - can use higher leverage
    } else if (volatility < 2.0) {
      leverage = 5; // Medium volatility - moderate leverage
    } else if (volatility < 3.5) {
      leverage = 3; // High volatility - lower leverage
    } else {
      leverage = 2; // Very high volatility - conservative leverage
    }

    // Calculate stop loss based on volatility (higher volatility = wider stops)
    let stopLoss = 2.0;
    if (volatility < 1.0) {
      stopLoss = 1.5; // Tight stops for low volatility
    } else if (volatility < 2.0) {
      stopLoss = 2.0; // Standard stops
    } else if (volatility < 3.5) {
      stopLoss = 3.0; // Wider stops for high volatility
    } else {
      stopLoss = 4.0; // Very wide stops for extreme volatility
    }

    // Calculate take profit (typically 2-3x stop loss for good risk/reward)
    const takeProfit = stopLoss * 2.5;

    // Calculate trade amount based on volume (higher volume = can trade larger amounts)
    let tradeAmount = 100;
    if (volume24h > 100000000) { // > $100M volume
      tradeAmount = 200; // Large volume pairs can handle bigger trades
    } else if (volume24h > 50000000) { // > $50M volume
      tradeAmount = 150;
    } else if (volume24h > 10000000) { // > $10M volume
      tradeAmount = 100;
    } else {
      tradeAmount = 50; // Lower volume - smaller trades
    }

    // Determine timeframe based on volatility (lower volatility = longer timeframes)
    let timeframe = '1h';
    if (volatility < 1.0) {
      timeframe = '4h'; // Lower volatility - can use longer timeframes
    } else if (volatility < 2.0) {
      timeframe = '1h'; // Standard timeframe
    } else {
      timeframe = '15m'; // High volatility - use shorter timeframes for better entry
    }

    // Generate reasoning
    const reasoning = `Based on ${pair.symbol}'s ${volatility.toFixed(2)}% volatility, ${(volume24h / 1000000).toFixed(1)}M 24h volume, and ${priceChange30d >= 0 ? '+' : ''}${priceChange30d.toFixed(2)}% 30d performance, we recommend ${riskLevel} risk settings with ${leverage}x leverage.`;

    return {
      leverage,
      riskLevel,
      tradeAmount,
      stopLoss,
      takeProfit,
      timeframe,
      reasoning
    };
  };

  const handleCreateBot = (pair: FuturesPair, suggestedSettings?: SuggestedBotSettings) => {
    // Force bybit if exchange is disabled (okx or bitunix)
    const exchange = (pair.exchange === 'okx' || pair.exchange === 'bitunix') ? 'bybit' : pair.exchange;
    const params = new URLSearchParams({
      symbol: pair.symbol,
      exchange: exchange,
      tradingType: 'futures'
    });

    if (suggestedSettings) {
      params.append('leverage', suggestedSettings.leverage.toString());
      params.append('riskLevel', suggestedSettings.riskLevel);
      params.append('tradeAmount', suggestedSettings.tradeAmount.toString());
      params.append('stopLoss', suggestedSettings.stopLoss.toString());
      params.append('takeProfit', suggestedSettings.takeProfit.toString());
      params.append('timeframe', suggestedSettings.timeframe);
    }

    navigate(`/create-bot?${params.toString()}`);
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
                  value={selectedExchange === 'okx' ? 'all' : selectedExchange}
                  onChange={(e) => handleExchangeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Exchanges</option>
                  <option value="bybit">Bybit</option>
                  <option value="bitunix">Bitunix</option>
                  <option value="okx" disabled>OKX (Coming Soon)</option>
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
              {pairs.map((pair) => {
                const suggestedSettings = calculateSuggestedSettings(pair);
                const pairKey = `${pair.exchange}-${pair.symbol}`;
                const isExpanded = expandedPair === pairKey;

                return (
                  <Card key={pairKey} className="p-4 hover:shadow-md transition-shadow">
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
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            suggestedSettings.riskLevel === 'low' ? 'bg-green-100 text-green-800' :
                            suggestedSettings.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {suggestedSettings.riskLevel.toUpperCase()} Risk
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

                        {/* Suggested Bot Settings */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <button
                            onClick={() => setExpandedPair(isExpanded ? null : pairKey)}
                            className="flex items-center justify-between w-full text-left"
                          >
                            <div className="flex items-center space-x-2">
                              <i className="ri-lightbulb-line text-yellow-600"></i>
                              <span className="text-sm font-medium text-gray-700">Suggested Bot Settings</span>
                            </div>
                            <i className={`ri-arrow-${isExpanded ? 'up' : 'down'}-s-line text-gray-400`}></i>
                          </button>

                          {isExpanded && (
                            <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <p className="text-xs text-gray-600 mb-3">{suggestedSettings.reasoning}</p>
                              
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-3">
                                <div>
                                  <span className="text-xs text-gray-500 block mb-1">Leverage</span>
                                  <span className="text-sm font-semibold text-gray-900">
                                    {suggestedSettings.leverage}x
                                  </span>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-500 block mb-1">Risk Level</span>
                                  <span className={`text-sm font-semibold ${
                                    suggestedSettings.riskLevel === 'low' ? 'text-green-600' :
                                    suggestedSettings.riskLevel === 'medium' ? 'text-yellow-600' :
                                    'text-red-600'
                                  }`}>
                                    {suggestedSettings.riskLevel.toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-500 block mb-1">Trade Amount</span>
                                  <span className="text-sm font-semibold text-gray-900">
                                    ${suggestedSettings.tradeAmount}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-500 block mb-1">Stop Loss</span>
                                  <span className="text-sm font-semibold text-red-600">
                                    {suggestedSettings.stopLoss}%
                                  </span>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-500 block mb-1">Take Profit</span>
                                  <span className="text-sm font-semibold text-green-600">
                                    {suggestedSettings.takeProfit}%
                                  </span>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-500 block mb-1">Timeframe</span>
                                  <span className="text-sm font-semibold text-gray-900">
                                    {suggestedSettings.timeframe}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-3 border-t border-blue-200">
                                <div className="text-xs text-gray-600">
                                  <i className="ri-information-line mr-1"></i>
                                  Settings are optimized based on pair characteristics
                                </div>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleCreateBot(pair, suggestedSettings)}
                                >
                                  <i className="ri-magic-line mr-1"></i>
                                  Use Suggested Settings
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="ml-4 flex flex-col space-y-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleCreateBot(pair)}
                        >
                          <i className="ri-add-line mr-1"></i>
                          Create Bot
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleCreateBot(pair, suggestedSettings)}
                          title="Create bot with suggested settings"
                        >
                          <i className="ri-magic-line mr-1"></i>
                          Smart Create
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSharingPairKey(pairKey)}
                          title="Share Pair Card"
                        >
                          <i className="ri-share-line mr-1"></i>
                          Share
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Futures Pair Share Card Modal */}
      {sharingPairKey && (() => {
        const pairToShare = pairs.find(p => `${p.exchange}-${p.symbol}` === sharingPairKey);
        if (!pairToShare) return null;
        
        const pairSettings = expandedPair === sharingPairKey 
          ? calculateSuggestedSettings(pairToShare)
          : undefined;
        
        return (
          <FuturesPairShareCard
            pair={pairToShare}
            suggestedSettings={pairSettings}
            isOpen={true}
            onClose={() => setSharingPairKey(null)}
          />
        );
      })()}

      <Navigation />
    </div>
  );
}

