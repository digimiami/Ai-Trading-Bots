/**
 * Errors Report Generator Component
 * Generates detailed error reports from bot activity logs
 */

import { useState } from 'react';
import Card from '../base/Card';
import Button from '../base/Button';
import { supabase } from '../../lib/supabase';

export interface ErrorReport {
  generated_at: string;
  period: {
    start: string;
    end: string;
  };
  summary: {
    total_errors: number;
    unique_errors: number;
    bots_with_errors: number;
    critical_errors: number;
    warnings: number;
  };
  errors_by_bot: Array<{
    bot_id: string;
    bot_name: string;
    error_count: number;
    last_error: string;
    error_types: Array<{
      message: string;
      count: number;
      first_occurrence: string;
      last_occurrence: string;
    }>;
  }>;
  errors_by_type: Array<{
    error_message: string;
    count: number;
    affected_bots: number;
    first_occurrence: string;
    last_occurrence: string;
    severity: 'critical' | 'warning' | 'info';
  }>;
  recent_errors: Array<{
    timestamp: string;
    bot_id: string;
    bot_name: string;
    level: string;
    category: string;
    message: string;
    details?: any;
  }>;
}

export default function ErrorsReportGenerator() {
  const [report, setReport] = useState<ErrorReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '60d' | '90d' | 'custom'>('7d');

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let startDate: Date;
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

      // Fetch bots
      const { data: bots, error: botsError } = await supabase
        .from('trading_bots')
        .select('id, name')
        .eq('user_id', user.id);

      if (botsError) throw new Error(botsError.message || 'Failed to load bots');
      const botIds = bots?.map(b => b.id) || [];
      const botMap = new Map(bots?.map(b => [b.id, b.name]) || []);

      // No bots: show empty report instead of querying with empty list
      if (botIds.length === 0) {
        const emptyReport: ErrorReport = {
          generated_at: new Date().toISOString(),
          period: { start: startDate.toISOString(), end: endDate.toISOString() },
          summary: { total_errors: 0, unique_errors: 0, bots_with_errors: 0, critical_errors: 0, warnings: 0 },
          errors_by_bot: [],
          errors_by_type: [],
          recent_errors: [],
        };
        setReport(emptyReport);
        setLoading(false);
        return;
      }

      // Fetch error logs (limit to avoid timeouts / large responses)
      const { data: errorLogs, error: logsError } = await supabase
        .from('bot_activity_logs')
        .select('*')
        .in('bot_id', botIds)
        .in('level', ['error', 'warning'])
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: false })
        .limit(2000);

      if (logsError) throw new Error(logsError.message || 'Failed to load error logs');

      const errors = errorLogs || [];
      const errorLogsList = errors.filter(e => e.level === 'error');
      const warnings = errors.filter(e => e.level === 'warning');

      // Group errors by bot
      const errorsByBot = new Map<string, any[]>();
      errors.forEach(err => {
        if (!errorsByBot.has(err.bot_id)) {
          errorsByBot.set(err.bot_id, []);
        }
        errorsByBot.get(err.bot_id)!.push(err);
      });

      // Process errors by bot
      const errorsByBotArray = Array.from(errorsByBot.entries()).map(([botId, botErrors]) => {
        const errorTypes = new Map<string, { count: number; first: string; last: string }>();
        
        botErrors.forEach(err => {
          const key = err.message || 'Unknown error';
          if (!errorTypes.has(key)) {
            errorTypes.set(key, { count: 0, first: err.timestamp, last: err.timestamp });
          }
          const type = errorTypes.get(key)!;
          type.count++;
          if (err.timestamp < type.first) type.first = err.timestamp;
          if (err.timestamp > type.last) type.last = err.timestamp;
        });

        return {
          bot_id: botId,
          bot_name: botMap.get(botId) || 'Unknown Bot',
          error_count: botErrors.length,
          last_error: botErrors[0]?.timestamp || '',
          error_types: Array.from(errorTypes.entries()).map(([message, data]) => ({
            message,
            count: data.count,
            first_occurrence: data.first,
            last_occurrence: data.last
          })).sort((a, b) => b.count - a.count)
        };
      }).sort((a, b) => b.error_count - a.error_count);

      // Group errors by type (across all bots)
      const errorsByType = new Map<string, { count: number; bots: Set<string>; first: string; last: string }>();
      
      errors.forEach(err => {
        const key = err.message || 'Unknown error';
        if (!errorsByType.has(key)) {
          errorsByType.set(key, { count: 0, bots: new Set(), first: err.timestamp, last: err.timestamp });
        }
        const type = errorsByType.get(key)!;
        type.count++;
        type.bots.add(err.bot_id);
        if (err.timestamp < type.first) type.first = err.timestamp;
        if (err.timestamp > type.last) type.last = err.timestamp;
      });

      const errorsByTypeArray = Array.from(errorsByType.entries()).map(([message, data]) => {
        const isCritical = message.toLowerCase().includes('failed') || 
                          message.toLowerCase().includes('error') ||
                          message.toLowerCase().includes('exception') ||
                          message.toLowerCase().includes('timeout');
        
        return {
          error_message: message,
          count: data.count,
          affected_bots: data.bots.size,
          first_occurrence: data.first,
          last_occurrence: data.last,
          severity: isCritical ? 'critical' as const : 'warning' as const
        };
      }).sort((a, b) => b.count - a.count);

      // Get recent errors (last 50)
      const recentErrors = errors.slice(0, 50).map(err => ({
        timestamp: err.timestamp,
        bot_id: err.bot_id,
        bot_name: botMap.get(err.bot_id) || 'Unknown Bot',
        level: err.level,
        category: err.category || 'unknown',
        message: err.message,
        details: err.details
      }));

      // Calculate critical errors (errors that mention critical keywords)
      const criticalErrors = errorLogsList.filter(e => {
        const msg = (e.message || '').toLowerCase();
        return msg.includes('failed') || msg.includes('exception') || 
               msg.includes('timeout') || msg.includes('critical');
      }).length;

      const reportData: ErrorReport = {
        generated_at: new Date().toISOString(),
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        summary: {
          total_errors: errorLogsList.length,
          unique_errors: errorsByTypeArray.length,
          bots_with_errors: errorsByBotArray.length,
          critical_errors: criticalErrors,
          warnings: warnings.length
        },
        errors_by_bot: errorsByBotArray,
        errors_by_type: errorsByTypeArray,
        recent_errors: recentErrors
      };

      setReport(reportData);
    } catch (err: any) {
      const msg = err?.message || (typeof err === 'string' ? err : 'Failed to generate error report');
      const details = err?.details || err?.error_description || (err?.code ? `Code: ${err.code}` : '');
      setError(details ? `${msg} — ${details}` : msg);
      console.error('Errors report generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!report) return;

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

    let csv = 'Errors Report\n';
    csv += `Generated: ${new Date(report.generated_at).toLocaleString()}\n`;
    csv += `Period: ${new Date(report.period.start).toLocaleDateString()} - ${new Date(report.period.end).toLocaleDateString()}\n\n`;

    // Summary
    csv += 'SUMMARY\n';
    csv += `Total Errors,${report.summary.total_errors}\n`;
    csv += `Unique Error Types,${report.summary.unique_errors}\n`;
    csv += `Bots with Errors,${report.summary.bots_with_errors}\n`;
    csv += `Critical Errors,${report.summary.critical_errors}\n`;
    csv += `Warnings,${report.summary.warnings}\n\n`;

    // Errors by Type
    csv += 'ERRORS BY TYPE\n';
    csv += 'Error Message,Count,Affected Bots,Severity,First Occurrence,Last Occurrence\n';
    report.errors_by_type.forEach(err => {
      csv += `"${err.error_message.replace(/"/g, '""')}",${err.count},${err.affected_bots},${err.severity},${new Date(err.first_occurrence).toLocaleString()},${new Date(err.last_occurrence).toLocaleString()}\n`;
    });
    csv += '\n';

    // Errors by Bot
    csv += 'ERRORS BY BOT\n';
    csv += 'Bot Name,Total Errors,Last Error\n';
    report.errors_by_bot.forEach(bot => {
      csv += `${bot.bot_name},${bot.error_count},${new Date(bot.last_error).toLocaleString()}\n`;
    });
    csv += '\n';

    // Recent Errors
    csv += 'RECENT ERRORS (Last 50)\n';
    csv += 'Timestamp,Bot Name,Level,Category,Message\n';
    report.recent_errors.forEach(err => {
      csv += `${new Date(err.timestamp).toLocaleString()},${err.bot_name},${err.level},${err.category},"${(err.message || '').replace(/"/g, '""')}"\n`;
    });

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `errors-report-${new Date().toISOString().split('T')[0]}.csv`;
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
    link.download = `errors-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card id="errors-report" className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <i className="ri-error-warning-line mr-2 text-red-600"></i>
            Errors Report Generator
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Generate detailed reports of bot errors and warnings. Select a period and click &quot;Generate Errors Report&quot; below.
          </p>
        </div>
      </div>

      {/* Period Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Period
        </label>
        <div className="flex space-x-2">
          {(['7d', '30d', '60d', '90d'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                selectedPeriod === period
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : period === '60d' ? '60 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <div className="mb-4">
        <Button
          variant="primary"
          onClick={handleGenerateReport}
          disabled={loading}
        >
          {loading ? (
            <>
              <i className="ri-loader-4-line animate-spin mr-2"></i>
              Getting errors...
            </>
          ) : (
            <>
              <i className="ri-file-list-3-line mr-2"></i>
              Generate Errors Report
            </>
          )}
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <div className="flex items-start">
            <i className="ri-error-warning-line mr-2 mt-0.5 flex-shrink-0"></i>
            <div>
              <div className="font-medium">Errors Report Generator — Error</div>
              <div className="mt-1 break-words">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Report Display */}
      {report && (
        <div className="space-y-6 mt-6">
          {report.summary.total_errors === 0 && report.summary.warnings === 0 ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              <i className="ri-checkbox-circle-line mr-2"></i>
              No errors or warnings in the selected period. You can still export the report (summary will be zero).
            </div>
          ) : null}
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-red-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-600">{report.summary.total_errors}</div>
              <div className="text-xs text-gray-600 mt-1">Total Errors</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-600">{report.summary.critical_errors}</div>
              <div className="text-xs text-gray-600 mt-1">Critical</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">{report.summary.warnings}</div>
              <div className="text-xs text-gray-600 mt-1">Warnings</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{report.summary.unique_errors}</div>
              <div className="text-xs text-gray-600 mt-1">Unique Types</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-600">{report.summary.bots_with_errors}</div>
              <div className="text-xs text-gray-600 mt-1">Affected Bots</div>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex space-x-2">
            <Button variant="secondary" onClick={handleExportCSV}>
              <i className="ri-download-line mr-2"></i>
              Download CSV
            </Button>
            <Button variant="secondary" onClick={handleExportPDF}>
              <i className="ri-file-pdf-line mr-2"></i>
              Download PDF
            </Button>
            <Button variant="secondary" onClick={handleExportJSON}>
              <i className="ri-file-code-line mr-2"></i>
              Download JSON
            </Button>
          </div>

          {/* Errors by Type */}
          {report.errors_by_type.length > 0 && (
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-3">Errors by Type</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error Message</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Count</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Affected Bots</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Occurrence</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {report.errors_by_type.slice(0, 20).map((err, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-md truncate" title={err.error_message}>
                          {err.error_message}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{err.count}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{err.affected_bots}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            err.severity === 'critical' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {err.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(err.last_occurrence).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Errors by Bot */}
          {report.errors_by_bot.length > 0 && (
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-3">Errors by Bot</h4>
              <div className="space-y-2">
                {report.errors_by_bot.map((bot, idx) => (
                  <div key={idx} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{bot.bot_name}</span>
                      <span className="text-sm text-gray-600">{bot.error_count} error{bot.error_count !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      Last error: {new Date(bot.last_error).toLocaleString()}
                    </div>
                    <div className="space-y-1">
                      {bot.error_types.slice(0, 3).map((type, typeIdx) => (
                        <div key={typeIdx} className="text-xs text-gray-600 pl-2 border-l-2 border-red-300">
                          <span className="font-medium">{type.count}x</span> - {type.message}
                        </div>
                      ))}
                      {bot.error_types.length > 3 && (
                        <div className="text-xs text-gray-400 pl-2">
                          +{bot.error_types.length - 3} more error type{bot.error_types.length - 3 !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Errors */}
          {report.recent_errors.length > 0 && (
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-3">Recent Errors (Last 50)</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {report.recent_errors.map((err, idx) => (
                  <div key={idx} className="bg-gray-50 p-3 rounded-lg text-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-gray-900">{err.bot_name}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            err.level === 'error' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {err.level}
                          </span>
                          <span className="text-xs text-gray-500">{err.category}</span>
                        </div>
                        <div className="text-gray-700">{err.message}</div>
                      </div>
                      <div className="text-xs text-gray-500 ml-4">
                        {new Date(err.timestamp).toLocaleString()}
                      </div>
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

function generatePDFContent(report: ErrorReport): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Errors Report - ${new Date().toISOString().split('T')[0]}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      color: #333;
    }
    h1 {
      color: #dc2626;
      border-bottom: 2px solid #dc2626;
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
      color: #dc2626;
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
    .critical {
      background-color: #fee2e2;
      color: #991b1b;
    }
    .warning {
      background-color: #fef3c7;
      color: #92400e;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>Errors Report</h1>
  <p><strong>Generated:</strong> ${new Date(report.generated_at).toLocaleString()}</p>
  <p><strong>Period:</strong> ${new Date(report.period.start).toLocaleDateString()} - ${new Date(report.period.end).toLocaleDateString()}</p>
  
  <h2>Summary</h2>
  <div>
    <div class="stat-box">
      <div class="stat-value">${report.summary.total_errors}</div>
      <div class="stat-label">Total Errors</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${report.summary.critical_errors}</div>
      <div class="stat-label">Critical Errors</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${report.summary.warnings}</div>
      <div class="stat-label">Warnings</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${report.summary.unique_errors}</div>
      <div class="stat-label">Unique Error Types</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${report.summary.bots_with_errors}</div>
      <div class="stat-label">Bots with Errors</div>
    </div>
  </div>
  
  <h2>Errors by Type</h2>
  <table>
    <tr>
      <th>Error Message</th>
      <th>Count</th>
      <th>Affected Bots</th>
      <th>Severity</th>
      <th>Last Occurrence</th>
    </tr>
    ${report.errors_by_type.map(err => `
    <tr class="${err.severity}">
      <td>${err.error_message}</td>
      <td>${err.count}</td>
      <td>${err.affected_bots}</td>
      <td>${err.severity}</td>
      <td>${new Date(err.last_occurrence).toLocaleString()}</td>
    </tr>
    `).join('')}
  </table>
  
  <h2>Errors by Bot</h2>
  <table>
    <tr>
      <th>Bot Name</th>
      <th>Total Errors</th>
      <th>Last Error</th>
    </tr>
    ${report.errors_by_bot.map(bot => `
    <tr>
      <td>${bot.bot_name}</td>
      <td>${bot.error_count}</td>
      <td>${new Date(bot.last_error).toLocaleString()}</td>
    </tr>
    `).join('')}
  </table>
  
  <h2>Recent Errors</h2>
  <table>
    <tr>
      <th>Timestamp</th>
      <th>Bot Name</th>
      <th>Level</th>
      <th>Category</th>
      <th>Message</th>
    </tr>
    ${report.recent_errors.map(err => `
    <tr>
      <td>${new Date(err.timestamp).toLocaleString()}</td>
      <td>${err.bot_name}</td>
      <td>${err.level}</td>
      <td>${err.category}</td>
      <td>${err.message}</td>
    </tr>
    `).join('')}
  </table>
</body>
</html>
  `;
}

