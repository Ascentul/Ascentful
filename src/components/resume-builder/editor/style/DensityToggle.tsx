'use client';

import { cn } from '@/lib/utils';

import type { DensityOption } from '../../templates/types';

interface DensityToggleProps {
  value: DensityOption;
  onChange: (density: DensityOption) => void;
}

export function DensityToggle({ value, onChange }: DensityToggleProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-slate-700">Density</h3>
      <div
        role="radiogroup"
        aria-label="Density"
        className="flex rounded-lg border border-slate-200 overflow-hidden"
      >
        <button
          type="button"
          onClick={() => onChange('comfortable')}
          role="radio"
          aria-checked={value === 'comfortable'}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            value === 'comfortable'
              ? 'bg-primary-500 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50',
          )}
        >
          Comfortable
        </button>
        <button
          type="button"
          onClick={() => onChange('compact')}
          role="radio"
          aria-checked={value === 'compact'}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-slate-200',
            value === 'compact'
              ? 'bg-primary-500 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50',
          )}
        >
          Compact
        </button>
      </div>
      <p className="text-xs text-slate-500">
        {value === 'comfortable'
          ? 'More whitespace for readability'
          : 'Fits more content on one page'}
      </p>
    </div>
  );
}
