'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import type { Suggestion } from '@/types/resume-editor';

interface InlineEditableTextProps {
  spanId: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  suggestions?: Suggestion[];
  coachEnabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  style?: React.CSSProperties;
}

export function InlineEditableText({
  spanId,
  value,
  onChange,
  className,
  placeholder = 'Click to edit...',
  multiline = false,
  suggestions = [],
  coachEnabled = true,
  onFocus,
  onBlur,
  style,
}: InlineEditableTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  // Sync with external value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Check if this span has suggestions
  const hasSuggestions = coachEnabled && suggestions.some((s) => s.spanId === spanId);

  const handleClick = useCallback(() => {
    setIsEditing(true);
    onFocus?.();
    // Focus and place cursor at end
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        // Place cursor at end
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(ref.current);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }, 0);
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    const newValue = ref.current?.textContent || '';
    if (newValue !== value) {
      onChange(newValue);
    }
    onBlur?.();
  }, [value, onChange, onBlur]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditValue(value);
        if (ref.current) {
          ref.current.textContent = value;
        }
        setIsEditing(false);
        ref.current?.blur();
      }
      if (e.key === 'Enter' && !multiline) {
        e.preventDefault();
        handleBlur();
      }
    },
    [value, multiline, handleBlur],
  );

  const handleInput = useCallback(() => {
    const newValue = ref.current?.textContent || '';
    setEditValue(newValue);
  }, []);

  const isEmpty = !value && !editValue;

  return (
    <div
      ref={ref}
      data-span-id={spanId}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onClick={handleClick}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onInput={handleInput}
      role="textbox"
      tabIndex={0}
      className={cn(
        'outline-none cursor-text transition-all',
        // Editing state
        isEditing && 'ring-2 ring-primary-300 rounded px-1 -mx-1 bg-white',
        // Suggestion highlight (Grammarly-style wavy underline)
        hasSuggestions &&
          !isEditing &&
          'underline decoration-wavy decoration-amber-400 underline-offset-4 decoration-2',
        // Empty placeholder styling
        isEmpty && !isEditing && 'text-slate-300',
        className,
      )}
      style={{
        minHeight: multiline ? '1.5em' : undefined,
        whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
        ...style,
      }}
    >
      {isEmpty && !isEditing ? placeholder : editValue || value}
    </div>
  );
}

// ============================================================================
// Bullet Point Editable
// ============================================================================

interface BulletEditableProps {
  spanId: string;
  bullets: string[];
  onChange: (bullets: string[]) => void;
  suggestions?: Suggestion[];
  coachEnabled?: boolean;
}

export function BulletEditable({
  spanId,
  bullets,
  onChange,
  suggestions = [],
  coachEnabled = true,
}: BulletEditableProps) {
  const handleBulletChange = (index: number, newValue: string) => {
    onChange(bullets.map((bullet, i) => (i === index ? newValue : bullet)));
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    const currentBullet = bullets.at(index) ?? '';

    if (e.key === 'Enter') {
      e.preventDefault();
      // Add new bullet after current
      const newBullets = [...bullets];
      newBullets.splice(index + 1, 0, '');
      onChange(newBullets);
      // Focus the new bullet (after state update)
      requestAnimationFrame(() => {
        const newSpanId = `${spanId}-${index + 1}`;
        const element = document.querySelector(`[data-span-id="${newSpanId}"]`);
        if (element instanceof HTMLElement) {
          element.click();
        }
      });
    }
    if (e.key === 'Backspace' && currentBullet === '' && bullets.length > 1) {
      e.preventDefault();
      // Remove empty bullet
      const newBullets = bullets.filter((_, i) => i !== index);
      onChange(newBullets);
      // Focus previous bullet
      if (index > 0) {
        requestAnimationFrame(() => {
          const prevSpanId = `${spanId}-${index - 1}`;
          const element = document.querySelector(`[data-span-id="${prevSpanId}"]`);
          if (element instanceof HTMLElement) {
            element.click();
          }
        });
      }
    }
  };

  return (
    <ul className="list-none space-y-1">
      {bullets.map((bullet, index) => {
        const bulletSpanId = `${spanId}-${index}`;
        const bulletSuggestions = suggestions.filter((s) => s.spanId === bulletSpanId);
        const hasSuggestion = coachEnabled && bulletSuggestions.length > 0;

        return (
          <li key={bulletSpanId} className="flex items-start gap-2">
            <span className="text-slate-400 select-none mt-0.5">•</span>
            <div
              data-span-id={bulletSpanId}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => {
                const newValue = e.currentTarget.textContent || '';
                if (newValue !== bullet) {
                  handleBulletChange(index, newValue);
                }
              }}
              onKeyDown={(e) => handleKeyDown(index, e)}
              role="textbox"
              tabIndex={0}
              className={cn(
                'flex-1 outline-none cursor-text',
                'focus:ring-2 focus:ring-primary-300 focus:rounded focus:px-1 focus:-mx-1 focus:bg-white',
                hasSuggestion &&
                  'underline decoration-wavy decoration-amber-400 underline-offset-4 decoration-2',
              )}
            >
              {bullet || <span className="text-slate-300">Add bullet point...</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
