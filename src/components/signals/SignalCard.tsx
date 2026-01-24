'use client';

import { Id } from 'convex/_generated/dataModel';
import {
  AlertTriangle,
  Archive,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  MessageSquare,
  XCircle,
} from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// Signal type configuration
const SIGNAL_TYPE_CONFIG = {
  needs_outreach: {
    label: 'Needs Outreach',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  application_support: {
    label: 'Application Support',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  document_review: {
    label: 'Document Review',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  milestone_check: {
    label: 'Milestone Check',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  custom: {
    label: 'Custom',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
  },
};

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: 'bg-red-500' },
  high: { label: 'High', color: 'bg-orange-500' },
  medium: { label: 'Medium', color: 'bg-yellow-500' },
  low: { label: 'Low', color: 'bg-slate-400' },
};

const STATUS_CONFIG = {
  active: { label: 'Active', icon: AlertTriangle, color: 'text-amber-600' },
  snoozed: { label: 'Snoozed', icon: Clock, color: 'text-blue-600' },
  resolved: { label: 'Resolved', icon: CheckCircle2, color: 'text-green-600' },
  dismissed: { label: 'Dismissed', icon: XCircle, color: 'text-slate-400' },
  archived: { label: 'Archived', icon: Archive, color: 'text-slate-300' },
};

/**
 * Generate a plain-English explanation for a signal based on its context.
 */
export function generateSignalExplanation(
  conditionType: string,
  context: Record<string, unknown> | undefined,
): string {
  if (!context) return 'Action may be needed. Please review student profile.';

  switch (conditionType) {
    case 'stalled': {
      const days =
        typeof context.days_since_activity === 'number' ? context.days_since_activity : null;
      const threshold = typeof context.threshold_days === 'number' ? context.threshold_days : 0;
      if (days !== null && threshold > 0) {
        return `No activity in ${days} days. Has been inactive for longer than the ${threshold}-day threshold.`;
      }
      return 'No recorded activity. Student may need outreach.';
    }

    case 'high_intent_low_conversion': {
      const appCount =
        typeof context.application_count === 'number' ? context.application_count : 0;
      const appointmentDays =
        typeof context.appointment_days === 'number' ? context.appointment_days : 0;
      return `${appCount} applications submitted but no advising appointment scheduled in ${appointmentDays} days. May need guidance on next steps.`;
    }

    case 'stage_stuck': {
      const longestStuck = context.longest_stuck as
        | {
            company: string;
            stage: string;
            days_stuck: number;
          }
        | undefined;
      const stuckCount =
        typeof context.stuck_applications === 'number' ? context.stuck_applications : 0;

      if (
        longestStuck &&
        typeof longestStuck.company === 'string' &&
        typeof longestStuck.stage === 'string' &&
        typeof longestStuck.days_stuck === 'number'
      ) {
        if (stuckCount > 1) {
          return `${stuckCount} applications stuck, including ${longestStuck.company} in "${longestStuck.stage}" stage for ${longestStuck.days_stuck} days.`;
        }
        return `Application at ${longestStuck.company} stuck in "${longestStuck.stage}" stage for ${longestStuck.days_stuck} days.`;
      }
      return 'Application stuck in same stage for extended period.';
    }

    case 'inactivity': {
      // Support both camelCase and snake_case for backwards compatibility
      const days =
        typeof context.days_since_activity === 'number'
          ? context.days_since_activity
          : typeof context.daysSinceActivity === 'number'
            ? context.daysSinceActivity
            : null;
      const threshold =
        typeof context.threshold_days === 'number'
          ? context.threshold_days
          : typeof context.thresholdDays === 'number'
            ? context.thresholdDays
            : 0;
      if (days !== null && threshold > 0) {
        return `Last activity was ${days} days ago, exceeding the ${threshold}-day threshold.`;
      }
      return 'No recent activity recorded.';
    }

    case 'application_stall': {
      const count =
        typeof context.stalledApplications === 'number' ? context.stalledApplications : 0;
      const stage = typeof context.stalledStage === 'string' ? context.stalledStage : 'any';
      const oldest = typeof context.oldestStallDays === 'number' ? context.oldestStallDays : 0;
      if (stage !== 'any') {
        return `${count} application(s) stuck in "${stage}" stage for ${oldest}+ days.`;
      }
      return `${count} application(s) haven't progressed in ${oldest}+ days.`;
    }

    case 'engagement_drop': {
      const current = context.currentLevel as string;
      const from = context.targetFromLevel as string;
      return `Engagement level dropped from ${from} to ${current}. May need check-in.`;
    }

    case 'no_progress': {
      const rejections = context.rejectionCount as number;
      const offers = context.offerCount as number;
      const total = context.totalApplications as number;
      return `${rejections} rejections out of ${total} applications with ${offers} offer(s). May need application strategy review.`;
    }

    default:
      return 'Action may be needed. Please review student profile.';
  }
}

/**
 * Get the condition type from a signal's context.
 */
function getConditionType(context: Record<string, unknown> | undefined): string {
  if (!context) return 'unknown';

  // Check for explicit condition_type
  if (context.condition_type) return context.condition_type as string;

  // Infer from context keys
  if (context.days_since_activity !== undefined) return 'stalled';
  if (context.application_count !== undefined) return 'high_intent_low_conversion';
  if (context.stuck_applications !== undefined) return 'stage_stuck';
  if (context.daysSinceActivity !== undefined) return 'inactivity';
  if (context.stalledApplications !== undefined) return 'application_stall';
  if (context.currentLevel !== undefined) return 'engagement_drop';
  if (context.rejectionCount !== undefined) return 'no_progress';

  return 'unknown';
}

export interface Signal {
  _id: Id<'signals'>;
  student_id: Id<'users'>;
  signal_type:
    | 'needs_outreach'
    | 'application_support'
    | 'document_review'
    | 'milestone_check'
    | 'custom';
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'active' | 'snoozed' | 'resolved' | 'dismissed' | 'archived';
  context_snapshot?: Record<string, unknown>;
  snoozed_until?: number;
  resolved_at?: number;
  archived_at?: number;
  resolution_type?: string;
  resolution_notes?: string;
  triggered_at: number;
  created_at: number;
  updated_at: number;
}

interface SignalCardProps {
  signal: Signal;
  onSnooze?: (signalId: Id<'signals'>, days: number) => void;
  onDismiss?: (signalId: Id<'signals'>) => void;
  onResolve?: (signalId: Id<'signals'>, notes?: string) => void;
  onScheduleMeeting?: (studentId: Id<'users'>) => void;
  compact?: boolean;
  showActions?: boolean;
  className?: string;
}

export function SignalCard({
  signal,
  onSnooze,
  onDismiss,
  onResolve,
  onScheduleMeeting,
  compact = false,
  showActions = true,
  className,
}: SignalCardProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);

  const typeConfig = SIGNAL_TYPE_CONFIG[signal.signal_type] || SIGNAL_TYPE_CONFIG.custom;
  const priorityConfig = PRIORITY_CONFIG[signal.priority] || PRIORITY_CONFIG.low;
  const statusConfig = STATUS_CONFIG[signal.status] || STATUS_CONFIG.active;
  const StatusIcon = statusConfig.icon;

  // Get explanation from context
  const conditionType = getConditionType(signal.context_snapshot);
  const explanation = generateSignalExplanation(conditionType, signal.context_snapshot);

  // Format time since triggered
  const formatTimeSince = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        typeConfig.bgColor,
        typeConfig.borderColor,
        signal.status === 'active' && 'ring-1 ring-amber-300',
        signal.status === 'resolved' && 'opacity-75',
        signal.status === 'dismissed' && 'opacity-50',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={cn('mt-0.5', statusConfig.color)}>
            <StatusIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('font-medium', typeConfig.color)}>{typeConfig.label}</span>
              <div className={cn('h-2 w-2 rounded-full', priorityConfig.color)} />
              <span className="text-xs text-muted-foreground">
                {formatTimeSince(signal.triggered_at)}
              </span>
            </div>
            <h4 className="font-medium text-sm mt-1">{signal.title}</h4>
          </div>
        </div>

        {compact && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Collapse signal details' : 'Expand signal details'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Explanation */}
          <div className="text-sm text-muted-foreground bg-white/50 rounded p-2">{explanation}</div>

          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {statusConfig.label}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {priorityConfig.label} Priority
            </Badge>
            {signal.snoozed_until && signal.status === 'snoozed' && (
              <Badge variant="outline" className="text-xs">
                Until {new Date(signal.snoozed_until).toLocaleDateString()}
              </Badge>
            )}
          </div>

          {/* Resolution info if resolved/dismissed */}
          {(signal.status === 'resolved' || signal.status === 'dismissed') &&
            signal.resolution_notes && (
              <div className="text-xs text-muted-foreground italic">
                Resolution: {signal.resolution_notes}
              </div>
            )}

          {/* Actions */}
          {showActions && signal.status === 'active' && (
            <div className="flex items-center gap-2 pt-2 border-t border-white/50">
              {onScheduleMeeting && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-white"
                  onClick={() => onScheduleMeeting(signal.student_id)}
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  Schedule Meeting
                </Button>
              )}

              {onResolve && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-white"
                  onClick={() => onResolve(signal._id)}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Resolve
                </Button>
              )}

              {onSnooze && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7 text-xs bg-white">
                      <Clock className="h-3 w-3 mr-1" />
                      Snooze
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => onSnooze(signal._id, 1)}>
                      1 day
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSnooze(signal._id, 3)}>
                      3 days
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSnooze(signal._id, 7)}>
                      1 week
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {onDismiss && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => onDismiss(signal._id)}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Dismiss
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * List of signals for a student's timeline.
 */
