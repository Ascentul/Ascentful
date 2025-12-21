'use client';

import React from 'react';

import { getScoreColor } from '@/lib/resume-score';

interface ResumeScoreIndicatorProps {
  score: number;
  className?: string;
}

export function ResumeScoreIndicator({ score, className = '' }: ResumeScoreIndicatorProps) {
  const color = getScoreColor(score);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="flex items-center justify-center text-xs font-bold text-white rounded px-2 py-1"
        style={{ backgroundColor: color }}
      >
        {score}%
      </div>
      <span className="text-sm text-slate-500">Your resume score</span>
      {/* Progress bar */}
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden max-w-[100px]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
