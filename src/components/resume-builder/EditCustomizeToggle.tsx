'use client';

import React from 'react';

import { cn } from '@/lib/utils';

interface EditCustomizeToggleProps {
  mode: 'edit' | 'customize';
  onModeChange: (mode: 'edit' | 'customize') => void;
}

export function EditCustomizeToggle({ mode, onModeChange }: EditCustomizeToggleProps) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex rounded-full border border-slate-200 p-1 bg-white">
        <button
          type="button"
          onClick={() => onModeChange('edit')}
          aria-pressed={mode === 'edit'}
          className={cn(
            'px-6 py-2 text-sm font-medium rounded-full transition-all',
            mode === 'edit' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900',
          )}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onModeChange('customize')}
          aria-pressed={mode === 'customize'}
          className={cn(
            'px-6 py-2 text-sm font-medium rounded-full transition-all',
            mode === 'customize'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900',
          )}
        >
          Customize
        </button>
      </div>
    </div>
  );
}
