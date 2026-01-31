import { type LucideIcon, TrendingDown, TrendingUp } from 'lucide-react';

import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number; // percentage
    direction: 'up' | 'down';
  };
  onClick?: () => void;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, trend, onClick, className }: StatCardProps) {
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl border border-slate-200 p-6 shadow-sm',
        isClickable && 'cursor-pointer hover:border-slate-300 hover:shadow-md transition-all',
        className,
      )}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {Icon && (
            <div className="p-2 bg-slate-100 rounded-lg">
              <Icon className="h-5 w-5 text-slate-600" />
            </div>
          )}
          {trend && (
            <div
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                trend.direction === 'up'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700',
              )}
            >
              {trend.direction === 'up' ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{trend.value}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
