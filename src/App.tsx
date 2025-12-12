
import { BrowserRouter } from 'react-router-dom';
import { Suspense, useEffect, useState } from 'react';
import { useRoutes, useNavigate, useLocation } from 'react-router-dom';
import routes from './router/config';
import { useAuth } from './hooks/useAuth';
import { useBotExecutor } from './hooks/useBotExecutor';
import { useSoundNotifications } from './hooks/useSoundNotifications';
import { ONBOARDING_ENABLED } from './constants/featureFlags';
import CookieConsent from './components/ui/CookieConsent';
import PopupDisplay from './components/ui/PopupDisplay';
import { supabase } from './lib/supabase';

function AppRoutes() {
  const element = useRoutes(routes);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Use key to force remount on route change (fixes lazy loading issues)
  // MUST be called before any conditional returns (Rules of Hooks)
  const [key, setKey] = useState(0);
  
  // Initialize bot executor for automatic trading (only when user is logged in)
  useBotExecutor();
  
  // Initialize sound notifications for real trades
  useSoundNotifications();

  // Load theme from localStorage on mount
  useEffect(() => {
    try {
    const savedSettings = localStorage.getItem('appearance_settings');
    if (savedSettings) {
      const appearance = JSON.parse(savedSettings);
        const theme = appearance?.theme || 'light';
        
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
      }
    } catch (error) {
      console.error('Error loading theme from localStorage:', error);
      // Clear invalid data
      localStorage.removeItem('appearance_settings');
    }
  }, []);

  useEffect(() => {
    if (!loading && user) {
      const checkFirstTimeLogin = async () => {
        try {
          // Wait a bit for user profile to be created by trigger
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Check if user has API keys configured
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            console.log('⚠️ No session found, skipping API key check');
            return;
          }

          const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
          const response = await fetch(`${supabaseUrl}/functions/v1/api-keys/list`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            const hasApiKeys = data.apiKeys && data.apiKeys.length > 0;
            const currentPath = window.location.pathname;
            const settingsRoutes = ['/settings', '/auth', '/onboarding'];
            const publicRoutes = ['/', '/market-dashboard', '/crypto-bubbles', '/crypto-news', '/contact', '/pricing'];
            
            console.log('🔍 First-time login check:', { 
              hasApiKeys, 
              currentPath, 
              isSettingsRoute: settingsRoutes.includes(currentPath),
              isPublicRoute: publicRoutes.includes(currentPath)
            });
            
            // If no API keys and not already on settings/auth/onboarding/public pages, redirect to settings
            if (!hasApiKeys && !settingsRoutes.includes(currentPath) && !publicRoutes.includes(currentPath)) {
              console.log('🔄 First-time user detected (no API keys), redirecting to settings');
              navigate('/settings', { replace: true });
              return;
            }
          } else {
            console.warn('⚠️ Failed to check API keys:', response.status, response.statusText);
          }
        } catch (error) {
          console.error('❌ Error checking API keys for first-time login:', error);
          // Don't block navigation on error
        }
      };

      // Only check on first load, not on every route change
      const hasCheckedFirstTime = sessionStorage.getItem('firstTimeLoginChecked');
      if (!hasCheckedFirstTime) {
        console.log('🔄 Starting first-time login check...');
        checkFirstTimeLogin();
        sessionStorage.setItem('firstTimeLoginChecked', 'true');
      } else {
        console.log('✅ First-time login already checked, skipping');
      }
    } else if (!loading && !user) {
      // Clear the check flag when user logs out
      sessionStorage.removeItem('firstTimeLoginChecked');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading) {
      const isOnboardingCompleted = localStorage.getItem('onboarding_completed');
      const currentPath = window.location.pathname;
      const publicRoutes = ['/', '/auth', '/onboarding', '/market-dashboard', '/crypto-bubbles', '/crypto-news', '/contact'];
      
      if (!ONBOARDING_ENABLED && !isOnboardingCompleted) {
        localStorage.setItem('onboarding_completed', 'true');
      }
      
      // Only redirect if we're certain about auth state
      if (user === null && !publicRoutes.includes(currentPath)) {
        console.log('🔄 No user, redirecting to auth');
        navigate('/auth', { replace: true });
      } else if (user && currentPath === '/') {
        navigate('/dashboard', { replace: true });
      } else if (user && ONBOARDING_ENABLED && !isOnboardingCompleted && currentPath !== '/onboarding') {
        console.log('🔄 User logged in but onboarding not completed, redirecting to onboarding');
        navigate('/onboarding', { replace: true });
      }
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    // Force remount on route change
    setKey(prev => prev + 1);
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
      <div key={key}>
        {element}
      </div>
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
