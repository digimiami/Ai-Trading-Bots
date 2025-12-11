import { useState } from 'react';

interface HelpTooltipProps {
  text: string;
  className?: string;
}

export default function HelpTooltip({ text, className = '' }: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        className="ml-1 text-blue-500 hover:text-blue-700 focus:outline-none"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        aria-label="Help"
      >
        <i className="ri-question-line text-sm"></i>
      </button>
      {isVisible && (
        <div className="absolute z-50 w-64 p-3 text-xs text-white bg-gray-900 rounded-lg shadow-lg bottom-full left-1/2 transform -translate-x-1/2 mb-2">
          <div className="whitespace-normal">{text}</div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}
    </div>
  );
}










