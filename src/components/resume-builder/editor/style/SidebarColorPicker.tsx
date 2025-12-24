'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

import { SIDEBAR_BG_COLORS } from '../../templates/types';

interface SidebarColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

// Helper to determine if a color is dark (for contrast)
function isColorDark(hexColor: string): boolean {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hexColor)) {
    return false;
  }
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

export function SidebarColorPicker({ value, onChange }: SidebarColorPickerProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-slate-700">Sidebar Background</h3>
      <p className="text-xs text-slate-500">For two-column template layouts</p>
      <div className="flex flex-wrap gap-2">
        {SIDEBAR_BG_COLORS.map((color) => {
          const isSelected = value === color.value;
          const isDark = isColorDark(color.value);

          return (
            <button
              key={color.value}
              type="button"
              onClick={() => onChange(color.value)}
              title={color.label}
              className={cn(
                'w-8 h-8 rounded-full transition-all flex items-center justify-center',
                'hover:scale-110 hover:shadow-md',
                'border border-slate-200',
                isSelected && 'ring-2 ring-offset-2 ring-slate-900',
              )}
              style={{ backgroundColor: color.value }}
            >
              {isSelected && (
                <Check className={cn('h-4 w-4', isDark ? 'text-white' : 'text-slate-700')} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
