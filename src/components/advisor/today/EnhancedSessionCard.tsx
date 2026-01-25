'use client';

/**
 * EnhancedSessionCard - Rich session card with student context
 *
 * Displays session information with:
 * - Session type badge
 * - New/Returning student indicator
 * - Risk tags when applicable
 * - Helper text (no resume, few apps, etc.)
 * - Quick action buttons
 */

import { Id } from 'convex/_generated/dataModel';
import { format, formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  Briefcase,
  Clock,
  ExternalLink,
  FileText,
  MessageSquare,
  Sparkles,
  User,
  Video,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StudentContext {
  isFirstSession: boolean;
  totalSessions: number;
  lastSessionDate?: number;
  resumeCount: number;
  applicationCount: number;
  riskTags: string[];
}

interface EnhancedSession {
  _id: Id<'advisor_sessions'>;
  student_id: Id<'users'>;
  student_name: string;
  student_email: string;
  title: string;
  session_type?: string;
  start_at: number;
  end_at?: number;
  duration_minutes?: number;
  notes?: string;
  visibility: 'shared' | 'advisor_only';
  status?: string;
  meeting_url?: string;
  studentContext: StudentContext;
}

interface EnhancedSessionCardProps {
  session: EnhancedSession;
  onAddNote?: (sessionId: Id<'advisor_sessions'>) => void;
  onAddFollowUp?: (studentId: Id<'users'>, sessionTitle?: string) => void;
  /** Route prefix for links (e.g., '/u' or '/advisor') */
  routePrefix?: string;
}

const sessionTypeLabels: Record<string, string> = {
  career_planning: 'Career Planning',
  resume_review: 'Resume Review',
  mock_interview: 'Mock Interview',
  application_strategy: 'Application Strategy',
  general_advising: 'General Advising',
  other: 'Other',
};

const riskTagLabels: Record<string, { label: string; variant: 'warning' | 'destructive' }> = {
  low_engagement: { label: 'Low engagement', variant: 'warning' },
  stalled_search: { label: 'Stalled search', variant: 'warning' },
  high_volume_no_offers: { label: 'High volume, no offers', variant: 'destructive' },
};

export function EnhancedSessionCard({
  session,
  onAddNote,
  onAddFollowUp,
  routePrefix = '/advisor',
}: EnhancedSessionCardProps) {
  const { studentContext } = session;
  const isPast = session.start_at < Date.now();
  const isCompleted = session.status === 'completed';

  // Build helper text items
  const helperItems: string[] = [];
  if (studentContext.resumeCount === 0) {
    helperItems.push('No resume on file');
  }
  if (studentContext.applicationCount === 0) {
    helperItems.push('No applications yet');
  } else if (studentContext.applicationCount < 3) {
    helperItems.push(
      `${studentContext.applicationCount} application${studentContext.applicationCount === 1 ? '' : 's'}`,
    );
  }

  // Format last session date
  const lastSessionText = studentContext.lastSessionDate
    ? `Last met ${formatDistanceToNow(studentContext.lastSessionDate, { addSuffix: true })}`
    : null;

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-md',
        isCompleted && 'bg-slate-50/50 border-slate-200',
      )}
    >
      <CardContent className="p-4">
        {/* Header Row: Time + Status */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="font-medium">{format(session.start_at, 'h:mm a')}</span>
            {session.duration_minutes && (
              <span className="text-slate-400">({session.duration_minutes} min)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {session.session_type && (
              <Badge variant="secondary" className="text-xs">
                {sessionTypeLabels[session.session_type] || session.session_type}
              </Badge>
            )}
            {isCompleted && (
              <Badge
                variant="outline"
                className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200"
              >
                Completed
              </Badge>
            )}
          </div>
        </div>

        {/* Student Info Row */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-slate-400" />
            <Link
              href={`${routePrefix}/students/${session.student_id}`}
              className="font-medium text-slate-900 hover:text-primary-600 hover:underline"
            >
              {session.student_name}
            </Link>
            {studentContext.isFirstSession ? (
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                New
              </Badge>
            ) : (
              <span className="text-xs text-slate-500">
                Session #{studentContext.totalSessions}
              </span>
            )}
          </div>
          {lastSessionText && !studentContext.isFirstSession && (
            <p className="text-xs text-slate-500 ml-6 mt-0.5">{lastSessionText}</p>
          )}
        </div>

        {/* Session Title */}
        {session.title && (
          <p className="text-sm text-slate-700 mb-3 font-medium">{session.title}</p>
        )}

        {/* Risk Tags */}
        {studentContext.riskTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {studentContext.riskTags.map((tag) => {
              const tagInfo = riskTagLabels[tag];
              return tagInfo ? (
                <Badge
                  key={tag}
                  variant={tagInfo.variant === 'destructive' ? 'destructive' : 'outline'}
                  className={cn(
                    'text-xs',
                    tagInfo.variant === 'warning' && 'bg-amber-50 text-amber-700 border-amber-200',
                  )}
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {tagInfo.label}
                </Badge>
              ) : null;
            })}
          </div>
        )}

        {/* Helper Text */}
        {helperItems.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-3 text-xs text-slate-500">
            {helperItems.map((item, idx) => (
              <span key={idx} className="flex items-center gap-1">
                {item.includes('resume') ? (
                  <FileText className="h-3 w-3" />
                ) : (
                  <Briefcase className="h-3 w-3" />
                )}
                {item}
              </span>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          {session.meeting_url && !isPast && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
              <a
                href={session.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Join meeting with ${session.student_name}`}
              >
                <Video className="h-3 w-3" />
                Join
              </a>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => onAddNote?.(session._id)}
          >
            <FileText className="h-3 w-3" />
            {session.notes ? 'Edit Notes' : 'Add Notes'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => onAddFollowUp?.(session.student_id, session.title)}
          >
            <MessageSquare className="h-3 w-3" />
            Follow-up
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 ml-auto" asChild>
            <Link href={`${routePrefix}/advising/sessions/${session._id}`}>
              <ExternalLink className="h-3 w-3" />
              View
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
