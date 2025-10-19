
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';

interface PnLData {
  date: string;
  profit: number;
  loss: number;
  netPnL: number;
  trades: number;
  winRate: number;
}

interface RiskMetrics {
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
}

export default function Reports() {
  const navigate = useNavigate();
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  
  const [pnlData] = useState<PnLData[]>([
    { date: '2024-01-15', profit: 245.50, loss: -89.20, netPnL: 156.30, trades: 12, winRate: 75 },
    { date: '2024-01-14', profit: 189.75, loss: -156.40, netPnL: 33.35, trades: 8, winRate: 62.5 },
    { date: '2024-01-13', profit: 312.80, loss: -45.60, netPnL: 267.20, trades: 15, winRate: 86.7 },
    { date: '2024-01-12', profit: 156.90, loss: -234.50, netPnL: -77.60, trades: 10, winRate: 40 },
    { date: '2024-01-11', profit: 445.20, loss: -123.80, netPnL: 321.40, trades: 18, winRate: 83.3 },
    { date: '2024-01-10', profit: 198.60, loss: -67.30, netPnL: 131.30, trades: 9, winRate: 77.8 },
    { date: '2024-01-09', profit: 289.40, loss: -178.90, netPnL: 110.50, trades: 14, winRate: 64.3 }
  ]);

  const [riskMetrics] = useState<RiskMetrics>({
    maxDrawdown: -12.5,
    sharpeRatio: 1.85,
    profitFactor: 2.34,
    avgWin: 187.50,
    avgLoss: -125.30,
    largestWin: 445.20,
    largestLoss: -234.50
  });

  const totalPnL = pnlData.reduce((sum, day) => sum + day.netPnL, 0);
  const totalTrades = pnlData.reduce((sum, day) => sum + day.trades, 0);
  const avgWinRate = pnlData.reduce((sum, day) => sum + day.winRate, 0) / pnlData.length;
  const profitableDays = pnlData.filter(day => day.netPnL > 0).length;

  const exportReport = () => {
    // Export functionality
    const csvContent = [
      ['Date', 'Profit', 'Loss', 'Net P&L', 'Trades', 'Win Rate'],
      ...pnlData.map(row => [
        row.date,
        row.profit.toFixed(2),
        row.loss.toFixed(2),
        row.netPnL.toFixed(2),
        row.trades.toString(),
        `${row.winRate.toFixed(1)}%`
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pnl-report-${selectedPeriod}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="P&L Reports" />
      
      <div className="pt-20 pb-20 px-4 space-y-6">
        {/* Period Selection */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Report Period</h3>
            <Button variant="secondary" onClick={exportReport} className="text-sm">
              <i className="ri-download-line mr-2"></i>
              Export
            </Button>
          </div>
          
          <div className="flex space-x-2 mb-4">
            {[
              { key: '7d', label: '7 Days' },
              { key: '30d', label: '30 Days' },
              { key: '90d', label: '90 Days' },
              { key: '1y', label: '1 Year' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSelectedPeriod(key)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedPeriod === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex space-x-2">
            {[
              { key: 'daily', label: 'Daily', icon: 'ri-calendar-line' },
              { key: 'weekly', label: 'Weekly', icon: 'ri-calendar-week-line' },
              { key: 'monthly', label: 'Monthly', icon: 'ri-calendar-month-line' }
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setTimeframe(key as any)}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  timeframe === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <i className={`${icon} mr-2`}></i>
                {label}
              </button>
            ))}
          </div>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <i className="ri-arrow-up-line text-green-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total P&L</p>
                <p className={`text-lg font-semibold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${totalPnL.toFixed(2)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <i className="ri-exchange-line text-blue-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Trades</p>
                <p className="text-lg font-semibold text-gray-900">{totalTrades}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <i className="ri-percent-line text-purple-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">Avg Win Rate</p>
                <p className="text-lg font-semibold text-gray-900">{avgWinRate.toFixed(1)}%</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <i className="ri-calendar-check-line text-orange-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">Profitable Days</p>
                <p className="text-lg font-semibold text-gray-900">{profitableDays}/{pnlData.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Risk Metrics */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Max Drawdown</span>
                <span className="text-sm font-medium text-red-600">{riskMetrics.maxDrawdown}%</span>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Sharpe Ratio</span>
                <span className="text-sm font-medium text-gray-900">{riskMetrics.sharpeRatio}</span>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Profit Factor</span>
                <span className="text-sm font-medium text-green-600">{riskMetrics.profitFactor}</span>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Avg Win</span>
                <span className="text-sm font-medium text-green-600">${riskMetrics.avgWin}</span>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Avg Loss</span>
                <span className="text-sm font-medium text-red-600">${riskMetrics.avgLoss}</span>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Largest Win</span>
                <span className="text-sm font-medium text-green-600">${riskMetrics.largestWin}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Daily P&L Table */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily P&L Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Date</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-gray-600">Profit</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-gray-600">Loss</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-gray-600">Net P&L</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-gray-600">Trades</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-gray-600">Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {pnlData.map((day, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-3 px-2 text-sm text-gray-900">
                      {new Date(day.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-2 text-sm text-right text-green-600">
                      +${day.profit.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-sm text-right text-red-600">
                      ${day.loss.toFixed(2)}
                    </td>
                    <td className={`py-3 px-2 text-sm text-right font-medium ${
                      day.netPnL >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {day.netPnL >= 0 ? '+' : ''}${day.netPnL.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-sm text-right text-gray-900">
                      {day.trades}
                    </td>
                    <td className="py-3 px-2 text-sm text-right">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        day.winRate >= 70 
                          ? 'bg-green-100 text-green-800'
                          : day.winRate >= 50
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {day.winRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Loss Analysis */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Loss Analysis</h3>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="flex items-center space-x-3 mb-2">
                <i className="ri-error-warning-line text-red-600"></i>
                <h4 className="font-medium text-red-900">Largest Loss Day</h4>
              </div>
              <p className="text-sm text-red-700">
                January 12, 2024: -$77.60 (10 trades, 40% win rate)
              </p>
              <p className="text-xs text-red-600 mt-1">
                Recommendation: Review bot parameters and market conditions
              </p>
            </div>

            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="flex items-center space-x-3 mb-2">
                <i className="ri-alert-line text-orange-600"></i>
                <h4 className="font-medium text-orange-900">Risk Factors</h4>
              </div>
              <ul className="text-sm text-orange-700 space-y-1">
                <li>• High volatility periods: 2 days</li>
                <li>• Low win rate days (&lt;50%): 1 day</li>
                <li>• Consecutive loss days: 0</li>
              </ul>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-3 mb-2">
                <i className="ri-lightbulb-line text-blue-600"></i>
                <h4 className="font-medium text-blue-900">Recommendations</h4>
              </div>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Consider reducing position size during high volatility</li>
                <li>• Implement stricter stop-loss rules</li>
                <li>• Review bot performance during specific market hours</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <Navigation />
    </div>
  );
}
