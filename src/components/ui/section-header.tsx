'use client';

import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  marker?: '●' | '◆' | '★' | '▶';
  meta?: string;
  className?: string;
}

/**
 * Section Header - Data Dashboard Style
 * Black bar with white text, full width section divider
 * Based on: Human Labs Oculus design pattern
 */
export function SectionHeader({
  title,
  marker = '●',
  meta,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between bg-black px-6 py-3 text-white',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm opacity-80">[{marker}]</span>
        <span className="text-sm font-semibold uppercase tracking-wide">
          {title}
        </span>
      </div>
      {meta && (
        <span className="text-xs text-white/60">{meta}</span>
      )}
    </div>
  );
}
