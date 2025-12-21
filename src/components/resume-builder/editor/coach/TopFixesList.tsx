'use client';

import { ChevronRight, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TopFix } from '@/types/resume-editor';

interface TopFixesListProps {
  fixes: TopFix[];
  onApplyFix: (fix: TopFix) => void;
}

export function TopFixesList({ fixes, onApplyFix }: TopFixesListProps) {
  if (fixes.length === 0) return null;

  return (
    <div className="p-4 border-b border-slate-200">
      <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-500" />
        Top 3 Fixes
      </h3>
      <div className="space-y-2">
        {fixes.map((fix) => (
          <TopFixItem key={fix.fixId} fix={fix} onApply={() => onApplyFix(fix)} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Top Fix Item
// ============================================================================

interface TopFixItemProps {
  fix: TopFix;
  onApply: () => void;
}

function TopFixItem({ fix, onApply }: TopFixItemProps) {
  const impactConfig = getImpactConfig(fix.impact);

  return (
    <button
      onClick={onApply}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-lg border transition-all',
        'hover:shadow-sm hover:border-primary-300',
        'bg-white border-slate-200',
      )}
    >
      {/* Impact indicator */}
      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', impactConfig.dotClass)} />

      {/* Message */}
      <span className="flex-1 text-sm text-slate-700 text-left">{fix.message}</span>

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
    </button>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getImpactConfig(impact: TopFix['impact']) {
  switch (impact) {
    case 'high':
      return {
        dotClass: 'bg-red-500',
        label: 'High Impact',
      };
    case 'medium':
      return {
        dotClass: 'bg-amber-500',
        label: 'Medium Impact',
      };
    case 'low':
      return {
        dotClass: 'bg-green-500',
        label: 'Low Impact',
      };
  }
}
