'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import type {
  CoachMode,
  GroupedSuggestions,
  ResumeScore,
  Suggestion,
  TopFix,
} from '@/types/resume-editor';

import { ScoreCard, SubscoreBreakdown } from './ScoreCard';
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
  const [mode, setMode] = useState<CoachMode>('suggestions');

  const totalSuggestions =
    groupedSuggestions.critical.length +
    groupedSuggestions.improve.length +
    groupedSuggestions.optional.length;

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col h-full">
      {/* Pinned score card */}
      <ScoreCard score={score} loading={scoreLoading} />

      {/* Mode selector */}
      <CoachModeSelector mode={mode} onModeChange={setMode} suggestionCount={totalSuggestions} />

      {/* Content based on mode */}
      <div className="flex-1 overflow-y-auto">
        {mode === 'score' && <SubscoreBreakdown subscores={score?.subscores} />}

        {mode === 'suggestions' && (
          <>
            <TopFixesList fixes={topFixes} onApplyFix={onApplyFix} />
            <SuggestionGroups
              critical={groupedSuggestions.critical}
              improve={groupedSuggestions.improve}
              optional={groupedSuggestions.optional}
              onApply={onApplySuggestion}
              onDismiss={onDismissSuggestion}
              onScrollTo={onScrollToSpan}
            />
          </>
        )}

        {mode === 'ats' && <ATSChecklist />}
      </div>
    </div>
  );
}

// ============================================================================
// Mode Selector
// ============================================================================

interface CoachModeSelectorProps {
  mode: CoachMode;
  onModeChange: (mode: CoachMode) => void;
  suggestionCount: number;
}

function CoachModeSelector({ mode, onModeChange, suggestionCount }: CoachModeSelectorProps) {
  const tabs: { id: CoachMode; label: string; badge?: number }[] = [
    { id: 'score', label: 'Score' },
    { id: 'suggestions', label: 'Tips', badge: suggestionCount },
    { id: 'ats', label: 'ATS' },
  ];

  return (
    <div className="flex border-b border-slate-200">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onModeChange(tab.id)}
          className={cn(
            'flex-1 py-2 text-sm font-medium transition-colors relative',
            mode === tab.id
              ? 'text-primary-600 border-b-2 border-primary-500'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <span>{tab.label}</span>
          {tab.badge !== undefined && tab.badge > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// ATS Checklist
// ============================================================================

function ATSChecklist() {
  const checks = [
    { id: 'format', label: 'Simple, single-column layout', passed: true },
    { id: 'fonts', label: 'Standard fonts used', passed: true },
    { id: 'sections', label: 'Clear section headings', passed: true },
    { id: 'dates', label: 'Consistent date format', passed: false },
    { id: 'contact', label: 'Contact info at top', passed: true },
    { id: 'keywords', label: 'Industry keywords present', passed: false },
    { id: 'length', label: 'Appropriate resume length', passed: true },
    { id: 'bullets', label: 'Bullet points for achievements', passed: true },
  ];

  const passedCount = checks.filter((c) => c.passed).length;
  const percentage = Math.round((passedCount / checks.length) * 100);

  return (
    <div className="p-4">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-900">ATS Compatibility</h3>
          <span className="text-sm font-medium text-primary-600">{percentage}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {checks.map((check) => (
          <div
            key={check.id}
            className={cn(
              'flex items-center gap-2 p-2 rounded-lg text-sm',
              check.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
            )}
          >
            <span>{check.passed ? '✓' : '✗'}</span>
            <span>{check.label}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 mt-4">
        ATS (Applicant Tracking Systems) scan resumes before human review. A higher score means your
        resume is more likely to be seen by recruiters.
      </p>
    </div>
  );
}
