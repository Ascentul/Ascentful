/**
 * Ascentul API Client
 *
 * Handles communication with the Ascentul backend API.
 */

import type {
  ExtensionProfile,
  JobApplication,
  CreateApplicationRequest,
  SaveJobRequest,
  ApplicationStage,
  Task,
  Contact,
  ApplicationStats,
  TaskPriority,
} from '~/types';
import { storage } from './storage';

const APP_URL = process.env.PLASMO_PUBLIC_APP_URL || 'https://app.ascentful.io';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Get the current auth token from storage
 */
async function getAuthToken(): Promise<string | null> {
  const auth = await storage.getAuth();
  if (!auth?.token) return null;

  // Check if token is expired or expiring soon
  // Refresh 5 minutes before expiry to avoid edge cases where server rejects expired token
  const REFRESH_BUFFER_MS = 5 * 60 * 1000;
  if (auth.expiresAt && Date.now() > auth.expiresAt - REFRESH_BUFFER_MS) {
    // Try to refresh
    try {
      const refreshed = await refreshToken(auth.token);
      if (refreshed) {
        await storage.setAuth({
          ...auth,
          token: refreshed.token,
          expiresAt: refreshed.expiresAt,
        });
        return refreshed.token;
      } else {
        // Refresh returned null (e.g., 401) - clear expired auth
        await storage.clearAuth();
        return null;
      }
    } catch {
      // Token refresh failed, clear auth
      await storage.clearAuth();
      return null;
    }
  }

  return auth.token;
}

/**
 * Make an authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = await getAuthToken();

  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${APP_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Request failed with status ${response.status}`,
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error(`[Ascentful] API request failed for ${endpoint}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Refresh the auth token
 */
