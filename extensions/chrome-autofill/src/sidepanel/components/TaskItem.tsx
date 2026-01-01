/**
 * Task Item Component
 *
 * Single task row with checkbox for completion.
 */

import { clsx } from 'clsx';
import type { Task, TaskPriority } from '~/types';

interface TaskItemProps {
  task: Task;
  onComplete: () => void;
}

const priorityStyles: Record<TaskPriority, { dot: string; text: string }> = {
  low: { dot: 'bg-neutral-300', text: 'text-neutral-500' },
  medium: { dot: 'bg-blue-400', text: 'text-blue-600' },
  high: { dot: 'bg-amber-400', text: 'text-amber-600' },
  urgent: { dot: 'bg-red-500', text: 'text-red-600' },
};

function formatDueDate(timestamp: number | null): { text: string; isOverdue: boolean; isToday: boolean } {
  if (!timestamp) {
    return { text: 'No due date', isOverdue: false, isToday: false };
  }

  const now = new Date();
  const due = new Date(timestamp);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.floor((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const daysOverdue = Math.abs(diffDays);
    return {
      text: daysOverdue === 1 ? '1 day overdue' : `${daysOverdue} days overdue`,
      isOverdue: true,
      isToday: false,
    };
  }

  if (diffDays === 0) {
    return { text: 'Due today', isOverdue: false, isToday: true };
  }

  if (diffDays === 1) {
    return { text: 'Due tomorrow', isOverdue: false, isToday: false };
  }

  if (diffDays < 7) {
    return { text: `Due in ${diffDays} days`, isOverdue: false, isToday: false };
  }

  return {
    text: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    isOverdue: false,
    isToday: false,
  };
}

export function TaskItem({ task, onComplete }: TaskItemProps) {
  const priority = priorityStyles[task.priority] || priorityStyles.medium;
  const dueInfo = formatDueDate(task.dueAt);

  return (
    <div
      className={clsx(
        'rounded-lg border bg-white p-3 transition-all',
        dueInfo.isOverdue ? 'border-red-200' : 'border-neutral-200',
        task.status === 'done' && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={onComplete}
          disabled={task.status === 'done'}
          className={clsx(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
            task.status === 'done'
              ? 'border-green-500 bg-green-500'
              : 'border-neutral-300 hover:border-primary-500'
          )}
        >
          {task.status === 'done' && (
            <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={clsx(
                'text-sm font-medium',
                task.status === 'done' ? 'text-neutral-400 line-through' : 'text-neutral-900'
              )}
            >
              {task.title}
            </h3>
            <span className={clsx('h-2 w-2 shrink-0 rounded-full', priority.dot)} title={task.priority} />
          </div>

          {/* Meta info */}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            {/* Due date */}
            <span
              className={clsx(
                dueInfo.isOverdue && 'font-medium text-red-600',
                dueInfo.isToday && 'font-medium text-amber-600',
                !dueInfo.isOverdue && !dueInfo.isToday && 'text-neutral-500'
              )}
            >
              {dueInfo.text}
            </span>

            {/* Associated application */}
            {task.applicationCompany && (
              <>
                <span className="text-neutral-300">•</span>
                <span className="text-neutral-500">{task.applicationCompany}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
