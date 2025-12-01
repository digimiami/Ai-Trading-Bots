
import { useNavigate, useLocation } from 'react-router-dom';
import LanguageSwitcher from '../ui/LanguageSwitcher';

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
    <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-50 safe-area-inset-top">
      <div className="flex items-center justify-between px-3 sm:px-4 h-14 sm:h-16">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
          {showBack && (
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation flex-shrink-0"
              aria-label="Go back"
            >
              <i className="ri-arrow-left-line text-lg sm:text-xl text-gray-600 dark:text-gray-300"></i>
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          <LanguageSwitcher />
          {showHelpButton && (
            <button
              onClick={() => navigate('/help')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
              aria-label="Help"
            >
              <i className="ri-question-line text-lg sm:text-xl text-gray-600 dark:text-gray-300"></i>
            </button>
          )}
          {action || rightAction}
        </div>
      </div>
    </header>
  );
}

export default Header;
