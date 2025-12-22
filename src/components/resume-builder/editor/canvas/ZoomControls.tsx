'use client';

import { cn } from '@/lib/utils';
import type { ZoomLevel } from '@/types/resume-editor';

interface ZoomControlsProps {
  value: ZoomLevel;
  onChange: (level: ZoomLevel) => void;
}

const ZOOM_OPTIONS: { value: ZoomLevel; label: string }[] = [
  { value: 'fit', label: 'Fit' },
  { value: '50', label: '50%' },
  { value: '75', label: '75%' },
  { value: '100', label: '100%' },
];

export function ZoomControls({ value, onChange }: ZoomControlsProps) {
  return (
    <div className="flex items-center gap-1 bg-white rounded-full shadow-sm border border-slate-200 p-1">
      {ZOOM_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-full transition-colors',
            value === option.value
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
