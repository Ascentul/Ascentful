'use client';

import { AlertCircle, Clock } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { KanbanApplication } from './types';

interface KanbanCardNextStepProps {
  application: KanbanApplication;
}

/**
 * Displays context-aware "next step" information on Kanban cards.
 * Shows due date or custom next_step if present.
 * Note: Interview info is now shown in KanbanCardMeta.
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

  // Priority 1: Due date / follow-up
  if (application.due_date) {
    const dueDate = application.due_date;
    const isOverdue = now > dueDate;

    return (
      <div
        className={cn(
          'flex items-center gap-1.5 text-xs mt-2',
          isOverdue ? 'text-red-500 font-medium' : 'text-slate-400',
        )}
      >
        {isOverdue ? (
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
        ) : (
          <Clock className="h-3 w-3 flex-shrink-0" />
        )}
        <span className="truncate">
          {isOverdue
            ? `Overdue • ${formatDistanceToNow(dueDate)} ago`
            : `Due • in ${formatDistanceToNow(dueDate)}`}
        </span>
      </div>
    );
  }

  // Priority 2: Custom next step
  if (application.next_step) {
    return (
      <div className="flex items-center gap-1.5 text-xs mt-2 text-slate-400">
        <Clock className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{application.next_step}</span>
      </div>
    );
  }

  return null;
}
