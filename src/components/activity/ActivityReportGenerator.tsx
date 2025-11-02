/**
 * Activity Report Generator Component
 * Generates comprehensive reports from bot activity logs
 */

import { useState } from 'react';
import Card from '../base/Card';
import Button from '../base/Button';
import { generateActivityReport, ActivityReport } from '../../services/activityReport';

export default function ActivityReportGenerator() {
  const [report, setReport] = useState<ActivityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '60d' | '90d' | 'custom'>('7d');

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    try {
      let startDate: Date | undefined;
      const endDate = new Date();

      switch (selectedPeriod) {
        case '7d':
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '60d':
          startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      }

      const data = await generateActivityReport(startDate, endDate);
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate report');
      console.error('Report generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!report) return;

    // Create a printable HTML document
    const htmlContent = generatePDFContent(report);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const handleExportCSV = () => {
    if (!report) return;

    let csv = 'Activity Report\n';
    csv += `Generated: ${new Date(report.generated_at).toLocaleString()}\n`;
    csv += `Period: ${new Date(report.period.start).toLocaleDateString()} - ${new Date(report.period.end).toLocaleDateString()}\n\n`;

    // Overview
    csv += 'OVERVIEW\n';
    csv += `Total Bots,${report.overview.total_bots}\n`;
    csv += `Active Bots,${report.overview.active_bots}\n`;
    csv += `Total Logs,${report.overview.total_logs}\n`;
    csv += `Errors,${report.overview.errors}\n`;
    csv += `Warnings,${report.overview.warnings}\n`;
    csv += `Successes,${report.overview.successes}\n`;
    csv += `Info Logs,${report.overview.info_logs}\n\n`;

    // Performance Summary
    csv += 'PERFORMANCE SUMMARY\n';
    csv += `Total Trades,${report.performance_summary.total_trades}\n`;
    csv += `Total P&L,${report.performance_summary.total_pnl.toFixed(2)}\n`;
    csv += `Win Rate,${report.performance_summary.win_rate.toFixed(2)}%\n`;
    csv += `Profitable Bots,${report.performance_summary.profitable_bots}\n\n`;

    // Bot Activity
    csv += 'BOT ACTIVITY\n';
    csv += 'Bot Name,Status,Total Logs,Errors,Warnings,Successes,Last Activity\n';
    report.bot_activity.forEach(bot => {
      csv += `${bot.bot_name},${bot.status},${bot.total_logs},${bot.errors},${bot.warnings},${bot.successes},${new Date(bot.last_activity).toLocaleString()}\n`;
    });
    csv += '\n';

    // Errors Summary
    if (report.errors_summary.length > 0) {
      csv += 'ERRORS SUMMARY\n';
      csv += 'Bot Name,Error Count,Last Error,Common Errors\n';
      report.errors_summary.forEach(error => {
        csv += `${error.bot_name},${error.error_count},${new Date(error.last_error).toLocaleString()},"${error.common_errors.join('; ')}"\n`;
      });
    }

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    if (!report) return;

    const jsonStr = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <i className="ri-file-chart-2-line mr-2 text-blue-600"></i>
            Activity Report Generator
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Generate comprehensive reports from bot activity logs
          </p>
        </div>
        <div className="flex space-x-2">
          {report && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportPDF}
              >
                <i className="ri-file-pdf-line mr-2"></i>
                Export PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportCSV}
              >
                <i className="ri-file-excel-line mr-2"></i>
                Export CSV
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportJSON}
              >
                <i className="ri-file-code-line mr-2"></i>
                Export JSON
              </Button>
            </>
          )}
          <Button
            variant="primary"
            size="sm"
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

      {/* Period Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Report Period
        </label>
        <div className="flex space-x-2">
          {['7d', '30d', '60d', '90d'].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period as any)}
              className={`px-3 py-2 rounded text-sm font-medium ${
                selectedPeriod === period
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last {period}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {report && (
        <div className="space-y-6 mt-6">
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
                <div className="text-2xl font-bold text-red-600">{report.overview.errors}</div>
                <div className="text-sm text-gray-500">Errors</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{report.overview.warnings}</div>
                <div className="text-sm text-gray-500">Warnings</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <div>
                <div className="text-lg font-semibold text-gray-700">{report.overview.total_logs}</div>
                <div className="text-xs text-gray-500">Total Logs</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-green-600">{report.overview.successes}</div>
                <div className="text-xs text-gray-500">Successes</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">
                  Period: {new Date(report.period.start).toLocaleDateString()} - {new Date(report.period.end).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          {/* Performance Summary */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-3">Performance Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-lg font-semibold text-gray-700">{report.performance_summary.total_trades}</div>
                <div className="text-xs text-gray-500">Total Trades</div>
              </div>
              <div className={`p-3 rounded-lg ${report.performance_summary.total_pnl >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className={`text-lg font-semibold ${report.performance_summary.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${report.performance_summary.total_pnl.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">Total P&L</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-lg font-semibold text-gray-700">{report.performance_summary.win_rate.toFixed(2)}%</div>
                <div className="text-xs text-gray-500">Win Rate</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-lg font-semibold text-green-600">{report.performance_summary.profitable_bots}</div>
                <div className="text-xs text-gray-500">Profitable Bots</div>
              </div>
            </div>
          </div>

          {/* Bot Activity Table */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-3">Bot Activity Details</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3">Bot Name</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-right py-2 px-3">Total Logs</th>
                    <th className="text-right py-2 px-3">Errors</th>
                    <th className="text-right py-2 px-3">Warnings</th>
                    <th className="text-right py-2 px-3">Successes</th>
                    <th className="text-left py-2 px-3">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {report.bot_activity.map((bot, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium">{bot.bot_name}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          bot.status === 'running' ? 'bg-green-100 text-green-800' :
                          bot.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {bot.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">{bot.total_logs}</td>
                      <td className="py-2 px-3 text-right text-red-600">{bot.errors}</td>
                      <td className="py-2 px-3 text-right text-yellow-600">{bot.warnings}</td>
                      <td className="py-2 px-3 text-right text-green-600">{bot.successes}</td>
                      <td className="py-2 px-3 text-gray-600 text-xs">
                        {bot.last_activity ? new Date(bot.last_activity).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Errors Summary */}
          {report.errors_summary.length > 0 && (
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-3 text-red-600">Errors Summary</h4>
              <div className="space-y-2">
                {report.errors_summary.map((error, idx) => (
                  <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{error.bot_name}</span>
                      <span className="text-red-600 font-semibold">{error.error_count} error(s)</span>
                    </div>
                    <div className="text-xs text-gray-600 mb-1">
                      Last Error: {new Date(error.last_error).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-700">
                      <strong>Common Errors:</strong> {error.common_errors.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function generatePDFContent(report: ActivityReport): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Activity Report - ${new Date().toISOString().split('T')[0]}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      color: #333;
    }
    h1 {
      color: #2563eb;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 10px;
    }
    h2 {
      color: #1f2937;
      margin-top: 30px;
      margin-bottom: 15px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f3f4f6;
      font-weight: bold;
    }
    .stat-box {
      display: inline-block;
      padding: 15px;
      margin: 10px;
      border: 1px solid #ddd;
      border-radius: 5px;
      min-width: 150px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
    }
    .error-box {
      background-color: #fef2f2;
      border-left: 4px solid #ef4444;
      padding: 10px;
      margin: 10px 0;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>Bot Activity Report</h1>
  <p><strong>Generated:</strong> ${new Date(report.generated_at).toLocaleString()}</p>
  <p><strong>Period:</strong> ${new Date(report.period.start).toLocaleDateString()} - ${new Date(report.period.end).toLocaleDateString()}</p>
  
  <h2>Overview Summary</h2>
  <div>
    <div class="stat-box">
      <div class="stat-value">${report.overview.total_bots}</div>
      <div class="stat-label">Total Bots</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${report.overview.active_bots}</div>
      <div class="stat-label">Active Bots</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${report.overview.total_logs}</div>
      <div class="stat-label">Total Logs</div>
    </div>
    <div class="stat-box">
      <div class="stat-value" style="color: #ef4444;">${report.overview.errors}</div>
      <div class="stat-label">Errors</div>
    </div>
    <div class="stat-box">
      <div class="stat-value" style="color: #f59e0b;">${report.overview.warnings}</div>
      <div class="stat-label">Warnings</div>
    </div>
  </div>
  
  <h2>Performance Summary</h2>
  <table>
    <tr>
      <th>Metric</th>
      <th>Value</th>
    </tr>
    <tr>
      <td>Total Trades</td>
      <td>${report.performance_summary.total_trades}</td>
    </tr>
    <tr>
      <td>Total P&L</td>
      <td>$${report.performance_summary.total_pnl.toFixed(2)}</td>
    </tr>
    <tr>
      <td>Win Rate</td>
      <td>${report.performance_summary.win_rate.toFixed(2)}%</td>
    </tr>
    <tr>
      <td>Profitable Bots</td>
      <td>${report.performance_summary.profitable_bots}</td>
    </tr>
  </table>
  
  <h2>Bot Activity Details</h2>
  <table>
    <tr>
      <th>Bot Name</th>
      <th>Status</th>
      <th>Total Logs</th>
      <th>Errors</th>
      <th>Warnings</th>
      <th>Successes</th>
      <th>Last Activity</th>
    </tr>
    ${report.bot_activity.map(bot => `
    <tr>
      <td>${bot.bot_name}</td>
      <td>${bot.status}</td>
      <td>${bot.total_logs}</td>
      <td>${bot.errors}</td>
      <td>${bot.warnings}</td>
      <td>${bot.successes}</td>
      <td>${bot.last_activity ? new Date(bot.last_activity).toLocaleString() : 'N/A'}</td>
    </tr>
    `).join('')}
  </table>
  
  ${report.errors_summary.length > 0 ? `
  <h2>Errors Summary</h2>
  ${report.errors_summary.map(error => `
  <div class="error-box">
    <strong>${error.bot_name}</strong> - ${error.error_count} error(s)<br>
    Last Error: ${new Date(error.last_error).toLocaleString()}<br>
    Common Errors: ${error.common_errors.join(', ')}
  </div>
  `).join('')}
  ` : ''}
  
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;
}