interface SignalListProps {
  signals: Signal[];
  onSnooze?: (signalId: Id<'signals'>, days: number) => void;
  onDismiss?: (signalId: Id<'signals'>) => void;
  onResolve?: (signalId: Id<'signals'>, notes?: string) => void;
  onScheduleMeeting?: (studentId: Id<'users'>) => void;
  showResolved?: boolean;
  className?: string;
}

export function SignalList({
  signals,
  onSnooze,
  onDismiss,
  onResolve,
  onScheduleMeeting,
  showResolved = false,
  className,
}: SignalListProps) {
  // Separate active from resolved/dismissed
  const activeSignals = signals.filter((s) => s.status === 'active' || s.status === 'snoozed');
  const resolvedSignals = signals.filter(
    (s) => s.status === 'resolved' || s.status === 'dismissed',
  );

  if (signals.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Active Signals */}
      {activeSignals.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Active Signals ({activeSignals.length})
          </h4>
          {activeSignals.map((signal) => (
            <SignalCard
              key={signal._id}
              signal={signal}
              onSnooze={onSnooze}
              onDismiss={onDismiss}
              onResolve={onResolve}
              onScheduleMeeting={onScheduleMeeting}
              compact
            />
          ))}
        </div>
      )}

      {/* Resolved Signals */}
      {showResolved && resolvedSignals.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Recently Resolved ({resolvedSignals.length})
          </h4>
          {resolvedSignals.slice(0, 3).map((signal) => (
            <SignalCard key={signal._id} signal={signal} compact showActions={false} />
          ))}
        </div>
      )}
    </div>
  );
}
