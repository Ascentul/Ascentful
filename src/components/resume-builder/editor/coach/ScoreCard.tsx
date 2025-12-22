'use client';

import { getScoreMessage } from '@/lib/resume-score';
import { cn } from '@/lib/utils';
import type { ResumeScore } from '@/types/resume-editor';

interface ScoreCardProps {
  score: ResumeScore | null;
  loading?: boolean;
}

// Subscores to display visually (ATS is used internally by AI but not shown to user)
const VISIBLE_SUBSCORES: (keyof ResumeScore['subscores'])[] = [
  'impact',
  'clarity',
  'relevance',
  'consistency',
];

const SUBSCORE_LABELS: Record<
  keyof ResumeScore['subscores'],
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
  ats: {
    label: 'ATS',
    description: 'Format compliance for applicant tracking',
    textColor: 'text-blue-500',
    bgColor: 'bg-blue-500',
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

export function ScoreCard({ score, loading }: ScoreCardProps) {
  if (loading) {
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

  if (!score) {
    return (
      <div className="p-4 border-b border-slate-200">
        <div className="text-center text-slate-500 text-sm">Add content to see your score</div>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-slate-200">
      {/* Overall score */}
      <div className="text-center mb-4">
        <div className={cn('text-4xl font-bold', getScoreColorClass(score.overallScore))}>
          {score.overallScore}
        </div>
        <div className="text-xs text-slate-500 mt-1">{getScoreMessage(score.overallScore)}</div>
      </div>

      {/* Subscores with progress bars (ATS hidden but used by AI) */}
      <div className="space-y-2.5">
        {VISIBLE_SUBSCORES.map((key) => {
          const value = score.subscores[key];
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
    </div>
  );
}
