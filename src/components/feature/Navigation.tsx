
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.pathname);

  const tabs = [
    { id: '/', label: 'Dashboard', icon: 'ri-dashboard-line' },
    { id: '/bots', label: 'Bots', icon: 'ri-robot-line' },
    { id: '/trades', label: 'Trades', icon: 'ri-line-chart-line' },
    { id: '/settings', label: 'Settings', icon: 'ri-settings-line' }
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    navigate(tabId);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="grid grid-cols-4 h-16">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className={`${tab.icon} text-lg`}></i>
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
