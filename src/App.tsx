
import { BrowserRouter } from 'react-router-dom';
import { Suspense, useEffect } from 'react';
import { useRoutes, useNavigate, useLocation } from 'react-router-dom';
import routes from './router/config';
import { useAuth } from './hooks/useAuth';
import { useBotExecutor } from './hooks/useBotExecutor';
import { useSoundNotifications } from './hooks/useSoundNotifications';
import { ONBOARDING_ENABLED } from './constants/featureFlags';
import CookieConsent from './components/ui/CookieConsent';
import PopupDisplay from './components/ui/PopupDisplay';
import { supabase } from './lib/supabase';
import { sendDebugTelemetry } from './utils/debugTelemetry';

function AppRoutes() {
  // #region agent log
  sendDebugTelemetry('1d699810-8c68-443d-8f9c-b629f3dcc932', {
    location: 'App.tsx:14',
    message: 'AppRoutes function entry',
    data: {},
    runId: 'pre-fix',
    hypothesisId: 'A'
  });
  // #endregion
  const element = useRoutes(routes);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Initialize bot executor for automatic trading (only when user is logged in)
  useBotExecutor();
  
  // Initialize sound notifications for real trades
  useSoundNotifications();

  // Load appearance settings from localStorage on mount
  useEffect(() => {
    try {
    const savedSettings = localStorage.getItem('appearance_settings');
    if (savedSettings) {
      const appearance = JSON.parse(savedSettings);
        const theme = appearance?.theme || 'light';
        const fontSize = appearance?.fontSize || 'medium';
        const density = appearance?.density || 'comfortable';
        const compactMode = appearance?.compactMode || false;
        
        // Remove all theme classes first
        document.documentElement.classList.remove('dark', 'theme-blue', 'theme-green', 'theme-purple', 'theme-orange');
        document.body.classList.remove('dark', 'theme-blue', 'theme-green', 'theme-purple', 'theme-orange');
        
        // Apply theme
        if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
        } else if (theme !== 'light' && ['blue', 'green', 'purple', 'orange'].includes(theme)) {
          document.documentElement.classList.add(`theme-${theme}`);
          document.body.classList.add(`theme-${theme}`);
        }
        
        // Apply font size
        document.documentElement.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
        document.documentElement.classList.add(`font-size-${fontSize}`);
        
        // Apply density
        document.documentElement.classList.remove('density-compact', 'density-comfortable', 'density-spacious');
        document.documentElement.classList.add(`density-${density}`);
        
        // Apply compact mode
        if (compactMode) {
          document.documentElement.classList.add('compact-mode');
        } else {
          document.documentElement.classList.remove('compact-mode');
        }
      }
    } catch (error) {
      console.error('Error loading appearance settings from localStorage:', error);
      // Clear invalid data
      localStorage.removeItem('appearance_settings');
    }
  }, []);

  useEffect(() => {
    if (!loading && user) {
      const checkSetupWizard = async () => {
        try {
          // Wait a bit for user profile to be created by trigger
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            console.log('⚠️ No session found, skipping wizard check');
            return;
          }

          // Check if setup wizard is completed
          const { data: userData, error } = await supabase
            .from('users')
            .select('setup_wizard_completed')
            .eq('id', user.id)
            .single();

          if (error && error.code !== 'PGRST116') {
            console.warn('⚠️ Failed to check wizard status:', error);
            return;
          }

          const wizardCompleted = userData?.setup_wizard_completed || false;
          const currentPath = window.location.pathname;
          const wizardRoutes = ['/onboarding', '/auth'];
          const publicRoutes = ['/', '/market-dashboard', '/crypto-bubbles', '/crypto-news', '/contact', '/pricing', '/privacy', '/terms', '/risk', '/cookies', '/disclaimer', '/adwords', '/t/*'];
          
          console.log('🔍 Setup wizard check:', { 
            wizardCompleted, 
            currentPath, 
            isWizardRoute: wizardRoutes.includes(currentPath),
            isPublicRoute: publicRoutes.some(route => currentPath === route || currentPath.startsWith(route))
          });
          
          // If wizard not completed and not already on wizard/auth/public pages, redirect to onboarding
          if (!wizardCompleted && !wizardRoutes.includes(currentPath) && !publicRoutes.some(route => currentPath === route || currentPath.startsWith(route))) {
            console.log('🔄 Setup wizard not completed, redirecting to onboarding');
            navigate('/onboarding', { replace: true });
            return;
          }
        } catch (error) {
          console.error('❌ Error checking setup wizard status:', error);
          // Don't block navigation on error
        }
      };

      // Only check on first load, not on every route change
      const hasCheckedWizard = sessionStorage.getItem('setupWizardChecked');
      if (!hasCheckedWizard) {
        console.log('🔄 Starting setup wizard check...');
        checkSetupWizard();
        sessionStorage.setItem('setupWizardChecked', 'true');
      } else {
        console.log('✅ Setup wizard already checked, skipping');
      }
    } else if (!loading && !user) {
      // Clear the check flag when user logs out
      sessionStorage.removeItem('setupWizardChecked');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading) {
      const currentPath = window.location.pathname;
      const publicRoutes = ['/', '/auth', '/onboarding', '/market-dashboard', '/crypto-bubbles', '/crypto-news', '/contact', '/pricing', '/privacy', '/terms', '/risk', '/cookies', '/disclaimer', '/adwords'];
      
      // Tracking redirect routes are public (allow redirects without auth)
      const isTrackingRedirect = currentPath.startsWith('/t/');
      const isPublicRoute = publicRoutes.includes(currentPath) || isTrackingRedirect;
      
      // Only redirect if we're certain about auth state
      if (user === null && !isPublicRoute) {
        console.log('🔄 No user, redirecting to auth');
        navigate('/auth', { replace: true });
      } else if (user && currentPath === '/') {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    // Remove AI Workers widget if not on homepage
    const isHomepage = location.pathname === '/';
    if (!isHomepage) {
      // Remove script tags
      const scripts = document.querySelectorAll('script[src*="aiworkers.vip"]');
      scripts.forEach(script => {
        try {
          script.parentNode?.removeChild(script);
        } catch (e) {
          // Ignore errors
        }
      });
      
      // Remove widget containers (common patterns for chat widgets)
      const widgetSelectors = [
        '[id*="aiworkers"]',
        '[class*="aiworkers"]',
        '[data-aiworkers]',
        '[id*="widget-chat"]',
        '[class*="widget-chat"]',
        'iframe[src*="aiworkers"]'
      ];
      
      widgetSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            try {
              el.parentNode?.removeChild(el);
            } catch (e) {
              // Ignore errors
            }
          });
        } catch (e) {
          // Ignore selector errors
        }
      });
    }
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-robot-line text-2xl text-blue-600 dark:text-blue-400 animate-pulse"></i>
          </div>
          <p className="text-gray-600 dark:text-gray-400">Loading Pablo...</p>
        </div>
      </div>
    );
  }

  // #region agent log
  sendDebugTelemetry('1d699810-8c68-443d-8f9c-b629f3dcc932', {
    location: 'App.tsx:198',
    message: 'AppRoutes return - before Suspense render',
    data: { loading, hasUser: !!user, pathname: location.pathname },
    runId: 'pre-fix',
    hypothesisId: 'B'
  });
  // #endregion
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-loader-4-line text-2xl text-blue-600 dark:text-blue-400 animate-spin"></i>
          </div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      {element}
    </Suspense>
  );
}

// Define base path - use window global or Vite's BASE_URL or default to '/'
declare global {
  interface Window {
    __BASE_PATH__?: string;
  }
}

const BASE_PATH = (typeof window !== 'undefined' && window.__BASE_PATH__) || import.meta.env.BASE_URL || '/';

function App() {
  return (
    <BrowserRouter basename={BASE_PATH}>
      <AppRoutes />
      <CookieConsent 
        onAccept={() => {
          console.log('✅ User accepted cookies');
          // Enable analytics tracking here if needed
        }}
        onDecline={() => {
          console.log('❌ User declined cookies');
          // Disable analytics tracking here if needed
        }}
      />
      <PopupDisplay />
    </BrowserRouter>
  );
}

export default App;
