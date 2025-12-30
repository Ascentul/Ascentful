/**
 * Quick Add Task Form Component
 *
 * Modal form for quickly creating a new task.
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import type { TaskPriority } from '~/types';

interface QuickAddTaskFormProps {
  onSubmit: (data: { title: string; dueAt?: number; priority: TaskPriority }) => Promise<void>;
  onClose: () => void;
  defaultApplicationId?: string;
}

export function QuickAddTaskForm({ onSubmit, onClose, defaultApplicationId }: QuickAddTaskFormProps) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        dueAt: dueDate ? new Date(dueDate).getTime() : undefined,
        priority,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick date presets
  const setQuickDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    setDueDate(date.toISOString().split('T')[0]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h2 className="text-base font-medium text-neutral-900">Add Task</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4">
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">
                Task <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Follow up on application"
                autoFocus
                required
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">Due Date</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              {/* Quick date buttons */}
              <div className="mt-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => setQuickDate(0)}
                  className="rounded-full border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className="rounded-full border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(7)}
                  className="rounded-full border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                >
                  In 1 week
                </button>
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">Priority</label>
              <div className="grid grid-cols-4 gap-2">
                {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={clsx(
                      'rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-colors',
                      priority === p
                        ? p === 'urgent'
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : p === 'high'
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : p === 'medium'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-neutral-500 bg-neutral-50 text-neutral-700'
                        : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex-1 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
