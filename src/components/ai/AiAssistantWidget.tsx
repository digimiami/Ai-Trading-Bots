import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const WIDGET_STORAGE_KEY = 'ai_assistant_widget_open';

export default function AiAssistantWidget() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(WIDGET_STORAGE_KEY);
      if (saved === 'true') {
        setIsOpen(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(WIDGET_STORAGE_KEY, isOpen ? 'true' : 'false');
    } catch {
      // ignore
    }
  }, [isOpen]);

  if (location.pathname.startsWith('/ai-assistant')) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group fixed bottom-32 right-4 sm:bottom-24 sm:right-6 z-[9998] flex items-center gap-3 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition px-4 py-3"
        aria-label="Open AI Assistant"
      >
        <i className="ri-robot-2-line text-xl"></i>
        <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm transition-all duration-200 group-hover:max-w-[200px] group-hover:opacity-100 opacity-0">
          AI Assistant
        </span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-3xl h-[75vh] sm:h-[80vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-full bg-white/90 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-white"
                aria-label="Close AI Assistant"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <iframe
              title="AI Assistant"
              src="/ai-assistant?embed=1"
              className="w-full h-full border-0"
            />
          </div>
        </div>
      )}
    </>
  );
}
