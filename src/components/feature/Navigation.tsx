
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Don't render navigation until user data is loaded
  if (loading || !user || user.role === undefined) {
    return null;
  }

  const navItems = [
    { path: '/dashboard', icon: 'ri-home-line', label: 'Home' },
    { path: '/bots', icon: 'ri-robot-line', label: 'Bots' },
    { path: '/backtest', icon: 'ri-test-tube-line', label: 'Backtest' },
    { path: '/bot-activity', icon: 'ri-file-list-line', label: 'Activity' },
    { path: '/trades', icon: 'ri-exchange-line', label: 'Trades' },
    { path: '/performance', icon: 'ri-line-chart-line', label: 'Performance' },
    { path: '/transaction-log', icon: 'ri-bar-chart-2-line', label: 'Log' },
    { path: '/paper-trading', icon: 'ri-edit-box-line', label: 'Paper' },
    { path: '/futures-pairs-finder', icon: 'ri-search-line', label: 'Futures' },
    { path: '/settings', icon: 'ri-settings-line', label: 'Settings' }
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
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40">
      <div className={useScrollable 
        ? "flex overflow-x-auto h-16 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        : `grid ${gridCols} h-16`
      }>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
                useScrollable ? 'min-w-[70px] px-2 flex-shrink-0' : ''
              } ${
                isActive 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <i className={`${item.icon} text-xl`}></i>
              <span className="text-xs font-medium whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
