'use client';

import { Lightbulb } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type MomentumSignal = 'green' | 'yellow' | 'red';

interface InsightCardProps {
  momentumSignal?: MomentumSignal;
  momentumReason?: string;
  resumeAgeDays?: number;
  className?: string;
}

// Insight messages based on momentum reason and context
function getInsightMessage(
  reason?: string,
  resumeAgeDays?: number,
  signal?: MomentumSignal,
): string | null {
  if (!reason || signal === 'green') {
    return null;
  }

  // Generate insight based on reason
  switch (reason) {
    case 'Search Plateau':
      if (resumeAgeDays && resumeAgeDays > 30) {
        return 'Outdated resume likely reducing response rate. Consider reviewing and updating key sections.';
      }
      return 'Job search activity has plateaued. A check-in may help identify blockers.';

    case 'Resume Stale':
      return `Resume hasn't been updated in ${resumeAgeDays || 'many'} days. Fresh content could improve application success.`;

    case 'Inactive':
      return 'Student has been inactive for an extended period. Proactive outreach recommended.';

    case 'Low Applications':
      return 'Application volume is below target. Help identify suitable opportunities to apply for.';

    case 'No Goal Progress':
      return 'Career goals are stalled. A goal-setting session may help reignite momentum.';

    case 'Engagement Drop':
      return 'Recent drop in platform engagement detected. Early intervention could prevent further disengagement.';

    case 'Needs Guidance':
      return 'Student may benefit from additional career guidance or resource recommendations.';

    default:
      if (signal === 'red') {
        return 'This student needs attention. Consider reaching out to understand their current situation.';
      }
      if (signal === 'yellow') {
        return 'Monitor this student closely. Early intervention can prevent further decline.';
      }
      return null;
  }
}

export function InsightCard({
  momentumSignal,
  momentumReason,
  resumeAgeDays,
  className,
}: InsightCardProps) {
  const message = getInsightMessage(momentumReason, resumeAgeDays, momentumSignal);

  // Don't render if no insight to show
  if (!message) {
    return null;
  }

  const isRed = momentumSignal === 'red';

  return (
    <Card
      className={cn(
        'border-l-4',
        isRed ? 'border-l-red-500 bg-red-50/50' : 'border-l-amber-500 bg-amber-50/50',
        className,
      )}
    >
      <CardContent className="flex gap-3 py-3">
        <div
          className={cn('flex-shrink-0 rounded-full p-1.5', isRed ? 'bg-red-100' : 'bg-amber-100')}
        >
          <Lightbulb className={cn('h-4 w-4', isRed ? 'text-red-600' : 'text-amber-600')} />
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-700">Advisor Insight</p>
          <p className="text-sm text-muted-foreground mt-0.5">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}
