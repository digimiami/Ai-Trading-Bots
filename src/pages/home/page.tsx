
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import StatsGrid from './components/StatsGrid';
import ActiveBots from './components/ActiveBots';
import MarketOverview from './components/MarketOverview';
import { useAuth } from '../../hooks/useAuth';
import { useBots } from '../../hooks/useBots';
import { useMarketData } from '../../hooks/useMarketData';
import { useExchangeBalance } from '../../hooks/useExchangeBalance';
import { useAcademy, isModuleCompleted } from '../../hooks/useAcademy';
import ExchangeBalanceDisplay from './components/ExchangeBalance';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bots, loading: botsLoading } = useBots();
  const { marketData, loading: marketLoading } = useMarketData();
  const { balances, loading: balancesLoading } = useExchangeBalance();
  const { modules: academyModules, lessonProgress: academyProgress, summary: academySummary, loading: academyLoading } = useAcademy();
  const [showWelcome, setShowWelcome] = useState(false);
  const orientationModule = useMemo(
    () => academyModules.find((module) => module.order_index === 1 || module.slug === 'orientation-setup'),
    [academyModules]
  );

  const orientationStats = useMemo(() => {
    if (!orientationModule) {
      return { completedLessons: 0, totalLessons: 0 };
    }
    const lessonIds = new Set(orientationModule.lessons.map((lesson) => lesson.id));
    const completedLessons = academyProgress.filter(
      (entry) => entry.module_id === orientationModule.id && (!!entry.lesson_id && lessonIds.has(entry.lesson_id)) && entry.status === 'completed'
    ).length;
    const totalLessons = orientationModule.lessons.length;
    return { completedLessons, totalLessons };
  }, [academyProgress, orientationModule]);

  const hasCompletedOrientation = orientationModule ? isModuleCompleted(orientationModule, academyProgress) : false;
  const showAcademyBanner = !academyLoading && orientationModule && !hasCompletedOrientation;

  const foundationBadgeUnlocked = academySummary?.badge_foundation_finisher ?? false;
  const foundationProgress =
    orientationStats.totalLessons > 0
      ? Math.round((orientationStats.completedLessons / orientationStats.totalLessons) * 100)
      : 0;

  useEffect(() => {
    const isFirstVisit = !localStorage.getItem('welcome_shown');
    if (isFirstVisit && user) {
      setShowWelcome(true);
      localStorage.setItem('welcome_shown', 'true');
    }
  }, [user]);

  const activeBots = bots.filter(bot => bot.status === 'active');
  const totalPnL = bots.reduce((sum, bot) => sum + (bot.totalPnL || 0), 0);
  const handleCreateFirstBot = () => {
    setShowWelcome(false);
    navigate('/create-bot');
  };

  const handleGetStarted = () => {
    navigate('/onboarding');
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all data? This will clear all bots, trades, and settings.')) {
      // Clear localStorage
      localStorage.clear();
      // Reload the page
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header 
        title="Pablo" 
        subtitle="AI Trading Platform"
        rightAction={
          <div className="flex space-x-2">
            <Button
              variant="danger"
              size="sm"
              onClick={handleReset}
            >
              <i className="ri-refresh-line mr-1"></i>
              Reset
            </Button>
            <button
              onClick={() => navigate('/help')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <i className="ri-notification-line text-xl text-gray-600 dark:text-gray-300"></i>
            </button>
            <button
              onClick={() => navigate('/contact')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Contact Us"
            >
              <i className="ri-customer-service-line text-xl text-gray-600 dark:text-gray-300"></i>
            </button>
          </div>
        }
      />
      
      <div className="pt-20 pb-20 px-4 space-y-6">
        {showAcademyBanner && orientationModule && (
          <Card className="relative overflow-hidden border border-sky-500/60 bg-slate-900">
            <div className="absolute inset-0 bg-gradient-to-r from-sky-500/30 via-indigo-500/25 to-purple-500/30 opacity-80" />
            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white drop-shadow-lg">Launch the Pablo Academy</h3>
                <p className="mt-2 text-sm text-slate-100">
                  Complete Orientation & Setup to unlock advanced templates, badges, and faster onboarding for your team.
                </p>
                <div className="mt-3 flex items-center space-x-4 text-xs text-slate-200">
                  <span className="flex items-center">
                    <i className="ri-time-line mr-1 text-slate-100" />
                    <span>{orientationModule.duration_minutes} minutes</span>
                  </span>
                  <span className="flex items-center">
                    <i className="ri-stack-line mr-1 text-slate-100" />
                    <span>{orientationModule.lessons.length} lessons</span>
                  </span>
                  {orientationStats.totalLessons > 0 && (
                    <span className="flex items-center">
                      <i className="ri-progress-8-line mr-1 text-slate-100" />
                      <span>
                        {orientationStats.completedLessons}/{orientationStats.totalLessons} complete
                      </span>
                    </span>
                  )}
                </div>
              </div>
              <Button size="lg" className="shadow-lg shadow-cyan-500/30" onClick={() => navigate(`/academy/${orientationModule.slug}`)}>
                Start Module 1
              </Button>
            </div>
          </Card>
        )}

        {/* Welcome Message for New Users */}
        {showWelcome && (
          <Card className="flex flex-col items-start gap-4 border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-indigo-50 p-6 shadow-sm dark:border-blue-900/40 dark:from-blue-950/40 dark:via-gray-900 dark:to-indigo-950/40">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-blue-400">
              <i className="ri-graduation-cap-line text-lg" />
              Academy
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Start the Pablo Academy</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Complete Orientation &amp; Setup to unlock pro tips, badges, and automation checklists tailored to your trading style.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate('/academy/orientation-setup')} size="sm">
                Begin Orientation
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/academy')}>
                View Curriculum
              </Button>
            </div>
          </Card>
        )}

        {foundationBadgeUnlocked && (
          <Card className="flex items-center gap-4 border border-emerald-300 bg-emerald-100 p-5 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/30 dark:text-emerald-200">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-200">
              <i className="ri-award-fill text-xl" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">Foundation Finisher</h3>
              <p className="text-sm text-emerald-800/90 dark:text-emerald-200">
                Congratulations! You’ve completed the core Pablo Academy modules. Advanced playbooks are now unlocked in the Academy hub.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => navigate('/academy')}>
              Explore Advanced Paths
            </Button>
          </Card>
        )}

          <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <i className="ri-robot-line text-2xl text-blue-600"></i>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Welcome to Pablo! 🎉
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  Ready to start automated trading? Create your first AI trading bot and let it work 24/7 for you.
                </p>
                <div className="flex space-x-3">
                  <Button
                    variant="primary"
                    onClick={handleCreateFirstBot}
                    className="text-sm"
                  >
                    Create First Bot
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowWelcome(false)}
                    className="text-sm"
                  >
                    Maybe Later
                  </Button>
                </div>
              </div>
              <button
                onClick={() => setShowWelcome(false)}
                className="p-1 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <i className="ri-close-line text-gray-500"></i>
              </button>
            </div>
          </Card>
        

        {/* Quick Stats */}
        <StatsGrid />

        {/* Quick Actions */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="primary"
              onClick={() => navigate('/create-bot')}
              className="h-12 flex items-center justify-center"
            >
              <i className="ri-add-line mr-2"></i>
              Create Bot
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/bots')}
              className="h-12 flex items-center justify-center"
            >
              <i className="ri-robot-line mr-2"></i>
              Manage Bots
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/academy')}
              className="h-12 flex items-center justify-center"
            >
              <i className="ri-graduation-cap-line mr-2"></i>
              Visit Academy
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/contact')}
              className="h-12 flex items-center justify-center"
            >
              <i className="ri-customer-service-line mr-2"></i>
              Contact Us
            </Button>
          </div>
        </Card>

        {academySummary && (
          <Card className="flex items-center justify-between border border-emerald-300 bg-gradient-to-r from-emerald-100 via-teal-100 to-sky-100 px-6 py-5 text-sm text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-900/40 dark:text-emerald-100">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700 dark:text-emerald-200">
                Academy Progress
              </div>
              <p className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
                {academySummary.modules_completed}/{academySummary.modules_available} modules completed
              </p>
              {foundationBadgeUnlocked ? (
                <p className="text-xs text-emerald-700 dark:text-emerald-200">
                  <i className="ri-award-fill mr-1 text-emerald-600 dark:text-emerald-200" />
                  Foundation badge unlocked — advanced content enabled.
                </p>
              ) : (
                <p className="text-xs text-emerald-700 dark:text-emerald-200">
                  Complete the first three modules to earn the Foundation badge.
                </p>
              )}
            </div>
            <div className="flex flex-col items-end">
              <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-800 dark:text-emerald-100">
                <span>{foundationProgress}% of Module 1</span>
              </div>
              <div className="mt-2 h-2.5 w-36 rounded-full bg-emerald-200 dark:bg-emerald-800/70">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400 shadow-inner"
                  style={{ width: `${foundationProgress}%` }}
                />
              </div>
              {!foundationBadgeUnlocked && (
                <Button variant="secondary" size="sm" className="mt-3 shadow-sm" onClick={() => navigate('/academy')}>
                  Resume
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Active Bots */}
        <ActiveBots bots={activeBots} />

        {/* Exchange Balances */}
        <ExchangeBalanceDisplay balances={balances} />

        {/* Market Overview */}
        <MarketOverview marketData={marketData} />

        {/* Recent Activity */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <Button
              variant="secondary"
              onClick={() => navigate('/trades')}
              className="text-sm"
            >
              View All
            </Button>
          </div>
          
          <div className="space-y-3">
            {[
              {
                type: 'trade',
                message: 'BTC Scalper opened LONG position',
                time: '2 minutes ago',
                icon: 'ri-arrow-up-line',
                color: 'green'
              },
              {
                type: 'profit',
                message: 'ETH Momentum closed with +$45.20 profit',
                time: '15 minutes ago',
                icon: 'ri-money-dollar-circle-line',
                color: 'green'
              },
              {
                type: 'alert',
                message: 'SOL Trader hit stop loss at -2.5%',
                time: '1 hour ago',
                icon: 'ri-alert-line',
                color: 'red'
              },
              {
                type: 'bot',
                message: 'New bot "DOGE Swing" created',
                time: '2 hours ago',
                icon: 'ri-robot-line',
                color: 'blue'
              }
            ].map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className={`w-8 h-8 bg-${activity.color}-100 rounded-full flex items-center justify-center`}>
                  <i className={`${activity.icon} text-${activity.color}-600`}></i>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Performance Summary */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Performance</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Total P&L</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {bots.reduce((sum, bot) => sum + (bot.totalTrades || 0), 0)}
              </div>
              <div className="text-sm text-gray-600">Total Trades</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {bots.length > 0 
                  ? (bots.reduce((sum, bot) => sum + (bot.winRate || 0), 0) / bots.length).toFixed(1)
                  : '0.0'}%
              </div>
              <div className="text-sm text-gray-600">Avg Win Rate</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{activeBots.length}</div>
              <div className="text-sm text-gray-600">Active Bots</div>
            </div>
          </div>
        </Card>

        {/* Educational Content */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Trading Tips</h3>
          <div className="space-y-3">
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm">
              <div className="flex items-start space-x-3">
                <i className="ri-lightbulb-line text-indigo-600 mt-1 text-lg"></i>
                <div>
                  <h4 className="font-medium text-indigo-900 mb-1">Risk Management</h4>
                  <p className="text-sm text-indigo-700">
                    Never risk more than 2-3% of your capital on a single trade. Use stop losses to protect your investments and revisit them as volatility changes.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg shadow-sm">
              <div className="flex items-start space-x-3">
                <i className="ri-bar-chart-line text-emerald-600 mt-1 text-lg"></i>
                <div>
                  <h4 className="font-medium text-emerald-900 mb-1">Diversification</h4>
                  <p className="text-sm text-green-700">
                    Spread your trades across different cryptocurrencies and strategies to reduce overall risk.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg shadow-sm">
              <div className="flex items-start space-x-3">
                <i className="ri-calendar-check-line text-amber-600 mt-1 text-lg"></i>
                <div>
                  <h4 className="font-medium text-amber-900 mb-1">Review Schedules</h4>
                  <p className="text-sm text-amber-700">
                    Set time blocks to review your bots weekly. Pause underperforming strategies, tune parameters, and celebrate what’s working.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg shadow-sm">
              <div className="flex items-start space-x-3">
                <i className="ri-heart-pulse-line text-rose-600 mt-1 text-lg"></i>
                <div>
                  <h4 className="font-medium text-rose-900 mb-1">Keep Emotions in Check</h4>
                  <p className="text-sm text-rose-700">
                    Stick to your plan. Avoid chasing pumps or panic-selling dips—your automation works best when signals stay objective.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg shadow-sm">
              <div className="flex items-start space-x-3">
                <i className="ri-history-line text-sky-600 mt-1 text-lg"></i>
                <div>
                  <h4 className="font-medium text-sky-900 mb-1">Backtest & Iterate</h4>
                  <p className="text-sm text-sky-700">
                    Before deploying capital, run backtests over multiple market regimes. Iteration builds confidence and surfaces edge cases early.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg shadow-sm">
              <div className="flex items-start space-x-3">
                <i className="ri-slideshow-line text-cyan-600 mt-1 text-lg"></i>
                <div>
                  <h4 className="font-medium text-cyan-900 mb-1">Right-Size Positions</h4>
                  <p className="text-sm text-cyan-700">
                    Scale entries based on volatility and conviction. Smaller sizing during uncertain markets keeps drawdowns manageable.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-lime-50 border border-lime-200 rounded-lg shadow-sm">
              <div className="flex items-start space-x-3">
                <i className="ri-pie-chart-2-line text-lime-600 mt-1 text-lg"></i>
                <div>
                  <h4 className="font-medium text-lime-900 mb-1">Track Core Metrics</h4>
                  <p className="text-sm text-lime-700">
                    Monitor win rate, profit factor, max drawdown, and average trade duration to spot trends before they erode performance.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg shadow-sm">
              <div className="flex items-start space-x-3">
                <i className="ri-wireless-charging-line text-violet-600 mt-1 text-lg"></i>
                <div>
                  <h4 className="font-medium text-violet-900 mb-1">Plan Liquidity</h4>
                  <p className="text-sm text-violet-700">
                    Favor pairs with healthy depth. Thin books amplify slippage, so adjust order types or trade size when liquidity dries up.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
              <div className="flex items-start space-x-3">
                <i className="ri-shield-check-line text-slate-600 mt-1 text-lg"></i>
                <div>
                  <h4 className="font-medium text-slate-900 mb-1">Stay Compliant</h4>
                  <p className="text-sm text-slate-700">
                    Keep tabs on exchange rules, tax obligations, and API rate limits. Small compliance habits prevent sudden trading interruptions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Navigation />
    </div>
  );
}
