'use client';

import type { ScoreResponse } from '@/lib/ai/schemas';
import type { TopFix } from '@/types/resume-editor';

// AI issue type from ScoreResponse
type AITopIssue = ScoreResponse['topIssues'][number];

interface TopFixesListProps {
  fixes: TopFix[];
  aiIssues?: AITopIssue[]; // Optional AI-generated top issues
}

export function TopFixesList({ fixes, aiIssues }: TopFixesListProps) {
  // Prefer AI issues if available, otherwise use legacy fixes
  const hasAIIssues = aiIssues && aiIssues.length > 0;
  const hasLegacyFixes = fixes.length > 0;

  if (!hasAIIssues && !hasLegacyFixes) return null;

  // If we have AI issues, show category counts with text labels
  // Note: hasAIIssues is only true when aiIssues.length > 0, so no need to check for empty
  if (hasAIIssues) {
    // Count issues by priority level (map categories to priority)
    const criticalCount = aiIssues.filter(
      (i) => i.category === 'impact' || i.category === 'ats',
    ).length;
    const importantCount = aiIssues.filter((i) => i.category === 'clarity').length;
    const polishCount = aiIssues.filter((i) => i.category === 'brevity').length;

    return (
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2 flex-wrap">
          {criticalCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50">
              <span className="text-xs font-semibold text-red-700">{criticalCount} critical</span>
            </div>
          )}
          {importantCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50">
              <span className="text-xs font-semibold text-amber-700">
                {importantCount} important
              </span>
            </div>
          )}
          {polishCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50">
              <span className="text-xs font-semibold text-slate-600">{polishCount} polish</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fall back to legacy fixes - show with text labels and card outlines
  // Note: fixes.length > 0 is guaranteed here due to the guard at line 21
  const highCount = fixes.filter((f) => f.impact === 'high').length;
  const mediumCount = fixes.filter((f) => f.impact === 'medium').length;
  const lowCount = fixes.filter((f) => f.impact === 'low').length;

  return (
    <div className="px-4 py-3 border-b border-slate-200">
      <div className="flex items-center gap-2 flex-wrap">
        {highCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50">
            <span className="text-xs font-semibold text-red-700">{highCount} critical</span>
          </div>
        )}
        {mediumCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50">
            <span className="text-xs font-semibold text-amber-700">{mediumCount} important</span>
          </div>
        )}
        {lowCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50">
            <span className="text-xs font-semibold text-slate-600">{lowCount} polish</span>
          </div>
        )}
      </div>
    </div>
  );
}
