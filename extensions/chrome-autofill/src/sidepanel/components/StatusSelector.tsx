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
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const currentStageInfo = stages.find((s) => s.stage === currentStage) || stages[0];
  const currentIndex = stages.findIndex((s) => s.stage === currentStage);

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

  // Focus the current option when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
      // Focus the current option after dropdown renders
      setTimeout(() => {
        optionRefs.current[currentIndex >= 0 ? currentIndex : 0]?.focus();
      }, 0);
    } else {
      setFocusedIndex(-1);
    }
  }, [isOpen, currentIndex]);

  const handleSelect = (stage: ApplicationStage) => {
    if (stage !== currentStage) {
      onChange(stage);
    }
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen) {
      // Open dropdown on arrow down or enter/space when closed
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        break;
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev < stages.length - 1 ? prev + 1 : 0;
          optionRefs.current[next]?.focus();
          return next;
        });
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : stages.length - 1;
          optionRefs.current[next]?.focus();
          return next;
        });
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < stages.length) {
          handleSelect(stages[focusedIndex].stage);
        }
        break;
      case 'Tab':
        // Close dropdown on tab
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={dropdownRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
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
            aria-hidden="true"
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
        <div
          role="listbox"
          aria-label="Application stage"
          className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {stages.map((stage, index) => (
            <button
              key={stage.stage}
              ref={(el) => { optionRefs.current[index] = el; }}
              role="option"
              aria-selected={stage.stage === currentStage}
              onClick={() => handleSelect(stage.stage)}
              className={clsx(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-50 focus:bg-neutral-100 focus:outline-none',
                stage.stage === currentStage && 'bg-neutral-50'
              )}
            >
              <span className={clsx('h-2 w-2 rounded-full', stage.bgColor, 'ring-1 ring-inset ring-black/10')} />
              <span className={clsx('font-medium', stage.color)}>{stage.label}</span>
              {stage.stage === currentStage && (
                <svg aria-hidden="true" className="ml-auto h-4 w-4 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
