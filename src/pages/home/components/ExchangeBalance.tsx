import { ExchangeBalance } from '../../../hooks/useExchangeBalance';
import Card from '../../../components/base/Card';

interface ExchangeBalanceProps {
  balances: ExchangeBalance[];
}

export default function ExchangeBalanceDisplay({ balances }: ExchangeBalanceProps) {
  const formatBalance = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getExchangeIcon = (exchange: string) => {
    switch (exchange.toLowerCase()) {
      case 'bybit':
        return 'ri-currency-line';
      case 'okx':
        return 'ri-exchange-line';
      default:
        return 'ri-exchange-line';
    }
  };

  const getExchangeColor = (exchange: string) => {
    switch (exchange.toLowerCase()) {
      case 'bybit':
        return 'text-yellow-600 bg-yellow-100';
      case 'okx':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (!balances || balances.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Exchange Balances</h3>
          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
        </div>
        <div className="text-center py-8 text-gray-500">
          <i className="ri-wallet-line text-4xl mb-2"></i>
          <p>No exchange connections found</p>
          <p className="text-sm">Connect your exchange API keys to view balances</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Exchange Balances</h3>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm text-green-600">Connected</span>
        </div>
      </div>
      
      <div className="space-y-4">
        {balances.map((balance, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getExchangeColor(balance.exchange)}`}>
                  <i className={`${getExchangeIcon(balance.exchange)} text-lg`}></i>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{balance.exchange.toUpperCase()}</h4>
                  <p className="text-sm text-gray-500">
                    Updated {new Date(balance.lastUpdated).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">
                  {formatBalance(balance.totalBalance)}
                </p>
                <p className="text-sm text-gray-500">
                  Available: {formatBalance(balance.availableBalance)}
                </p>
              </div>
            </div>
            
            {/* Top Assets */}
            <div className="grid grid-cols-2 gap-2">
              {balance.assets.slice(0, 4).map((asset, assetIndex) => (
                <div key={assetIndex} className="flex justify-between text-sm">
                  <span className="text-gray-600">{asset.asset}</span>
                  <span className="font-medium">{asset.total.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
