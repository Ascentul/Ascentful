'use client';

import {
  CheckCircle,
  ClipboardList,
  Eye,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Reply,
} from 'lucide-react';

import { formatRelativeTime } from '@/lib/cohortos/mock-data';
import { type NoteType, type TimelineEntry as TimelineEntryType } from '@/lib/cohortos/types';
import { cn } from '@/lib/utils';

interface TimelineEntryProps {
  entry: TimelineEntryType;
  isLast?: boolean;
  className?: string;
}

// Icon configuration for each note type
const typeConfig: Record<NoteType, { icon: typeof FileText; bgColor: string; iconColor: string }> =
  {
    note: {
      icon: FileText,
      bgColor: 'bg-slate-100',
      iconColor: 'text-slate-600',
    },
    email: {
      icon: Mail,
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    sms: {
      icon: MessageSquare,
      bgColor: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    call: {
      icon: Phone,
      bgColor: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
    survey: {
      icon: ClipboardList,
      bgColor: 'bg-amber-100',
      iconColor: 'text-amber-600',
    },
  };

// Human-readable type labels
const typeLabels: Record<NoteType, string> = {
  note: 'Note',
  email: 'Email',
  sms: 'SMS',
  call: 'Phone Call',
  survey: 'Survey Response',
};

export function TimelineEntry({ entry, isLast = false, className }: TimelineEntryProps) {
  const config = typeConfig[entry.type];
  const Icon = config.icon;

  return (
    <div className={cn('relative flex gap-4', className)}>
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-5 top-10 bottom-0 w-px bg-slate-200" aria-hidden="true" />
      )}

      {/* Icon */}
      <div
        className={cn(
          'relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
          config.bgColor,
        )}
      >
        <Icon className={cn('h-5 w-5', config.iconColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-6">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900">{entry.coachName}</span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs font-medium text-slate-500">{typeLabels[entry.type]}</span>
          </div>
          <time className="flex-shrink-0 text-xs text-slate-500">
            {formatRelativeTime(entry.createdAt)}
          </time>
        </div>
        <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{entry.content}</p>

        {/* Engagement indicators for email/sms */}
        {(entry.type === 'email' || entry.type === 'sms') && (
          <div className="flex items-center gap-4 mt-2 pt-2 border-t border-slate-100">
            {/* Opened indicator */}
            <div
              className={cn(
                'flex items-center gap-1 text-xs',
                entry.opened ? 'text-green-600' : 'text-slate-400',
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{entry.opened ? 'Opened' : 'Not opened'}</span>
            </div>

            {/* Replied indicator */}
            <div
              className={cn(
                'flex items-center gap-1 text-xs',
                entry.replied ? 'text-green-600' : 'text-slate-400',
              )}
            >
              <Reply className="h-3.5 w-3.5" />
              <span>{entry.replied ? 'Replied' : 'No reply'}</span>
            </div>

            {/* Action indicator */}
            {entry.resultedInAction && (
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <CheckCircle className="h-3.5 w-3.5" />
                <span>{entry.actionNote || 'Action taken'}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Timeline container component
interface TimelineProps {
  entries: TimelineEntryType[];
  className?: string;
}

export function Timeline({ entries, className }: TimelineProps) {
  if (entries.length === 0) {
    return (
      <div className={cn('text-center py-8 text-slate-500', className)}>
        No activity recorded yet
      </div>
    );
  }

  return (
    <div className={cn('space-y-0', className)}>
      {entries.map((entry, index) => (
        <TimelineEntry key={entry.id} entry={entry} isLast={index === entries.length - 1} />
      ))}
    </div>
  );
}
