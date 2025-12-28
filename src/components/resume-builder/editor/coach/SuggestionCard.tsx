'use client';

import { Check, ChevronRight, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { Suggestion as AISuggestion } from '@/lib/ai/schemas';
import { getSpanElement, scrollToSpan } from '@/lib/resume-editor/span-utils';
import { cn } from '@/lib/utils';
import type { Suggestion, SuggestionType } from '@/types/resume-editor';

// Types for missing content that require "Add" action instead of "Apply"
const MISSING_CONTENT_TYPES = new Set([
  'missing-summary',
  'missing-experience',
  'missing-skills',
  'missing-education',
  'missing-contact-field',
  'empty-bullets',
  'incomplete-entry',
]);

// Checkbox component for selection
// Uses div with role="checkbox" to avoid nested button issues when used inside button wrappers
function SelectionCheckbox({
  checked,
  onChange,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      onKeyDown={(e) => {
        // Handle Enter and Space for keyboard accessibility
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onChange(!checked);
        }
      }}
      className={cn(
        'w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 cursor-pointer',
        checked
          ? 'bg-primary-500 border-primary-500 text-white'
          : 'border-slate-300 hover:border-primary-400 bg-white',
        'focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-1',
        className,
      )}
      aria-label={checked ? 'Deselect suggestion' : 'Select suggestion'}
    >
      {checked && <Check className="h-3 w-3" />}
    </div>
  );
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  onApply: (suggestionId: string) => void;
  onDismiss: (suggestionId: string) => void;
  onScrollTo: (spanId: string) => void;
}

// Props for AI-generated suggestions
interface AISuggestionCardProps {
  suggestion: AISuggestion;
  onApply: (suggestionId: string, afterText: string) => void;
  onDismiss: (suggestionId: string) => void;
  onScrollTo?: (targetPath: string) => void;
  // Selection props - only one card can be selected (shows purple outline + buttons)
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  // Checkbox props - multiple cards can be checked for batch operations
  isChecked?: boolean;
  onCheckChange?: (checked: boolean) => void;
}

type SuggestionCategory = 'impact' | 'clarity' | 'relevance' | 'consistency' | 'ats' | 'brevity';

// Category colors matching the ScoreCard subscores
const CATEGORY_COLORS: Record<SuggestionCategory, { bg: string; text: string }> = {
  impact: { bg: 'bg-orange-500', text: 'text-orange-500' },
  clarity: { bg: 'bg-green-500', text: 'text-green-500' },
  relevance: { bg: 'bg-amber-500', text: 'text-amber-500' },
  consistency: { bg: 'bg-cyan-500', text: 'text-cyan-500' },
  ats: { bg: 'bg-blue-500', text: 'text-blue-500' },
  brevity: { bg: 'bg-cyan-500', text: 'text-cyan-500' },
};

// Map suggestion types to their parent category (matching ScoreCard subscores)
function getTypeCategory(type: SuggestionType): SuggestionCategory {
  switch (type) {
    case 'impact':
    case 'metric':
    case 'verb':
      return 'impact';
    case 'clarity':
    case 'length':
      return 'clarity';
    case 'keyword':
      return 'relevance';
    case 'consistency':
      return 'consistency';
    case 'ats':
      return 'ats';
    default:
      return 'impact';
  }
}

// Get category color for the dot indicator
function getCategoryDot(type: SuggestionType): string {
  const category = getTypeCategory(type);
  return CATEGORY_COLORS[category]?.bg ?? 'bg-slate-400';
}

// Get category text color
function getCategoryTextColor(type: SuggestionType): string {
  const category = getTypeCategory(type);
  return CATEGORY_COLORS[category]?.text ?? 'text-slate-500';
}

