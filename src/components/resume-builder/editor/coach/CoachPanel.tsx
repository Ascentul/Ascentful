'use client';

import { FileText, Lightbulb, Sparkles, X } from 'lucide-react';
import { useState } from 'react';

import type { ScoreResponse, Suggestion as AISuggestion } from '@/lib/ai/schemas';
import { cn } from '@/lib/utils';
import type { GroupedSuggestions, ResumeScore, TopFix } from '@/types/resume-editor';

import { ScoreCard } from './ScoreCard';
import { AISuggestionGroups, SuggestionGroups } from './SuggestionCard';
import { TopFixesList } from './TopFixesList';

// AI top issue type from ScoreResponse
type AITopIssue = ScoreResponse['topIssues'][number];

// Tab types for the coach panel
type CoachTab = 'tips' | 'tailor';

interface CoachPanelProps {
  // Legacy score props
  score: ResumeScore | null;
  scoreLoading?: boolean;
  groupedSuggestions: GroupedSuggestions;
  topFixes: TopFix[];
  onApplySuggestion: (suggestionId: string) => void;
  onDismissSuggestion: (suggestionId: string) => void;
  onScrollToSpan: (spanId: string) => void;

  // New AI props (optional - when provided, uses AI features)
  aiScore?: ScoreResponse | null;
  aiSuggestions?: AISuggestion[];
  matchScore?: number | null;
  onApplyAISuggestion?: (suggestionId: string, afterText: string) => void;
  onDismissAISuggestion?: (suggestionId: string) => void;
  onApplyAIFix?: (issue: AITopIssue) => void;
  onScrollToTarget?: (targetPath: string) => void;

  // JD input props
  jobDescription?: string;
  onJobDescriptionChange?: (jd: string) => void;
  onAnalyzeJD?: () => void;
  jdLoading?: boolean;
}

export function CoachPanel({
  score,
  scoreLoading,
  groupedSuggestions,
  topFixes,
  onApplySuggestion,
  onDismissSuggestion,
  onScrollToSpan,
  // AI props
  aiScore,
  aiSuggestions,
  matchScore,
  onApplyAISuggestion,
  onDismissAISuggestion,
  onApplyAIFix,
  onScrollToTarget,
  // JD props
  jobDescription,
  onJobDescriptionChange,
  onAnalyzeJD,
  jdLoading,
}: CoachPanelProps) {
  // Default to 'tips' tab
  const [activeTab, setActiveTab] = useState<CoachTab>('tips');

  // Determine if we should use AI features
  const useAIScore = aiScore !== undefined && aiScore !== null;
  const useAISuggestions = aiSuggestions !== undefined && aiSuggestions.length > 0;
  const hasJDSupport = onJobDescriptionChange !== undefined;

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col h-full">
      {/* Score card - supports both legacy and AI formats */}
      <ScoreCard score={score} aiScore={aiScore} loading={scoreLoading} matchScore={matchScore} />

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('tips')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'tips'
              ? 'text-primary-600 border-b-2 border-primary-500 bg-primary-50/50'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50',
          )}
        >
          <Lightbulb className="h-4 w-4" />
          Tips
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tailor')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'tailor'
              ? 'text-primary-600 border-b-2 border-primary-500 bg-primary-50/50'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50',
            jobDescription && activeTab !== 'tailor' && 'relative',
          )}
        >
          <Sparkles className="h-4 w-4" />
          Tailor with AI
          {/* Active indicator when JD is loaded */}
          {jobDescription && activeTab !== 'tailor' && (
            <span className="absolute top-1.5 right-2 w-2 h-2 bg-green-500 rounded-full" />
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {activeTab === 'tips' ? (
          <>
            {/* Top fixes - supports both legacy and AI formats */}
            <TopFixesList fixes={topFixes} aiIssues={useAIScore ? aiScore.topIssues : undefined} />

            {/* Suggestions - use AI format if available, otherwise legacy */}
            {useAISuggestions && onApplyAISuggestion && onDismissAISuggestion ? (
              <AISuggestionGroups
                suggestions={aiSuggestions}
                onApply={onApplyAISuggestion}
                onDismiss={onDismissAISuggestion}
                onScrollTo={onScrollToTarget}
                aiIssues={useAIScore ? aiScore.topIssues : undefined}
                onApplyAIIssue={onApplyAIFix}
              />
            ) : (
              <SuggestionGroups
                critical={groupedSuggestions.critical}
                improve={groupedSuggestions.improve}
                optional={groupedSuggestions.optional}
                onApply={onApplySuggestion}
                onDismiss={onDismissSuggestion}
                onScrollTo={onScrollToSpan}
              />
            )}
          </>
        ) : (
          /* Tailor with AI tab content */
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary-50">
                <FileText className="h-5 w-5 text-primary-500" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-900">Job Description</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Paste a job description to get tailored suggestions and match score
                </p>
              </div>
            </div>

            {/* JD Input */}
            {hasJDSupport && (
              <div className="space-y-3">
                <div className="relative">
                  <textarea
                    value={jobDescription || ''}
                    onChange={(e) => onJobDescriptionChange?.(e.target.value)}
                    placeholder="Paste job description here..."
                    className={cn(
                      'w-full h-40 text-xs p-3 rounded-lg border resize-none',
                      'border-slate-200 focus:border-primary-400 focus:ring-1 focus:ring-primary-400',
                      'placeholder:text-slate-400',
                    )}
                  />
                  {jobDescription && (
                    <button
                      type="button"
                      onClick={() => onJobDescriptionChange?.('')}
                      className="absolute top-2 right-2 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                      aria-label="Clear job description"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Analyze button */}
                {onAnalyzeJD && (
                  <button
                    type="button"
                    onClick={onAnalyzeJD}
                    disabled={jdLoading || !jobDescription}
                    className={cn(
                      'w-full text-sm font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2',
                      jdLoading || !jobDescription
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-primary-500 text-white hover:bg-primary-600',
                    )}
                  >
                    <Sparkles className="h-4 w-4" />
                    {jdLoading ? 'Analyzing...' : 'Analyze & Match'}
                  </button>
                )}

                {/* Match score display when JD is analyzed */}
                {matchScore !== undefined && matchScore !== null && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-600">Match Score</span>
                      <span
                        className={cn(
                          'text-lg font-bold',
                          matchScore >= 80
                            ? 'text-green-600'
                            : matchScore >= 60
                              ? 'text-amber-600'
                              : 'text-red-500',
                        )}
                      >
                        {matchScore}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          matchScore >= 80
                            ? 'bg-green-500'
                            : matchScore >= 60
                              ? 'bg-amber-500'
                              : 'bg-red-500',
                        )}
                        style={{ width: `${matchScore}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {matchScore >= 80
                        ? 'Excellent match! Your resume aligns well with this role.'
                        : matchScore >= 60
                          ? 'Good match. Consider adding more relevant keywords.'
                          : 'Needs improvement. Review the suggestions to better match this role.'}
                    </p>
                  </div>
                )}

                {/* Empty state */}
                {!jobDescription && (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500">No job description added yet</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Paste a job posting to get AI-powered tailoring suggestions
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
