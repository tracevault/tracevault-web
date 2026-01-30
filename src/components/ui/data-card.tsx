'use client';

import { cn } from '@/lib/utils';

interface DataCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

/**
 * Data Card - Minimal bordered card with subtle hover
 * Based on: Data Dashboard Style Guide
 */
export function DataCard({ children, className, hover = true }: DataCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[#EEEEEE] bg-white p-4',
        hover && 'transition-shadow duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]',
        className
      )}
    >
      {children}
    </div>
  );
}

interface DataValueProps {
  value: string | number;
  label?: string;
  trend?: 'up' | 'down' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Data Value - Emphasized numerical display
 */
export function DataValue({
  value,
  label,
  trend,
  size = 'md',
  className,
}: DataValueProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  const trendColors = {
    up: 'text-[#22C55E]',
    down: 'text-[#EF4444]',
    neutral: 'text-black',
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div
        className={cn(
          'font-medium tabular-nums',
          sizeClasses[size],
          trend ? trendColors[trend] : 'text-black'
        )}
      >
        {value}
      </div>
      {label && (
        <div className="text-[11px] uppercase tracking-[0.5px] text-[#666666]">
          {label}
        </div>
      )}
    </div>
  );
}

interface DataRowProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Data Row - List item with bottom border
 */
export function DataRow({ children, className }: DataRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 border-b border-[#EEEEEE] px-6 py-4 last:border-b-0',
        className
      )}
    >
      {children}
    </div>
  );
}

interface StatusIndicatorProps {
  status: 'live' | 'success' | 'error' | 'pending';
  label?: string;
  className?: string;
}

/**
 * Status Indicator - Live/Success/Error state display
 */
export function StatusIndicator({
  status,
  label,
  className,
}: StatusIndicatorProps) {
  const statusStyles = {
    live: 'bg-[#22C55E] animate-pulse',
    success: 'bg-[#22C55E]',
    error: 'bg-[#EF4444]',
    pending: 'bg-[#999999]',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn('h-2 w-2 rounded-full', statusStyles[status])}
      />
      {label && <span className="text-sm text-[#666666]">{label}</span>}
    </div>
  );
}
