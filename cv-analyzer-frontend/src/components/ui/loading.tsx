'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2, FileText, Database, BarChart3 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  return (
    <Loader2 className={cn('animate-spin text-primary-600', sizes[size], className)} />
  );
}

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular' | 'avatar';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({ 
  className, 
  variant = 'rectangular',
  width,
  height,
  lines = 1,
}: SkeletonProps) {
  const baseStyles = 'animate-pulse bg-gradient-to-r from-neutral-200 via-neutral-300 to-neutral-200 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]';

  const variants = {
    text: 'h-4 rounded',
    rectangular: 'rounded-lg',
    circular: 'rounded-full',
    avatar: 'rounded-full w-10 h-10',
  };

  const style = {
    width: width,
    height: height,
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(
              baseStyles,
              variants.text,
              index === lines - 1 && 'w-3/4', // Last line is shorter
              className
            )}
            style={{ width: index === lines - 1 ? '75%' : width }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(baseStyles, variants[variant], className)}
      style={style}
    />
  );
}

interface LoadingCardProps {
  className?: string;
  type?: 'cv' | 'jd' | 'match' | 'stats';
  count?: number;
}

export function LoadingCard({ className, type = 'cv', count = 1 }: LoadingCardProps) {
  const renderCard = () => (
    <div className={cn('bg-white border border-neutral-200 rounded-xl p-6 space-y-4', className)}>
      <div className="flex items-start space-x-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
        </div>
      </div>
      
      <div className="space-y-3">
        <Skeleton variant="text" lines={2} />
        <div className="flex space-x-2">
          <Skeleton variant="rectangular" width={60} height={24} />
          <Skeleton variant="rectangular" width={80} height={24} />
          <Skeleton variant="rectangular" width={70} height={24} />
        </div>
      </div>
    </div>
  );

  if (count === 1) {
    return renderCard();
  }

  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>{renderCard()}</div>
      ))}
    </div>
  );
}

interface LoadingPageProps {
  title?: string;
  subtitle?: string;
  type?: 'upload' | 'database' | 'results' | 'system';
}

export function LoadingPage({ title, subtitle, type = 'database' }: LoadingPageProps) {
  const getIcon = () => {
    switch (type) {
      case 'upload':
        return <FileText className="w-8 h-8 text-primary-600" />;
      case 'database':
        return <Database className="w-8 h-8 text-primary-600" />;
      case 'results':
        return <BarChart3 className="w-8 h-8 text-primary-600" />;
      default:
        return <LoadingSpinner size="lg" />;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6 animate-fade-in">
      <div className="flex flex-col items-center space-y-4">
        <div className="p-4 bg-primary-100 rounded-2xl">
          {getIcon()}
        </div>
        
        <div className="text-center space-y-2">
          <h3 className="text-heading-3 font-semibold text-neutral-900">
            {title || 'Loading...'}
          </h3>
          {subtitle && (
            <p className="text-neutral-600 max-w-md">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Animated dots */}
      <div className="flex space-x-1">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="w-2 h-2 bg-primary-400 rounded-full animate-pulse"
            style={{
              animationDelay: `${index * 0.2}s`,
              animationDuration: '1s',
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  label?: string;
}

export function ProgressBar({
  value,
  max = 100,
  className,
  size = 'md',
  variant = 'default',
  showLabel = false,
  label,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const variants = {
    default: 'bg-primary-600',
    success: 'bg-accent-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  return (
    <div className="space-y-2">
      {(showLabel || label) && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-neutral-700">{label}</span>
          <span className="text-neutral-500">{Math.round(percentage)}%</span>
        </div>
      )}
      
      <div className={cn('w-full bg-neutral-200 rounded-full overflow-hidden', sizes[size], className)}>
        <div
          className={cn('h-full transition-all duration-500 ease-out rounded-full', variants[variant])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function PulsingDot({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <div className="w-2 h-2 bg-accent-500 rounded-full"></div>
      <div className="absolute inset-0 w-2 h-2 bg-accent-500 rounded-full animate-ping opacity-75"></div>
    </div>
  );
}
