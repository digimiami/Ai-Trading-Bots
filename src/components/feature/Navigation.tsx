
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
    { path: '/bot-activity', icon: 'ri-file-list-line', label: 'Activity' },
    { path: '/trades', icon: 'ri-exchange-line', label: 'Trades' },
    { path: '/settings', icon: 'ri-settings-line', label: 'Settings' }
  ];

  // Add admin link if user is admin
  if (user?.role === 'admin') {
    navItems.push({ path: '/admin', icon: 'ri-admin-line', label: 'Admin' });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
      <div className={`grid ${user?.role === 'admin' ? 'grid-cols-6' : 'grid-cols-5'} h-16`}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
                isActive 
                  ? 'text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
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
