'use client';

import type { ZoomLevel } from '@/types/resume-editor';

interface ZoomControlsProps {
  value: ZoomLevel;
  onChange: (level: ZoomLevel) => void;
}

export function ZoomControls({ value, onChange }: ZoomControlsProps) {
  const isFit = value === 'fit';
  const sliderValue = isFit ? '100' : value;

  return (
    <div className="flex items-center gap-3 bg-white rounded-full shadow-sm border border-slate-200 px-3 py-2">
      <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
        <input
          type="checkbox"
          checked={isFit}
          onChange={(event) => onChange(event.target.checked ? 'fit' : '100')}
          className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
        />
        Fit
      </label>

      <div className="flex items-center gap-2">
        <input
          type="range"
          min="50"
          max="100"
          step="25"
          value={sliderValue}
          onChange={(event) => onChange(event.target.value as ZoomLevel)}
          disabled={isFit}
          className="accent-slate-900"
          aria-label="Zoom level"
        />
        <span className="text-xs font-medium text-slate-600">{sliderValue}%</span>
      </div>
    </div>
  );
}
