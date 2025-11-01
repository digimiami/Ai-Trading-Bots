import { useState } from 'react';
import Card from '../base/Card';
import Button from '../base/Button';
import { generateBotReport, BotReport } from '../../services/botReport';

export default function BotReportViewer() {
  const [report, setReport] = useState<BotReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await generateBotReport();
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Bot Performance Report</h3>
          <p className="text-sm text-gray-500">Generate comprehensive report with P&L and fees</p>
        </div>
        <Button
          variant="primary"
          onClick={handleGenerateReport}
          disabled={loading}
        >
          {loading ? (
            <>
              <i className="ri-loader-4-line animate-spin mr-2"></i>
              Generating...
            </>
          ) : (
            <>
              <i className="ri-file-chart-line mr-2"></i>
              Generate Report
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* Overview Summary */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="text-md font-semibold text-gray-900 mb-3">Overview Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold text-blue-600">{report.overview.total_bots}</div>
                <div className="text-sm text-gray-500">Total Bots</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{report.overview.active_bots}</div>
                <div className="text-sm text-gray-500">Active Bots</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${report.overview.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(report.overview.total_pnl)}
                </div>
                <div className="text-sm text-gray-500">Total P&L</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${report.overview.net_profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(report.overview.net_profit_loss)}
                </div>
                <div className="text-sm text-gray-500">Net Profit/Loss</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <div>
                <div className="text-lg font-semibold text-gray-700">{formatCurrency(report.overview.total_fees)}</div>
                <div className="text-xs text-gray-500">Total Fees Paid</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-700">{report.overview.total_trades}</div>
                <div className="text-xs text-gray-500">Total Trades</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">
                  Generated: {new Date(report.generated_at).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Contract Summary */}
          {report.contract_summary && report.contract_summary.length > 0 && (
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-3">Contract Performance</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3">Contract</th>
                      <th className="text-left py-2 px-3">Exchange</th>
                      <th className="text-right py-2 px-3">Trades</th>
                      <th className="text-right py-2 px-3">Total P&L</th>
                      <th className="text-right py-2 px-3">Fees</th>
                      <th className="text-right py-2 px-3">Net Profit/Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.contract_summary.map((contract, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-2 px-3 font-medium">{contract.contract}</td>
                        <td className="py-2 px-3 text-gray-600">{contract.exchange}</td>
                        <td className="py-2 px-3 text-right">{contract.total_trades}</td>
                        <td className={`py-2 px-3 text-right font-medium ${contract.total_net_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(contract.total_net_pnl)}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-600">{formatCurrency(contract.total_fees_paid)}</td>
                        <td className={`py-2 px-3 text-right font-semibold ${contract.net_profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(contract.net_profit_loss)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Active Bots */}
          {report.active_bots && report.active_bots.length > 0 && (
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-3">Active Bots</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3">Bot Name</th>
                      <th className="text-left py-2 px-3">Symbol</th>
                      <th className="text-left py-2 px-3">Exchange</th>
                      <th className="text-right py-2 px-3">P&L</th>
                      <th className="text-right py-2 px-3">Trades</th>
                      <th className="text-right py-2 px-3">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.active_bots.map((bot) => (
                      <tr key={bot.id} className="border-b border-gray-100">
                        <td className="py-2 px-3 font-medium">{bot.name}</td>
                        <td className="py-2 px-3 text-gray-600">{bot.symbol}</td>
                        <td className="py-2 px-3 text-gray-600">{bot.exchange}</td>
                        <td className={`py-2 px-3 text-right font-medium ${bot.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(bot.pnl)}
                        </td>
                        <td className="py-2 px-3 text-right">{bot.total_trades}</td>
                        <td className="py-2 px-3 text-right">{bot.win_rate.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

