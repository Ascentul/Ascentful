'use client';

/**
 * MetricCard - Clickable stat card for Today page
 *
 * Displays a metric with optional click behavior to scroll to
 * a section or change tab state.
 */

import { LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
  isLoading?: boolean;
}

const variantStyles = {
  default: 'bg-slate-50 text-slate-700 border-slate-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
};

const iconVariantStyles = {
  default: 'text-slate-500',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  danger: 'text-red-500',
};

export function MetricCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
  onClick,
  isLoading,
}: MetricCardProps) {
  if (isLoading) {
    return (
      <Card className={cn('py-5 px-5 border transition-colors', variantStyles.default)}>
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded bg-slate-200 animate-pulse" />
          <div className="h-5 w-8 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'py-5 px-5 border transition-all',
        variantStyles[variant],
        onClick && 'cursor-pointer hover:shadow-md hover:scale-[1.02]',
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-center gap-3">
        <Icon className={cn('h-4 w-4 flex-shrink-0', iconVariantStyles[variant])} />
        <p className="text-xl font-semibold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}
