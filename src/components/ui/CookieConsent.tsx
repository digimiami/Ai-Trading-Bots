import { useState, useEffect } from 'react';

interface CookieConsentProps {
  onAccept?: () => void;
  onDecline?: () => void;
}

export default function CookieConsent({ onAccept, onDecline }: CookieConsentProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const cookieConsent = localStorage.getItem('cookie_consent');
    if (!cookieConsent) {
      // Show popup after a short delay for better UX
      setTimeout(() => setIsVisible(true), 1000);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    localStorage.setItem('cookie_consent_date', new Date().toISOString());
    setIsVisible(false);
    if (onAccept) onAccept();
  };

  const handleDecline = () => {
    localStorage.setItem('cookie_consent', 'declined');
    localStorage.setItem('cookie_consent_date', new Date().toISOString());
    setIsVisible(false);
    if (onDecline) onDecline();
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity" />
      
      {/* Cookie Consent Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 animate-slide-up">
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <i className="ri-cookie-line text-2xl text-blue-600 dark:text-blue-400"></i>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  We Value Your Privacy
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  We use cookies to enhance your browsing experience and analyze our traffic. 
                  By clicking "Accept All", you consent to our use of cookies.
                </p>
              </div>
            </div>

            {/* Cookie Details (Collapsible) */}
            {showDetails && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="space-y-4">
                  {/* Essential Cookies */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <i className="ri-shield-check-line text-green-600"></i>
                        Essential Cookies
                      </h4>
                      <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded">
                        Always Active
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Required for basic site functionality, authentication, and security. Cannot be disabled.
                    </p>
                    <ul className="mt-2 text-xs text-gray-500 dark:text-gray-500 list-disc list-inside">
                      <li>User authentication tokens</li>
                      <li>Session management</li>
                      <li>Security preferences</li>
                    </ul>
                  </div>

                  {/* Analytics Cookies */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <i className="ri-bar-chart-line text-blue-600"></i>
                        Analytics Cookies
                      </h4>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Used to understand how visitors use our website.
                    </p>
                    <ul className="mt-2 text-xs text-gray-500 dark:text-gray-500 list-disc list-inside">
                      <li>Google Analytics</li>
                      <li>Page views and click data</li>
                      <li>Device/browser information</li>
                    </ul>
                  </div>

                  {/* Performance Cookies */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <i className="ri-speed-line text-purple-600"></i>
                        Performance Cookies
                      </h4>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Help us improve website performance and user experience.
                    </p>
                    <ul className="mt-2 text-xs text-gray-500 dark:text-gray-500 list-disc list-inside">
                      <li>Error tracking and reporting</li>
                      <li>Load time optimization</li>
                      <li>Feature usage statistics</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                <i className={`ri-${showDetails ? 'arrow-up' : 'arrow-down'}-s-line`}></i>
                {showDetails ? 'Hide Details' : 'Cookie Details'}
              </button>
              
              <div className="flex gap-3 flex-1">
                <button
                  onClick={handleDecline}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors"
                >
                  Decline
                </button>
                
                <button
                  onClick={handleAccept}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors shadow-lg shadow-blue-500/20"
                >
                  Accept All
                </button>
              </div>
            </div>

            {/* Privacy Policy Link */}
            <div className="mt-4 text-center">
              <a
                href="/privacy-policy"
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Learn more in our Privacy Policy
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-up animation styles */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
      `}</style>
    </>
  );
}

