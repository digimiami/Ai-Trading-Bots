import React from 'react';

export interface GaugeData {
  sell: number;
  neutral: number;
  buy: number;
}

interface TechnicalGaugeProps {
  title: string;
  data: GaugeData;
  className?: string;
}

/**
 * Calculate the angle for the gauge needle based on Sell/Neutral/Buy values
 * Returns angle in degrees where:
 * - 180° = leftmost (Strong Sell)
 * - 90° = center (Neutral)
 * - 0° = rightmost (Strong Buy)
 */
const calculateGaugeAngle = (data: GaugeData): number => {
  const total = data.sell + data.neutral + data.buy;
  
  // Handle edge case where all values are 0
  if (total === 0) {
    return 90; // Point to neutral/center
  }
  
  // Calculate weighted score: -1 for sell, 0 for neutral, +1 for buy
  const score = (data.buy - data.sell) / total;
  
  // Map score from [-1, 1] to [180°, 0°]
  // score = -1 (all sell) -> 180° (leftmost)
  // score = 0 (neutral) -> 90° (center)
  // score = 1 (all buy) -> 0° (rightmost)
  const angle = 90 - (score * 90);
  
  return angle;
};

/**
 * Get the sentiment label and color based on the angle
 */
const getSentimentLabel = (angle: number): { label: string; color: string } => {
  if (angle >= 144) return { label: 'Strong Sell', color: '#ef4444' }; // 144-180°
  if (angle >= 108) return { label: 'Sell', color: '#f97316' }; // 108-144°
  if (angle >= 72) return { label: 'Neutral', color: '#8b5cf6' }; // 72-108°
  if (angle >= 36) return { label: 'Buy', color: '#22c55e' }; // 36-72°
  return { label: 'Strong Buy', color: '#10b981' }; // 0-36°
};

/**
 * Convert angle to point on arc
 */
const getPointOnArc = (angleDeg: number, radius: number = 80) => {
  const angleRad = (angleDeg * Math.PI) / 180;
  const centerX = 100;
  const centerY = 100;
  return {
    x: centerX + radius * Math.cos(angleRad),
    y: centerY - radius * Math.sin(angleRad)
  };
};

export const TechnicalGauge: React.FC<TechnicalGaugeProps> = ({ title, data, className = '' }) => {
  const angle = calculateGaugeAngle(data);
  const sentiment = getSentimentLabel(angle);
  const needlePoint = getPointOnArc(angle, 80);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">{title}</h3>
      
      {/* Gauge SVG */}
      <div className="relative w-full max-w-xs">
        <svg viewBox="0 0 200 120" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          <defs>
            {/* Gradient for segments */}
            <linearGradient id={`gradient-${title}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
          
          {/* Background arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#374151"
            strokeWidth="18"
            className="dark:stroke-gray-700"
          />
          
          {/* Colored segments */}
          {/* Strong Sell (180° - 144°) - Red */}
          <path
            d={`M ${getPointOnArc(180, 80).x} ${getPointOnArc(180, 80).y} A 80 80 0 0 1 ${getPointOnArc(144, 80).x} ${getPointOnArc(144, 80).y}`}
            fill="none"
            stroke="#ef4444"
            strokeWidth="18"
            strokeLinecap="round"
          />
          
          {/* Sell (144° - 108°) - Orange/Pink */}
          <path
            d={`M ${getPointOnArc(144, 80).x} ${getPointOnArc(144, 80).y} A 80 80 0 0 1 ${getPointOnArc(108, 80).x} ${getPointOnArc(108, 80).y}`}
            fill="none"
            stroke="#fb7185"
            strokeWidth="18"
            strokeLinecap="round"
          />
          
          {/* Neutral (108° - 72°) - Purple */}
          <path
            d={`M ${getPointOnArc(108, 80).x} ${getPointOnArc(108, 80).y} A 80 80 0 0 1 ${getPointOnArc(72, 80).x} ${getPointOnArc(72, 80).y}`}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="18"
            strokeLinecap="round"
          />
          
          {/* Buy (72° - 36°) - Light Green */}
          <path
            d={`M ${getPointOnArc(72, 80).x} ${getPointOnArc(72, 80).y} A 80 80 0 0 1 ${getPointOnArc(36, 80).x} ${getPointOnArc(36, 80).y}`}
            fill="none"
            stroke="#4ade80"
            strokeWidth="18"
            strokeLinecap="round"
          />
          
          {/* Strong Buy (36° - 0°) - Green */}
          <path
            d={`M ${getPointOnArc(36, 80).x} ${getPointOnArc(36, 80).y} A 80 80 0 0 1 ${getPointOnArc(0, 80).x} ${getPointOnArc(0, 80).y}`}
            fill="none"
            stroke="#10b981"
            strokeWidth="18"
            strokeLinecap="round"
          />
          
          {/* Needle */}
          <g className="transition-transform duration-500 ease-out">
            <line
              x1="100"
              y1="100"
              x2={needlePoint.x}
              y2={needlePoint.y}
              stroke="#f8fafc"
              strokeWidth="4"
              strokeLinecap="round"
              className="dark:stroke-gray-100"
            />
            {/* Needle tip */}
            <circle
              cx={needlePoint.x}
              cy={needlePoint.y}
              r="6"
              fill="#f8fafc"
              stroke="#1f2937"
              strokeWidth="2"
              className="dark:fill-gray-100 dark:stroke-gray-800"
            />
          </g>
          
          {/* Center pivot */}
          <circle cx="100" cy="100" r="5" fill="#1f2937" className="dark:fill-gray-300" />
          
          {/* Labels */}
          <text x="20" y="115" fontSize="9" fill="#9ca3af" className="dark:fill-gray-400" textAnchor="start">
            Strong sell
          </text>
          <text x="100" y="25" fontSize="9" fill="#9ca3af" className="dark:fill-gray-400" textAnchor="middle">
            Neutral
          </text>
          <text x="180" y="115" fontSize="9" fill="#9ca3af" className="dark:fill-gray-400" textAnchor="end">
            Strong buy
          </text>
        </svg>
        
        {/* Sentiment Label */}
        <div className="text-center mt-2">
          <div 
            className="text-2xl font-bold transition-colors duration-300"
            style={{ color: sentiment.color }}
          >
            {sentiment.label}
          </div>
        </div>
      </div>
      
      {/* Summary counts */}
      <div className="mt-4 flex items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-gray-500 dark:text-gray-400">Sell</span>
          <span className="font-semibold text-red-500">{data.sell}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500 dark:text-gray-400">Neutral</span>
          <span className="font-semibold text-purple-500">{data.neutral}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500 dark:text-gray-400">Buy</span>
          <span className="font-semibold text-green-500">{data.buy}</span>
        </div>
      </div>
    </div>
  );
};

export default TechnicalGauge;

