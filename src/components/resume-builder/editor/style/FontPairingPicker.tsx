'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { FontPairingId } from '../../templates/types';
import { FONT_PAIRINGS } from '../../templates/types';

interface FontPairingPickerProps {
  value: FontPairingId;
  onChange: (fontPairing: FontPairingId) => void;
}

const FONT_PAIRING_IDS: FontPairingId[] = ['classic', 'modern', 'elegant', 'minimal'];

export function FontPairingPicker({ value, onChange }: FontPairingPickerProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-slate-700">Font Pairing</h3>
      <div className="space-y-2">
        {FONT_PAIRING_IDS.map((pairingId) => {
          const pairing = FONT_PAIRINGS[pairingId];
          const isSelected = value === pairingId;

          return (
            <button
              key={pairingId}
              type="button"
              onClick={() => onChange(pairingId)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left',
                'hover:border-primary-300',
                isSelected ? 'border-primary-500 bg-primary-50/50' : 'border-slate-200 bg-white',
              )}
            >
              {/* Checkbox */}
              <div
                className={cn(
                  'flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors',
                  isSelected ? 'bg-primary-500 border-primary-500' : 'bg-white border-slate-300',
                )}
              >
                {isSelected && <Check className="h-3 w-3 text-white" />}
              </div>

              {/* Font preview */}
              <div className="flex-1">
                <div
                  className="text-base font-semibold text-slate-900"
                  style={{ fontFamily: pairing.heading }}
                >
                  {pairing.label}
                </div>
                <div className="text-xs text-slate-500" style={{ fontFamily: pairing.body }}>
                  {pairing.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
