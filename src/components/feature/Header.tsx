
import { useAuth } from '../../hooks/useAuth';
import { useAdmin } from '../../hooks/useAdmin';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function Header({ title, subtitle, action }: HeaderProps) {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-40 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          {title && <h1 className="text-lg font-semibold text-gray-900">{title}</h1>}
          {subtitle && (
            <p className="text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {action && (
            <div>{action}</div>
          )}
          
          {/* Admin Link */}
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <i className="ri-shield-check-line"></i>
              <span className="text-sm font-medium">Admin</span>
            </button>
          )}
          
          {/* User Menu */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <i className="ri-user-line text-gray-600"></i>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user?.email}</p>
              <p className="text-xs text-gray-500">{isAdmin ? 'Admin' : 'User'}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Sign Out"
            >
              <i className="ri-logout-box-line text-gray-600"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Header;
