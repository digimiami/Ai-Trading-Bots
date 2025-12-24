import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import DropdownMenu, { DropdownMenuItem } from '../ui/DropdownMenu';
import { useAuth } from '../../hooks/useAuth';
import NotificationBell from './NotificationBell';

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
  const { user, signOut } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false);

  const handleBack = () => {
    navigate(-1);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const showHelpButton = !location.pathname.includes('/help') && !location.pathname.includes('/auth') && !location.pathname.includes('/onboarding');
  const isAuthenticated = !!user;

  // User menu items
  const userMenuItems: DropdownMenuItem[] = [
    {
      label: 'Profile',
      icon: 'ri-user-line',
      onClick: () => navigate('/settings?tab=profile'),
    },
    {
      label: 'Subscription',
      icon: 'ri-vip-crown-line',
      onClick: () => navigate('/subscription'),
    },
    {
      label: 'Messages',
      icon: 'ri-message-3-line',
      onClick: () => navigate('/messages'),
    },
    {
      label: 'Settings',
      icon: 'ri-settings-line',
      onClick: () => navigate('/settings'),
    },
    {
      label: 'Help & Support',
      icon: 'ri-question-line',
      onClick: () => navigate('/help'),
    },
    { divider: true },
    {
      label: 'Sign Out',
      icon: 'ri-logout-box-r-line',
      onClick: handleSignOut,
      danger: true,
    },
  ];

  // Help menu items
  const helpMenuItems: DropdownMenuItem[] = [
    {
      label: 'Help Center',
      icon: 'ri-question-line',
      onClick: () => navigate('/help'),
    },
    {
      label: 'Academy',
      icon: 'ri-graduation-cap-line',
      onClick: () => navigate('/academy'),
    },
    {
      label: 'Settings',
      icon: 'ri-settings-line',
      onClick: () => navigate('/settings'),
    },
  ];

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
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 flex-shrink-0 hover:opacity-80 transition-opacity"
            aria-label="Home"
          >
            <img 
              src="https://dkawxgwdqiirgmmjbvhc.supabase.co/storage/v1/object/public/message-attachments/pablobots-logo.jpeg" 
              alt="Pablo Logo" 
              className="h-8 w-8 sm:h-10 sm:w-10 object-contain"
            />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          <LanguageSwitcher />
          
          {/* Notification Bell (if authenticated) */}
          {isAuthenticated && <NotificationBell />}
          
          {/* Help Menu Dropdown */}
          {showHelpButton && (
            <DropdownMenu
              trigger={
                <button
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
                  aria-label="Help"
                >
                  <i className="ri-question-line text-lg sm:text-xl text-gray-600 dark:text-gray-300"></i>
                </button>
              }
              items={helpMenuItems}
              align="right"
              onOpenChange={setIsHelpMenuOpen}
            />
          )}

          {/* User Menu Dropdown (if authenticated) */}
          {isAuthenticated && (
            <DropdownMenu
              trigger={
                <button
                  className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation flex items-center gap-1.5 sm:gap-2"
                  aria-label="User menu"
                >
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center text-white text-xs sm:text-sm font-semibold shadow-sm">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <i className="ri-arrow-down-s-line text-gray-600 dark:text-gray-300 hidden sm:inline text-sm"></i>
                </button>
              }
              items={userMenuItems}
              align="right"
              onOpenChange={setIsUserMenuOpen}
              header={
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center text-white text-base font-semibold shadow-sm">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {user?.email || 'User'}
                    </p>
                    {user?.role && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {user.role}
                      </p>
                    )}
                  </div>
                </div>
              }
            />
          )}

          {action || rightAction}
        </div>
      </div>
    </header>
  );
}

export default Header;
