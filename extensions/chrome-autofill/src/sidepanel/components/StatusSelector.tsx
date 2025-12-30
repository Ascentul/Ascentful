/**
 * Status Selector
 *
 * Dropdown component for changing application stage.
 */

import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import type { ApplicationStage } from '~/types';

interface StatusSelectorProps {
  currentStage: ApplicationStage;
  onChange: (stage: ApplicationStage) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

const stages: { stage: ApplicationStage; label: string; color: string; bgColor: string }[] = [
  { stage: 'Prospect', label: 'Saved', color: 'text-neutral-700', bgColor: 'bg-neutral-100' },
  { stage: 'Applied', label: 'Applied', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  { stage: 'Interview', label: 'Interview', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  { stage: 'Offer', label: 'Offer', color: 'text-green-700', bgColor: 'bg-green-100' },
  { stage: 'Accepted', label: 'Accepted', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  { stage: 'Rejected', label: 'Rejected', color: 'text-red-700', bgColor: 'bg-red-100' },
  { stage: 'Withdrawn', label: 'Withdrawn', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  { stage: 'Archived', label: 'Archived', color: 'text-neutral-500', bgColor: 'bg-neutral-50' },
];

export function StatusSelector({ currentStage, onChange, disabled = false, size = 'md' }: StatusSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentStageInfo = stages.find((s) => s.stage === currentStage) || stages[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (stage: ApplicationStage) => {
    if (stage !== currentStage) {
      onChange(stage);
    }
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-full font-medium transition-all',
          currentStageInfo.bgColor,
          currentStageInfo.color,
          size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:opacity-80'
        )}
      >
        <span>{currentStageInfo.label}</span>
        {!disabled && (
          <svg
            className={clsx('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          {stages.map((stage) => (
            <button
              key={stage.stage}
              onClick={() => handleSelect(stage.stage)}
              className={clsx(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-50',
                stage.stage === currentStage && 'bg-neutral-50'
              )}
            >
              <span className={clsx('h-2 w-2 rounded-full', stage.bgColor, 'ring-1 ring-inset ring-black/10')} />
              <span className={clsx('font-medium', stage.color)}>{stage.label}</span>
              {stage.stage === currentStage && (
                <svg className="ml-auto h-4 w-4 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
