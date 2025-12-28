'use client';

import { FileText, Lightbulb, RefreshCw, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ScoreResponse, Suggestion as AISuggestion } from '@/lib/ai/schemas';
import { cn } from '@/lib/utils';
import type { GroupedSuggestions, ResumeScore, TopFix } from '@/types/resume-editor';

import { ScoreCard } from './ScoreCard';
import { AISuggestionGroups, BatchSelectionFooter, SuggestionGroups } from './SuggestionCard';
import { TopFixesList } from './TopFixesList';

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
  onScrollToTarget?: (targetPath: string) => void;

  // JD input props
  jobDescription?: string;
  onJobDescriptionChange?: (jd: string) => void;
  onAnalyzeJD?: () => void;
  jdLoading?: boolean;

  // Bidirectional linking - when a track change is clicked on canvas, this is set
  focusedSuggestionId?: string | null;
  // Callback when a suggestion is selected (for switching to review mode)
  onSuggestionSelect?: (suggestionId: string, targetPath: string) => void;

  // Rerun AI review
  onRerunAIReview?: () => void;
  aiReviewLoading?: boolean;
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
  onScrollToTarget,
  // JD props
  jobDescription,
  onJobDescriptionChange,
  onAnalyzeJD,
  jdLoading,
  // Bidirectional linking
  focusedSuggestionId,
  onSuggestionSelect,
  // Rerun AI review
  onRerunAIReview,
  aiReviewLoading,
}: CoachPanelProps) {
  // Default to 'tips' tab
  const [activeTab, setActiveTab] = useState<CoachTab>('tips');

  // Card selection state - only one card can show purple outline + buttons at a time
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);

  // Checkbox state - multiple cards can be checked for batch operations
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  // Sync selection state when focusedSuggestionId changes (from canvas click)
  useEffect(() => {
    if (focusedSuggestionId) {
      setSelectedSuggestionId(focusedSuggestionId);
      // Scroll the suggestion card into view
      requestAnimationFrame(() => {
        const cardElement = document.querySelector(
          `[data-suggestion-card-id="${focusedSuggestionId}"]`,
        );
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }, [focusedSuggestionId]);

  // Determine if we should use AI features
  const useAIScore = aiScore !== undefined && aiScore !== null;
  const useAISuggestions = aiSuggestions !== undefined && aiSuggestions.length > 0;
  const hasJDSupport = onJobDescriptionChange !== undefined;

  // Convert topIssues to Suggestion format so they can be grouped with other suggestions
  const convertedTopIssues: AISuggestion[] = useMemo(() => {
    if (!aiScore?.topIssues) return [];

    return aiScore.topIssues.map((issue, index) => {
      // Map location to a targetPath (e.g., "Experience" -> "experience-section")
      const locationLower = issue.location.toLowerCase();
      let targetPath = `${locationLower}-section`;

      // Handle common variations
      if (locationLower.includes('experience')) targetPath = 'experience-section';
      else if (locationLower.includes('summary')) targetPath = 'summary-text';
      else if (locationLower.includes('education')) targetPath = 'education-section';
      else if (locationLower.includes('skill')) targetPath = 'skills-list';
      else if (locationLower.includes('project')) targetPath = 'projects-section';
      else if (locationLower.includes('contact')) targetPath = 'contact-section';

      // Map category to severity
      const severityMap: Record<string, 'critical' | 'important' | 'polish'> = {
        impact: 'critical',
        ats: 'critical',
        clarity: 'important',
        brevity: 'polish',
      };

      return {
        id: `top-issue-${index}`,
        type: 'generic-content' as const,
        severity: severityMap[issue.category] || 'important',
        category: issue.category,
        targetType: 'section' as const,
        targetId: issue.location,
        targetPath,
        title: issue.issue,
        explanation: issue.fix,
        beforeText: '',
        afterText: issue.fix, // Use the fix as afterText for display
        estimatedScoreImpact: 3,
      };
    });
  }, [aiScore?.topIssues]);

  // Combine regular suggestions with converted top issues
  const allSuggestions = useMemo(() => {
    const suggestions = aiSuggestions || [];
    return [...convertedTopIssues, ...suggestions];
  }, [convertedTopIssues, aiSuggestions]);

  // Card selection handler - only one can be selected at a time (shows purple outline + buttons)
  const handleSelectionChange = useCallback(
    (id: string, selected: boolean) => {
      if (selected) {
        setSelectedSuggestionId(id);
        // Find the suggestion to get its targetPath and trigger review mode
        const suggestion = allSuggestions.find((s) => s.id === id);
        if (suggestion && onSuggestionSelect) {
          onSuggestionSelect(id, suggestion.targetPath);
        }
      } else {
        setSelectedSuggestionId(null);
      }
    },
    [allSuggestions, onSuggestionSelect],
  );

  // Checkbox handler - multiple can be checked, checking also deselects the card
  const handleCheckChange = useCallback(
    (id: string, checked: boolean) => {
      // When checking a box, deselect the card (hide purple outline + buttons)
      if (checked && selectedSuggestionId === id) {
        setSelectedSuggestionId(null);
      }

      setCheckedIds((prev) => {
        const next = new Set(prev);
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });
    },
    [selectedSuggestionId],
  );

  const handleSelectAll = useCallback(() => {
    const allIds = allSuggestions.map((s) => s.id);
    setCheckedIds(new Set(allIds));
    // Also deselect any selected card
    setSelectedSuggestionId(null);
  }, [allSuggestions]);

  const handleDeselectAll = useCallback(() => {
    setCheckedIds(new Set());
  }, []);

  // Apply all checked items
  const handleApplyChecked = useCallback(() => {
    if (checkedIds.size === 0) return;

    checkedIds.forEach((id) => {
      const suggestion = allSuggestions.find((s) => s.id === id);
      if (suggestion && onApplyAISuggestion) {
        onApplyAISuggestion(suggestion.id, suggestion.afterText);
      }
    });

    // Clear checked after applying
    setCheckedIds(new Set());
  }, [checkedIds, allSuggestions, onApplyAISuggestion]);

  // Dismiss all checked items
  const handleDismissChecked = useCallback(() => {
    if (checkedIds.size === 0) return;

    checkedIds.forEach((id) => {
      if (onDismissAISuggestion) {
        onDismissAISuggestion(id);
      }
    });

    // Clear checked after dismissing
    setCheckedIds(new Set());
  }, [checkedIds, onDismissAISuggestion]);

  return (
    <div className="w-[352px] bg-white border-l border-slate-200 flex flex-col h-full">
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
            {/* Rerun AI Review button */}
            {onRerunAIReview && (
              <div className="px-4 pt-3 pb-2">
                <button
                  type="button"
                  onClick={onRerunAIReview}
                  disabled={aiReviewLoading}
                  className={cn(
                    'w-full text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2',
                    aiReviewLoading
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200',
                  )}
                >
                  <RefreshCw className={cn('h-4 w-4', aiReviewLoading && 'animate-spin')} />
                  {aiReviewLoading ? 'Analyzing...' : 'Rerun AI Review'}
                </button>
              </div>
            )}

            {/* Top fixes - supports both legacy and AI formats */}
            <TopFixesList
              fixes={topFixes}
              aiIssues={useAIScore ? aiScore.topIssues : undefined}
              aiSuggestions={useAISuggestions ? aiSuggestions : undefined}
            />

            {/* Suggestions - use AI format if available, otherwise legacy */}
            {(useAISuggestions || convertedTopIssues.length > 0) &&
            onApplyAISuggestion &&
            onDismissAISuggestion ? (
              <AISuggestionGroups
                suggestions={allSuggestions}
                onApply={onApplyAISuggestion}
                onDismiss={onDismissAISuggestion}
                onScrollTo={onScrollToTarget}
                selectedId={selectedSuggestionId}
                onSelectionChange={handleSelectionChange}
                checkedIds={checkedIds}
                onCheckChange={handleCheckChange}
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

      {/* Batch selection footer - show when any checkboxes are checked */}
      {activeTab === 'tips' && checkedIds.size > 0 && (
        <BatchSelectionFooter
          selectedCount={checkedIds.size}
          totalCount={allSuggestions.length}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onApplySelected={handleApplyChecked}
          onDismissSelected={handleDismissChecked}
        />
      )}
    </div>
  );
}
