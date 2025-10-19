
import { useNavigate, useLocation } from 'react-router-dom';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  action?: React.ReactNode;
  rightAction?: React.ReactNode;
}

export function Header({ title, subtitle, showBack = false, action, rightAction }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    navigate(-1);
  };

  const showHelpButton = !location.pathname.includes('/help') && !location.pathname.includes('/auth') && !location.pathname.includes('/onboarding');

  return (
    <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
      <div className="flex items-center justify-between px-4 h-16">
        <div className="flex items-center space-x-3">
          {showBack && (
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <i className="ri-arrow-left-line text-xl text-gray-600"></i>
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {showHelpButton && (
            <button
              onClick={() => navigate('/help')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <i className="ri-question-line text-xl text-gray-600"></i>
            </button>
          )}
          {action || rightAction}
        </div>
      </div>
    </header>
  );
}

export default Header;
