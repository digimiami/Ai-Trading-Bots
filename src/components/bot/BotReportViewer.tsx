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

  const handleDownloadReport = (reportData: BotReport, format: 'csv' | 'json' | 'pdf') => {
    if (!reportData) return;

    if (format === 'pdf') {
      const fmt = (v: number) => formatCurrency(v);
      const html = `
<!DOCTYPE html>
<html><head><title>Bot Performance Report - ${new Date(reportData.generated_at).toISOString().split('T')[0]}</title>
<style>
body{font-family:Arial,sans-serif;padding:20px;color:#333;}
h1{color:#1e40af;border-bottom:2px solid #1e40af;padding-bottom:8px;}
h2{margin-top:24px;margin-bottom:12px;color:#374151;}
table{width:100%;border-collapse:collapse;margin:12px 0;}
th,td{border:1px solid #ddd;padding:8px;text-align:left;}
th{background:#f3f4f6;font-weight:bold;}
td.text-right{text-align:right;}
.green{color:#059669;}
.red{color:#dc2626;}
</style></head><body>
<h1>Bot Performance Report</h1>
<p><strong>Generated:</strong> ${new Date(reportData.generated_at).toLocaleString()}</p>
<h2>Overview Summary</h2>
<table>
<tr><th>Total Bots</th><th>Active Bots</th><th>Total P&L</th><th>Net Profit/Loss</th><th>Total Fees</th><th>Total Trades</th></tr>
<tr>
<td>${reportData.overview.total_bots}</td>
<td>${reportData.overview.active_bots}</td>
<td class="text-right ${reportData.overview.total_pnl >= 0 ? 'green' : 'red'}">${fmt(reportData.overview.total_pnl)}</td>
<td class="text-right ${reportData.overview.net_profit_loss >= 0 ? 'green' : 'red'}">${fmt(reportData.overview.net_profit_loss)}</td>
<td class="text-right">${fmt(reportData.overview.total_fees)}</td>
<td>${reportData.overview.total_trades}</td>
</tr>
</table>
${reportData.contract_summary && reportData.contract_summary.length > 0 ? `
<h2>Contract Performance</h2>
<table>
<tr><th>Contract</th><th>Exchange</th><th>Trades</th><th>Total P&L</th><th>Fees</th><th>Net P/L</th><th>Win Rate</th></tr>
${reportData.contract_summary.map(c => `
<tr>
<td>${c.contract}</td><td>${c.exchange}</td><td class="text-right">${c.total_trades}</td>
<td class="text-right ${c.total_net_pnl >= 0 ? 'green' : 'red'}">${fmt(c.total_net_pnl)}</td>
<td class="text-right">${fmt(c.total_fees_paid)}</td>
<td class="text-right ${c.net_profit_loss >= 0 ? 'green' : 'red'}">${fmt(c.net_profit_loss)}</td>
<td class="text-right">${(c.win_rate ?? 0).toFixed(1)}%</td>
</tr>`).join('')}
</table>` : ''}
${reportData.active_bots && reportData.active_bots.length > 0 ? `
<h2>Active Bots</h2>
<table>
<tr><th>Bot Name</th><th>Symbol</th><th>Exchange</th><th>P&L</th><th>Fees</th><th>Net P/L</th><th>Trades</th><th>Win Rate</th></tr>
${reportData.active_bots.map(b => `
<tr>
<td>${b.name}</td><td>${b.symbol}</td><td>${b.exchange}</td>
<td class="text-right ${b.pnl >= 0 ? 'green' : 'red'}">${fmt(b.pnl)}</td>
<td class="text-right">${fmt(b.total_fees || 0)}</td>
<td class="text-right ${(b.net_profit_loss || 0) >= 0 ? 'green' : 'red'}">${fmt(b.net_profit_loss || 0)}</td>
<td class="text-right">${b.total_trades}</td>
<td class="text-right">${b.win_rate.toFixed(1)}%</td>
</tr>`).join('')}
</table>` : ''}
</body></html>`;
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 300);
      }
      return;
    }

    if (format === 'json') {
      // Download as JSON
      const jsonStr = JSON.stringify(reportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bot-performance-report-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // Download as CSV
      let csv = 'Bot Performance Report\n';
      csv += `Generated: ${new Date(reportData.generated_at).toLocaleString()}\n\n`;
      
      // Overview Section
      csv += 'OVERVIEW SUMMARY\n';
      csv += `Total Bots,${reportData.overview.total_bots}\n`;
      csv += `Active Bots,${reportData.overview.active_bots}\n`;
      csv += `Total P&L,${reportData.overview.total_pnl.toFixed(2)}\n`;
      csv += `Total Fees Paid,${reportData.overview.total_fees.toFixed(2)}\n`;
      csv += `Net Profit/Loss,${reportData.overview.net_profit_loss.toFixed(2)}\n`;
      csv += `Total Trades,${reportData.overview.total_trades}\n\n`;
      
      // Contract Performance Section
      if (reportData.contract_summary && reportData.contract_summary.length > 0) {
        csv += 'CONTRACT PERFORMANCE\n';
        csv += 'Contract,Exchange,Trades,Total P&L,Total Fees Paid,Net Profit/Loss\n';
        reportData.contract_summary.forEach((contract) => {
          csv += `${contract.contract},${contract.exchange},${contract.total_trades},${contract.total_net_pnl.toFixed(2)},${contract.total_fees_paid.toFixed(2)},${contract.net_profit_loss.toFixed(2)}\n`;
        });
        csv += '\n';
      }
      
      // Active Bots Section
      if (reportData.active_bots && reportData.active_bots.length > 0) {
        csv += 'ACTIVE BOTS\n';
        csv += 'Bot Name,Symbol,Exchange,P&L,Total Fees,Net Profit/Loss,Total Trades,Win Rate,Profit Factor,Avg Win,Avg Loss,Sharpe Ratio\n';
        reportData.active_bots.forEach((bot) => {
          csv += `${bot.name},${bot.symbol},${bot.exchange},${bot.pnl.toFixed(2)},${(bot.total_fees || 0).toFixed(2)},${(bot.net_profit_loss || 0).toFixed(2)},${bot.total_trades},${bot.win_rate.toFixed(2)}%,${(bot.profit_factor || 0).toFixed(2)},${(bot.avg_win || 0).toFixed(2)},${(bot.avg_loss || 0).toFixed(2)},${(bot.sharpe_ratio || 0).toFixed(2)}\n`;
        });
      }
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bot-performance-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Bot Performance Report</h3>
          <p className="text-sm text-gray-500">Generate comprehensive report with P&L and fees</p>
        </div>
        <div className="flex space-x-2">
          {report && (
            <Button
              variant="secondary"
              onClick={() => handleDownloadReport(report, 'pdf')}
            >
              <i className="ri-file-pdf-line mr-2"></i>
              Download PDF
            </Button>
          )}
          {report && (
            <Button
              variant="secondary"
              onClick={() => handleDownloadReport(report, 'csv')}
            >
              <i className="ri-download-line mr-2"></i>
              Download CSV
            </Button>
          )}
          {report && (
            <Button
              variant="secondary"
              onClick={() => handleDownloadReport(report, 'json')}
            >
              <i className="ri-download-line mr-2"></i>
              Download JSON
            </Button>
          )}
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
                      <th className="text-right py-2 px-3">Win/Loss</th>
                      <th className="text-right py-2 px-3">Win Rate</th>
                      <th className="text-right py-2 px-3">Total P&L</th>
                      <th className="text-right py-2 px-3">Fees</th>
                      <th className="text-right py-2 px-3">Net Profit/Loss</th>
                      <th className="text-right py-2 px-3">Drawdown</th>
                      <th className="text-right py-2 px-3">Peak/Current P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.contract_summary.map((contract, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-2 px-3 font-medium">{contract.contract}</td>
                        <td className="py-2 px-3 text-gray-600">{contract.exchange}</td>
                        <td className="py-2 px-3 text-right">{contract.total_trades}</td>
                        <td className="py-2 px-3 text-right">
                          <span className="text-green-600 font-medium">{contract.win_trades || 0}</span>
                          <span className="text-gray-400 mx-1">/</span>
                          <span className="text-red-600 font-medium">{contract.loss_trades || 0}</span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className={`font-medium ${(contract.win_rate || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                            {(contract.win_rate || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className={`py-2 px-3 text-right font-medium ${contract.total_net_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(contract.total_net_pnl)}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-600">{formatCurrency(contract.total_fees_paid)}</td>
                        <td className={`py-2 px-3 text-right font-semibold ${contract.net_profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(contract.net_profit_loss)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="text-red-600 font-medium">{formatCurrency(contract.drawdown || 0)}</div>
                          <div className="text-xs text-gray-500">{(contract.drawdown_percentage || 0).toFixed(1)}%</div>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="text-green-600 font-medium">{formatCurrency(contract.peak_pnl || 0)}</div>
                          <div className={`text-xs font-medium ${(contract.current_pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(contract.current_pnl || 0)}
                          </div>
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
                      <th className="text-right py-2 px-3">Fees</th>
                      <th className="text-right py-2 px-3">Net Profit/Loss</th>
                      <th className="text-right py-2 px-3">Trades</th>
                      <th className="text-right py-2 px-3">Win/Loss</th>
                      <th className="text-right py-2 px-3">Win Rate</th>
                      <th className="text-right py-2 px-3">Profit Factor</th>
                      <th className="text-right py-2 px-3">Avg Win/Loss</th>
                      <th className="text-right py-2 px-3">Sharpe</th>
                      <th className="text-right py-2 px-3">Drawdown</th>
                      <th className="text-right py-2 px-3">Peak/Current P&L</th>
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
                        <td className="py-2 px-3 text-right text-gray-600">{formatCurrency(bot.total_fees || 0)}</td>
                        <td className={`py-2 px-3 text-right font-semibold ${(bot.net_profit_loss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(bot.net_profit_loss || 0)}
                        </td>
                        <td className="py-2 px-3 text-right">{bot.total_trades}</td>
                        <td className="py-2 px-3 text-right">
                          <span className="text-green-600 font-medium">{bot.win_trades || 0}</span>
                          <span className="text-gray-400 mx-1">/</span>
                          <span className="text-red-600 font-medium">{bot.loss_trades || 0}</span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className={`font-medium ${bot.win_rate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                            {bot.win_rate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-gray-700">
                          {(bot.profit_factor || 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="text-green-600 font-medium">{formatCurrency(bot.avg_win || 0)}</div>
                          <div className="text-red-600 text-xs font-medium">{formatCurrency(bot.avg_loss || 0)}</div>
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-gray-700">
                          {(bot.sharpe_ratio || 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="text-red-600 font-medium">{formatCurrency(bot.drawdown || 0)}</div>
                          <div className="text-xs text-gray-500">{(bot.drawdown_percentage || 0).toFixed(1)}%</div>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="text-green-600 font-medium">{formatCurrency(bot.peak_pnl || 0)}</div>
                          <div className={`text-xs font-medium ${(bot.current_pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(bot.current_pnl || 0)}
                          </div>
                        </td>
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

