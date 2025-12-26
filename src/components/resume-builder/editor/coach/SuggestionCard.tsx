'use client';

import { Check, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import type { ScoreResponse, Suggestion as AISuggestion } from '@/lib/ai/schemas';
import { cn } from '@/lib/utils';
import type { Suggestion, SuggestionType } from '@/types/resume-editor';

// Checkbox component for selection
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
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        'w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0',
        checked
          ? 'bg-primary-500 border-primary-500 text-white'
          : 'border-slate-300 hover:border-primary-400 bg-white',
        className,
      )}
      aria-label={checked ? 'Deselect' : 'Select'}
    >
      {checked && <Check className="h-3 w-3" />}
    </button>
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

  // Get category label for the badge
  const getCategoryLabel = (category: AISuggestion['category']) => {
    switch (category) {
      case 'impact':
        return 'Missing Info';
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
              'border-amber-200 bg-amber-50 text-amber-700',
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', categoryColor.bg)} />
            {getCategoryLabel(suggestion.category)}
          </span>
        </div>
      </button>

      {/* Action buttons - only show when selected */}
      {isSelected && (
        <div className="px-4 pb-4">
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

            {/* Edit button */}
            <button
              type="button"
              onClick={() => onScrollTo?.(suggestion.targetPath)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-slate-200 text-sm text-slate-600 hover:border-slate-300 hover:text-slate-800 transition-colors"
            >
              <span className="text-base">✎</span>
              <span>Edit</span>
            </button>

            {/* Apply button */}
            <button
              type="button"
              onClick={() => {
                onApply(suggestion.id, suggestion.afterText);
                onSelectionChange?.(false);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-500 text-sm font-medium text-white hover:bg-green-600 transition-colors"
            >
              <Check className="h-4 w-4" />
              <span>Apply</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AI Top Issue Card (from AI scoring)
// Same style as AISuggestionCard with checkbox and Ignore/Edit/Apply buttons
// ============================================================================

type AITopIssue = ScoreResponse['topIssues'][number];

interface AITopIssueCardProps {
  issue: AITopIssue;
  onApply?: (issue: AITopIssue) => void;
  onDismiss?: (issue: AITopIssue) => void;
  onScrollTo?: (location: string) => void;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  isChecked?: boolean;
  onCheckChange?: (checked: boolean) => void;
}

function AITopIssueCard({
  issue,
  onApply,
  onDismiss,
  onScrollTo,
  isSelected = false,
  onSelectionChange,
  isChecked = false,
  onCheckChange,
}: AITopIssueCardProps) {
  const categoryColor = getAICategoryColor(issue.category);

  // Clicking checkbox toggles checked state for batch operations
  const handleCheckboxChange = (checked: boolean) => {
    onCheckChange?.(checked);
  };

  // Clicking card selects it (shows purple outline and action buttons)
  const handleCardClick = () => {
    if (!isSelected) {
      onSelectionChange?.(true);
    }
  };

  // Get category label for the badge
  const getCategoryLabel = (category: AITopIssue['category']) => {
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

  return (
    <div
      className={cn(
        'mb-2 rounded-xl border-2 bg-white transition-all',
        isSelected ? 'border-primary-400 shadow-sm' : 'border-slate-200 hover:border-primary-300',
      )}
    >
      {/* Card content - clickable to select */}
      <button type="button" onClick={handleCardClick} className="w-full text-left p-4">
        {/* Header row with title and checkbox */}
        <div className="flex items-start gap-3">
          {/* Issue title */}
          <p
            className={cn(
              'text-sm flex-1 leading-relaxed',
              isSelected ? 'text-primary-600 font-medium' : 'text-slate-700',
            )}
          >
            {issue.issue}
          </p>

          {/* Checkbox - always visible, for batch selection */}
          <SelectionCheckbox
            checked={isChecked}
            onChange={handleCheckboxChange}
            className="mt-0.5"
          />
        </div>

        {/* Suggested fix as explanation */}
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{issue.fix}</p>

        {/* Category badge */}
        <div className="mt-3">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border',
              'border-amber-200 bg-amber-50 text-amber-700',
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', categoryColor.bg)} />
            {getCategoryLabel(issue.category)}
          </span>
        </div>
      </button>

      {/* Action buttons - only show when selected */}
      {isSelected && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 pt-3 border-t border-dashed border-slate-200">
            {/* Ignore button */}
            <button
              type="button"
              onClick={() => {
                onDismiss?.(issue);
                onSelectionChange?.(false);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-slate-200 text-sm text-slate-600 hover:border-slate-300 hover:text-slate-800 transition-colors"
            >
              <span className="text-base">×</span>
              <span>Ignore</span>
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Edit button */}
            <button
              type="button"
              onClick={() => onScrollTo?.(issue.location)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-slate-200 text-sm text-slate-600 hover:border-slate-300 hover:text-slate-800 transition-colors"
            >
              <span className="text-base">✎</span>
              <span>Edit</span>
            </button>

            {/* Apply button */}
            <button
              type="button"
              onClick={() => {
                onApply?.(issue);
                onSelectionChange?.(false);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-500 text-sm font-medium text-white hover:bg-green-600 transition-colors"
            >
              <Check className="h-4 w-4" />
              <span>Apply</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AI Suggestion Groups (for new AI suggestions format)
// ============================================================================

interface AISuggestionGroupsProps {
  suggestions: AISuggestion[];
  onApply: (suggestionId: string, afterText: string) => void;
  onDismiss: (suggestionId: string) => void;
  onScrollTo?: (targetPath: string) => void;
  aiIssues?: AITopIssue[];
  onApplyAIIssue?: (issue: AITopIssue) => void;
  onDismissAIIssue?: (issue: AITopIssue) => void;
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
  aiIssues,
  onApplyAIIssue,
  onDismissAIIssue,
  selectedId,
  onSelectionChange,
  checkedIds,
  onCheckChange,
}: AISuggestionGroupsProps) {
  // Sort by severity: critical first, then important, then polish
  const sortedSuggestions = [...suggestions].sort((a, b) => {
    const severityOrder = { critical: 0, important: 1, polish: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const hasAIIssues = Boolean(aiIssues && aiIssues.length > 0);

  if (sortedSuggestions.length === 0 && !hasAIIssues) {
    return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-2">✨</div>
        <p className="text-sm font-medium text-slate-900">Looking great!</p>
        <p className="text-xs text-slate-500 mt-1">No suggestions at the moment</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-3 pb-4">
      {hasAIIssues && (
        <div className="mb-2">
          {aiIssues?.map((issue, index) => {
            // Create a unique ID for the issue for selection tracking
            const issueId = `issue-${issue.category}-${index}`;
            return (
              <AITopIssueCard
                key={issueId}
                issue={issue}
                onApply={onApplyAIIssue}
                onDismiss={onDismissAIIssue}
                onScrollTo={onScrollTo}
                isSelected={selectedId === issueId}
                onSelectionChange={
                  onSelectionChange ? (selected) => onSelectionChange(issueId, selected) : undefined
                }
                isChecked={checkedIds?.has(issueId) ?? false}
                onCheckChange={
                  onCheckChange ? (checked) => onCheckChange(issueId, checked) : undefined
                }
              />
            );
          })}
        </div>
      )}
      {sortedSuggestions.map((suggestion) => (
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
          onCheckChange={
            onCheckChange ? (checked) => onCheckChange(suggestion.id, checked) : undefined
          }
        />
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
          <button
            type="button"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
          >
            <SelectionCheckbox
              checked={allSelected}
              onChange={() => (allSelected ? onDeselectAll() : onSelectAll())}
              className="w-4 h-4"
            />
            <span>Select All</span>
          </button>
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
