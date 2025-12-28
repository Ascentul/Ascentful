'use client';

import { Check, ChevronRight, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { Suggestion } from '@/lib/ai/schemas';
import { cn } from '@/lib/utils';

/**
 * Props for SuggestionTooltip component.
 * Note: Callback props (onApply, onDismiss, onClose) should be memoized with useCallback
 * in the parent component to avoid unnecessary event listener re-registration.
 */
interface SuggestionTooltipProps {
  suggestion: Suggestion;
  position: { x: number; y: number };
  onApply: () => void;
  onDismiss: () => void;
  onClose: () => void;
}

const SEVERITY_COLORS = {
  critical: 'border-red-200 bg-red-50',
  important: 'border-amber-200 bg-amber-50',
  polish: 'border-blue-200 bg-blue-50',
} as const;

const CATEGORY_COLORS = {
  impact: 'text-orange-600 bg-orange-100',
  clarity: 'text-green-600 bg-green-100',
  ats: 'text-blue-600 bg-blue-100',
  brevity: 'text-cyan-600 bg-cyan-100',
} as const;

export function SuggestionTooltip({
  suggestion,
  position,
  onApply,
  onDismiss,
  onClose,
}: SuggestionTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const [showFull, setShowFull] = useState(false);

  // Adjust position to keep tooltip in viewport (useLayoutEffect to avoid flash)
  useLayoutEffect(() => {
    if (!tooltipRef.current) return;

    const rect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = position.x;
    let y = position.y + 8; // Position below

    // Keep in horizontal bounds
    if (x + rect.width > viewportWidth - 16) {
      x = viewportWidth - rect.width - 16;
    }
    if (x < 16) {
      x = 16;
    }

    // If too close to bottom, position above
    if (y + rect.height > viewportHeight - 16) {
      y = position.y - rect.height - 8;
    }

    setAdjustedPosition({ x, y });
  }, [position.x, position.y, showFull]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        zIndex: 9999,
        maxWidth: 320,
      }}
      className={cn(
        'rounded-xl shadow-lg border overflow-hidden',
        SEVERITY_COLORS[suggestion.severity],
      )}
    >
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-inherit">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-[10px] font-medium px-1.5 py-0.5 rounded',
              CATEGORY_COLORS[suggestion.category],
            )}
          >
            {suggestion.category.toUpperCase()}
          </span>
          <span className="text-xs font-medium text-slate-700">{suggestion.title}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close suggestion"
          className="p-0.5 rounded hover:bg-white/50 text-slate-400 hover:text-slate-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="px-3 py-2 bg-white">
        <p className="text-xs text-slate-600 mb-3">{suggestion.explanation}</p>

        {/* Before/After Preview */}
        {showFull ? (
          <div className="space-y-2 mb-3">
            <div>
              <span className="text-[10px] font-medium text-slate-400">BEFORE</span>
              <p className="text-xs text-slate-600 mt-0.5 line-through opacity-60">
                {suggestion.beforeText}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-medium text-green-600">AFTER</span>
              <p className="text-xs text-slate-900 mt-0.5 font-medium">{suggestion.afterText}</p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowFull(true)}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 mb-3"
          >
            <span>See suggested change</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        )}

        {/* Score Impact */}
        {suggestion.estimatedScoreImpact > 0 && (
          <div className="text-xs text-green-600 mb-3">
            +{suggestion.estimatedScoreImpact} points if applied
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onApply}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
              'bg-primary-500 text-white hover:bg-primary-600 transition-colors',
            )}
          >
            <Check className="h-3.5 w-3.5" />
            <span>Apply</span>
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium',
              'bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors',
            )}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
