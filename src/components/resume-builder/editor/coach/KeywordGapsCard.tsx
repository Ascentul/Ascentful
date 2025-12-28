'use client';

import { AlertCircle, CheckCircle, Plus, Target } from 'lucide-react';

import type { MatchScoreResponse } from '@/lib/ai/schemas';
import { cn } from '@/lib/utils';

interface KeywordGapsCardProps {
  matchScore: MatchScoreResponse;
  onAddKeyword?: (keyword: string) => void;
  loading?: boolean;
}

export function KeywordGapsCard({ matchScore, onAddKeyword, loading }: KeywordGapsCardProps) {
  if (loading) {
    return (
      <div className="p-4 border-b border-slate-200">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-slate-200 rounded w-1/2" />
          <div className="flex flex-wrap gap-1">
            <div className="h-6 bg-slate-200 rounded-full w-16" />
            <div className="h-6 bg-slate-200 rounded-full w-20" />
            <div className="h-6 bg-slate-200 rounded-full w-14" />
          </div>
        </div>
      </div>
    );
  }

  const { keywordAnalysis, skillsAnalysis } = matchScore;
  const hasGaps = keywordAnalysis.missing.length > 0 || skillsAnalysis.gaps.length > 0;

  if (!hasGaps) {
    return (
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">All key requirements covered!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-slate-200 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-medium text-slate-900">Gaps to Address</h3>
        <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
          {keywordAnalysis.missing.length + skillsAnalysis.gaps.length}
        </span>
      </div>

      {/* Missing Keywords */}
      {keywordAnalysis.missing.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-slate-500 mb-2">Missing Keywords</h4>
          <div className="flex flex-wrap gap-1.5">
            {keywordAnalysis.missing.slice(0, 8).map((keyword) =>
              onAddKeyword ? (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => onAddKeyword(keyword)}
                  className={cn(
                    'group inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full',
                    'bg-red-50 text-red-700 hover:bg-red-100 transition-colors cursor-pointer',
                  )}
                >
                  <span>{keyword}</span>
                  <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ) : (
                <span
                  key={keyword}
                  className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-red-50 text-red-700"
                >
                  {keyword}
                </span>
              ),
            )}
            {keywordAnalysis.missing.length > 8 && (
              <span className="text-xs text-slate-400 px-2 py-1">
                +{keywordAnalysis.missing.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Skill Gaps */}
      {skillsAnalysis.gaps.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-slate-500 mb-2">Skill Gaps</h4>
          <ul className="space-y-2">
            {skillsAnalysis.gaps.slice(0, 4).map((gap) => (
              <li key={gap.skill} className="text-xs">
                <div className="flex items-start gap-2">
                  <AlertCircle
                    className={cn(
                      'h-3.5 w-3.5 mt-0.5 flex-shrink-0',
                      gap.importance === 'required'
                        ? 'text-red-500'
                        : gap.importance === 'preferred'
                          ? 'text-amber-500'
                          : 'text-slate-400',
                    )}
                  />
                  <div>
                    <span className="font-medium text-slate-700">{gap.skill}</span>
                    <span
                      className={cn(
                        'ml-1.5 text-xs px-1.5 py-0.5 rounded',
                        gap.importance === 'required'
                          ? 'bg-red-50 text-red-600'
                          : gap.importance === 'preferred'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-slate-100 text-slate-500',
                      )}
                    >
                      {gap.importance}
                    </span>
                    <p className="text-slate-500 mt-0.5">{gap.suggestion}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Matched Skills (collapsed) */}
      {skillsAnalysis.matched.length > 0 && (
        <details className="group">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 list-none flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span>{skillsAnalysis.matched.length} skills matched</span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {skillsAnalysis.matched.slice(0, 6).map((match) => (
              <span
                key={match.skill}
                className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700"
              >
                {match.skill}
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