async function refreshToken(
  currentToken: string,
): Promise<{ token: string; expiresAt: number } | null> {
  try {
    const response = await fetch(`${APP_URL}/api/extension/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

/**
 * API client for Ascentul backend
 */
export const api = {
  /**
   * Fetch user profile for autofill
   */
  async getProfile(): Promise<ApiResponse<{ profile: ExtensionProfile }>> {
    return apiRequest<{ profile: ExtensionProfile }>('/api/extension/profile');
  },

  /**
   * Create a new job application
   */
  async createApplication(
    application: CreateApplicationRequest,
  ): Promise<ApiResponse<{ success: boolean; applicationId: string }>> {
    return apiRequest<{ success: boolean; applicationId: string }>(
      '/api/extension/applications',
      {
        method: 'POST',
        body: JSON.stringify(application),
      },
    );
  },

  /**
   * Get recent applications
   */
  async getRecentApplications(): Promise<
    ApiResponse<{
      applications: Array<{
        id: string;
        company: string;
        jobTitle: string;
        status: string;
        url?: string;
        appliedAt: number;
      }>;
    }>
  > {
    return apiRequest('/api/extension/applications');
  },

  /**
   * Sync profile from backend and update local cache
   */
  async syncProfile(): Promise<ExtensionProfile | null> {
    const result = await this.getProfile();

    if (result.success && result.data?.profile) {
      await storage.setProfile(result.data.profile);
      return result.data.profile;
    }

    return null;
  },

  /**
   * Log an application and handle offline queue
   */
  async logApplication(
    application: CreateApplicationRequest,
  ): Promise<{ success: boolean; applicationId?: string; queued?: boolean }> {
    const result = await this.createApplication(application);

    if (result.success && result.data) {
      // Add to recent applications cache
      await storage.addRecentApplication({
        id: result.data.applicationId,
        company: application.company,
        jobTitle: application.jobTitle,
        url: application.url,
        source: application.source || 'extension_autofill',
        atsPlatform: application.atsPlatform || 'unknown',
        status: 'applied',
        appliedAt: Date.now(),
      });

      return { success: true, applicationId: result.data.applicationId };
    }

    // If offline or request failed, queue for later
    if (result.error === 'Network error' || result.error?.includes('fetch')) {
      await storage.addPendingApplication({
        company: application.company,
        jobTitle: application.jobTitle,
        url: application.url,
        atsPlatform: application.atsPlatform,
      });
      return { success: true, queued: true };
    }

    return { success: false };
  },

  /**
   * Sync pending applications (call when online)
   */
  async syncPendingApplications(): Promise<void> {
    const pending = await storage.getPendingApplications();

    for (const app of pending) {
      try {
        const result = await this.createApplication({
          company: app.company,
          jobTitle: app.jobTitle,
          url: app.url,
          atsPlatform: app.atsPlatform as any,
          source: 'extension_autofill',
        });

        if (result.success) {
          await storage.removePendingApplication(app.id);
        } else {
          // Increment retry count
          if (app.retryCount >= 5) {
            // Give up after 5 retries
            await storage.removePendingApplication(app.id);
          } else {
            await storage.updatePendingApplication(app.id, {
              retryCount: app.retryCount + 1,
            });
          }
        }
      } catch {
        // Will retry later
      }
    }
  },

  // ============================================
  // Job Saving (Huntr-like functionality)
  // ============================================

  /**
   * Save a job without applying (creates application with Prospect stage)
   */
  async saveJob(
    job: SaveJobRequest,
  ): Promise<ApiResponse<{ applicationId: string }>> {
    return apiRequest<{ applicationId: string }>(
      '/api/extension/applications/save-job',
      {
        method: 'POST',
        body: JSON.stringify(job),
      },
    );
  },

  /**
   * Update an application (stage, notes, etc.)
   */
  async updateApplication(
    id: string,
    updates: { stage?: ApplicationStage; notes?: string },
  ): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>(
      `/api/extension/applications/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      },
    );
  },

  // ============================================
  // Tasks
  // ============================================

  /**
   * Get user's tasks
   */
  async getTasks(): Promise<ApiResponse<{ tasks: Task[] }>> {
    return apiRequest<{ tasks: Task[] }>('/api/extension/tasks');
  },

  /**
   * Create a new task
   */
  async createTask(task: {
    title: string;
    description?: string;
    dueAt?: number;
    priority?: TaskPriority;
    applicationId: string;
  }): Promise<ApiResponse<{ success: boolean; taskId: string }>> {
    return apiRequest<{ success: boolean; taskId: string }>('/api/extension/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  },

  /**
   * Mark a task as complete
   */
  async completeTask(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>(
      `/api/extension/tasks/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
      },
    );
  },

  // ============================================
  // Contacts
  // ============================================

  /**
   * Get user's contacts
   */
  async getContacts(): Promise<ApiResponse<{ contacts: Contact[] }>> {
    return apiRequest<{ contacts: Contact[] }>('/api/extension/contacts');
  },

  /**
   * Create a new contact
   */
  async createContact(contact: {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    position?: string;
    linkedinUrl?: string;
    notes?: string;
    relationship?: string;
  }): Promise<ApiResponse<{ success: boolean; contact: Contact | null }>> {
    return apiRequest<{ success: boolean; contact: Contact | null }>('/api/extension/contacts', {
      method: 'POST',
      body: JSON.stringify(contact),
    });
  },

  // ============================================
  // Stats / Analytics
  // ============================================

  /**
   * Get application stats summary
   */
  async getStats(): Promise<ApplicationStats> {
    interface StatsResponse {
      applications: {
        saved: number;
        applied: number;
        interview: number;
        offer: number;
        rejected: number;
        total: number;
      };
      activity: {
        applicationsThisWeek: number;
        activeThisWeek: number;
        upcomingInterviews: number;
        openTasks: number;
        overdueTasks: number;
        responseRate: number;
      };
      streak: {
        currentStreak: number;
        longestStreak: number;
        totalActiveDays: number;
      };
    }

    const result = await apiRequest<StatsResponse>('/api/extension/stats/summary');
    if (result.success && result.data) {
      const { applications, activity, streak } = result.data;
      return {
        totalApplications: applications.total,
        byStage: {
          Prospect: applications.saved,
          Applied: applications.applied,
          Interview: applications.interview,
          Offer: applications.offer,
          Accepted: 0, // Not tracked separately
          Rejected: applications.rejected,
          Withdrawn: 0, // Not tracked separately
          Archived: 0, // Not tracked separately
        },
        thisWeek: activity.applicationsThisWeek,
        thisMonth: 0, // Could be added to API if needed
        interviews: activity.upcomingInterviews,
        interviewsScheduled: activity.upcomingInterviews,
        offersReceived: applications.offer,
        responseRate: activity.responseRate,
        streak: streak.currentStreak,
      };
    }
    // Return empty stats on failure
    return {
      totalApplications: 0,
      byStage: {
        Prospect: 0,
        Applied: 0,
        Interview: 0,
        Offer: 0,
        Accepted: 0,
        Rejected: 0,
        Withdrawn: 0,
        Archived: 0,
      },
      thisWeek: 0,
      thisMonth: 0,
      interviews: 0,
      interviewsScheduled: 0,
      offersReceived: 0,
      responseRate: 0,
      streak: 0,
    };
  },
};

export default api;
