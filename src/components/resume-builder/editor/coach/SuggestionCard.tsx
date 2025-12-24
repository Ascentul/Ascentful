'use client';

import { ChevronRight } from 'lucide-react';
import { useState } from 'react';

import type { ScoreResponse, Suggestion as AISuggestion } from '@/lib/ai/schemas';
import { cn } from '@/lib/utils';
import type { Suggestion, SuggestionType } from '@/types/resume-editor';

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
}

// Category colors matching the ScoreCard subscores
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  impact: { bg: 'bg-orange-500', text: 'text-orange-500' },
  clarity: { bg: 'bg-green-500', text: 'text-green-500' },
  relevance: { bg: 'bg-amber-500', text: 'text-amber-500' },
  consistency: { bg: 'bg-cyan-500', text: 'text-cyan-500' },
  ats: { bg: 'bg-blue-500', text: 'text-blue-500' },
  brevity: { bg: 'bg-cyan-500', text: 'text-cyan-500' },
};

// Map suggestion types to their parent category (matching ScoreCard subscores)
function getTypeCategory(type: SuggestionType): string {
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
        <button
          type="button"
          onClick={handleScrollTo}
          className="text-xs text-primary-600 hover:text-primary-700 ml-auto transition-colors"
        >
          Show in resume
        </button>
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

// Severity badge colors for AI suggestions
const SEVERITY_COLORS: Record<AISuggestion['severity'], { bg: string; text: string }> = {
  critical: { bg: 'bg-red-100', text: 'text-red-700' },
  important: { bg: 'bg-amber-100', text: 'text-amber-700' },
  polish: { bg: 'bg-slate-100', text: 'text-slate-600' },
};

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
  }
}

export function AISuggestionCard({
  suggestion,
  onApply,
  onDismiss,
  onScrollTo,
}: AISuggestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const categoryColor = getAICategoryColor(suggestion.category);
  const severityColor = SEVERITY_COLORS[suggestion.severity];

  const handleCardClick = () => {
    if (!isExpanded) {
      setIsExpanded(true);
    }
  };

  const handleScrollTo = () => {
    onScrollTo?.(suggestion.targetPath);
  };

  // Collapsed view
  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={handleCardClick}
        className="w-full text-left mb-2 p-3 rounded-xl border-2 border-slate-200 hover:border-primary-300 bg-white transition-all group"
      >
        <div className="flex items-center gap-3">
          {/* Category color dot */}
          <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', categoryColor.bg)} />

          {/* Title */}
          <p className="text-sm text-slate-700 flex-1 line-clamp-2 leading-relaxed">
            {suggestion.title}
          </p>

          {/* Severity badge */}
          <span
            className={cn(
              'text-xs px-1.5 py-0.5 rounded font-medium',
              severityColor.bg,
              severityColor.text,
            )}
          >
            {suggestion.severity === 'critical'
              ? '!'
              : suggestion.severity === 'important'
                ? '•'
                : '○'}
          </span>

          {/* Chevron */}
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 flex-shrink-0 transition-colors" />
        </div>
      </button>
    );
  }

  // Expanded view with before/after comparison
  return (
    <div className="mb-2 p-4 rounded-xl border-2 border-primary-400 bg-white shadow-sm">
      {/* Header with category and severity */}
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-2.5 h-2.5 rounded-full', categoryColor.bg)} />
        <span className={cn('text-xs font-medium uppercase tracking-wide', categoryColor.text)}>
          {suggestion.category}
        </span>
        <span
          className={cn(
            'text-xs px-1.5 py-0.5 rounded font-medium ml-auto',
            severityColor.bg,
            severityColor.text,
          )}
        >
          {suggestion.severity}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-slate-900 mb-2">{suggestion.title}</p>

      {/* Explanation */}
      <p className="text-xs text-slate-500 mb-3 leading-relaxed">{suggestion.explanation}</p>

      {/* Before/After comparison */}
      {suggestion.beforeText && suggestion.afterText && (
        <div className="mb-3 space-y-2">
          <div className="p-2.5 bg-red-50 rounded-lg border border-red-100">
            <p className="text-xs text-red-600 mb-1 font-medium">Before:</p>
            <p className="text-sm text-slate-700">{suggestion.beforeText}</p>
          </div>
          <div className="p-2.5 bg-green-50 rounded-lg border border-green-100">
            <p className="text-xs text-green-600 mb-1 font-medium">After:</p>
            <p className="text-sm text-slate-900 font-medium">{suggestion.afterText}</p>
          </div>
        </div>
      )}

      {/* Score impact indicator */}
      {suggestion.estimatedScoreImpact > 0 && (
        <p className="text-xs text-green-600 mb-3">
          +{suggestion.estimatedScoreImpact} points estimated impact
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => onApply(suggestion.id, suggestion.afterText)}
          className="flex-1 text-sm font-medium text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => onDismiss(suggestion.id)}
          className="text-sm text-slate-600 hover:text-slate-800 px-4 py-2 transition-colors"
        >
          Dismiss
        </button>
        {onScrollTo && (
          <button
            type="button"
            onClick={handleScrollTo}
            className="text-xs text-primary-600 hover:text-primary-700 ml-auto transition-colors"
          >
            Show in resume
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// AI Top Issue Card (from AI scoring)
// ============================================================================

type AITopIssue = ScoreResponse['topIssues'][number];

interface AITopIssueCardProps {
  issue: AITopIssue;
  onApply?: (issue: AITopIssue) => void;
}

function getAIIssueDot(category: AITopIssue['category']): string {
  return CATEGORY_COLORS[category]?.bg ?? 'bg-slate-400';
}

function AITopIssueCard({ issue, onApply }: AITopIssueCardProps) {
  return (
    <button
      type="button"
      onClick={() => onApply?.(issue)}
      className="w-full text-left mb-2 p-3 rounded-xl border-2 border-slate-200 hover:border-primary-300 bg-white transition-all group"
    >
      <div className="flex items-center gap-3">
        <div
          className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', getAIIssueDot(issue.category))}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 line-clamp-2 leading-relaxed">{issue.issue}</p>
          <p className="text-xs text-slate-500 mt-1 line-clamp-1">{issue.fix}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 flex-shrink-0 transition-colors" />
      </div>
    </button>
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
}

export function AISuggestionGroups({
  suggestions,
  onApply,
  onDismiss,
  onScrollTo,
  aiIssues,
  onApplyAIIssue,
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
    <div className="px-4 pt-3">
      {hasAIIssues && (
        <div className="mb-2">
          {aiIssues?.map((issue, index) => (
            <AITopIssueCard
              key={`${issue.category}-${issue.location}-${index}`}
              issue={issue}
              onApply={onApplyAIIssue}
            />
          ))}
        </div>
      )}
      {sortedSuggestions.map((suggestion) => (
        <AISuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          onApply={onApply}
          onDismiss={onDismiss}
          onScrollTo={onScrollTo}
        />
      ))}
    </div>
  );
}
