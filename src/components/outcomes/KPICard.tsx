'use client';

import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: number;
  subtitle?: string;
  format?: 'percentage' | 'number';
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  className?: string;
  colorScheme?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
}

const colorSchemes = {
  primary: {
    bg: 'bg-primary-50',
    text: 'text-primary-700',
    valueText: 'text-primary-900',
  },
  success: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    valueText: 'text-green-900',
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    valueText: 'text-amber-900',
  },
  danger: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    valueText: 'text-red-900',
  },
  neutral: {
    bg: 'bg-white',
    text: 'text-neutral-600',
    valueText: 'text-neutral-900',
  },
};

export function KPICard({
  title,
  value,
  subtitle,
  format = 'percentage',
  trend,
  className,
  colorScheme = 'neutral',
}: KPICardProps) {
  const colors = colorSchemes[colorScheme];

  const formattedValue =
    format === 'percentage'
      ? `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`
      : Number.isFinite(value)
        ? value.toLocaleString()
        : '0';

  return (
    <div
      className={cn(
        'rounded-card p-6 shadow-card transition-shadow hover:shadow-md',
        colors.bg,
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={cn('text-sm font-medium', colors.text)}>{title}</p>
          <p className={cn('mt-2 text-3xl font-semibold', colors.valueText)}>{formattedValue}</p>
          {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
        </div>
        {trend && (
          <div
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-medium',
              trend.direction === 'up' && 'bg-green-100 text-green-800',
              trend.direction === 'down' && 'bg-red-100 text-red-800',
              trend.direction === 'neutral' && 'bg-neutral-100 text-neutral-600',
            )}
          >
            {trend.direction === 'up' && '+'}
            {trend.direction === 'down' && '-'}
            {Number.isFinite(trend.value) ? Math.abs(trend.value).toFixed(1) : '0.0'}%
          </div>
        )}
      </div>
    </div>
  );
}

interface KPICardGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function KPICardGroup({ children, className }: KPICardGroupProps) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', className)}>
      {children}
    </div>
  );
}
