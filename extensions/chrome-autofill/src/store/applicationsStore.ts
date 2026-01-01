/**
 * Applications Store
 *
 * Manages job applications state for the extension side panel.
 * Handles fetching, caching, and updating applications.
 */

import { create } from 'zustand';
import type { ApplicationStage, ApplicationStatus } from '~/types';
import { api } from '~/lib/api';

export interface Application {
  id: string;
  company: string;
  jobTitle: string;
  url?: string;
  location?: string;
  salary?: string;
  stage: ApplicationStage;
  status: ApplicationStatus;
  notes?: string;
  appliedAt: number;
  updatedAt?: number;
  logoUrl?: string;
  // Task summary
  openTasks?: number;
  overdueTasks?: number;
  // Interview info
  nextInterviewAt?: number;
}

interface ApplicationsState {
  // Data
  applications: Application[];
  selectedApplicationId: string | null;

  // Loading states
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;

  // Cache
  lastFetched: number | null;
}

interface ApplicationsActions {
  // Fetch applications
  fetchApplications: (forceRefresh?: boolean) => Promise<void>;

  // Select application for detail view
  selectApplication: (id: string | null) => void;

  // Update application
  updateApplication: (
    id: string,
    updates: { stage?: ApplicationStage; notes?: string; status?: ApplicationStatus }
  ) => Promise<boolean>;

  // Add a new application to the list (after saving a job)
  addApplication: (application: Application) => void;

  // Get selected application
  getSelectedApplication: () => Application | null;

  // Clear error
  clearError: () => void;

  // Reset store
  reset: () => void;
}

type ApplicationsStore = ApplicationsState & ApplicationsActions;

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

const initialState: ApplicationsState = {
  applications: [],
  selectedApplicationId: null,
  isLoading: false,
  isUpdating: false,
  error: null,
  lastFetched: null,
};

export const useApplicationsStore = create<ApplicationsStore>((set, get) => ({
  ...initialState,

  fetchApplications: async (forceRefresh = false) => {
    const { lastFetched, isLoading } = get();

    // Skip if already loading
    if (isLoading) return;

    // Use cache if fresh
    if (!forceRefresh && lastFetched && Date.now() - lastFetched < CACHE_DURATION) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await api.getRecentApplications();

      if (response.success && response.data) {
        // Transform API response to Application format
        const applications: Application[] = response.data.applications.map((app) => ({
          id: app.id,
          company: app.company,
          jobTitle: app.jobTitle,
          url: app.url,
          status: app.status as ApplicationStatus,
          stage: mapStatusToStage(app.status),
          appliedAt: app.appliedAt,
        }));

        set({
          applications,
          lastFetched: Date.now(),
          isLoading: false,
          error: null,
        });
      } else {
        set({
          isLoading: false,
          error: response.error || 'Failed to fetch applications',
        });
      }
    } catch (error) {
      console.error('[ApplicationsStore] Failed to fetch applications:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch applications',
      });
    }
  },

  selectApplication: (id: string | null) => {
    set({ selectedApplicationId: id });
  },

  updateApplication: async (id, updates) => {
    set({ isUpdating: true, error: null });

    try {
      const response = await api.updateApplication(id, updates);

      if (response.success) {
        // Update local state
        set((state) => ({
          applications: state.applications.map((app) =>
            app.id === id
              ? {
                  ...app,
                  ...updates,
                  updatedAt: Date.now(),
                }
              : app
          ),
          isUpdating: false,
        }));
        return true;
      } else {
        set({
          isUpdating: false,
          error: response.error || 'Failed to update application',
        });
        return false;
      }
    } catch (error) {
      console.error('[ApplicationsStore] Failed to update application:', error);
      set({
        isUpdating: false,
        error: error instanceof Error ? error.message : 'Failed to update application',
      });
      return false;
    }
  },

  addApplication: (application: Application) => {
    set((state) => ({
      applications: [application, ...state.applications],
    }));
  },

  getSelectedApplication: () => {
    const { applications, selectedApplicationId } = get();
    if (!selectedApplicationId) return null;
    return applications.find((app) => app.id === selectedApplicationId) || null;
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set(initialState);
  },
}));

// Helper function to map status to stage
function mapStatusToStage(status: string): ApplicationStage {
  const statusMap: Record<string, ApplicationStage> = {
    saved: 'Prospect',
    applied: 'Applied',
    interview: 'Interview',
    offer: 'Offer',
    rejected: 'Rejected',
  };
  return statusMap[status] || 'Prospect';
}

export default useApplicationsStore;
