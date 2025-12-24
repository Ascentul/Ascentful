'use client';

import { BarChart2, FileText, Scissors, Sparkles, Target, Zap } from 'lucide-react';

import { cn } from '@/lib/utils';

interface QuickAction {
  id: string;
  label: string;
  icon: typeof Sparkles;
  description: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'add-metrics',
    label: 'Add Metrics',
    icon: BarChart2,
    description: 'Quantify achievements with numbers',
  },
  {
    id: 'strengthen-verbs',
    label: 'Stronger Verbs',
    icon: Zap,
    description: 'Replace weak verbs with impactful ones',
  },
  {
    id: 'tailor-jd',
    label: 'Tailor to JD',
    icon: Target,
    description: 'Optimize for job description keywords',
  },
  {
    id: 'shorten',
    label: 'Shorten',
    icon: Scissors,
    description: 'Make content more concise',
  },
];

interface QuickActionsBarProps {
  onAction?: (actionId: string) => void;
  disabled?: boolean;
  className?: string;
}

export function QuickActionsBar({ onAction, disabled, className }: QuickActionsBarProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <h4 className="text-xs font-medium text-slate-500">Quick Actions</h4>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onAction?.(action.id)}
              disabled={disabled}
              className={cn(
                'group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs',
                'bg-slate-100 text-slate-700 hover:bg-primary-100 hover:text-primary-700',
                'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
              )}
              title={action.description}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Standalone chip version for inline use
interface QuickActionChipProps {
  action: (typeof QUICK_ACTIONS)[number];
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function QuickActionChip({ action, onClick, disabled, size = 'sm' }: QuickActionChipProps) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1 rounded-full transition-colors',
        'bg-slate-100 text-slate-700 hover:bg-primary-100 hover:text-primary-700',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
      )}
      title={action.description}
    >
      <Icon className={cn(size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
      <span>{action.label}</span>
    </button>
  );
}

export { QUICK_ACTIONS };
export type { QuickAction };
