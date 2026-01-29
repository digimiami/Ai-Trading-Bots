import { useState, useEffect, useRef } from 'react';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import NotificationBell from '../../components/feature/NotificationBell';
import { useBotActivity } from '../../hooks/useBotActivity';
import { useBots } from '../../hooks/useBots';
import BotActivityLogs from '../../components/bot/BotActivityLogs';
import BotReportViewer from '../../components/bot/BotReportViewer';
import ActivityReportGenerator from '../../components/activity/ActivityReportGenerator';
import ErrorsReportGenerator from '../../components/activity/ErrorsReportGenerator';

export default function BotActivityPage() {
  const { bots } = useBots();
  const { activities, loading, addLog, clearBotLogs, simulateBotActivity } = useBotActivity(bots);
  const [filter, setFilter] = useState<'all' | 'running' | 'paused' | 'stopped'>('all');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setShowDownloadMenu(false);
      }
    };

    if (showDownloadMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDownloadMenu]);

  const filteredActivities = activities.filter(activity => 
    filter === 'all' || activity.status === filter
  );

  // Smart Exit triggered: from all activity logs where message contains "Smart Exit"
  const smartExitEvents = activities.flatMap(a =>
    (a.logs || [])
      .filter((log: { message?: string }) => (log.message || '').toLowerCase().includes('smart exit'))
      .map((log: any) => ({ ...log, botName: a.botName, botId: a.botId }))
  ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 20);

  const handleAddTestLog = async (botId: string) => {
    await addLog(botId, {
      level: 'info',
      category: 'system',
      message: 'Manual test log added',
      details: { timestamp: new Date().toISOString(), source: 'manual' }
    });
  };

  const handleSimulateError = async (botId: string) => {
    await addLog(botId, {
      level: 'error',
      category: 'error',
      message: 'Simulated error for testing',
      details: { error: 'Connection timeout', retry: true }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title="Bot Activity Logs"
        subtitle="Monitor bot operations and debug issues"
        rightAction={
          <div className="flex space-x-2">
            <NotificationBell />
            <Button
              variant="primary"
              size="sm"
              onClick={() => window.location.reload()}
            >
              <i className="ri-refresh-line mr-1"></i>
              Refresh
            </Button>
          </div>
        }
      />
      
      <div className="pt-20 pb-20 px-4 space-y-6">
        {/* Recent Activity Overview */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <i className="ri-pulse-line mr-2 text-blue-600 animate-pulse"></i>
              Recent Activity
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                Updates every 1 min
              </span>
              <div className="relative" ref={downloadMenuRef}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                >
                  <i className="ri-download-line mr-1"></i>
                  Download
                  <i className={`ri-arrow-${showDownloadMenu ? 'up' : 'down'}-s-line ml-1`}></i>
                </Button>
                {showDownloadMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      onClick={() => {
                        setShowDownloadMenu(false);
                        // Export as CSV
                        const csvRows: string[] = [];
                        
                        // Metadata header
                        const now = new Date();
                        csvRows.push(`Recent Activity Report`);
                        csvRows.push(`Generated: ${now.toLocaleString()}`);
                        csvRows.push(`Generated (ISO): ${now.toISOString()}`);
                        csvRows.push('');
                        
                        // Summary section
                        csvRows.push('SUMMARY');
                        csvRows.push(`Total Bots,${activities.length}`);
                        csvRows.push(`Running,${activities.filter(a => a.status === 'running').length}`);
                        csvRows.push(`Paused,${activities.filter(a => a.status === 'paused').length}`);
                        csvRows.push(`Stopped,${activities.filter(a => a.status === 'stopped').length}`);
                        csvRows.push(`Executing,${activities.filter(a => a.executionState === 'executing').length}`);
                        csvRows.push(`Analyzing,${activities.filter(a => a.executionState === 'analyzing').length}`);
                        csvRows.push(`Waiting,${activities.filter(a => a.executionState === 'waiting').length}`);
                        csvRows.push(`Errors,${activities.filter(a => a.executionState === 'error').length}`);
                        csvRows.push(`Smart Exit triggered,${smartExitEvents.length}`);
                        csvRows.push(`Total Errors,${activities.reduce((sum, a) => sum + a.errorCount, 0)}`);
                        csvRows.push(`Total Success,${activities.reduce((sum, a) => sum + a.successCount, 0)}`);
                        csvRows.push('');
                        
                        // Main data header
                        csvRows.push('BOT ACTIVITY DETAILS');
                        csvRows.push('Bot ID,Bot Name,Status,Execution State,Current Action,Waiting For,Last Activity,Last Activity (Readable),Last Execution Time,Last Execution Time (Readable),Error Count,Success Count,Recent Logs Count');
                        
                        // Helper function to format date
                        const formatDate = (dateStr: string | null | undefined): string => {
                          if (!dateStr || dateStr === 'N/A') return 'N/A';
                          try {
                            const date = new Date(dateStr);
                            return date.toLocaleString();
                          } catch {
                            return dateStr;
                          }
                        };
                        
                        // Data rows
                        activities.forEach(a => {
                          csvRows.push([
                            a.botId,
                            `"${a.botName}"`,
                            a.status,
                            a.executionState || 'N/A',
                            `"${(a.currentAction || '').replace(/"/g, '""')}"`,
                            `"${(a.waitingFor || '').replace(/"/g, '""')}"`,
                            a.lastActivity || 'N/A',
                            formatDate(a.lastActivity),
                            a.lastExecutionTime || 'N/A',
                            formatDate(a.lastExecutionTime),
                            a.errorCount,
                            a.successCount,
                            a.logs.length,
                          ].join(','));
                        });
                        
                        // Smart Exit triggered section (details report)
                        if (smartExitEvents.length > 0) {
                          csvRows.push('');
                          csvRows.push('SMART EXIT TRIGGERED – DETAILS REPORT');
                          csvRows.push('Timestamp,Bot Name,Message,Symbol,Side,Exchange,Retracement %,Threshold %,Highest Price,Lowest Price,Entry Price,Current Price');
                          smartExitEvents.forEach((e: any) => {
                            const d = e.details || {};
                            csvRows.push([
                              e.timestamp || 'N/A',
                              `"${(e.botName || '').replace(/"/g, '""')}"`,
                              `"${(e.message || '').replace(/"/g, '""')}"`,
                              (d.symbol ?? '').toString(),
                              (d.side ?? '').toString(),
                              (d.exchange ?? '').toString(),
                              d.retracement_pct != null ? Number(d.retracement_pct).toFixed(2) : '',
                              d.threshold_pct != null ? Number(d.threshold_pct).toFixed(2) : '',
                              d.highest_price != null ? Number(d.highest_price).toFixed(4) : '',
                              d.lowest_price != null ? Number(d.lowest_price).toFixed(4) : '',
                              d.entry_price != null ? Number(d.entry_price).toFixed(4) : '',
                              d.current_price != null ? Number(d.current_price).toFixed(4) : '',
                            ].join(','));
                          });
                        }
                        // Recent errors section
                        const botsWithErrors = activities.filter(a => a.errorCount > 0);
                        if (botsWithErrors.length > 0) {
                          csvRows.push('');
                          csvRows.push('BOTS WITH ERRORS');
                          csvRows.push('Bot Name,Error Count,Last Activity,Status');
                          botsWithErrors.forEach(a => {
                            csvRows.push([
                              `"${a.botName}"`,
                              a.errorCount,
                              a.lastActivity || 'N/A',
                              a.status,
                            ].join(','));
                          });
                        }
                        
                        const csvContent = csvRows.join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `recent-activity-${new Date().toISOString().split('T')[0]}.csv`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <i className="ri-file-excel-line mr-2"></i>
                      Download CSV
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      onClick={() => {
                        setShowDownloadMenu(false);
                        // Export as JSON
                        const now = new Date();
                        const recentActivityData = {
                          report_title: 'Recent Activity Report',
                          generated_at: now.toISOString(),
                          generated_at_readable: now.toLocaleString(),
                          metadata: {
                            total_bots: activities.length,
                            report_version: '1.1',
                            export_format: 'JSON',
                          },
                          summary: {
                            total_bots: activities.length,
                            by_status: {
                              running: activities.filter(a => a.status === 'running').length,
                              paused: activities.filter(a => a.status === 'paused').length,
                              stopped: activities.filter(a => a.status === 'stopped').length,
                            },
                            by_execution_state: {
                              executing: activities.filter(a => a.executionState === 'executing').length,
                              analyzing: activities.filter(a => a.executionState === 'analyzing').length,
                              waiting: activities.filter(a => a.executionState === 'waiting').length,
                              idle: activities.filter(a => a.executionState === 'idle').length,
                              error: activities.filter(a => a.executionState === 'error').length,
                            },
                            totals: {
                              total_errors: activities.reduce((sum, a) => sum + a.errorCount, 0),
                              total_success: activities.reduce((sum, a) => sum + a.successCount, 0),
                              total_logs: activities.reduce((sum, a) => sum + a.logs.length, 0),
                              smart_exit_triggered: smartExitEvents.length,
                            },
                          },
                          smart_exit_triggered: smartExitEvents.map((e: any) => {
                            const d = e.details || {};
                            return {
                              timestamp: e.timestamp,
                              bot_id: e.botId,
                              bot_name: e.botName,
                              message: e.message,
                              details: e.details,
                              // Flattened details report fields
                              symbol: d.symbol,
                              side: d.side,
                              exchange: d.exchange,
                              retracement_pct: d.retracement_pct != null ? Number(d.retracement_pct) : null,
                              threshold_pct: d.threshold_pct != null ? Number(d.threshold_pct) : null,
                              highest_price: d.highest_price != null ? Number(d.highest_price) : null,
                              lowest_price: d.lowest_price != null ? Number(d.lowest_price) : null,
                              entry_price: d.entry_price != null ? Number(d.entry_price) : null,
                              current_price: d.current_price != null ? Number(d.current_price) : null,
                            };
                          }),
                          activities_by_state: {
                            executing: activities
                              .filter(a => a.executionState === 'executing')
                              .map(a => ({
                                bot_id: a.botId,
                                bot_name: a.botName,
                                status: a.status,
                                current_action: a.currentAction,
                                waiting_for: a.waitingFor || null,
                                last_activity: a.lastActivity,
                                last_activity_readable: a.lastActivity ? new Date(a.lastActivity).toLocaleString() : null,
                                last_execution_time: a.lastExecutionTime,
                                last_execution_time_readable: a.lastExecutionTime ? new Date(a.lastExecutionTime).toLocaleString() : null,
                                error_count: a.errorCount,
                                success_count: a.successCount,
                                recent_logs_count: a.logs.length,
                              })),
                            analyzing: activities
                              .filter(a => a.executionState === 'analyzing')
                              .map(a => ({
                                bot_id: a.botId,
                                bot_name: a.botName,
                                status: a.status,
                                current_action: a.currentAction,
                                waiting_for: a.waitingFor || null,
                                last_activity: a.lastActivity,
                                last_activity_readable: a.lastActivity ? new Date(a.lastActivity).toLocaleString() : null,
                                last_execution_time: a.lastExecutionTime,
                                last_execution_time_readable: a.lastExecutionTime ? new Date(a.lastExecutionTime).toLocaleString() : null,
                                error_count: a.errorCount,
                                success_count: a.successCount,
                                recent_logs_count: a.logs.length,
                              })),
                            waiting: activities
                              .filter(a => a.executionState === 'waiting')
                              .map(a => ({
                                bot_id: a.botId,
                                bot_name: a.botName,
                                status: a.status,
                                current_action: a.currentAction,
                                waiting_for: a.waitingFor || null,
                                last_activity: a.lastActivity,
                                last_activity_readable: a.lastActivity ? new Date(a.lastActivity).toLocaleString() : null,
                                last_execution_time: a.lastExecutionTime,
                                last_execution_time_readable: a.lastExecutionTime ? new Date(a.lastExecutionTime).toLocaleString() : null,
                                error_count: a.errorCount,
                                success_count: a.successCount,
                                recent_logs_count: a.logs.length,
                              })),
                            idle: activities
                              .filter(a => a.executionState === 'idle')
                              .map(a => ({
                                bot_id: a.botId,
                                bot_name: a.botName,
                                status: a.status,
                                current_action: a.currentAction,
                                waiting_for: a.waitingFor || null,
                                last_activity: a.lastActivity,
                                last_activity_readable: a.lastActivity ? new Date(a.lastActivity).toLocaleString() : null,
                                last_execution_time: a.lastExecutionTime,
                                last_execution_time_readable: a.lastExecutionTime ? new Date(a.lastExecutionTime).toLocaleString() : null,
                                error_count: a.errorCount,
                                success_count: a.successCount,
                                recent_logs_count: a.logs.length,
                              })),
                            errors: activities
                              .filter(a => a.executionState === 'error')
                              .map(a => ({
                                bot_id: a.botId,
                                bot_name: a.botName,
                                status: a.status,
                                current_action: a.currentAction,
                                waiting_for: a.waitingFor || null,
                                last_activity: a.lastActivity,
                                last_activity_readable: a.lastActivity ? new Date(a.lastActivity).toLocaleString() : null,
                                last_execution_time: a.lastExecutionTime,
                                last_execution_time_readable: a.lastExecutionTime ? new Date(a.lastExecutionTime).toLocaleString() : null,
                                error_count: a.errorCount,
                                success_count: a.successCount,
                                recent_logs_count: a.logs.length,
                              })),
                          },
                          all_activities: activities.map(a => ({
                            bot_id: a.botId,
                            bot_name: a.botName,
                            status: a.status,
                            execution_state: a.executionState,
                            current_action: a.currentAction,
                            waiting_for: a.waitingFor || null,
                            last_activity: a.lastActivity,
                            last_activity_readable: a.lastActivity ? new Date(a.lastActivity).toLocaleString() : null,
                            last_execution_time: a.lastExecutionTime,
                            last_execution_time_readable: a.lastExecutionTime ? new Date(a.lastExecutionTime).toLocaleString() : null,
                            error_count: a.errorCount,
                            success_count: a.successCount,
                            recent_logs_count: a.logs.length,
                          })),
                          bots_with_errors: activities
                            .filter(a => a.errorCount > 0)
                            .map(a => ({
                              bot_id: a.botId,
                              bot_name: a.botName,
                              status: a.status,
                              error_count: a.errorCount,
                              last_activity: a.lastActivity,
                              last_activity_readable: a.lastActivity ? new Date(a.lastActivity).toLocaleString() : null,
                              current_action: a.currentAction,
                            })),
                        };

                        const jsonData = JSON.stringify(recentActivityData, null, 2);
                        const blob = new Blob([jsonData], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `recent-activity-${new Date().toISOString().split('T')[0]}.json`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <i className="ri-file-code-line mr-2"></i>
                      Download JSON
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      onClick={() => {
                        setShowDownloadMenu(false);
                        const now = new Date();
                        const formatDate = (dateStr: string | null | undefined): string => {
                          if (!dateStr || dateStr === 'N/A') return 'N/A';
                          try { return new Date(dateStr).toLocaleString(); } catch { return String(dateStr); }
                        };
                        const html = `
<!DOCTYPE html>
<html><head><title>Recent Activity Report - ${now.toISOString().split('T')[0]}</title>
<style>
body{font-family:Arial,sans-serif;padding:20px;color:#333;}
h1{color:#1e40af;border-bottom:2px solid #1e40af;padding-bottom:8px;}
h2{margin-top:24px;margin-bottom:12px;color:#374151;}
table{width:100%;border-collapse:collapse;margin:12px 0;}
th,td{border:1px solid #ddd;padding:8px;text-align:left;}
th{background:#f3f4f6;font-weight:bold;}
.stat{display:inline-block;padding:12px;margin:8px;border:1px solid #ddd;border-radius:6px;min-width:100px;text-align:center;}
.smart-exit{background:#fffbeb;border-left:4px solid #f59e0b;padding:10px;margin:8px 0;}
</style></head><body>
<h1>Recent Activity Report</h1>
<p><strong>Generated:</strong> ${now.toLocaleString()}</p>
<h2>Summary</h2>
<div>
  <span class="stat">Total Bots: ${activities.length}</span>
  <span class="stat">Running: ${activities.filter(a => a.status === 'running').length}</span>
  <span class="stat">Executing: ${activities.filter(a => a.executionState === 'executing').length}</span>
  <span class="stat">Analyzing: ${activities.filter(a => a.executionState === 'analyzing').length}</span>
  <span class="stat">Waiting: ${activities.filter(a => a.executionState === 'waiting').length}</span>
  <span class="stat">Smart Exit: ${smartExitEvents.length}</span>
  <span class="stat">Errors: ${activities.filter(a => a.executionState === 'error').length}</span>
</div>
${smartExitEvents.length > 0 ? `
<h2>Smart Exit triggered – details report</h2>
<table><tr><th>Timestamp</th><th>Bot Name</th><th>Message</th><th>Symbol</th><th>Side</th><th>Exchange</th><th>Retracement %</th><th>Threshold %</th><th>Highest</th><th>Lowest</th><th>Entry</th><th>Price</th></tr>
${smartExitEvents.map((e: any) => {
  const d = e.details || {};
  return `<tr>
<td>${formatDate(e.timestamp)}</td><td>${(e.botName || '').replace(/</g, '&lt;')}</td><td>${(e.message || '').replace(/</g, '&lt;')}</td>
<td>${(d.symbol ?? '').toString().replace(/</g, '&lt;')}</td><td>${(d.side ?? '').toString().replace(/</g, '&lt;')}</td><td>${(d.exchange ?? '').toString().replace(/</g, '&lt;')}</td>
<td>${d.retracement_pct != null ? Number(d.retracement_pct).toFixed(2) : ''}</td><td>${d.threshold_pct != null ? Number(d.threshold_pct).toFixed(2) : ''}</td>
<td>${d.highest_price != null ? Number(d.highest_price).toFixed(4) : ''}</td><td>${d.lowest_price != null ? Number(d.lowest_price).toFixed(4) : ''}</td>
<td>${d.entry_price != null ? Number(d.entry_price).toFixed(4) : ''}</td><td>${d.current_price != null ? Number(d.current_price).toFixed(4) : ''}</td>
</tr>`;
}).join('')}
</table>` : ''}
<h2>Bot Activity Details</h2>
<table><tr><th>Bot Name</th><th>Status</th><th>State</th><th>Current Action</th><th>Last Activity</th><th>Errors</th></tr>
${activities.map(a => `<tr><td>${(a.botName || '').replace(/</g, '&lt;')}</td><td>${a.status}</td><td>${a.executionState || 'N/A'}</td><td>${(a.currentAction || '').replace(/</g, '&lt;')}</td><td>${formatDate(a.lastActivity)}</td><td>${a.errorCount}</td></tr>`).join('')}
</table>
</body></html>`;
                        const w = window.open('', '_blank');
                        if (w) {
                          w.document.write(html);
                          w.document.close();
                          w.focus();
                          setTimeout(() => w.print(), 300);
                        }
                      }}
                    >
                      <i className="ri-file-pdf-line mr-2"></i>
                      Download PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Executing Bots */}
            {activities.filter(a => a.executionState === 'executing').length > 0 && (
              <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-purple-800">Executing</span>
                  <i className="ri-loader-4-line animate-spin text-purple-600"></i>
                </div>
                <div className="space-y-2">
                  {activities
                    .filter(a => a.executionState === 'executing')
                    .slice(0, 3)
                    .map(activity => (
                      <div key={activity.botId} className="text-sm">
                        <span className="font-medium text-purple-900">{activity.botName}</span>
                        <span className="text-purple-700 ml-2">• {activity.currentAction}</span>
                      </div>
                    ))}
                  {activities.filter(a => a.executionState === 'executing').length > 3 && (
                    <div className="text-xs text-purple-600">
                      +{activities.filter(a => a.executionState === 'executing').length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Analyzing Bots */}
            {activities.filter(a => a.executionState === 'analyzing').length > 0 && (
              <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-800">Analyzing Market</span>
                  <i className="ri-bar-chart-line text-blue-600"></i>
                </div>
                <div className="space-y-2">
                  {activities
                    .filter(a => a.executionState === 'analyzing')
                    .slice(0, 3)
                    .map(activity => (
                      <div key={activity.botId} className="text-sm">
                        <span className="font-medium text-blue-900">{activity.botName}</span>
                        <span className="text-blue-700 ml-2">• {activity.currentAction}</span>
                      </div>
                    ))}
                  {activities.filter(a => a.executionState === 'analyzing').length > 3 && (
                    <div className="text-xs text-blue-600">
                      +{activities.filter(a => a.executionState === 'analyzing').length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Waiting Bots */}
            {activities.filter(a => a.executionState === 'waiting').length > 0 && (
              <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-yellow-800">Waiting</span>
                  <i className="ri-time-line text-yellow-600"></i>
                </div>
                <div className="space-y-2">
                  {activities
                    .filter(a => a.executionState === 'waiting')
                    .slice(0, 3)
                    .map(activity => (
                      <div key={activity.botId} className="text-sm">
                        <span className="font-medium text-yellow-900">{activity.botName}</span>
                        <span className="text-yellow-700 ml-2">
                          {activity.waitingFor ? `• Waiting: ${activity.waitingFor}` : `• ${activity.currentAction}`}
                        </span>
                      </div>
                    ))}
                  {activities.filter(a => a.executionState === 'waiting').length > 3 && (
                    <div className="text-xs text-yellow-600">
                      +{activities.filter(a => a.executionState === 'waiting').length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Smart Exit triggered */}
            {smartExitEvents.length > 0 && (
              <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-amber-800">Smart Exit triggered</span>
                  <i className="ri-external-link-line text-amber-600"></i>
                </div>
                <div className="space-y-3">
                  {smartExitEvents.slice(0, 5).map((evt, idx) => {
                    const d = evt.details || {};
                    const hasDetails = d.symbol != null || d.retracement_pct != null || d.threshold_pct != null;
                    return (
                      <div key={idx} className="text-sm border border-amber-200 rounded-lg p-2 bg-white/60">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-medium text-amber-900">{evt.botName}</span>
                            <span className="text-amber-700 ml-2">• {evt.message || 'Smart Exit'}</span>
                          </div>
                          <div className="text-xs text-amber-600 whitespace-nowrap">
                            {evt.timestamp ? new Date(evt.timestamp).toLocaleString() : ''}
                          </div>
                        </div>
                        {hasDetails && (
                          <div className="mt-2 pt-2 border-t border-amber-200 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-amber-800">
                            {d.symbol != null && <span><strong>Symbol:</strong> {d.symbol}</span>}
                            {d.side != null && <span><strong>Side:</strong> {d.side}</span>}
                            {d.exchange != null && <span><strong>Exchange:</strong> {d.exchange}</span>}
                            {d.retracement_pct != null && <span><strong>Retracement:</strong> {Number(d.retracement_pct).toFixed(2)}%</span>}
                            {d.threshold_pct != null && <span><strong>Threshold:</strong> {Number(d.threshold_pct).toFixed(2)}%</span>}
                            {d.highest_price != null && <span><strong>High:</strong> {Number(d.highest_price).toFixed(4)}</span>}
                            {d.lowest_price != null && <span><strong>Low:</strong> {Number(d.lowest_price).toFixed(4)}</span>}
                            {d.entry_price != null && <span><strong>Entry:</strong> {Number(d.entry_price).toFixed(4)}</span>}
                            {d.current_price != null && <span><strong>Price:</strong> {Number(d.current_price).toFixed(4)}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {smartExitEvents.length > 5 && (
                    <div className="text-xs text-amber-600">
                      +{smartExitEvents.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats Row */}
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {activities.filter(a => a.executionState === 'executing').length}
              </div>
              <div className="text-xs text-gray-500">Executing</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {activities.filter(a => a.executionState === 'analyzing').length}
              </div>
              <div className="text-xs text-gray-500">Analyzing</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">
                {activities.filter(a => a.executionState === 'waiting').length}
              </div>
              <div className="text-xs text-gray-500">Waiting</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">
                {smartExitEvents.length}
              </div>
              <div className="text-xs text-gray-500">Smart Exit</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {activities.filter(a => a.executionState === 'error').length}
              </div>
              <div className="text-xs text-gray-500">Errors</div>
            </div>
          </div>
        </Card>

        {/* Filter Tabs */}
        <div className="flex space-x-2 overflow-x-auto">
          {['all', 'running', 'paused', 'stopped'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{activities.length}</div>
            <div className="text-sm text-gray-500">Total Bots</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {activities.filter(a => a.status === 'running').length}
            </div>
            <div className="text-sm text-gray-500">Active</div>
          </Card>
          <Card className="p-4 text-center">
            <div className={`text-2xl font-bold ${bots.reduce((sum, b) => sum + (b.pnl || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${bots.reduce((sum, b) => sum + (b.pnl || 0), 0).toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">Total PnL</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {bots.reduce((sum, b) => sum + (b.totalTrades || 0), 0)}
            </div>
            <div className="text-sm text-gray-500">Total Trades</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {(() => {
                const botsWithTrades = bots.filter(b => (b.totalTrades || 0) > 0);
                const avgWinRate = botsWithTrades.length > 0
                  ? botsWithTrades.reduce((sum, b) => sum + (b.winRate || 0), 0) / botsWithTrades.length
                  : 0;
                return `${avgWinRate.toFixed(1)}%`;
              })()}
            </div>
            <div className="text-sm text-gray-500">Win Rate</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {bots.reduce((sum, b) => sum + (b.winTrades || 0), 0)}/{bots.reduce((sum, b) => sum + (b.lossTrades || 0), 0)}
            </div>
            <div className="text-sm text-gray-500">Win/Loss</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              ${Math.abs(bots.reduce((sum, b) => {
                const botFees = (b as any).totalFees || (b as any).total_fees || (b as any).fees || 0;
                return sum + botFees;
              }, 0)).toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">Total Fees</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {(() => {
                let maxDrawdown = 0;
                let peakPnL = 0;
                let runningPnL = 0;
                const sortedBots = [...bots].sort((a, b) => 
                  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
                sortedBots.forEach(bot => {
                  const botPnL = bot.pnl || 0;
                  runningPnL += botPnL;
                  if (runningPnL > peakPnL) {
                    peakPnL = runningPnL;
                  }
                  const drawdown = peakPnL - runningPnL;
                  if (drawdown > maxDrawdown) {
                    maxDrawdown = drawdown;
                  }
                });
                return `$${maxDrawdown.toFixed(2)}`;
              })()}
            </div>
            <div className="text-sm text-gray-500">Max Drawdown</div>
          </Card>
        </div>

        {/* Bot Activities */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading bot activities...</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-12">
              <i className="ri-robot-line text-4xl text-gray-400 mb-4"></i>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No bots found</h3>
              <p className="text-gray-500 mb-4">Create some bots to see their activity logs</p>
            </div>
          ) : (
            filteredActivities.map((activity) => (
              <BotActivityLogs
                key={activity.botId}
                activity={activity}
                onClearLogs={clearBotLogs}
                onSimulateActivity={simulateBotActivity}
              />
            ))
          )}
        </div>

        {/* Activity Report Generator */}
        <ActivityReportGenerator />

        {/* Errors Report Generator — detailed reports of bot errors and warnings */}
        <div className="flex items-center justify-between mb-2">
          <a href="#errors-report" className="text-sm text-blue-600 hover:underline">
            Jump to Errors Report Generator
          </a>
        </div>
        <ErrorsReportGenerator />

        {/* Bot Performance Report */}
        <BotReportViewer />

        {/* Debug Tools */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Debug Tools</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Test Logging</h4>
              <p className="text-sm text-gray-500 mb-3">
                Add test logs to verify the logging system is working
              </p>
              <div className="space-x-2">
                {activities.slice(0, 3).map((activity) => (
                  <Button
                    key={activity.botId}
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAddTestLog(activity.botId)}
                  >
                    Test {activity.botName}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Error Simulation</h4>
              <p className="text-sm text-gray-500 mb-3">
                Simulate errors to test error handling and logging
              </p>
              <div className="space-x-2">
                {activities.slice(0, 3).map((activity) => (
                  <Button
                    key={activity.botId}
                    variant="danger"
                    size="sm"
                    onClick={() => handleSimulateError(activity.botId)}
                  >
                    Error {activity.botName}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Navigation />
    </div>
  );
}
