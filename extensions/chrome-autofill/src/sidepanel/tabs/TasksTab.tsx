/**
 * Tasks Tab
 *
 * Shows open follow-ups/tasks sorted by due date.
 */

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import type { TaskPriority } from '~/types';
import { TaskItem } from '../components/TaskItem';
import { QuickAddTaskForm } from '../components/QuickAddTaskForm';
import { useTasksStore } from '~/store/tasksStore';

export function TasksTab() {
  const {
    isLoading,
    fetchTasks,
    createTask,
    completeTask,
    getOpenTasks,
    getOverdueTasks,
    getTodayTasks,
    getUpcomingTasks,
  } = useTasksStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all');

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleCompleteTask = async (id: string) => {
    await completeTask(id);
  };

  const handleCreateTask = async (data: { title: string; dueAt?: number; priority: TaskPriority }) => {
    // Note: Tasks require an application ID. For standalone tasks, we'd need a default or selection.
    // For now, we'll pass an empty string and let the API handle it.
    const task = await createTask({
      ...data,
      applicationId: '', // Would be selected in full implementation
    });
    if (task) {
      setShowAddForm(false);
    }
  };

  const openTasks = getOpenTasks();
  const overdueTasks = getOverdueTasks();
  const todayTasks = getTodayTasks();
  const upcomingTasks = getUpcomingTasks();

  const filteredTasks = (() => {
    switch (filter) {
      case 'overdue':
        return overdueTasks;
      case 'today':
        return todayTasks;
      case 'upcoming':
        return upcomingTasks;
      default:
        return openTasks;
    }
  })();

  // Sort by due date (overdue first, then soonest)
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return a.dueAt - b.dueAt;
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          <p className="text-sm text-neutral-500">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header with Add Button */}
      <div className="border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-900">
            {openTasks.length} open task{openTasks.length !== 1 ? 's' : ''}
          </h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-600"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Task
          </button>
        </div>

        {/* Filter Pills */}
        <div className="mt-3 flex gap-1 overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={clsx(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === 'all'
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            )}
          >
            All ({openTasks.length})
          </button>
          {overdueTasks.length > 0 && (
            <button
              onClick={() => setFilter('overdue')}
              className={clsx(
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                filter === 'overdue'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              )}
            >
              Overdue ({overdueTasks.length})
            </button>
          )}
          {todayTasks.length > 0 && (
            <button
              onClick={() => setFilter('today')}
              className={clsx(
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                filter === 'today'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              )}
            >
              Today ({todayTasks.length})
            </button>
          )}
          {upcomingTasks.length > 0 && (
            <button
              onClick={() => setFilter('upcoming')}
              className={clsx(
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                filter === 'upcoming'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              )}
            >
              Upcoming ({upcomingTasks.length})
            </button>
          )}
        </div>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto p-4">
        {sortedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <svg
                className="h-6 w-6 text-neutral-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <p className="text-sm text-neutral-500">
              {filter === 'all' ? 'No open tasks' : `No ${filter} tasks`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onComplete={() => handleCompleteTask(task.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Add Form Modal */}
      {showAddForm && (
        <QuickAddTaskForm
          onSubmit={handleCreateTask}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}
