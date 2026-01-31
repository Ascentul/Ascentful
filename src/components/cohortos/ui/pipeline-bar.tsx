'use client';

import { type Status, STATUS_CONFIG } from '@/lib/cohortos/types';
import { cn } from '@/lib/utils';

interface PipelineStats {
  searching: number;
  applying: number;
  interviewing: number;
  offered: number;
  placed: number;
}

interface PipelineBarProps {
  stats: PipelineStats;
  showLabels?: boolean;
  height?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusOrder: Status[] = ['searching', 'applying', 'interviewing', 'offered', 'placed'];

const heightClasses = {
  sm: 'h-2',
  md: 'h-4',
  lg: 'h-6',
};

// Tailwind background colors for each status
const statusBgColors: Record<Status, string> = {
  searching: 'bg-amber-400',
  applying: 'bg-blue-400',
  interviewing: 'bg-purple-400',
  offered: 'bg-green-400',
  placed: 'bg-emerald-500',
};

export function PipelineBar({
  stats,
  showLabels = true,
  height = 'md',
  className,
}: PipelineBarProps) {
  const total = Object.values(stats).reduce((sum, val) => sum + val, 0);

  if (total === 0) {
    return (
      <div className={cn('w-full', className)}>
        <div className={cn('w-full rounded-full bg-slate-200', heightClasses[height])} />
        {showLabels && (
          <div className="mt-2 text-center text-sm text-slate-500">No students in pipeline</div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      {/* Bar */}
      <div className={cn('w-full rounded-full overflow-hidden flex', heightClasses[height])}>
        {statusOrder.map((status) => {
          const count = stats[status];
          if (count === 0) return null;
          const percentage = (count / total) * 100;

          return (
            <div
              key={status}
              className={cn('transition-all', statusBgColors[status])}
              style={{ width: `${percentage}%` }}
              title={`${STATUS_CONFIG[status].label}: ${count} (${Math.round(percentage)}%)`}
            />
          );
        })}
      </div>

      {/* Labels */}
      {showLabels && (
        <div className="mt-3 flex justify-between gap-2 flex-wrap">
          {statusOrder.map((status) => {
            const count = stats[status];
            if (count === 0) return null;

            return (
              <div key={status} className="flex items-center gap-1.5 text-xs">
                <div className={cn('w-2.5 h-2.5 rounded-full', statusBgColors[status])} />
                <span className="text-slate-600">
                  {STATUS_CONFIG[status].label}:{' '}
                  <span className="font-medium text-slate-900">{count}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
