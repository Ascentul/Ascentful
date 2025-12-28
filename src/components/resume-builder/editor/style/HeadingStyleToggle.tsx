'use client';

import { cn } from '@/lib/utils';

import type { HeadingStyle } from '../../templates/types';

interface HeadingStyleToggleProps {
  value: HeadingStyle;
  onChange: (style: HeadingStyle) => void;
}

export function HeadingStyleToggle({ value, onChange }: HeadingStyleToggleProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-slate-700">Heading Style</h3>
      <div
        role="radiogroup"
        aria-label="Heading Style"
        className="flex rounded-lg border border-slate-200 overflow-hidden"
      >
        <button
          type="button"
          onClick={() => onChange('title_case')}
          role="radio"
          aria-checked={value === 'title_case'}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            value === 'title_case'
              ? 'bg-primary-500 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50',
          )}
        >
          Title Case
        </button>
        <button
          type="button"
          onClick={() => onChange('caps')}
          role="radio"
          aria-checked={value === 'caps'}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-slate-200 uppercase tracking-wider',
            value === 'caps'
              ? 'bg-primary-500 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50',
          )}
        >
          CAPS
        </button>
      </div>
    </div>
  );
}
