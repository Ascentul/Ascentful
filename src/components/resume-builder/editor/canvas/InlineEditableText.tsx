'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Suggestion as AISuggestion } from '@/lib/ai/schemas';
import { cn } from '@/lib/utils';
import type { Suggestion } from '@/types/resume-editor';

import type { EditorMode } from '../EditorTopBar';
import { type AIToolbarAction, InlineAIToolbar } from './InlineAIToolbar';

// Re-export for consumers
export type { AIToolbarAction };

// Helper to parse text and identify placeholders like <X>, <Y>, etc.
function parseTextWithPlaceholders(text: string): Array<{ text: string; isPlaceholder: boolean }> {
  const placeholderRegex = /<[A-Z]>/g;
  const parts: Array<{ text: string; isPlaceholder: boolean }> = [];
  let lastIndex = 0;
  let match;

  while ((match = placeholderRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), isPlaceholder: false });
    }
    parts.push({ text: match[0], isPlaceholder: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isPlaceholder: false });
  }

  return parts.length > 0 ? parts : [{ text, isPlaceholder: false }];
}

// Component to render track changes view
function TrackChangesText({
  beforeText,
  afterText,
  className,
  style,
  isFocused,
  onClick,
}: {
  beforeText: string;
  afterText: string;
  className?: string;
  style?: React.CSSProperties;
  isFocused?: boolean;
  onClick?: () => void;
}) {
  // Normalize texts for comparison (trim whitespace)
  const normalizedBefore = beforeText?.trim() || '';
  const normalizedAfter = afterText?.trim() || '';

  // If before and after are the same, just show the text normally without markup
  const hasActualChanges = normalizedBefore !== normalizedAfter;

  // If no actual changes, render without track changes styling
  if (!hasActualChanges) {
    const parts = parseTextWithPlaceholders(afterText || beforeText);
    return (
      <span
        className={cn(
          'inline cursor-pointer transition-all rounded',
          isFocused && 'ring-2 ring-primary-500 ring-offset-2',
          className,
        )}
        style={{ wordBreak: 'break-word', ...style }}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
      >
        {parts.map((part, idx) =>
          part.isPlaceholder ? (
            <span
              key={idx}
              className="font-medium"
              style={{
                backgroundColor: 'rgba(253, 230, 138, 0.8)',
                color: '#92400e',
                padding: '0 2px',
                borderRadius: '2px',
                textDecoration: 'underline',
                textDecorationStyle: 'dotted',
              }}
            >
              {part.text}
            </span>
          ) : (
            <span key={idx}>{part.text}</span>
          ),
        )}
      </span>
    );
  }

  const afterParts = parseTextWithPlaceholders(afterText);

  return (
    <span
      className={cn(
        'inline cursor-pointer transition-all rounded',
        isFocused && 'ring-2 ring-primary-500 ring-offset-2',
        className,
      )}
      style={{ wordBreak: 'break-word', ...style }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Deleted text - strikethrough with red background */}
      {beforeText && (
        <span
          className="line-through mr-1"
          style={{
            backgroundColor: 'rgba(254, 202, 202, 0.7)',
            color: '#b91c1c',
            padding: '0 2px',
            borderRadius: '2px',
          }}
        >
          {beforeText}
        </span>
      )}
      {/* New text - green background with orange/yellow placeholders */}
      {afterParts.map((part, idx) =>
        part.isPlaceholder ? (
          <span
            key={idx}
            className="font-medium"
            style={{
              backgroundColor: 'rgba(253, 230, 138, 0.8)',
              color: '#92400e',
              padding: '0 2px',
              borderRadius: '2px',
              textDecoration: 'underline',
              textDecorationStyle: 'dotted',
            }}
          >
            {part.text}
          </span>
        ) : (
          <span
            key={idx}
            style={{
              backgroundColor: 'rgba(187, 247, 208, 0.7)',
              color: '#15803d',
              padding: '0 2px',
              borderRadius: '2px',
            }}
          >
            {part.text}
          </span>
        ),
      )}
    </span>
  );
}

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
  /** When true, shows a red border/highlight indicating this field needs attention */
  isMissing?: boolean;
  /** Editor mode - 'editor' for normal editing, 'review' for track changes view */
  editorMode?: EditorMode;
  /** AI suggestions for track changes in review mode */
  aiSuggestions?: AISuggestion[];
  /** Focused suggestion ID for bidirectional linking */
  focusedSuggestionId?: string | null;
  /** Callback when track changes are clicked */
  onTrackChangeClick?: (suggestionId: string) => void;
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
  isMissing = false,
  editorMode = 'editor',
  aiSuggestions = [],
  focusedSuggestionId,
  onTrackChangeClick,
}: InlineEditableTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const lastValueRef = useRef(value);

  // Sync DOM with external value changes ONLY when not editing
  // Skip if value is empty - we use React children for placeholder
  useEffect(() => {
    if (!isEditing && ref.current && lastValueRef.current !== value && value) {
      ref.current.textContent = value;
      lastValueRef.current = value;
    }
  }, [value, isEditing]);

  // Set initial content on mount (only if there's a value)
  useEffect(() => {
    if (ref.current && value && ref.current.textContent !== value) {
      ref.current.textContent = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check if this span has suggestions
  const hasSuggestions = coachEnabled && suggestions.some((s) => s.spanId === spanId);

  const handleClick = useCallback(() => {
    if (isEditing) return; // Already editing
    setIsEditing(true);
    onFocus?.();
    // Focus and place cursor at start (placeholder will be cleared)
    setTimeout(() => {
      if (ref.current) {
        // Clear placeholder content when focusing on empty field
        if (!value) {
          ref.current.textContent = '';
        }
        ref.current.focus();
        // Place cursor at end
        const range = document.createRange();
        const selection = window.getSelection();
        if (ref.current.childNodes.length > 0) {
          range.selectNodeContents(ref.current);
          range.collapse(false);
        } else {
          range.setStart(ref.current, 0);
          range.collapse(true);
        }
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }, 0);
  }, [onFocus, isEditing, value]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    const newValue = ref.current?.textContent || '';
    lastValueRef.current = newValue;
    if (newValue !== value) {
      onChange(newValue);
    }
    onBlur?.();
  }, [value, onChange, onBlur]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (ref.current) {
          ref.current.textContent = value;
        }
        lastValueRef.current = value;
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

  const isEmpty = !value;

  // Show placeholder text when empty and not editing
  const showPlaceholder = isEmpty && !isEditing;

  // Find matching AI suggestion for this span (for review mode)
  const matchingAISuggestion = aiSuggestions.find((s) => s.targetPath === spanId);
  const isReviewMode = editorMode === 'review';
  const hasTrackChanges = isReviewMode && matchingAISuggestion;

  // In review mode with a matching suggestion, show track changes view (non-editable)
  if (hasTrackChanges) {
    const isFocused = focusedSuggestionId === matchingAISuggestion.id;
    return (
      <div
        data-span-id={spanId}
        data-suggestion-id={matchingAISuggestion.id}
        className={cn('transition-all', className)}
        style={{
          minHeight: multiline ? '1.5em' : undefined,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          ...style,
        }}
      >
        <TrackChangesText
          beforeText={matchingAISuggestion.beforeText}
          afterText={matchingAISuggestion.afterText}
          isFocused={isFocused}
          onClick={() => onTrackChangeClick?.(matchingAISuggestion.id)}
        />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      data-span-id={spanId}
      contentEditable
      suppressContentEditableWarning
      onClick={handleClick}
      onFocus={() => {
        if (!isEditing) {
          setIsEditing(true);
          onFocus?.();
        }
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      role="textbox"
      tabIndex={0}
      className={cn(
        'outline-none cursor-text transition-all',
        // Editing state
        isEditing && 'ring-2 ring-primary-300 rounded px-1 -mx-1 bg-white',
        // Missing field highlight (red border like form validation)
        isMissing &&
          !isEditing &&
          isEmpty &&
          'ring-2 ring-red-400 ring-offset-1 rounded px-1 -mx-1 bg-red-50/50',
        // Suggestion highlight (Grammarly-style wavy underline)
        hasSuggestions &&
          !isEditing &&
          !isMissing &&
          'underline decoration-wavy decoration-amber-400 underline-offset-4 decoration-2',
        // Empty placeholder styling - red text when missing, gray otherwise
        showPlaceholder && (isMissing ? 'text-red-400' : 'text-slate-400'),
        className,
      )}
      style={{
        minHeight: multiline ? '1.5em' : undefined,
        whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
        ...style,
      }}
      data-placeholder={placeholder}
    >
      {showPlaceholder ? placeholder : null}
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
  onAIAction?: (bulletIndex: number, bulletText: string, action: AIToolbarAction) => void;
  aiLoading?: boolean;
  /** When true, shows a red border/highlight on empty bullets indicating this field needs attention */
  isMissing?: boolean;
  /** Custom placeholder text for empty bullets */
  placeholder?: string;
  /** Editor mode - 'editor' for normal editing, 'review' for track changes view */
  editorMode?: EditorMode;
  /** AI suggestions for track changes in review mode */
  aiSuggestions?: AISuggestion[];
  /** Focused suggestion ID for bidirectional linking */
  focusedSuggestionId?: string | null;
  /** Callback when track changes are clicked */
  onTrackChangeClick?: (suggestionId: string) => void;
}

// Individual bullet item component to properly manage contentEditable
interface BulletItemProps {
  bulletSpanId: string;
  bullet: string;
  index: number;
  hasSuggestion: boolean;
  isMissing?: boolean;
  placeholder?: string;
  onAIAction?: (bulletIndex: number, bulletText: string, action: AIToolbarAction) => void;
  onBulletChange: (index: number, newValue: string) => void;
  onKeyDown: (index: number, e: React.KeyboardEvent) => void;
  onMouseEnter: (index: number, e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
  /** Track changes data for review mode */
  trackChanges?: { beforeText: string; afterText: string; suggestionId: string } | null;
  /** Whether this track change is focused */
  isTrackChangeFocused?: boolean;
  /** Callback when track changes are clicked */
  onTrackChangeClick?: (suggestionId: string) => void;
}

function BulletItem({
  bulletSpanId,
  bullet,
  index,
  hasSuggestion,
  isMissing,
  placeholder = 'Add bullet point...',
  onAIAction,
  onBulletChange,
  onKeyDown,
  onMouseEnter,
  onMouseLeave,
  trackChanges,
  isTrackChangeFocused,
  onTrackChangeClick,
}: BulletItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef(bullet);
  const [isFocused, setIsFocused] = useState(false);
  const isEmpty = !bullet?.trim();

  // Show placeholder when empty and not focused
  const showPlaceholder = isEmpty && !isFocused;

  // Sync DOM with external value changes (must be before any early returns)
  useEffect(() => {
    // Skip if we're showing track changes (non-editable)
    if (trackChanges) return;
    if (ref.current && lastValueRef.current !== bullet && bullet) {
      // Only update if the element is not focused (not being edited)
      if (document.activeElement !== ref.current) {
        ref.current.textContent = bullet;
      }
      lastValueRef.current = bullet;
    }
  }, [bullet, trackChanges]);

  // Set initial content on mount (only if there's a value)
  useEffect(() => {
    // Skip if we're showing track changes (non-editable)
    if (trackChanges) return;
    if (ref.current && bullet) {
      ref.current.textContent = bullet;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackChanges]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    // Clear placeholder text when focusing
    if (ref.current && !bullet) {
      ref.current.textContent = '';
    }
  }, [bullet]);

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      setIsFocused(false);
      const newValue = e.currentTarget.textContent || '';
      lastValueRef.current = newValue;
      if (newValue !== bullet) {
        onBulletChange(index, newValue);
      }
    },
    [bullet, index, onBulletChange],
  );

  // In review mode with track changes, show non-editable track changes view
  if (trackChanges) {
    return (
      <li className="flex items-start gap-2 group/bullet">
        <span className="text-slate-400 select-none mt-0.5">•</span>
        <div
          data-span-id={bulletSpanId}
          data-suggestion-id={trackChanges.suggestionId}
          className="flex-1"
        >
          <TrackChangesText
            beforeText={trackChanges.beforeText}
            afterText={trackChanges.afterText}
            isFocused={isTrackChangeFocused}
            onClick={() => onTrackChangeClick?.(trackChanges.suggestionId)}
          />
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-2 group/bullet">
      <span className="text-slate-400 select-none mt-0.5">•</span>
      <div
        ref={ref}
        data-span-id={bulletSpanId}
        contentEditable
        suppressContentEditableWarning
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={(e) => onKeyDown(index, e)}
        onMouseEnter={(e) => onMouseEnter(index, e)}
        onMouseLeave={onMouseLeave}
        role="textbox"
        tabIndex={0}
        className={cn(
          'flex-1 outline-none cursor-text transition-colors',
          'focus:ring-2 focus:ring-primary-300 focus:rounded focus:px-1 focus:-mx-1 focus:bg-white',
          // Missing field highlight (red border like form validation)
          isMissing &&
            isEmpty &&
            !isFocused &&
            'ring-2 ring-red-400 ring-offset-1 rounded px-1 -mx-1 bg-red-50/50',
          // Placeholder text color
          showPlaceholder && (isMissing ? 'text-red-400' : 'text-slate-400'),
          hasSuggestion &&
            !isMissing &&
            'underline decoration-wavy decoration-amber-400 underline-offset-4 decoration-2',
          // Subtle hover indication when AI is available
          onAIAction && bullet && 'hover:bg-primary-50/50 rounded -mx-1 px-1',
        )}
        data-placeholder={placeholder}
      >
        {showPlaceholder ? placeholder : null}
      </div>
    </li>
  );
}

export function BulletEditable({
  spanId,
  bullets,
  onChange,
  suggestions = [],
  coachEnabled = true,
  onAIAction,
  aiLoading = false,
  isMissing = false,
  placeholder,
  editorMode = 'editor',
  aiSuggestions = [],
  focusedSuggestionId,
  onTrackChangeClick,
}: BulletEditableProps) {
  const isReviewMode = editorMode === 'review';
  // Track hover state for AI toolbar
  const [hoveredBulletIndex, setHoveredBulletIndex] = useState<number | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleBulletChange = useCallback(
    (index: number, newValue: string) => {
      onChange(bullets.map((bullet, i) => (i === index ? newValue : bullet)));
    },
    [bullets, onChange],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      const target = e.currentTarget as HTMLElement;
      const currentBullet = target.textContent || '';

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
            element.focus();
          }
        });
      }
      if (e.key === 'Backspace' && currentBullet === '' && bullets.length > 1) {
        e.preventDefault();
        // Remove empty bullet
        const newBullets = bullets.filter((_, i) => i !== index);
        onChange(newBullets);
        // Focus previous bullet, or next if deleting the first
        const focusIndex = index > 0 ? index - 1 : 0;
        requestAnimationFrame(() => {
          const targetSpanId = `${spanId}-${focusIndex}`;
          const element = document.querySelector(`[data-span-id="${targetSpanId}"]`);
          if (element instanceof HTMLElement) {
            element.focus();
          }
        });
      }
    },
    [bullets, onChange, spanId],
  );

  const handleMouseEnter = useCallback(
    (index: number, e: React.MouseEvent<HTMLDivElement>) => {
      // Only show AI toolbar if there's actual content and AI actions are enabled
      if (!onAIAction || !bullets[index]?.trim()) return;

      // Clear any pending hide timeout (user moved back to content)
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }

      // Clear any existing show timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }

      // Delay before showing toolbar to avoid flicker
      const rect = e.currentTarget.getBoundingClientRect();
      hoverTimeoutRef.current = setTimeout(() => {
        setToolbarPosition({
          x: rect.left,
          y: rect.top,
        });
        setHoveredBulletIndex(index);
      }, 400); // 400ms delay before showing toolbar
    },
    [onAIAction, bullets],
  );

  const handleMouseLeave = useCallback(() => {
    // Clear the pending show timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    // Delayed hide - gives user time to move to toolbar, but ensures cleanup
    // The toolbar's click-outside handler will also close it immediately on interaction
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredBulletIndex(null);
      setToolbarPosition(null);
    }, 1500); // 1.5s delay before hiding toolbar
  }, []);

  const handleToolbarClose = useCallback(() => {
    // Clear any pending hide timeout since we're explicitly closing
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setHoveredBulletIndex(null);
    setToolbarPosition(null);
  }, []);

  const handleToolbarAction = useCallback(
    (action: AIToolbarAction) => {
      if (hoveredBulletIndex === null || !onAIAction) return;
      const bulletText = bullets[hoveredBulletIndex];
      if (bulletText) {
        onAIAction(hoveredBulletIndex, bulletText, action);
      }
      handleToolbarClose();
    },
    [hoveredBulletIndex, bullets, onAIAction, handleToolbarClose],
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <ul className="list-none space-y-1">
        {bullets.map((bullet, index) => {
          const bulletSpanId = `${spanId}-${index}`;
          const bulletSuggestions = suggestions.filter((s) => s.spanId === bulletSpanId);
          const hasSuggestion = coachEnabled && bulletSuggestions.length > 0;

          // Find matching AI suggestion for this bullet (for review mode)
          const matchingAISuggestion = isReviewMode
            ? aiSuggestions.find((s) => s.targetPath === bulletSpanId)
            : null;
          const trackChanges = matchingAISuggestion
            ? {
                beforeText: matchingAISuggestion.beforeText,
                afterText: matchingAISuggestion.afterText,
                suggestionId: matchingAISuggestion.id,
              }
            : null;
          const isTrackChangeFocused = matchingAISuggestion?.id === focusedSuggestionId;

          return (
            <BulletItem
              key={bulletSpanId}
              bulletSpanId={bulletSpanId}
              bullet={bullet}
              index={index}
              hasSuggestion={hasSuggestion}
              isMissing={isMissing && index === 0}
              placeholder={placeholder}
              onAIAction={onAIAction}
              onBulletChange={handleBulletChange}
              onKeyDown={handleKeyDown}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              trackChanges={trackChanges}
              isTrackChangeFocused={isTrackChangeFocused}
              onTrackChangeClick={onTrackChangeClick}
            />
          );
        })}
      </ul>

      {/* AI Toolbar - rendered outside the list for proper positioning */}
      {hoveredBulletIndex !== null && toolbarPosition && onAIAction && (
        <InlineAIToolbar
          position={toolbarPosition}
          onAction={handleToolbarAction}
          onClose={handleToolbarClose}
          isLoading={aiLoading}
        />
      )}
    </>
  );
}
