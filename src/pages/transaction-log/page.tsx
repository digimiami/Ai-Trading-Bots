import { useEffect, useMemo, useState } from 'react';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

type TransactionSummary = {
  totalTrades: number;
  longTrades: number;
  shortTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  grossPnl: number;
  fees: number;
  netPnl: number;
};

type BreakdownRow = {
  symbol: string;
  mode: string;
  trades: number;
  pnl: number;
  fees: number;
};

type TransactionEntry = {
  id: string;
  botId: string;
  botName: string;
  symbol: string;
  side: string;
  status: string;
  pnl: number;
  fees: number;
  mode: string;
  amount?: number;
  price?: number;
  exchange?: string;
  executedAt?: string;
  updatedAt?: string;
  createdAt: string;
  closedAt: string | null;
};

type ReportResponse = {
  summary: TransactionSummary;
  breakdown: {
    bySymbol: BreakdownRow[];
  };
  entries: TransactionEntry[];
};

type DateRangeOption = '24h' | '7d' | '30d' | 'custom';

const DEFAULT_SUMMARY: TransactionSummary = {
  totalTrades: 0,
  longTrades: 0,
  shortTrades: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  grossPnl: 0,
  fees: 0,
  netPnl: 0
};

export default function TransactionLogPage() {
  const { user } = useAuth();
  const [range, setRange] = useState<DateRangeOption>('7d');
  const [mode, setMode] = useState<'all' | 'real' | 'paper'>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [symbols, setSymbols] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('all');
  const [report, setReport] = useState<ReportResponse>({
    summary: DEFAULT_SUMMARY,
    breakdown: { bySymbol: [] },
    entries: []
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const formattedSummary = useMemo(() => report.summary || DEFAULT_SUMMARY, [report.summary]);

  const computeRange = () => {
    const now = new Date();
    const endIso = now.toISOString();
    if (range === '24h') {
      return { start: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), end: endIso };
    }
    if (range === '7d') {
      return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), end: endIso };
    }
    if (range === '30d') {
      return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), end: endIso };
    }
    // custom
    return {
      start: customStart ? new Date(customStart).toISOString() : null,
      end: customEnd ? new Date(customEnd).toISOString() : null
    };
  };

  const fetchSymbols = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('transaction_log_entries')
        .select('symbol', { distinct: true })
        .eq('user_id', user.id);
      if (error) throw error;
      const unique = Array.from(
        new Set(
          (data || [])
            .map((row) => row.symbol)
            .filter((value): value is string => Boolean(value))
        )
      ).sort();
      setSymbols(unique);
    } catch (err) {
      console.error('Failed to load available symbols', err);
    }
  };

  const fetchReport = async () => {
    if (!user) return;
    const { start, end } = computeRange();
    if (range === 'custom' && (!start || !end)) {
      setError('Please select both start and end date for custom range.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('transaction_log_report', {
        p_user_id: user.id,
        p_symbols: selectedSymbol !== 'all' ? [selectedSymbol] : null,
        p_mode: mode,
        p_start: start,
        p_end: end,
        p_limit: 200,
        p_offset: 0
      });

      if (error) throw error;

      const nextReport: ReportResponse = {
        summary: data?.summary || DEFAULT_SUMMARY,
        breakdown: {
          bySymbol: data?.breakdown?.bySymbol || []
        },
        entries: data?.entries || []
      };

      setReport(nextReport);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Failed to load transaction log report:', err);
      setError(err?.message || 'Failed to load transaction log report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSymbols();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    fetchReport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, range, mode, selectedSymbol]);

  const handleSymbolChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSymbol(event.target.value);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  const formatAmount = (value?: number, digits: number = 4) =>
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(value ?? 0);

  const formatPercentage = (value: number) => `${(value * 100 || 0).toFixed(1)}%`;

  const renderSummaryCard = (
    label: string,
    value: string | number,
    icon: string,
    tintClass: string = 'text-gray-900'
  ) => (
    <Card key={label} className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{label}</p>
          <p className={`text-2xl font-semibold ${tintClass}`}>{value}</p>
        </div>
        <i className={`${icon} text-2xl text-gray-300`}></i>
      </div>
    </Card>
  );

  const summaryCards = [
    renderSummaryCard('Total Trades', formattedSummary.totalTrades, 'ri-bar-chart-line'),
    renderSummaryCard(
      'Net PnL',
      formatCurrency(formattedSummary.netPnl),
      'ri-funds-line',
      formattedSummary.netPnl >= 0 ? 'text-green-600' : 'text-red-600'
    ),
    renderSummaryCard('Fees', formatCurrency(formattedSummary.fees), 'ri-hand-coin-fill', 'text-amber-600'),
    renderSummaryCard('Win Rate', `${(formattedSummary.winRate * 100 || 0).toFixed(1)}%`, 'ri-trophy-line', 'text-blue-600'),
    renderSummaryCard('Long Trades', formattedSummary.longTrades, 'ri-arrow-up-line', 'text-emerald-600'),
    renderSummaryCard('Short Trades', formattedSummary.shortTrades, 'ri-arrow-down-line', 'text-rose-600'),
    renderSummaryCard('Wins', formattedSummary.wins, 'ri-checkbox-circle-line', 'text-green-600'),
    renderSummaryCard('Losses', formattedSummary.losses, 'ri-close-circle-line', 'text-red-600')
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header
        title="Transaction Log"
        subtitle="Analyze executed trades, fees, and performance across your bots"
      />

      <div className="pt-20 pb-20 px-4 space-y-4 max-w-6xl mx-auto w-full">
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: '24h', label: 'Last 24h' },
              { key: '7d', label: 'Last 7d' },
              { key: '30d', label: 'Last 30d' },
              { key: 'custom', label: 'Custom' }
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => setRange(option.key as DateRangeOption)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  range === option.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {range === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col">
                <label className="text-sm text-gray-600 mb-1">Start date</label>
                <input
                  type="datetime-local"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm text-gray-600 mb-1">End date</label>
                <input
                  type="datetime-local"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col">
              <label className="text-sm text-gray-600 mb-1">Mode</label>
              <div className="flex items-center gap-2">
                {['all', 'real', 'paper'].map((value) => (
                  <button
                    key={value}
                    onClick={() => setMode(value as 'all' | 'real' | 'paper')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                      mode === value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col md:col-span-2">
              <label className="text-sm text-gray-600 mb-1">Symbol</label>
              <select
                value={selectedSymbol}
                onChange={handleSymbolChange}
                className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Pairs</option>
                {symbols.length === 0 && <option value="" disabled>No symbols available yet</option>}
                {symbols.map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {lastUpdated ? `Last updated: ${lastUpdated.toLocaleString()}` : 'Results update automatically when filters change.'}
            </div>
            <Button variant="secondary" size="sm" onClick={fetchReport} loading={loading}>
              <i className="ri-refresh-line mr-1"></i>
              Refresh
            </Button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
              <i className="ri-error-warning-line"></i>
              {error}
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards}
        </div>

        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Symbol breakdown</h2>
          {report.breakdown.bySymbol.length === 0 ? (
            <div className="text-sm text-gray-500">No trades recorded for the selected filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead>
                  <tr className="text-left text-gray-500 uppercase tracking-wider">
                    <th className="px-3 py-2">Symbol</th>
                    <th className="px-3 py-2">Mode</th>
                    <th className="px-3 py-2 text-right">Trades</th>
                    <th className="px-3 py-2 text-right">PnL</th>
                    <th className="px-3 py-2 text-right">Fees</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {report.breakdown.bySymbol.map((row) => (
                    <tr key={`${row.symbol}-${row.mode}`}>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{row.symbol}</td>
                      <td className="px-3 py-2 capitalize">{row.mode}</td>
                      <td className="px-3 py-2 text-right">{row.trades}</td>
                      <td className={`px-3 py-2 text-right ${row.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(row.pnl)}
                      </td>
                      <td className="px-3 py-2 text-right text-amber-600">
                        {formatCurrency(row.fees)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent trades</h2>
            <div className="text-xs text-gray-500">Showing up to 200 records</div>
          </div>
          {loading ? (
            <div className="text-center py-8 text-gray-500 flex items-center justify-center gap-2">
              <i className="ri-loader-4-line animate-spin"></i>
              Loading transaction log...
            </div>
          ) : report.entries.length === 0 ? (
            <div className="text-center py-8">
              <i className="ri-file-chart-line text-4xl text-gray-300 mb-2"></i>
              <p className="text-sm text-gray-500">No trades found for the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead>
                  <tr className="text-left text-gray-500 uppercase tracking-wider">
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Bot</th>
                    <th className="px-3 py-2">Symbol</th>
                    <th className="px-3 py-2">Side</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">PnL</th>
                    <th className="px-3 py-2 text-right">Fees</th>
                    <th className="px-3 py-2">Exchange</th>
                    <th className="px-3 py-2 text-right">Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {report.entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                        {new Date(entry.executedAt ?? entry.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900 dark:text-white">{entry.botName || '—'}</div>
                        <div className="text-xs text-gray-500">#{entry.botId.slice(0, 6)}</div>
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{entry.symbol}</td>
                      <td className={`px-3 py-2 font-medium ${entry.side?.toLowerCase() === 'buy' || entry.side?.toLowerCase() === 'long' ? 'text-green-600' : 'text-red-600'}`}>
                        {entry.side?.toUpperCase()}
                      </td>
                      <td className="px-3 py-2 text-right">{formatAmount(entry.amount)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(entry.price ?? 0)}</td>
                      <td className="px-3 py-2 capitalize">{entry.status || '—'}</td>
                      <td className={`px-3 py-2 text-right ${entry.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(entry.pnl)}
                      </td>
                      <td className="px-3 py-2 text-right text-amber-600">
                        {formatCurrency(entry.fees)}
                      </td>
                      <td className="px-3 py-2 uppercase">{entry.exchange || '—'}</td>
                      <td className="px-3 py-2 text-right capitalize">{entry.mode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Navigation />
    </div>
  );
}

