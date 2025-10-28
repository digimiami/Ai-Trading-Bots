
import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  title?: string;
}

export function Card({ children, className = '', padding = 'md', title }: CardProps) {
  const paddingClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${paddingClasses[padding]} ${className}`}>
      {title && (
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h2>
      )}
      {children}
    </div>
  );
}

export default Card;
