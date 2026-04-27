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
    <Loader2 className={cn('animate-spin text-neutral-900', sizes[size], className)} />
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
  const baseStyles = 'animate-shimmer bg-neutral-100/80';

  const variants = {
    text: 'h-4 rounded',
    rectangular: 'rounded-md',
    circular: 'rounded-full',
    avatar: 'rounded-full w-10 h-10',
  };

  const style = {
    width: width,
    height: height,
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(
              baseStyles,
              variants.text,
              index === lines - 1 && 'w-2/3', // Last line is shorter
              className
            )}
            style={{ width: index === lines - 1 ? '66%' : width }}
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
    <div className={cn('bg-white border border-neutral-200 rounded-lg p-6 space-y-5 shadow-sm', className)}>
      <div className="flex items-start space-x-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" height={18} />
          <Skeleton variant="text" width="40%" />
        </div>
      </div>
      
      <div className="space-y-4">
        <Skeleton variant="text" lines={2} />
        <div className="flex space-x-3 pt-2 border-t border-neutral-100">
          <Skeleton variant="rectangular" width={60} height={28} />
          <Skeleton variant="rectangular" width={80} height={28} />
          <Skeleton variant="rectangular" width={70} height={28} />
        </div>
      </div>
    </div>
  );

  if (count === 1) {
    return renderCard();
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col space-y-4">
        <Skeleton variant="text" width="200px" height={32} />
        <Skeleton variant="text" width="350px" height={20} />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center space-x-4">
              <Skeleton variant="circular" width={48} height={48} />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" width="70%" height={20} />
                <Skeleton variant="text" width="40%" height={16} />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton variant="text" lines={3} />
            </div>
            <div className="flex gap-2 pt-4 border-t border-neutral-100">
              <Skeleton variant="rectangular" width={80} height={32} className="rounded-lg" />
              <Skeleton variant="rectangular" width={80} height={32} className="rounded-lg" />
            </div>
          </div>
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
    default: 'bg-neutral-900',
    success: 'bg-neutral-900',
    warning: 'bg-neutral-900',
    error: 'bg-red-600',
  };

  return (
    <div className="space-y-2">
      {(showLabel || label) && (
        <div className="flex justify-between items-center text-sm font-medium">
          <span className="text-neutral-900">{label}</span>
          <span className="text-neutral-500">{Math.round(percentage)}%</span>
        </div>
      )}
      
      <div className={cn('w-full bg-neutral-100 rounded-full overflow-hidden', sizes[size], className)}>
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
    <div className={cn('relative flex items-center justify-center', className)}>
      <div className="w-2.5 h-2.5 bg-neutral-900 rounded-full"></div>
      <div className="absolute inset-0 w-2.5 h-2.5 bg-neutral-900 rounded-full animate-ping opacity-75"></div>
    </div>
  );
}
