'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive' | 'outline' | 'gradient';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  hover?: boolean;
  loading?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant = 'default',
      padding = 'md',
      rounded = 'lg',
      shadow = 'sm',
      hover = false,
      loading = false,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = cn(
      'bg-white border transition-all duration-200',
      loading && 'animate-pulse'
    );

    const variants = {
      default: 'border-neutral-200',
      elevated: 'border-neutral-200 shadow-lg hover:shadow-xl',
      interactive: cn(
        'border-neutral-200 cursor-pointer',
        'hover:border-primary-300 hover:shadow-lg',
        'active:scale-98'
      ),
      outline: 'border-neutral-300 shadow-none',
      gradient: cn(
        'border-0 bg-gradient-to-br from-white via-primary-50/30 to-accent-50/30',
        'shadow-lg hover:shadow-xl'
      ),
    };

    const paddings = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
      xl: 'p-10',
    };

    const roundedStyles = {
      sm: 'rounded-md',
      md: 'rounded-lg',
      lg: 'rounded-xl',
      xl: 'rounded-2xl',
      full: 'rounded-full',
    };

    const shadows = {
      none: 'shadow-none',
      sm: 'shadow-sm',
      md: 'shadow-md',
      lg: 'shadow-lg',
      xl: 'shadow-xl',
    };

    const hoverEffect = hover ? 'hover:shadow-md hover:-translate-y-0.5' : '';

    return (
      <div
        className={cn(
          baseStyles,
          variants[variant],
          paddings[padding],
          roundedStyles[rounded],
          shadows[shadow],
          hoverEffect,
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 pb-6', className)}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-heading-3 font-semibold leading-none tracking-tight text-neutral-900', className)}
      {...props}
    >
      {children}
    </h3>
  )
);
CardTitle.displayName = 'CardTitle';

const CardSubtitle = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-neutral-600 leading-relaxed', className)}
      {...props}
    />
  )
);
CardSubtitle.displayName = 'CardSubtitle';

const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('space-y-4', className)}
      {...props}
    />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center justify-between pt-6 border-t border-neutral-100', className)}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';

// Specialized Card Components
const StatsCard = forwardRef<HTMLDivElement, CardProps & {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
}>(({ title, value, subtitle, icon, trend, className, ...props }, ref) => (
  <Card
    ref={ref}
    variant="elevated"
    className={cn('relative overflow-hidden', className)}
    {...props}
  >
    {icon && (
      <div className="absolute top-4 right-4 p-2 bg-primary-100 rounded-lg">
        <span className="w-5 h-5 text-primary-600 block">
          {icon}
        </span>
      </div>
    )}
    
    <CardContent className="space-y-2">
      <h3 className="text-sm font-medium text-neutral-600">{title}</h3>
      <div className="text-3xl font-bold text-neutral-900">{value}</div>
      {subtitle && (
        <p className="text-sm text-neutral-500">{subtitle}</p>
      )}
      {trend && (
        <div className="flex items-center space-x-1">
          <span className={cn(
            'text-sm font-medium',
            trend.positive ? 'text-accent-600' : 'text-red-600'
          )}>
            {trend.positive ? '+' : ''}{trend.value}%
          </span>
          <span className="text-sm text-neutral-500">{trend.label}</span>
        </div>
      )}
    </CardContent>
  </Card>
));
StatsCard.displayName = 'StatsCard';

export {
  Card,
  CardHeader,
  CardTitle,
  CardSubtitle,
  CardContent,
  CardFooter,
  StatsCard,
};
