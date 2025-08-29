'use client';
import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'ghost' | 'outline' | 'gradient';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  rounded?: boolean;
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
      rounded = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    
    const baseStyles = cn(
      'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
      fullWidth && 'w-full',
      rounded ? 'rounded-full' : 'rounded-lg'
    );
    
    const variants = {
      primary: cn(
        'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-sm',
        'hover:from-primary-700 hover:to-primary-800 hover:shadow-md',
        'focus:ring-primary-500',
        'active:from-primary-800 active:to-primary-900'
      ),
      secondary: cn(
        'bg-neutral-100 text-neutral-900 border border-neutral-200',
        'hover:bg-neutral-200 hover:border-neutral-300',
        'focus:ring-neutral-500',
        'active:bg-neutral-300'
      ),
      success: cn(
        'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-sm',
        'hover:from-green-700 hover:to-green-800 hover:shadow-md',
        'focus:ring-green-500',
        'active:from-green-800 active:to-green-900'
      ),
      warning: cn(
        'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-sm',
        'hover:from-yellow-600 hover:to-yellow-700 hover:shadow-md',
        'focus:ring-yellow-500',
        'active:from-yellow-700 active:to-yellow-800'
      ),
      error: cn(
        'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-sm',
        'hover:from-red-600 hover:to-red-700 hover:shadow-md',
        'focus:ring-red-500',
        'active:from-red-700 active:to-red-800'
      ),
      ghost: cn(
        'text-neutral-700 hover:bg-neutral-100',
        'focus:ring-neutral-500',
        'active:bg-neutral-200'
      ),
      outline: cn(
        'border border-neutral-300 text-neutral-700 bg-transparent',
        'hover:bg-neutral-50 hover:border-neutral-400',
        'focus:ring-neutral-500',
        'active:bg-neutral-100'
      ),
      gradient: cn(
        'bg-gradient-to-r from-primary-600 via-purple-600 to-green-500 text-white shadow-lg',
        'hover:shadow-xl hover:scale-105',
        'focus:ring-primary-500',
        'active:scale-95'
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