export function SuggestionCard({
  suggestion,
  onApply,
  onDismiss,
  onScrollTo,
}: SuggestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCardClick = () => {
    if (!isExpanded) {
      setIsExpanded(true);
    }
  };

  const handleScrollTo = () => {
    onScrollTo(suggestion.spanId);
  };

  // Collapsed view - clean card with message and chevron
  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={handleCardClick}
        className="w-full text-left mb-2 p-3 rounded-xl border-2 border-slate-200 hover:border-primary-300 bg-white transition-all group"
      >
        <div className="flex items-center gap-3">
          {/* Category color dot */}
          <div
            className={cn(
              'w-2.5 h-2.5 rounded-full flex-shrink-0',
              getCategoryDot(suggestion.type),
            )}
          />

          {/* Message */}
          <p className="text-sm text-slate-700 flex-1 line-clamp-2 leading-relaxed">
            {suggestion.message}
          </p>

          {/* Chevron */}
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 flex-shrink-0 transition-colors" />
        </div>
      </button>
    );
  }

  // Expanded view - full details with actions
  return (
    <div className="mb-2 p-4 rounded-xl border-2 border-primary-400 bg-white shadow-sm">
      {/* Header with category */}
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-2.5 h-2.5 rounded-full', getCategoryDot(suggestion.type))} />
        <span
          className={cn(
            'text-xs font-medium uppercase tracking-wide',
            getCategoryTextColor(suggestion.type),
          )}
        >
          {suggestion.category}
        </span>
      </div>

      {/* Full message */}
      <p className="text-sm text-slate-700 leading-relaxed mb-3">{suggestion.message}</p>

      {/* Proposed text if available */}
      {suggestion.proposedText && (
        <div className="mb-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Suggested change:</p>
          <p className="text-sm text-slate-900 font-medium">{suggestion.proposedText}</p>
        </div>
      )}

      {/* Explanation if available */}
      {suggestion.explainText && (
        <p className="text-xs text-slate-500 mb-3 leading-relaxed">{suggestion.explainText}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => onApply(suggestion.suggestionId)}
          className="flex-1 text-sm font-medium text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => onDismiss(suggestion.suggestionId)}
          className="text-sm text-slate-600 hover:text-slate-800 px-4 py-2 transition-colors"
        >
          Dismiss
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleScrollTo}
            className="text-xs text-primary-600 hover:text-primary-700 transition-colors"
          >
            Show in resume
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            Collapse
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Suggestion Groups
// ============================================================================

interface SuggestionGroupsProps {
  critical: Suggestion[];
  improve: Suggestion[];
  optional: Suggestion[];
  onApply: (suggestionId: string) => void;
  onDismiss: (suggestionId: string) => void;
  onScrollTo: (spanId: string) => void;
}

export function SuggestionGroups({
  critical,
  improve,
  optional,
  onApply,
  onDismiss,
  onScrollTo,
}: SuggestionGroupsProps) {
  // Combine all suggestions, sorted by severity (critical first)
  const allSuggestions = [...critical, ...improve, ...optional];

  if (allSuggestions.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-2">✨</div>
        <p className="text-sm font-medium text-slate-900">Looking great!</p>
        <p className="text-xs text-slate-500 mt-1">No suggestions at the moment</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-3">
      {allSuggestions.map((suggestion) => (
        <SuggestionCard
          key={suggestion.suggestionId}
          suggestion={suggestion}
          onApply={onApply}
          onDismiss={onDismiss}
          onScrollTo={onScrollTo}
        />
      ))}
    </div>
  );
}

// ============================================================================
// AI Suggestion Card (new format from AI API)
// ============================================================================

// AI suggestion type to category mapping
function getAICategoryColor(category: AISuggestion['category']): { bg: string; text: string } {
  switch (category) {
    case 'impact':
      return { bg: 'bg-orange-500', text: 'text-orange-500' };
    case 'clarity':
      return { bg: 'bg-green-500', text: 'text-green-500' };
    case 'ats':
      return { bg: 'bg-blue-500', text: 'text-blue-500' };
    case 'brevity':
      return { bg: 'bg-cyan-500', text: 'text-cyan-500' };
    default: {
      const _exhaustiveCheck: never = category;
      return { bg: 'bg-slate-400', text: 'text-slate-500' };
    }
  }
}

export function AISuggestionCard({
  suggestion,
  onApply,
  onDismiss,
  onScrollTo,
  isSelected = false,
  onSelectionChange,
  isChecked = false,
  onCheckChange,
}: AISuggestionCardProps) {
  const categoryColor = getAICategoryColor(suggestion.category);
  const isMissingContent = MISSING_CONTENT_TYPES.has(suggestion.type);
  const [isEditPreviewOpen, setIsEditPreviewOpen] = useState(false);

  // Clicking checkbox toggles checked state for batch operations
  // Also deselects the card when checking
  const handleCheckboxChange = (checked: boolean) => {
    onCheckChange?.(checked);
  };

  // Clicking card selects it (shows purple outline and action buttons)
  const handleCardClick = () => {
    if (!isSelected) {
      onSelectionChange?.(true);
    }
  };

  // Apply with scroll and highlight animation
  const handleApplyWithAnimation = async () => {
    // 1. Scroll to target with highlight animation
    scrollToSpan(suggestion.targetPath);

    // 2. Brief delay so user sees the highlight before change
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 3. Apply the change
    onApply(suggestion.id, suggestion.afterText);
    setIsEditPreviewOpen(false);
    onSelectionChange?.(false);
  };

  // Get category label for the badge
  const getCategoryLabel = (category: AISuggestion['category'], type: string) => {
    // For missing content types, show a more descriptive label
    if (MISSING_CONTENT_TYPES.has(type)) {
      return 'Missing Content';
    }
    switch (category) {
      case 'impact':
        return 'Impact';
      case 'clarity':
        return 'Clarity';
      case 'ats':
        return 'ATS';
      case 'brevity':
        return 'Brevity';
      default:
        return category;
    }
  };

  // Get badge styling based on severity and type
  const getBadgeStyle = (severity: string, type: string) => {
    if (MISSING_CONTENT_TYPES.has(type)) {
      // Red/critical styling for missing content
      return 'border-red-200 bg-red-50 text-red-700';
    }
    switch (severity) {
      case 'critical':
        return 'border-red-200 bg-red-50 text-red-700';
      case 'important':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-600';
    }
  };

  return (
    <div
      data-suggestion-card-id={suggestion.id}
      className={cn(
        'mb-2 rounded-xl border-2 bg-white transition-all',
        isSelected ? 'border-primary-400 shadow-sm' : 'border-slate-200 hover:border-primary-300',
      )}
    >
      {/* Card content - clickable to select */}
      <button type="button" onClick={handleCardClick} className="w-full text-left p-4">
        {/* Header row with title and checkbox */}
        <div className="flex items-start gap-3">
          {/* Title */}
          <p
            className={cn(
              'text-sm flex-1 leading-relaxed',
              isSelected ? 'text-primary-600 font-medium' : 'text-slate-700',
              isMissingContent && !isSelected && 'text-red-700 font-medium',
            )}
          >
            {suggestion.title}
          </p>

          {/* Checkbox - always visible, for batch selection */}
          <SelectionCheckbox
            checked={isChecked}
            onChange={handleCheckboxChange}
            className="mt-0.5"
          />
        </div>

        {/* Explanation */}
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{suggestion.explanation}</p>

        {/* Category badge */}
        <div className="mt-3">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border',
              getBadgeStyle(suggestion.severity, suggestion.type),
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', categoryColor.bg)} />
            {getCategoryLabel(suggestion.category, suggestion.type)}
          </span>
        </div>
      </button>

      {/* Action buttons - only show when selected */}
      {isSelected && (
        <div className="px-4 pb-4">
          {/* Edit Preview - shown when Edit is clicked */}
          {isEditPreviewOpen && (
            <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              {/* Proposed text display */}
              <div className="text-sm text-slate-800 leading-relaxed mb-3">
                {suggestion.afterText}
              </div>

              {/* Cancel/Apply buttons */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsEditPreviewOpen(false)}
                  className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyWithAnimation}
                  className="px-4 py-1.5 rounded-lg bg-green-500 text-sm font-medium text-white hover:bg-green-600 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-3 border-t border-dashed border-slate-200">
            {/* Ignore button */}
            <button
              type="button"
              onClick={() => {
                onDismiss(suggestion.id);
                onSelectionChange?.(false);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-slate-200 text-sm text-slate-600 hover:border-slate-300 hover:text-slate-800 transition-colors"
            >
              <span className="text-base">×</span>
              <span>Ignore</span>
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Edit button - toggles preview */}
            <button
              type="button"
              onClick={() => setIsEditPreviewOpen(!isEditPreviewOpen)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 text-sm transition-colors',
                isEditPreviewOpen
                  ? 'border-primary-400 text-primary-600 bg-primary-50'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800',
              )}
            >
              <span className="text-base">✎</span>
              <span>Edit</span>
            </button>

            {/* Add/Apply button - different styling and label for missing content */}
            <button
              type="button"
              onClick={handleApplyWithAnimation}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                isMissingContent
                  ? 'bg-primary-500 text-white hover:bg-primary-600'
                  : 'bg-green-500 text-white hover:bg-green-600',
              )}
            >
              {isMissingContent ? (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Add</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Apply</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ============================================================================
// AI Suggestion Groups (for new AI suggestions format)
// ============================================================================

type GroupByMode = 'section' | 'priority';

// Map targetPath to human-readable section name
function getSectionFromTargetPath(targetPath: string): string {
  if (targetPath.startsWith('summary')) return 'Summary';
  if (targetPath.startsWith('experience')) return 'Experience';
  if (targetPath.startsWith('education')) return 'Education';
  if (targetPath.startsWith('skills')) return 'Skills';
  if (targetPath.startsWith('projects')) return 'Projects';
  if (targetPath.startsWith('certifications')) return 'Certifications';
  if (targetPath.startsWith('achievements')) return 'Achievements';
  if (targetPath.startsWith('contact')) return 'Contact';
  return 'Other';
}

// Section order for grouping
const SECTION_ORDER: Record<string, number> = {
  Contact: 0,
  Summary: 1,
  Experience: 2,
  Education: 3,
  Skills: 4,
  Projects: 5,
  Certifications: 6,
  Achievements: 7,
  Other: 8,
};

// Group by toggle component
function GroupByToggle({
  value,
  onChange,
}: {
  value: GroupByMode;
  onChange: (mode: GroupByMode) => void;
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-sm text-slate-500">Group by</span>
      <div className="flex rounded-lg border border-slate-200 overflow-hidden">
        <button
          type="button"
          onClick={() => onChange('section')}
          className={cn(
            'px-3 py-1.5 text-sm font-medium transition-colors',
            value === 'section'
              ? 'bg-primary-500 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50',
          )}
        >
          Section
        </button>
        <button
          type="button"
          onClick={() => onChange('priority')}
          className={cn(
            'px-3 py-1.5 text-sm font-medium transition-colors border-l border-slate-200',
            value === 'priority'
              ? 'bg-primary-500 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50',
          )}
        >
          Priority
        </button>
      </div>
    </div>
  );
}

// Section header component
function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-3 first:mt-0">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</span>
      <span className="text-xs text-slate-400">({count})</span>
    </div>
  );
}

interface AISuggestionGroupsProps {
  suggestions: AISuggestion[];
  onApply: (suggestionId: string, afterText: string) => void;
  onDismiss: (suggestionId: string) => void;
  onScrollTo?: (targetPath: string) => void;
  // Selection props - only one can be selected at a time (shows purple outline + buttons)
  selectedId?: string | null;
  onSelectionChange?: (id: string, selected: boolean) => void;
  // Checkbox props - multiple can be checked for batch operations
  checkedIds?: Set<string>;
  onCheckChange?: (id: string, checked: boolean) => void;
}

export function AISuggestionGroups({
  suggestions,
  onApply,
  onDismiss,
  onScrollTo,
  selectedId,
  onSelectionChange,
  checkedIds,
  onCheckChange,
}: AISuggestionGroupsProps) {
  // Track which suggestions have valid DOM elements (for highlighting)
  const [validTargetPaths, setValidTargetPaths] = useState<Set<string>>(new Set());
  // Group by mode - default to section
  const [groupBy, setGroupBy] = useState<GroupByMode>('section');

  // Check which suggestions have corresponding DOM elements
  // This runs after render to ensure the canvas is mounted
  useEffect(() => {
    // Small delay to ensure canvas DOM is fully rendered
    const checkTimer = setTimeout(() => {
      const validPaths = new Set<string>();
      for (const suggestion of suggestions) {
        const element = getSpanElement(suggestion.targetPath);
        if (element) {
          validPaths.add(suggestion.targetPath);
        }
      }
      setValidTargetPaths(validPaths);
    }, 100);

    return () => clearTimeout(checkTimer);
  }, [suggestions]);

  // Filter suggestions - only show those with valid DOM targets
  const filteredSuggestions = useMemo(() => {
    return suggestions.filter((s) => {
      // If we haven't checked yet (validTargetPaths is empty), show all
      // This prevents flash of empty content on initial render
      if (validTargetPaths.size === 0 && suggestions.length > 0) {
        return true;
      }
      return validTargetPaths.has(s.targetPath);
    });
  }, [suggestions, validTargetPaths]);

  // Group and sort suggestions based on mode
  const groupedSuggestions = useMemo(() => {
    if (groupBy === 'priority') {
      // Group by severity
      const groups: Record<string, AISuggestion[]> = {
        critical: [],
        important: [],
        polish: [],
      };
      for (const s of filteredSuggestions) {
        groups[s.severity].push(s);
      }
      return groups;
    } else {
      // Group by section
      const groups: Record<string, AISuggestion[]> = {};
      for (const s of filteredSuggestions) {
        const section = getSectionFromTargetPath(s.targetPath);
        if (!groups[section]) {
          groups[section] = [];
        }
        groups[section].push(s);
      }
      // Sort within each section by severity
      for (const section of Object.keys(groups)) {
        groups[section].sort((a, b) => {
          const severityOrder = { critical: 0, important: 1, polish: 2 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        });
      }
      return groups;
    }
  }, [filteredSuggestions, groupBy]);

  // Get ordered group keys
  const orderedGroupKeys = useMemo(() => {
    const keys = Object.keys(groupedSuggestions).filter((k) => groupedSuggestions[k].length > 0);
    if (groupBy === 'priority') {
      return ['critical', 'important', 'polish'].filter((k) => keys.includes(k));
    } else {
      return keys.sort((a, b) => (SECTION_ORDER[a] ?? 99) - (SECTION_ORDER[b] ?? 99));
    }
  }, [groupedSuggestions, groupBy]);

  // Get display label for group
  const getGroupLabel = (key: string): string => {
    if (groupBy === 'priority') {
      switch (key) {
        case 'critical':
          return 'Critical';
        case 'important':
          return 'Important';
        case 'polish':
          return 'Polish';
        default:
          return key;
      }
    }
    return key;
  };

  const hasSuggestions = filteredSuggestions.length > 0;

  if (!hasSuggestions) {
    return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-2">✨</div>
        <p className="text-sm font-medium text-slate-900">Looking great!</p>
        <p className="text-xs text-slate-500 mt-1">No suggestions at the moment</p>
      </div>
    );
  }

  // Render a single suggestion card
  const renderSuggestionCard = (suggestion: AISuggestion) => (
    <AISuggestionCard
      key={suggestion.id}
      suggestion={suggestion}
      onApply={onApply}
      onDismiss={onDismiss}
      onScrollTo={onScrollTo}
      isSelected={selectedId === suggestion.id}
      onSelectionChange={
        onSelectionChange ? (selected) => onSelectionChange(suggestion.id, selected) : undefined
      }
      isChecked={checkedIds?.has(suggestion.id) ?? false}
      onCheckChange={onCheckChange ? (checked) => onCheckChange(suggestion.id, checked) : undefined}
    />
  );

  return (
    <div className="px-4 pt-3 pb-4">
      {/* Group by toggle */}
      <GroupByToggle value={groupBy} onChange={setGroupBy} />

      {/* Grouped suggestions */}
      {orderedGroupKeys.map((groupKey) => (
        <div key={groupKey}>
          <SectionHeader
            title={getGroupLabel(groupKey)}
            count={groupedSuggestions[groupKey].length}
          />
          {groupedSuggestions[groupKey].map(renderSuggestionCard)}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Batch Selection Footer
// ============================================================================

interface BatchSelectionFooterProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onApplySelected: () => void;
  onDismissSelected: () => void;
}

export function BatchSelectionFooter({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onApplySelected,
  onDismissSelected,
}: BatchSelectionFooterProps) {
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="border-t border-slate-200 bg-white p-3 space-y-3">
      {/* Selection controls row */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-600">{selectedCount} selected</span>
        <div className="flex items-center gap-3">
          {/* Select All - using label with checkbox for proper a11y */}
          <label className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 cursor-pointer">
            <SelectionCheckbox
              checked={allSelected}
              onChange={() => (allSelected ? onDeselectAll() : onSelectAll())}
              className="w-4 h-4"
            />
            <span>Select All</span>
          </label>
          <button
            type="button"
            onClick={onDeselectAll}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Action buttons row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDismissSelected}
          disabled={selectedCount === 0}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors',
            selectedCount === 0
              ? 'border-slate-200 text-slate-400 cursor-not-allowed'
              : 'border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800',
          )}
        >
          <span>×</span>
          <span>Ignore {selectedCount} Selected</span>
        </button>
        <button
          type="button"
          onClick={onApplySelected}
          disabled={selectedCount === 0}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
            selectedCount === 0
              ? 'bg-green-200 text-green-400 cursor-not-allowed'
              : 'bg-green-500 text-white hover:bg-green-600',
          )}
        >
          <Check className="h-4 w-4" />
          <span>Apply {selectedCount} Selected</span>
        </button>
      </div>
    </div>
  );
}
