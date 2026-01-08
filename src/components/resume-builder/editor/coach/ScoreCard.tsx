'use client';

import { Sparkles } from 'lucide-react';

import type { ScoreResponse } from '@/lib/ai/schemas';
import { getScoreMessage } from '@/lib/resume-score';
import { cn } from '@/lib/utils';
import type { ResumeScore } from '@/types/resume-editor';

// The component accepts either the legacy ResumeScore format or the new AI ScoreResponse
interface ScoreCardProps {
  score: ResumeScore | null;
  aiScore?: ScoreResponse | null;
  loading?: boolean;
  matchScore?: number | null; // Optional match score to display when JD is provided
}

// AI Score dimensions (shown when AI score is available)
type AIDimension = 'impact' | 'clarity' | 'ats' | 'brevity';

const AI_DIMENSION_CONFIG: Record<
  AIDimension,
  { label: string; weight: string; description: string; textColor: string; bgColor: string }
> = {
  impact: {
    label: 'Impact',
    weight: '35%',
    description: 'Strong verbs & quantified achievements',
    textColor: 'text-orange-500',
    bgColor: 'bg-orange-500',
  },
  clarity: {
    label: 'Clarity',
    weight: '25%',
    description: 'Clear, concise, easy to read',
    textColor: 'text-green-500',
    bgColor: 'bg-green-500',
  },
  ats: {
    label: 'ATS',
    weight: '25%',
    description: 'Keywords & format optimization',
    textColor: 'text-blue-500',
    bgColor: 'bg-blue-500',
  },
  brevity: {
    label: 'Brevity',
    weight: '15%',
    description: 'Concise without filler',
    textColor: 'text-cyan-500',
    bgColor: 'bg-cyan-500',
  },
};

// Legacy subscores (shown when only legacy score is available)
const VISIBLE_SUBSCORES = ['impact', 'clarity', 'relevance', 'consistency'] as const;

// Labels only for the visible legacy subscores
const SUBSCORE_LABELS: Record<
  (typeof VISIBLE_SUBSCORES)[number],
  { label: string; description: string; textColor: string; bgColor: string }
> = {
  impact: {
    label: 'Impact',
    description: 'Action verbs & quantified achievements',
    textColor: 'text-orange-500',
    bgColor: 'bg-orange-500',
  },
  clarity: {
    label: 'Clarity',
    description: 'Readability & conciseness',
    textColor: 'text-green-500',
    bgColor: 'bg-green-500',
  },
  relevance: {
    label: 'Relevance',
    description: 'Job fit & keyword matching',
    textColor: 'text-amber-500',
    bgColor: 'bg-amber-500',
  },
  consistency: {
    label: 'Consistency',
    description: 'Style & formatting uniformity',
    textColor: 'text-cyan-500',
    bgColor: 'bg-cyan-500',
  },
};

// Get color class based on score value (for overall score only)
function getScoreColorClass(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-500';
}

// Get match level color
function getMatchLevelColor(matchScore: number): string {
  if (matchScore >= 80) return 'text-green-600';
  if (matchScore >= 60) return 'text-amber-600';
  if (matchScore >= 40) return 'text-orange-500';
  return 'text-red-500';
}

export function ScoreCard({ score, aiScore, loading, matchScore }: ScoreCardProps) {
  // Determine which score source to use
  const hasAIScore = aiScore !== undefined && aiScore !== null;
  const hasLegacyScore = score !== null;
  const hasAnyScore = hasAIScore || hasLegacyScore;

  // Only show skeleton when loading AND no existing score to display
  if (loading && !hasAnyScore) {
    return (
      <div className="p-4 border-b border-slate-200">
        <div className="animate-pulse">
          <div className="h-10 w-20 bg-slate-200 rounded mx-auto mb-2" />
          <div className="h-3 w-32 bg-slate-200 rounded mx-auto mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-2 bg-slate-100 rounded-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!hasAnyScore) {
    return (
      <div className="p-4 border-b border-slate-200">
        <div className="text-center text-slate-500 text-sm">Add content to see your score</div>
      </div>
    );
  }

  // Use AI score if available, otherwise fall back to legacy
  const overallScore = hasAIScore ? aiScore.overall : score!.overallScore;

  return (
    <div className="p-4 border-b border-slate-200">
      {/* Match score badge (shown when JD is provided) */}
      {matchScore !== undefined && matchScore !== null && (
        <div className="flex items-center justify-center gap-2 mb-3 pb-3 border-b border-slate-100">
          <span className="text-xs text-slate-500">Job Match:</span>
          <span className={cn('text-sm font-semibold', getMatchLevelColor(matchScore))}>
            {matchScore}%
          </span>
        </div>
      )}

      {/* Overall score */}
      <div className={cn('text-center mb-4', loading && 'opacity-60')}>
        {hasAIScore && (
          <div className="flex items-center justify-center gap-1 text-xs text-primary-500 mb-1">
            <Sparkles className={cn('h-3 w-3', loading && 'animate-pulse')} />
            <span>{loading ? 'Updating...' : 'AI-Powered'}</span>
          </div>
        )}
        {!hasAIScore && loading && (
          <div className="flex items-center justify-center gap-1 text-xs text-primary-500 mb-1">
            <Sparkles className="h-3 w-3 animate-pulse" />
            <span>Analyzing...</span>
          </div>
        )}
        <div className={cn('text-4xl font-bold', getScoreColorClass(overallScore))}>
          {overallScore}
        </div>
        <div className="text-xs text-slate-500 mt-1">{getScoreMessage(overallScore)}</div>
      </div>

      {/* AI Score Dimensions (4 dimensions) */}
      {hasAIScore ? (
        <div className="space-y-2.5">
          {(['impact', 'clarity', 'ats', 'brevity'] as const).map((key) => {
            const value = aiScore.breakdown[key].score;
            const config = AI_DIMENSION_CONFIG[key];
            return (
              <div key={key} className="group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-600">{config.label}</span>
                    <span className="text-[10px] text-slate-400">({config.weight})</span>
                  </div>
                  <span className={cn('text-xs font-medium', config.textColor)}>{value}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      config.bgColor,
                    )}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Legacy subscores
        <div className="space-y-2.5">
          {VISIBLE_SUBSCORES.map((key) => {
            const value = score!.subscores[key];
            const info = SUBSCORE_LABELS[key];
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-600">{info.label}</span>
                  <span className={cn('text-xs font-medium', info.textColor)}>{value}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-300', info.bgColor)}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
