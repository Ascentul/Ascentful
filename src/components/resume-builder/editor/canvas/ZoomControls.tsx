'use client';

import { Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

interface ZoomControlsProps {
  value: number;
  onChange: (level: number) => void;
}

// Range centered on 80%: min 40%, max 120% (80% is exactly in the middle)
const MIN_ZOOM = 40;
const MAX_ZOOM = 120;
const ZOOM_STEP = 5;

export function ZoomControls({ value, onChange }: ZoomControlsProps) {
  const clampedValue = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(clampedValue));

  // Sync input value when external value changes
  useEffect(() => {
    if (!isEditing) {
      setInputValue(String(clampedValue));
    }
  }, [clampedValue, isEditing]);

  const handleZoomIn = () => {
    onChange(Math.min(MAX_ZOOM, clampedValue + ZOOM_STEP));
  };

  const handleZoomOut = () => {
    onChange(Math.max(MIN_ZOOM, clampedValue - ZOOM_STEP));
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(e.target.value, 10));
  };

  const handleInputSubmit = () => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed)) {
      onChange(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, parsed)));
    } else {
      setInputValue(String(clampedValue));
    }
    setIsEditing(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputSubmit();
    } else if (e.key === 'Escape') {
      setInputValue(String(clampedValue));
      setIsEditing(false);
    }
  };

  // Calculate fill percentage for styled track
  const fillPercent = ((clampedValue - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-slate-500 hover:text-slate-700 hover:bg-slate-200"
        onClick={handleZoomOut}
        disabled={clampedValue <= MIN_ZOOM}
        aria-label="Zoom out"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>

      <div className="relative w-28">
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={ZOOM_STEP}
          value={clampedValue}
          onChange={handleSliderChange}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-700 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-slate-700 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
          style={{
            background: `linear-gradient(to right, #334155 0%, #334155 ${fillPercent}%, #e2e8f0 ${fillPercent}%, #e2e8f0 100%)`,
          }}
          aria-label="Zoom level"
        />
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-slate-500 hover:text-slate-700 hover:bg-slate-200"
        onClick={handleZoomIn}
        disabled={clampedValue >= MAX_ZOOM}
        aria-label="Zoom in"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>

      {isEditing ? (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleInputSubmit}
          onKeyDown={handleInputKeyDown}
          className="w-14 h-6 text-xs text-center border border-slate-300 rounded px-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
          autoFocus
        />
      ) : (
        <button
          onClick={() => {
            setInputValue(String(clampedValue));
            setIsEditing(true);
          }}
          className="text-xs font-medium text-slate-600 w-14 h-6 text-center hover:bg-slate-200 rounded transition-colors"
        >
          {clampedValue}%
        </button>
      )}
    </div>
  );
}
