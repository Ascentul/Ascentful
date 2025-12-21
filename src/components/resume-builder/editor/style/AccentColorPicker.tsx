'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

import { ACCENT_COLORS } from '../../templates/types';

interface AccentColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function AccentColorPicker({ value, onChange }: AccentColorPickerProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-slate-700">Accent Color</h3>
      <div className="flex flex-wrap gap-2">
        {ACCENT_COLORS.map((color) => {
          const isSelected = value === color.value;

          return (
            <button
              key={color.value}
              type="button"
              onClick={() => onChange(color.value)}
              title={color.label}
              className={cn(
                'w-8 h-8 rounded-full transition-all flex items-center justify-center',
                'hover:scale-110 hover:shadow-md',
                isSelected && 'ring-2 ring-offset-2 ring-slate-900',
              )}
              style={{ backgroundColor: color.value }}
            >
              {isSelected && (
                <Check
                  className={cn(
                    'h-4 w-4',
                    color.value === '#000000' || color.value === '#374151'
                      ? 'text-white'
                      : 'text-white',
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
