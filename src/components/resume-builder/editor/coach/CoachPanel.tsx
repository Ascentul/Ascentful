'use client';

import type { GroupedSuggestions, ResumeScore, TopFix } from '@/types/resume-editor';

import { ScoreCard } from './ScoreCard';
import { SuggestionGroups } from './SuggestionCard';
import { TopFixesList } from './TopFixesList';

interface CoachPanelProps {
  score: ResumeScore | null;
  scoreLoading?: boolean;
  groupedSuggestions: GroupedSuggestions;
  topFixes: TopFix[];
  onApplySuggestion: (suggestionId: string) => void;
  onDismissSuggestion: (suggestionId: string) => void;
  onApplyFix: (fix: TopFix) => void;
  onScrollToSpan: (spanId: string) => void;
}

export function CoachPanel({
  score,
  scoreLoading,
  groupedSuggestions,
  topFixes,
  onApplySuggestion,
  onDismissSuggestion,
  onApplyFix,
  onScrollToSpan,
}: CoachPanelProps) {
  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col h-full">
      {/* Pinned score card */}
      <ScoreCard score={score} loading={scoreLoading} />

      {/* Tips header */}
      <div className="px-4 py-2 border-b border-slate-200">
        <h3 className="text-sm font-medium text-slate-900">Tips</h3>
      </div>

      {/* Tips content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <TopFixesList fixes={topFixes} onApplyFix={onApplyFix} />
        <SuggestionGroups
          critical={groupedSuggestions.critical}
          improve={groupedSuggestions.improve}
          optional={groupedSuggestions.optional}
          onApply={onApplySuggestion}
          onDismiss={onDismissSuggestion}
          onScrollTo={onScrollToSpan}
        />
      </div>
    </div>
  );
}
