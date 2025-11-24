
import { BrowserRouter } from 'react-router-dom';
import { Suspense, useEffect } from 'react';
import { useRoutes, useNavigate } from 'react-router-dom';
import routes from './router/config';
import { useAuth } from './hooks/useAuth';
import { useBotExecutor } from './hooks/useBotExecutor';
import { useSoundNotifications } from './hooks/useSoundNotifications';
import { ONBOARDING_ENABLED } from './constants/featureFlags';
import CookieConsent from './components/ui/CookieConsent';

function AppRoutes() {
  const element = useRoutes(routes);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
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
    if (!loading) {
      const isOnboardingCompleted = localStorage.getItem('onboarding_completed');
      const currentPath = window.location.pathname;
      const publicRoutes = ['/', '/auth', '/onboarding', '/market-dashboard'];
      
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
    </BrowserRouter>
  );
}

export default App;
