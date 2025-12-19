'use client';

import { Calendar } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { InterviewSummary } from './types';

interface KanbanCardMetaProps {
  interviewSummary?: InterviewSummary | null;
}

/**
 * Check if a timestamp is today
 */
const isDateToday = (timestamp: number): boolean => {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return targetDate.getTime() === today.getTime();
};

/**
 * Check if a timestamp is tomorrow
 */
const isDateTomorrow = (timestamp: number): boolean => {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return targetDate.getTime() === tomorrow.getTime();
};

/**
 * Format date for interview display
 */
const formatInterviewDate = (timestamp: number): string => {
  const date = new Date(timestamp);

  if (isDateToday(timestamp)) {
    return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }
  if (isDateTomorrow(timestamp)) {
    return `Tomorrow, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Displays interview stages on Kanban cards.
 * Shows each interview with name and date.
 */
export function KanbanCardMeta({ interviewSummary }: KanbanCardMetaProps) {
  if (!interviewSummary || interviewSummary.stages.length === 0) {
    return null;
  }

  const { stages } = interviewSummary;
  const now = Date.now();

  return (
    <div className="space-y-1.5">
      {stages.map((stage) => {
        const isPast = stage.scheduled_at < now;
        const isToday = isDateToday(stage.scheduled_at);

        return (
          <div key={stage.id} className="flex items-center gap-2 -ml-0.5">
            {/* Interview name pill */}
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium border',
                isPast
                  ? 'bg-slate-50 text-slate-400 border-slate-100'
                  : isToday
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200/50',
              )}
            >
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span className="truncate max-w-[100px]">{stage.title}</span>
            </span>
            {/* Date/time text */}
            <span
              className={cn(
                'text-[11px] whitespace-nowrap',
                isPast ? 'text-slate-400' : isToday ? 'text-amber-600' : 'text-slate-500',
              )}
            >
              {formatInterviewDate(stage.scheduled_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
