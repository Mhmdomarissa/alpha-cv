'use client';
import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      loadingText,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    
    const baseStyles = cn(
      'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95 rounded-md',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
      fullWidth && 'w-full'
    );
    
    const variants = {
      primary: cn(
        'bg-gradient-primary text-white shadow-xl shadow-blue-900/10',
        'hover:opacity-90 hover:shadow-2xl hover:shadow-blue-900/20',
        'focus:ring-blue-500',
        'active:bg-blue-800'
      ),
      secondary: cn(
        'bg-blue-50 text-blue-700',
        'hover:bg-blue-100',
        'focus:ring-blue-400',
        'active:bg-blue-200'
      ),
      ghost: cn(
        'text-gray-700 hover:bg-blue-50 hover:text-blue-600',
        'focus:ring-blue-400',
        'active:bg-blue-100'
      ),
      outline: cn(
        'border border-gray-300 text-gray-900 bg-white',
        'hover:bg-gray-50 hover:border-blue-400 hover:text-blue-600',
        'focus:ring-blue-500',
        'active:bg-blue-50'
      ),
    };
    
    const sizes = {
      xs: 'px-3 py-1.5 text-xs gap-1.5',
      sm: 'px-4 py-2 text-sm gap-2',
      md: 'px-6 py-3 text-base gap-2',
      lg: 'px-8 py-4 text-lg gap-3',
      xl: 'px-10 py-5 text-xl gap-4',
    };
    
    const renderIcon = (position: 'left' | 'right') => {
      const iconClasses = size === 'xs' ? 'w-3 h-3' : 
                        size === 'sm' ? 'w-3.5 h-3.5' : 
                        size === 'lg' ? 'w-5 h-5' : 
                        size === 'xl' ? 'w-6 h-6' : 'w-4 h-4';
      
      if (loading && position === 'left') {
        return <Loader2 className={`animate-spin ${iconClasses}`} />;
      }
      
      if (icon && iconPosition === position) {
        return (
          <span className={iconClasses}>
            {icon}
          </span>
        );
      }
      
      return null;
    };
    
    const content = loading && loadingText ? loadingText : children;
    
    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {renderIcon('left')}
        {content}
        {renderIcon('right')}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };