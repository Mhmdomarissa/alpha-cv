'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
}

const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, variant = 'default', size = 'md', showValue = false, ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    
    const variants = {
      default: 'bg-primary-600',
      success: 'bg-success-600',
      warning: 'bg-warning-500',
      error: 'bg-error-600',
    };

    const sizes = {
      sm: 'h-1',
      md: 'h-2',
      lg: 'h-3',
    };

    return (
      <div className="w-full">
        {showValue && (
          <div className="flex justify-between text-sm mb-1">
            <span className="text-secondary-700">Progress</span>
            <span className="text-secondary-700">{Math.round(percentage)}%</span>
          </div>
        )}
        <div
          ref={ref}
          className={cn(
            'w-full bg-secondary-200 rounded-full overflow-hidden',
            sizes[size],
            className
          )}
          {...props}
        >
          <div
            className={cn(
              'h-full transition-all duration-300 ease-in-out rounded-full',
              variants[variant]
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);

Progress.displayName = 'Progress';

export { Progress };