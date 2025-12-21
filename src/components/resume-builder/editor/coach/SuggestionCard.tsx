'use client';

import { AlertCircle, AlertTriangle, Check, ChevronDown, ChevronUp, Info, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Suggestion } from '@/types/resume-editor';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onApply: (suggestionId: string) => void;
  onDismiss: (suggestionId: string) => void;
  onScrollTo: (spanId: string) => void;
}

export function SuggestionCard({
  suggestion,
  onApply,
  onDismiss,
  onScrollTo,
}: SuggestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const severityConfig = getSeverityConfig(suggestion.severity);
  const Icon = severityConfig.icon;

  return (
    <div
      className={cn(
        'p-3 rounded-lg border transition-all cursor-pointer',
        'hover:shadow-sm',
        severityConfig.bgClass,
        severityConfig.borderClass,
      )}
      onClick={() => onScrollTo(suggestion.spanId)}
    >
      <div className="flex items-start gap-2">
        {/* Icon */}
        <div className={cn('mt-0.5', severityConfig.iconClass)}>
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900">{suggestion.message}</p>

          {/* Proposed text */}
          {suggestion.proposedText && (
            <div className="mt-2 p-2 bg-white rounded border border-slate-200">
              <p className="text-xs text-slate-500 mb-1">Suggested:</p>
              <p className="text-sm text-slate-700 italic">"{suggestion.proposedText}"</p>
            </div>
          )}

          {/* Expand for explanation */}
          {suggestion.explainText && (
            <div className="mt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
              >
                <Info className="h-3 w-3" />
                <span>Why this matters</span>
                {isExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
              {isExpanded && (
                <p className="text-xs text-slate-600 mt-1 pl-4 border-l-2 border-slate-200">
                  {suggestion.explainText}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-2 border-t border-slate-200/50">
        <Button
          size="sm"
          variant="default"
          onClick={(e) => {
            e.stopPropagation();
            onApply(suggestion.suggestionId);
          }}
          className="flex-1 h-7 text-xs"
        >
          <Check className="h-3 w-3 mr-1" />
          Accept
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(suggestion.suggestionId);
          }}
          className="h-7 text-xs text-slate-500"
        >
          <X className="h-3 w-3" />
        </Button>
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
  const groups = [
    { title: 'Critical', suggestions: critical, color: 'text-red-600' },
    { title: 'Improvements', suggestions: improve, color: 'text-amber-600' },
    { title: 'Optional', suggestions: optional, color: 'text-slate-500' },
  ];

  const totalCount = critical.length + improve.length + optional.length;

  if (totalCount === 0) {
    return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-2">✨</div>
        <p className="text-sm font-medium text-slate-900">Looking great!</p>
        <p className="text-xs text-slate-500 mt-1">No suggestions at the moment</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {groups.map(
        (group) =>
          group.suggestions.length > 0 && (
            <div key={group.title}>
              <h4 className={cn('text-xs font-semibold uppercase tracking-wide mb-2', group.color)}>
                {group.title} ({group.suggestions.length})
              </h4>
              <div className="space-y-2">
                {group.suggestions.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.suggestionId}
                    suggestion={suggestion}
                    onApply={onApply}
                    onDismiss={onDismiss}
                    onScrollTo={onScrollTo}
                  />
                ))}
              </div>
            </div>
          ),
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getSeverityConfig(severity: Suggestion['severity']) {
  switch (severity) {
    case 'critical':
      return {
        icon: AlertCircle,
        bgClass: 'bg-red-50',
        borderClass: 'border-red-200',
        iconClass: 'text-red-500',
      };
    case 'improve':
      return {
        icon: AlertTriangle,
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-200',
        iconClass: 'text-amber-500',
      };
    case 'optional':
      return {
        icon: Info,
        bgClass: 'bg-slate-50',
        borderClass: 'border-slate-200',
        iconClass: 'text-slate-400',
      };
  }
}
