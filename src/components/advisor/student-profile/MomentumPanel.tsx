'use client';

import {
  Activity,
  AlertTriangle,
  Briefcase,
  CheckCircle,
  FileText,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type MomentumSignal = 'green' | 'yellow' | 'red';
type JobBoardActivity = 'active' | 'moderate' | 'inactive';

interface MomentumPanelProps {
  momentumScore?: number;
  momentumSignal?: MomentumSignal;
  momentumReason?: string;
  jobBoardActivity?: JobBoardActivity;
  resumeAgeDays?: number;
}

const signalConfig: Record<
  MomentumSignal,
  { label: string; icon: typeof CheckCircle; className: string; bgClass: string }
> = {
  green: {
    label: 'On Track',
    icon: TrendingUp,
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    bgClass: '',
  },
  yellow: {
    label: 'Needs Attention',
    icon: AlertTriangle,
    className: 'bg-amber-100 text-amber-700 border-amber-200',
    bgClass: 'border-amber-200 bg-amber-50/50',
  },
  red: {
    label: 'Stalled',
    icon: TrendingDown,
    className: 'bg-red-100 text-red-700 border-red-200',
    bgClass: 'border-red-200 bg-red-50/50',
  },
};

const jobBoardConfig: Record<JobBoardActivity, { label: string; className: string }> = {
  active: { label: 'Active', className: 'text-emerald-600' },
  moderate: { label: 'Moderate', className: 'text-amber-600' },
  inactive: { label: 'Inactive', className: 'text-neutral-400' },
};

export function MomentumPanel({
  momentumScore,
  momentumSignal,
  momentumReason,
  jobBoardActivity,
  resumeAgeDays,
}: MomentumPanelProps) {
  // Don't render if no momentum data
  if (!momentumSignal) {
    return null;
  }

  const config = signalConfig[momentumSignal];
  const SignalIcon = config.icon;

  return (
    <Card className={cn(config.bgClass)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Momentum
          </div>
          <Badge variant="outline" className={cn('font-medium', config.className)}>
            <SignalIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Momentum Score */}
        {momentumScore !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Score</span>
            <span className="text-sm font-medium">{momentumScore}/100</span>
          </div>
        )}

        {/* Reason Tag */}
        {momentumReason && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant="secondary" className="text-xs">
              {momentumReason}
            </Badge>
          </div>
        )}

        {/* Resume Age */}
        {resumeAgeDays !== undefined && (
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>
              Resume:{' '}
              <span className={cn('font-medium', resumeAgeDays > 30 && 'text-amber-600')}>
                {resumeAgeDays === 0
                  ? 'Updated today'
                  : resumeAgeDays === 1
                    ? '1 day ago'
                    : `${resumeAgeDays} days ago`}
              </span>
            </span>
          </div>
        )}

        {/* Job Board Activity */}
        {jobBoardActivity && (
          <div className="flex items-center gap-2 text-sm">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <span>
              Job Board:{' '}
              <span className={cn('font-medium', jobBoardConfig[jobBoardActivity].className)}>
                {jobBoardConfig[jobBoardActivity].label}
              </span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
