'use client';

import { getScoreColor, getScoreMessage } from '@/lib/resume-score';
import type { ResumeScore } from '@/types/resume-editor';

interface ScoreCardProps {
  score: ResumeScore | null;
  loading?: boolean;
}

const SUBSCORE_LABELS: Record<
  keyof ResumeScore['subscores'],
  { label: string; description: string }
> = {
  impact: { label: 'Impact', description: 'Action verbs & quantified achievements' },
  clarity: { label: 'Clarity', description: 'Readability & conciseness' },
  relevance: { label: 'Relevance', description: 'Job fit & keyword matching' },
  ats: { label: 'ATS', description: 'Format compliance for applicant tracking' },
  consistency: { label: 'Consistency', description: 'Style & formatting uniformity' },
};

export function ScoreCard({ score, loading }: ScoreCardProps) {
  if (loading) {
    return (
      <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 border-b border-slate-200">
        <div className="animate-pulse">
          <div className="h-8 w-16 bg-slate-200 rounded mx-auto mb-2" />
          <div className="h-3 w-24 bg-slate-200 rounded mx-auto" />
        </div>
      </div>
    );
  }

  if (!score) {
    return (
      <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 border-b border-slate-200">
        <div className="text-center text-slate-500 text-sm">Add content to see your score</div>
      </div>
    );
  }

  const scoreColor = getScoreColor(score.overallScore);

  return (
    <div className="p-4 bg-gradient-to-br from-primary-50 to-primary-100 border-b border-slate-200">
      {/* Overall score */}
      <div className="text-center mb-4">
        <div className="text-4xl font-bold" style={{ color: scoreColor }}>
          {score.overallScore}
        </div>
        <div className="text-xs text-slate-600 mt-1">{getScoreMessage(score.overallScore)}</div>
      </div>

      {/* Mini subscores */}
      <div className="grid grid-cols-5 gap-2">
        {Object.entries(score.subscores).map(([key, value]) => (
          <div key={key} className="text-center">
            <div className="text-[10px] text-slate-500 capitalize truncate">{key}</div>
            <div className="text-sm font-semibold" style={{ color: getScoreColor(value) }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Subscore Breakdown
// ============================================================================

interface SubscoreBreakdownProps {
  subscores: ResumeScore['subscores'] | undefined;
}

export function SubscoreBreakdown({ subscores }: SubscoreBreakdownProps) {
  if (!subscores) return null;

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">Score Breakdown</h3>
      {Object.entries(subscores).map(([key, value]) => {
        const info = SUBSCORE_LABELS[key as keyof ResumeScore['subscores']];
        const color = getScoreColor(value);

        return (
          <div key={key}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-slate-700">{info.label}</span>
              <span className="text-sm font-medium" style={{ color }}>
                {value}
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${value}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">{info.description}</p>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================
