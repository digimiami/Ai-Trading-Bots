
import { BrowserRouter } from 'react-router-dom';
import { Suspense, useEffect } from 'react';
import { useRoutes, useNavigate } from 'react-router-dom';
import routes from './router/config';
import { useAuth } from './hooks/useAuth';
import { useBotExecutor } from './hooks/useBotExecutor';

function AppRoutes() {
  const element = useRoutes(routes);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  // Initialize bot executor for automatic trading (only when user is logged in)
  useBotExecutor();

  useEffect(() => {
    if (!loading) {
      const isOnboardingCompleted = localStorage.getItem('onboarding_completed');
      const currentPath = window.location.pathname;
      
      if (!user && currentPath !== '/auth' && currentPath !== '/onboarding') {
        navigate('/auth');
      } else if (user && !isOnboardingCompleted && currentPath !== '/onboarding') {
        navigate('/onboarding');
      }
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-robot-line text-2xl text-blue-600 animate-pulse"></i>
          </div>
          <p className="text-gray-600">Loading Pablo...</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-loader-4-line text-2xl text-blue-600 animate-spin"></i>
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      {element}
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter basename={__BASE_PATH__}>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
