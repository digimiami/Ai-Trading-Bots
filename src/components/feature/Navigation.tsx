
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
    { path: '/', icon: 'ri-home-line', label: 'Home' },
    { path: '/bots', icon: 'ri-robot-line', label: 'Bots' },
    { path: '/backtest', icon: 'ri-test-tube-line', label: 'Backtest' },
    { path: '/bot-activity', icon: 'ri-file-list-line', label: 'Activity' },
    { path: '/trades', icon: 'ri-exchange-line', label: 'Trades' },
    { path: '/performance', icon: 'ri-line-chart-line', label: 'Performance' },
    { path: '/paper-trading', icon: 'ri-edit-box-line', label: 'Paper' },
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
  const getGridCols = () => {
    if (navItems.length === 5) return 'grid-cols-5';
    if (navItems.length === 6) return 'grid-cols-6';
    if (navItems.length === 7) return 'grid-cols-7';
    if (navItems.length === 8) return 'grid-cols-8';
    return 'grid-cols-6'; // fallback for more items
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40">
      <div className={`grid ${getGridCols()} h-16`}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
                isActive 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <i className={`${item.icon} text-xl`}></i>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
