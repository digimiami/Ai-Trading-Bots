
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';

export default function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  // Public routes that don't require login
  const publicRoutes = ['/market-dashboard', '/crypto-bubbles', '/crypto-news'];
  const isPublicRoute = publicRoutes.includes(location.pathname) || location.pathname.startsWith('/crypto-news/');

  // For public routes, show simplified navigation
  if (isPublicRoute) {
    const publicNavItems = [
      { path: '/', icon: 'ri-home-line', label: t('nav.home') },
      { path: '/market-dashboard', icon: 'ri-line-chart-line', label: t('nav.market') },
      { path: '/crypto-bubbles', icon: 'ri-bubble-chart-line', label: 'Bubbles' },
      { path: '/crypto-news', icon: 'ri-newspaper-line', label: 'News' },
      { path: '/academy', icon: 'ri-graduation-cap-line', label: t('nav.academy') },
      { path: '/auth', icon: 'ri-login-box-line', label: 'Sign In' }
    ];

    return (
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-blue-200/60 bg-white/95 backdrop-blur-sm shadow-[0_-6px_18px_-12px_rgba(30,64,175,0.45)] dark:border-blue-400/30 dark:bg-gray-900/95">
        <div className="grid grid-cols-6 h-20 px-3 py-2">
          {publicNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`group relative flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-150 px-2 ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-300'
                    : 'text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300'
                }`}
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-full border transition-all duration-150 ${
                    isActive
                      ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'border-slate-200 bg-slate-50 text-inherit group-hover:border-blue-300 group-hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:group-hover:border-blue-500/60 dark:group-hover:bg-slate-800'
                  }`}
                >
                  <i className={`${item.icon} text-[1.35rem]`}></i>
                </span>
                <span className="text-[0.72rem] font-semibold uppercase tracking-wide whitespace-nowrap drop-shadow-sm">
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 h-1 w-10 rounded-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.45)]" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // Don't render navigation until user data is loaded (for authenticated routes)
  if (loading || !user || user.role === undefined) {
    return null;
  }

  const navItems = [
    { path: '/dashboard', icon: 'ri-home-line', label: t('nav.home') },
    { path: '/academy', icon: 'ri-graduation-cap-line', label: t('nav.academy') },
    { path: '/pablo-ready', icon: 'ri-star-line', label: 'Pablo Ready' },
    { path: '/market-dashboard', icon: 'ri-line-chart-line', label: t('nav.market') },
    { path: '/bots', icon: 'ri-robot-line', label: t('nav.bots') },
    { path: '/backtest', icon: 'ri-test-tube-line', label: 'Backtest' },
    { path: '/bot-activity', icon: 'ri-file-list-line', label: 'Activity' },
    { path: '/trades', icon: 'ri-exchange-line', label: t('nav.trades') },
    { path: '/performance', icon: 'ri-line-chart-line', label: t('nav.performance') },
    { path: '/transaction-log', icon: 'ri-bar-chart-2-line', label: 'Log' },
    { path: '/paper-trading', icon: 'ri-edit-box-line', label: t('nav.paperTrading') },
    { path: '/futures-pairs-finder', icon: 'ri-search-line', label: 'Futures' },
    { path: '/settings', icon: 'ri-settings-line', label: t('nav.settings') }
  ];

  // Add AI/ML Dashboard if feature is enabled
  if (import.meta.env.VITE_FEATURE_AI_ML === '1') {
    navItems.push({ path: '/ai-ml/dashboard', icon: 'ri-brain-line', label: 'AI/ML' });
  }

  // Add admin link if user is admin
  if (user?.role === 'admin') {
    navItems.push({ path: '/admin', icon: 'ri-admin-line', label: 'Admin' });
  }

  // Calculate grid columns based on number of nav items
  // Support up to 9 items in grid, then use scrollable layout
  const getGridCols = () => {
    const count = navItems.length;
    if (count <= 5) return 'grid-cols-5';
    if (count <= 6) return 'grid-cols-6';
    if (count <= 7) return 'grid-cols-7';
    if (count <= 8) return 'grid-cols-8';
    if (count === 9) return 'grid-cols-9';
    // For 10+ items, use scrollable flex layout
    return 'flex';
  };

  const gridCols = getGridCols();
  const useScrollable = gridCols === 'flex';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-blue-200/60 bg-white/95 backdrop-blur-sm shadow-[0_-6px_18px_-12px_rgba(30,64,175,0.45)] dark:border-blue-400/30 dark:bg-gray-900/95">
      <div
        className={
          useScrollable
            ? 'flex h-20 overflow-x-auto px-2 py-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
            : `grid ${gridCols} h-20 px-3 py-2`
        }
      >
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`group relative flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-150 ${
                useScrollable ? 'min-w-[80px] px-3 flex-shrink-0' : 'px-2'
              } ${
                isActive
                  ? 'text-blue-600 dark:text-blue-300'
                  : 'text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300'
              }`}
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full border transition-all duration-150 ${
                  isActive
                    ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'border-slate-200 bg-slate-50 text-inherit group-hover:border-blue-300 group-hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:group-hover:border-blue-500/60 dark:group-hover:bg-slate-800'
                }`}
              >
                <i className={`${item.icon} text-[1.35rem]`}></i>
              </span>
              <span className="text-[0.72rem] font-semibold uppercase tracking-wide whitespace-nowrap drop-shadow-sm">
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 h-1 w-10 rounded-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.45)]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
