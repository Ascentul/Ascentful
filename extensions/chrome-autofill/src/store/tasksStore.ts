/**
 * Tasks Store
 *
 * Manages tasks/follow-ups state for the extension side panel.
 * Handles fetching, creating, and completing tasks.
 */

import { create } from 'zustand';
import type { Task, TaskPriority, TaskStatus } from '~/types';
import { api } from '~/lib/api';

interface TasksState {
  // Data
  tasks: Task[];

  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  error: string | null;

  // Cache
  lastFetched: number | null;
}

interface TasksActions {
  // Fetch tasks
  fetchTasks: (forceRefresh?: boolean) => Promise<void>;

  // Create task
  createTask: (task: {
    title: string;
    description?: string;
    dueAt?: number;
    priority?: TaskPriority;
    applicationId: string;
  }) => Promise<Task | null>;

  // Complete task
  completeTask: (id: string) => Promise<boolean>;

  // Get filtered tasks
  getOpenTasks: () => Task[];
  getOverdueTasks: () => Task[];
  getTodayTasks: () => Task[];
  getUpcomingTasks: () => Task[];

  // Get task counts
  getCounts: () => {
    total: number;
    open: number;
    overdue: number;
    today: number;
    upcoming: number;
  };

  // Clear error
  clearError: () => void;

  // Reset store
  reset: () => void;
}

type TasksStore = TasksState & TasksActions;

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

const initialState: TasksState = {
  tasks: [],
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  error: null,
  lastFetched: null,
};

export const useTasksStore = create<TasksStore>((set, get) => ({
  ...initialState,

  fetchTasks: async (forceRefresh = false) => {
    const { lastFetched, isLoading } = get();

    // Skip if already loading
    if (isLoading) return;

    // Use cache if fresh
    if (!forceRefresh && lastFetched && Date.now() - lastFetched < CACHE_DURATION) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await api.getTasks();

      if (response.success && response.data) {
        set({
          tasks: response.data.tasks,
          lastFetched: Date.now(),
          isLoading: false,
          error: null,
        });
      } else {
        set({
          isLoading: false,
          error: response.error || 'Failed to fetch tasks',
        });
      }
    } catch (error) {
      console.error('[TasksStore] Failed to fetch tasks:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tasks',
      });
    }
  },

  createTask: async (taskData) => {
    set({ isCreating: true, error: null });

    try {
      const response = await api.createTask(taskData);

      if (response.success && response.data) {
        const newTask: Task = {
          id: response.data.taskId,
          title: taskData.title,
          description: taskData.description,
          dueAt: taskData.dueAt || null,
          priority: taskData.priority || 'medium',
          status: 'open',
          applicationId: taskData.applicationId,
          createdAt: Date.now(),
        };

        set((state) => ({
          tasks: [newTask, ...state.tasks],
          isCreating: false,
        }));

        return newTask;
      } else {
        set({
          isCreating: false,
          error: response.error || 'Failed to create task',
        });
        return null;
      }
    } catch (error) {
      console.error('[TasksStore] Failed to create task:', error);
      set({
        isCreating: false,
        error: error instanceof Error ? error.message : 'Failed to create task',
      });
      return null;
    }
  },

  completeTask: async (id: string) => {
    set({ isUpdating: true, error: null });

    try {
      const response = await api.completeTask(id);

      if (response.success) {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? { ...task, status: 'done' as TaskStatus, completedAt: Date.now() }
              : task
          ),
          isUpdating: false,
        }));
        return true;
      } else {
        set({
          isUpdating: false,
          error: response.error || 'Failed to complete task',
        });
        return false;
      }
    } catch (error) {
      console.error('[TasksStore] Failed to complete task:', error);
      set({
        isUpdating: false,
        error: error instanceof Error ? error.message : 'Failed to complete task',
      });
      return false;
    }
  },

  getOpenTasks: () => {
    const { tasks } = get();
    return tasks.filter((t) => t.status === 'open');
  },

  getOverdueTasks: () => {
    const { tasks } = get();
    const now = Date.now();
    return tasks.filter((t) => t.status === 'open' && t.dueAt && t.dueAt < now);
  },

  getTodayTasks: () => {
    const { tasks } = get();
    const now = Date.now();
    const todayEnd = new Date().setHours(23, 59, 59, 999);
    return tasks.filter(
      (t) => t.status === 'open' && t.dueAt && t.dueAt >= now && t.dueAt <= todayEnd
    );
  },

  getUpcomingTasks: () => {
    const { tasks } = get();
    const todayEnd = new Date().setHours(23, 59, 59, 999);
    return tasks.filter((t) => t.status === 'open' && t.dueAt && t.dueAt > todayEnd);
  },

  getCounts: () => {
    const { tasks } = get();
    const now = Date.now();
    const todayEnd = new Date().setHours(23, 59, 59, 999);

    const open = tasks.filter((t) => t.status === 'open');
    const overdue = open.filter((t) => t.dueAt && t.dueAt < now);
    const today = open.filter((t) => t.dueAt && t.dueAt >= now && t.dueAt <= todayEnd);
    const upcoming = open.filter((t) => t.dueAt && t.dueAt > todayEnd);

    return {
      total: tasks.length,
      open: open.length,
      overdue: overdue.length,
      today: today.length,
      upcoming: upcoming.length,
    };
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set(initialState);
  },
}));

export default useTasksStore;
