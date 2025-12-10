
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';

export default function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

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
      { path: '/contact', icon: 'ri-customer-service-line', label: 'Contact' },
      { path: '/auth', icon: 'ri-login-box-line', label: 'Sign In' }
    ];

    return (
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-blue-200/60 bg-white/95 backdrop-blur-sm shadow-[0_-6px_18px_-12px_rgba(30,64,175,0.45)] dark:border-blue-400/30 dark:bg-gray-900/95 safe-area-inset-bottom">
        <div className="grid grid-cols-6 h-16 sm:h-20 px-1 sm:px-3 py-1.5 sm:py-2">
          {publicNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`group relative flex flex-col items-center justify-center gap-0.5 sm:gap-1 rounded-xl transition-all duration-150 px-1 sm:px-2 touch-manipulation ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-300'
                    : 'text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300'
                }`}
              >
                <span
                  className={`flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full border transition-all duration-150 ${
                    isActive
                      ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'border-slate-200 bg-slate-50 text-inherit group-hover:border-blue-300 group-hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:group-hover:border-blue-500/60 dark:group-hover:bg-slate-800'
                  }`}
                >
                  <i className={`${item.icon} text-lg sm:text-[1.35rem]`}></i>
                </span>
                <span className="text-[0.65rem] sm:text-[0.72rem] font-semibold uppercase tracking-wide whitespace-nowrap drop-shadow-sm leading-tight">
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 h-0.5 sm:h-1 w-8 sm:w-10 rounded-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.45)]" />
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

  // Main visible navigation items
  const mainNavItems = [
    { path: '/dashboard', icon: 'ri-home-line', label: t('nav.home') },
    { path: '/bots', icon: 'ri-robot-line', label: t('nav.bots') },
    { path: '/pablo-ready', icon: 'ri-star-line', label: 'Pablo Ready' },
    { path: '/settings', icon: 'ri-settings-line', label: t('nav.settings') }
  ];

  // Dropdown menu items
  const dropdownItems = [
    { path: '/academy', icon: 'ri-graduation-cap-line', label: t('nav.academy') },
    { path: '/market-dashboard', icon: 'ri-line-chart-line', label: t('nav.market') },
    { path: '/ai-assistant', icon: 'ri-robot-2-line', label: 'AI Assistant' },
    { path: '/backtest', icon: 'ri-test-tube-line', label: 'Backtest' },
    { path: '/bot-activity', icon: 'ri-file-list-line', label: 'Activity' },
    { path: '/trades', icon: 'ri-exchange-line', label: t('nav.trades') },
    { path: '/performance', icon: 'ri-line-chart-line', label: t('nav.performance') },
    { path: '/transaction-log', icon: 'ri-bar-chart-2-line', label: 'Log' },
    { path: '/paper-trading', icon: 'ri-edit-box-line', label: t('nav.paperTrading') },
    { path: '/futures-pairs-finder', icon: 'ri-search-line', label: 'Futures' },
    { path: '/contact', icon: 'ri-customer-service-line', label: 'Contact' },
    { path: '/messages', icon: 'ri-message-3-line', label: 'Messages' },
    { path: '/pricing', icon: 'ri-vip-crown-line', label: 'Pricing' }
  ];
  
  // Add AI/ML Dashboard if feature is enabled
  if (import.meta.env.VITE_FEATURE_AI_ML === '1') {
    dropdownItems.push({ path: '/ai-ml/dashboard', icon: 'ri-brain-line', label: 'AI/ML' });
  }

  // Add admin link if user is admin
  if (user?.role === 'admin') {
    dropdownItems.push({ path: '/admin', icon: 'ri-admin-line', label: 'Admin' });
  }

  // Refresh handler
  const handleRefresh = () => {
    window.location.reload();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-menu') && !target.closest('.dropdown-button')) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  // Mobile menu drawer
  const MobileMenuDrawer = () => (
    <>
      {/* Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      {/* Drawer */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-blue-200/60 dark:border-blue-400/30 rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          isMobileMenuOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '85vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        </div>
        
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Navigation</h2>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors touch-manipulation"
            aria-label="Close menu"
          >
            <i className="ri-close-line text-2xl text-gray-600 dark:text-gray-300"></i>
          </button>
        </div>
        
        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          <div className="grid grid-cols-2 gap-3 p-4">
            {[...mainNavItems, ...dropdownItems].map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`group relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all duration-150 touch-manipulation ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border-2 border-blue-500'
                      : 'bg-gray-50 dark:bg-gray-800 text-slate-600 dark:text-slate-300 border-2 border-transparent active:border-blue-300 dark:active:border-blue-500/60'
                  }`}
                >
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-150 ${
                      isActive
                        ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-gray-700 text-inherit'
                    }`}
                  >
                    <i className={`${item.icon} text-xl`}></i>
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-center leading-tight">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );

  // Mobile: Show hamburger button + drawer + compact bottom nav
  if (isMobile) {
    return (
      <>
        {/* Mobile Hamburger Button - Positioned above bottom nav */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="fixed bottom-20 right-4 z-40 h-12 w-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full shadow-lg shadow-blue-500/50 flex items-center justify-center transition-all duration-200 active:scale-95 md:hidden touch-manipulation"
          aria-label="Open menu"
        >
          <i className={`ri-menu-line text-xl transition-transform duration-300 ${isMobileMenuOpen ? 'rotate-90' : ''}`}></i>
        </button>

        {/* Mobile Menu Drawer */}
        <MobileMenuDrawer />

        {/* Bottom Quick Nav (Mobile) - Show main items + refresh + dropdown */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-blue-200/60 bg-white/95 backdrop-blur-sm shadow-[0_-6px_18px_-12px_rgba(30,64,175,0.45)] dark:border-blue-400/30 dark:bg-gray-900/95 safe-area-inset-bottom md:hidden">
          <div className="flex h-16 overflow-x-auto px-2 py-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory">
            {mainNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`group relative flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-150 min-w-[64px] flex-shrink-0 px-1 touch-manipulation snap-center ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-300'
                      : 'text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-150 ${
                      isActive
                        ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                        : 'border-slate-200 bg-slate-50 text-inherit group-hover:border-blue-300 group-hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:group-hover:border-blue-500/60 dark:group-hover:bg-slate-800'
                    }`}
                  >
                    <i className={`${item.icon} text-lg`}></i>
                  </span>
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wide whitespace-nowrap drop-shadow-sm leading-tight text-center">
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-0 h-0.5 w-8 rounded-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.45)]" />
                  )}
                </button>
              );
            })}
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              className="group relative flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-150 min-w-[64px] flex-shrink-0 px-1 touch-manipulation snap-center text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-inherit group-hover:border-blue-300 group-hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:group-hover:border-blue-500/60 dark:group-hover:bg-slate-800">
                <i className="ri-refresh-line text-lg"></i>
              </span>
              <span className="text-[0.65rem] font-semibold uppercase tracking-wide whitespace-nowrap drop-shadow-sm leading-tight text-center">
                Refresh
              </span>
            </button>
            {/* Dropdown Button */}
            <div className="relative dropdown-button">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`group relative flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-150 min-w-[64px] flex-shrink-0 px-1 touch-manipulation snap-center ${
                  isDropdownOpen
                    ? 'text-blue-600 dark:text-blue-300'
                    : 'text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300'
                }`}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-150 ${
                  isDropdownOpen
                    ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'border-slate-200 bg-slate-50 text-inherit group-hover:border-blue-300 group-hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:group-hover:border-blue-500/60 dark:group-hover:bg-slate-800'
                }`}>
                  <i className="ri-menu-line text-lg"></i>
                </span>
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide whitespace-nowrap drop-shadow-sm leading-tight text-center">
                  More
                </span>
              </button>
              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="dropdown-menu fixed bottom-20 right-2 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-h-[60vh] overflow-y-auto min-w-[200px]">
                  <div className="p-2">
                    {dropdownItems.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <button
                          key={item.path}
                          onClick={() => {
                            navigate(item.path);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                            isActive
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          <i className={`${item.icon} text-lg`}></i>
                          <span className="text-sm font-medium">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </nav>
      </>
    );
  }

  // Desktop/Tablet: Bottom navigation with main items + refresh + dropdown
  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-blue-200/60 bg-white/95 backdrop-blur-sm shadow-[0_-6px_18px_-12px_rgba(30,64,175,0.45)] dark:border-blue-400/30 dark:bg-gray-900/95">
        <div className="grid grid-cols-6 h-18 sm:h-20 px-2 sm:px-3 py-1.5 sm:py-2">
          {mainNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`group relative flex flex-col items-center justify-center gap-0.5 sm:gap-1 rounded-xl transition-all duration-150 touch-manipulation px-1 sm:px-2 ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-300'
                    : 'text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300'
                }`}
              >
                <span
                  className={`flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full border transition-all duration-150 ${
                    isActive
                      ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'border-slate-200 bg-slate-50 text-inherit group-hover:border-blue-300 group-hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:group-hover:border-blue-500/60 dark:group-hover:bg-slate-800'
                  }`}
                >
                  <i className={`${item.icon} text-lg sm:text-[1.35rem]`}></i>
                </span>
                <span className="text-[0.65rem] sm:text-[0.72rem] font-semibold uppercase tracking-wide whitespace-nowrap drop-shadow-sm leading-tight text-center">
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 h-0.5 sm:h-1 w-8 sm:w-10 rounded-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.45)]" />
                )}
              </button>
            );
          })}
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="group relative flex flex-col items-center justify-center gap-0.5 sm:gap-1 rounded-xl transition-all duration-150 px-1 sm:px-2 touch-manipulation text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300"
          >
            <span className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-inherit group-hover:border-blue-300 group-hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:group-hover:border-blue-500/60 dark:group-hover:bg-slate-800">
              <i className="ri-refresh-line text-lg sm:text-[1.35rem]"></i>
            </span>
            <span className="text-[0.65rem] sm:text-[0.72rem] font-semibold uppercase tracking-wide whitespace-nowrap drop-shadow-sm leading-tight text-center">
              Refresh
            </span>
          </button>
          {/* Dropdown Button */}
          <div className="relative dropdown-button">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`group relative flex flex-col items-center justify-center gap-0.5 sm:gap-1 rounded-xl transition-all duration-150 px-1 sm:px-2 touch-manipulation ${
                isDropdownOpen
                  ? 'text-blue-600 dark:text-blue-300'
                  : 'text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300'
              }`}
            >
              <span className={`flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full border transition-all duration-150 ${
                isDropdownOpen
                  ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'border-slate-200 bg-slate-50 text-inherit group-hover:border-blue-300 group-hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:group-hover:border-blue-500/60 dark:group-hover:bg-slate-800'
              }`}>
                <i className="ri-menu-line text-lg sm:text-[1.35rem]"></i>
              </span>
              <span className="text-[0.65rem] sm:text-[0.72rem] font-semibold uppercase tracking-wide whitespace-nowrap drop-shadow-sm leading-tight text-center">
                More
              </span>
            </button>
            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="dropdown-menu fixed bottom-20 right-4 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-h-[60vh] overflow-y-auto min-w-[220px]">
                <div className="p-2">
                  {dropdownItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <button
                        key={item.path}
                        onClick={() => {
                          navigate(item.path);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <i className={`${item.icon} text-lg`}></i>
                        <span className="text-sm font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
