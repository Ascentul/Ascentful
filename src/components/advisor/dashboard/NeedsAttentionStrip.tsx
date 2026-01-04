'use client';

/**
 * Needs Attention Today Strip
 *
 * Horizontal strip at the top of the advisor dashboard showing high-priority items
 * that require immediate advisor action. Each chip is clickable and routes to
 * a filtered list of students or items.
 *
 * Business meaning: This answers "Who needs my attention right now?" by surfacing:
 * - Overdue follow-ups that students are waiting on
 * - Past sessions that need documentation for compliance
 * - Students who haven't been contacted recently (potential disengagement)
 * - Urgent document reviews that students are waiting on
 */

import { AlertTriangle, Clock, FileEdit, FileQuestion, UserX } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

interface AttentionItem {
  count: number;
  items?: Array<{
    _id: string;
    student_id?: string;
    student_name?: string;
    name?: string;
    title?: string;
    [key: string]: unknown;
  }>;
  config?: { days?: number };
}

interface NeedsAttentionData {
  overdueFollowUps: AttentionItem;
  sessionsWithoutNotes: AttentionItem;
  studentsNoContact: AttentionItem;
  urgentReviews: AttentionItem;
}

interface NeedsAttentionStripProps {
  data: NeedsAttentionData | undefined;
  isLoading?: boolean;
}

interface AttentionChipProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  href: string;
  variant?: 'warning' | 'alert' | 'info';
  subtitle?: string;
}

function AttentionChip({
  icon,
  label,
  count,
  href,
  variant = 'warning',
  subtitle,
}: AttentionChipProps) {
  if (count === 0) return null;

  const variantClasses = {
    warning: 'bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-800',
    alert: 'bg-orange-50 border-orange-200 hover:bg-orange-100 text-orange-800',
    info: 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700',
  };

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
        'min-w-[140px] shrink-0',
        variantClasses[variant],
      )}
    >
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-lg leading-none">{count}</span>
          <span className="text-sm font-medium truncate">{label}</span>
        </div>
        {subtitle && <p className="text-xs opacity-75 truncate">{subtitle}</p>}
      </div>
    </Link>
  );
}

function LoadingChip() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 min-w-[140px]">
      <div className="h-5 w-5 rounded bg-slate-200 animate-pulse" />
      <div className="flex-1 space-y-1">
        <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
        <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
      </div>
    </div>
  );
}

export function NeedsAttentionStrip({ data, isLoading }: NeedsAttentionStripProps) {
  if (isLoading) {
    return (
      <div className="border-b">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-slate-700">Needs Attention Today</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            <LoadingChip />
            <LoadingChip />
            <LoadingChip />
            <LoadingChip />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalAttentionItems =
    data.overdueFollowUps.count +
    data.sessionsWithoutNotes.count +
    data.studentsNoContact.count +
    data.urgentReviews.count;

  // Don't show the strip if there's nothing needing attention
  if (totalAttentionItems === 0) {
    return (
      <div className="border-b">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <p className="text-sm text-green-700 font-medium">
              All caught up! No urgent items need your attention right now.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b">
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h2 className="text-sm font-semibold text-slate-700">Needs Attention Today</h2>
          <span className="text-xs text-slate-500">({totalAttentionItems} items)</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          <AttentionChip
            icon={<Clock className="h-4 w-4" />}
            label="Overdue Follow-ups"
            count={data.overdueFollowUps.count}
            href="/advisor/students?filter=overdue-followups"
            variant="alert"
            subtitle="Past due date"
          />
          <AttentionChip
            icon={<FileQuestion className="h-4 w-4" />}
            label="Sessions Need Notes"
            count={data.sessionsWithoutNotes.count}
            href="/advisor/advising/sessions?filter=no-notes"
            variant="warning"
            subtitle="Past week"
          />
          <AttentionChip
            icon={<UserX className="h-4 w-4" />}
            label="No Recent Contact"
            count={data.studentsNoContact.count}
            href="/advisor/students?filter=no-contact"
            variant="warning"
            subtitle={`${data.studentsNoContact.config?.days || 14}+ days`}
          />
          <AttentionChip
            icon={<FileEdit className="h-4 w-4" />}
            label="Urgent Reviews"
            count={data.urgentReviews.count}
            href="/advisor/advising/reviews?filter=urgent"
            variant="alert"
            subtitle={`Waiting ${data.urgentReviews.config?.days || 3}+ days`}
          />
        </div>
      </div>
    </div>
  );
}
