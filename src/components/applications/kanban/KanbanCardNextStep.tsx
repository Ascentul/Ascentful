'use client';

import { AlertCircle, Calendar, Clock } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { KanbanApplication } from './types';

interface KanbanCardNextStepProps {
  application: KanbanApplication;
}

/**
 * Displays context-aware "next step" information on Kanban cards.
 * Priority order:
 * 1. Upcoming interview
 * 2. Due date / follow-up
 * 3. Custom next_step
 * 4. Last activity (if >3 days old)
 */
export function KanbanCardNextStep({ application }: KanbanCardNextStepProps) {
  const now = Date.now();

  // Helper to format relative time
  const formatDistanceToNow = (timestamp: number): string => {
    const diff = Math.abs(now - timestamp);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (days > 0) {
      return `${days} day${days === 1 ? '' : 's'}`;
    }
    if (hours > 0) {
      return `${hours} hour${hours === 1 ? '' : 's'}`;
    }
    return 'less than an hour';
  };

  // Helper to format date/time
  const formatDateTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Priority 1: Upcoming interview (nearest one if multiple exist)
  const upcomingInterview = application.interviews
    ?.filter((interview) => interview.date > now)
    ?.sort((a, b) => a.date - b.date)[0];
  if (upcomingInterview) {
    const interviewDate = new Date(upcomingInterview.date);
    const today = new Date();
    const isToday = interviewDate.toDateString() === today.toDateString();

    return (
      <div
        className={cn(
          'flex items-center gap-1.5 text-xs mt-1.5',
          isToday ? 'text-amber-600 font-medium' : 'text-slate-500',
        )}
      >
        <Calendar className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">Interview: {formatDateTime(upcomingInterview.date)}</span>
      </div>
    );
  }

  // Priority 2: Due date / follow-up
  if (application.due_date) {
    const dueDate = application.due_date;
    const isOverdue = now > dueDate;

    return (
      <div
        className={cn(
          'flex items-center gap-1.5 text-xs mt-1.5',
          isOverdue ? 'text-red-500 font-medium' : 'text-slate-500',
        )}
      >
        {isOverdue ? (
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
        ) : (
          <Clock className="h-3 w-3 flex-shrink-0" />
        )}
        <span className="truncate">
          {isOverdue
            ? `Overdue: ${formatDistanceToNow(dueDate)} ago`
            : `Follow up in ${formatDistanceToNow(dueDate)}`}
        </span>
      </div>
    );
  }

  // Priority 3: Custom next step
  if (application.next_step) {
    return (
      <div className="flex items-center gap-1.5 text-xs mt-1.5 text-slate-500">
        <Clock className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{application.next_step}</span>
      </div>
    );
  }

  // Priority 4: Last activity (only show if >3 days old)
  const daysSinceUpdate = Math.floor((now - application.updated_at) / (1000 * 60 * 60 * 24));
  if (daysSinceUpdate >= 3) {
    return (
      <div className="flex items-center gap-1.5 text-xs mt-1.5 text-slate-400">
        <Clock className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">Updated {formatDistanceToNow(application.updated_at)} ago</span>
      </div>
    );
  }

  return null;
}
