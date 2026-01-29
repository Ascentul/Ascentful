'use client';

import { cn } from '@/lib/utils';

interface BenchmarkInfo {
  nationalAverage: number;
  label?: string;
}

interface KPICardProps {
  title: string;
  value: number;
  subtitle?: string;
  format?: 'percentage' | 'number';
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  benchmark?: BenchmarkInfo;
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
  benchmark,
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

  // Calculate benchmark comparison
  const benchmarkComparison = benchmark
    ? {
        difference: value - benchmark.nationalAverage,
        isAbove: value > benchmark.nationalAverage + 2,
        isBelow: value < benchmark.nationalAverage - 2,
      }
    : null;

  return (
    <div
      className={cn(
        'rounded-card p-6 shadow-card transition-shadow hover:shadow-md',
        colors.bg,
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={cn('text-sm font-medium', colors.text)}>{title}</p>
          <p className={cn('mt-2 text-3xl font-semibold', colors.valueText)}>{formattedValue}</p>
          {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
          {benchmark && (
            <div className="mt-2 pt-2 border-t border-neutral-200/50">
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">{benchmark.label || 'NACE Avg'}:</span>
                <span className="text-xs font-medium text-neutral-600">
                  {format === 'percentage'
                    ? `${Number.isFinite(benchmark.nationalAverage) ? benchmark.nationalAverage.toFixed(1) : '0.0'}%`
                    : Number.isFinite(benchmark.nationalAverage)
                      ? benchmark.nationalAverage.toLocaleString()
                      : '0'}
                </span>
                {benchmarkComparison && (
                  <span
                    className={cn(
                      'text-xs font-medium px-1.5 py-0.5 rounded',
                      benchmarkComparison.isAbove && 'bg-green-100 text-green-700',
                      benchmarkComparison.isBelow && 'bg-red-100 text-red-700',
                      !benchmarkComparison.isAbove &&
                        !benchmarkComparison.isBelow &&
                        'bg-blue-100 text-blue-700',
                    )}
                  >
                    {benchmarkComparison.difference > 0 ? '+' : ''}
                    {format === 'percentage'
                      ? `${Number.isFinite(benchmarkComparison.difference) ? benchmarkComparison.difference.toFixed(1) : '0.0'}%`
                      : Number.isFinite(benchmarkComparison.difference)
                        ? benchmarkComparison.difference.toLocaleString()
                        : '0'}
                  </span>
                )}
              </div>
            </div>
          )}
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
