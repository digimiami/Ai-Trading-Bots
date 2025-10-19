
import { MarketData } from '../../../hooks/useMarketData';
import Card from '../../../components/base/Card';

interface MarketOverviewProps {
  marketData: MarketData[];
}

export default function MarketOverview({ marketData }: MarketOverviewProps) {
  const getChangeColor = (change: number) => {
    return change >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    });
  };

  if (!marketData || marketData.length === 0) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Market Overview</h3>
          <button className="text-blue-600 text-sm font-medium">Refresh</button>
        </div>
        <div className="text-center py-8 text-gray-500">
          <i className="ri-line-chart-line text-4xl mb-2"></i>
          <p>No market data available</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Market Overview</h3>
        <button className="text-blue-600 text-sm font-medium">Refresh</button>
      </div>
      
      <div className="space-y-3">
        {marketData.slice(0, 6).map((market, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <i className="ri-currency-line text-orange-600 text-sm"></i>
              </div>
              <div>
                <p className="font-medium text-gray-900">{market.symbol}</p>
                <p className="text-xs text-gray-500">Volume: {market.volume24h.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="font-medium text-gray-900">{formatPrice(market.price)}</p>
              <p className={`text-sm ${getChangeColor(market.change24h)}`}>
                {market.change24h >= 0 ? '+' : ''}{market.change24h.toFixed(2)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
