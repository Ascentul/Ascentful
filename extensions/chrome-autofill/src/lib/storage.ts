/**
 * Chrome Storage Wrapper
 *
 * Provides a typed interface for chrome.storage API with
 * support for both local and session storage.
 */

import type {
  AuthState,
  ExtensionProfile,
  ExtensionSettings,
  JobApplication,
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
} from '~/types';

// Re-export storage keys and defaults
export { STORAGE_KEYS, DEFAULT_SETTINGS, PROFILE_CACHE_DURATION } from '~/types';

/**
 * Get a value from chrome.storage.local
 */
export async function getLocal<T>(key: string): Promise<T | null> {
  try {
    const result = await chrome.storage.local.get(key);
    return (result[key] as T) || null;
  } catch (error) {
    console.error(`[Ascentul] Storage get error for ${key}:`, error);
    return null;
  }
}

/**
 * Set a value in chrome.storage.local
 */
export async function setLocal<T>(key: string, value: T): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (error) {
    console.error(`[Ascentul] Storage set error for ${key}:`, error);
    throw error;
  }
}

/**
 * Remove a value from chrome.storage.local
 */
export async function removeLocal(key: string): Promise<void> {
  try {
    await chrome.storage.local.remove(key);
  } catch (error) {
    console.error(`[Ascentul] Storage remove error for ${key}:`, error);
    throw error;
  }
}

/**
 * Get a value from chrome.storage.session (encrypted, cleared on browser close)
 */
export async function getSession<T>(key: string): Promise<T | null> {
  try {
    const result = await chrome.storage.session.get(key);
    return (result[key] as T) || null;
  } catch (error) {
    console.error(`[Ascentul] Session storage get error for ${key}:`, error);
    return null;
  }
}

/**
 * Set a value in chrome.storage.session
 */
export async function setSession<T>(key: string, value: T): Promise<void> {
  try {
    await chrome.storage.session.set({ [key]: value });
  } catch (error) {
    console.error(`[Ascentul] Session storage set error for ${key}:`, error);
    throw error;
  }
}

/**
 * Remove a value from chrome.storage.session
 */
export async function removeSession(key: string): Promise<void> {
  try {
    await chrome.storage.session.remove(key);
  } catch (error) {
    console.error(`[Ascentul] Session storage remove error for ${key}:`, error);
    throw error;
  }
}

/**
 * Storage API with typed methods for common operations
 */
export const storage = {
  // ============================================
  // AUTH (Session Storage - encrypted)
  // ============================================

  async getAuth(): Promise<AuthState | null> {
    return getSession<AuthState>('ascentul_auth');
  },

  async setAuth(auth: AuthState): Promise<void> {
    await setSession('ascentul_auth', auth);
  },

  async clearAuth(): Promise<void> {
    await removeSession('ascentul_auth');
  },

  // ============================================
  // PROFILE (Local Storage - persisted)
  // ============================================

  async getProfile(): Promise<ExtensionProfile | null> {
    return getLocal<ExtensionProfile>('ascentul_profile');
  },

  async setProfile(profile: ExtensionProfile): Promise<void> {
    await setLocal('ascentul_profile', profile);
    await setLocal('ascentul_profile_cache_time', Date.now());
  },

  async getProfileCacheTime(): Promise<number | null> {
    return getLocal<number>('ascentul_profile_cache_time');
  },

  async isProfileStale(maxAge: number = 60 * 60 * 1000): Promise<boolean> {
    const cacheTime = await this.getProfileCacheTime();
    if (!cacheTime) return true;
    return Date.now() - cacheTime > maxAge;
  },

  async clearProfile(): Promise<void> {
    await removeLocal('ascentul_profile');
    await removeLocal('ascentul_profile_cache_time');
  },

  // ============================================
  // SETTINGS (Local Storage - persisted)
  // ============================================

  async getSettings(): Promise<ExtensionSettings> {
    const settings = await getLocal<ExtensionSettings>('ascentul_settings');
    return { ...DEFAULT_SETTINGS, ...settings };
  },

  async setSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    const current = await this.getSettings();
    await setLocal('ascentul_settings', { ...current, ...settings });
  },

  // ============================================
  // SELECTED RESUME
  // ============================================

  async getSelectedResumeId(): Promise<string | null> {
    return getLocal<string>('ascentul_selected_resume');
  },

  async setSelectedResumeId(resumeId: string): Promise<void> {
    await setLocal('ascentul_selected_resume', resumeId);
  },

  // ============================================
  // RECENT APPLICATIONS (Local Storage - cache)
  // ============================================

  async getRecentApplications(): Promise<JobApplication[]> {
    const apps = await getLocal<JobApplication[]>('ascentul_recent_apps');
    return apps || [];
  },

  async addRecentApplication(app: JobApplication): Promise<void> {
    const apps = await this.getRecentApplications();
    // Add to front, keep only 20 most recent
    const updated = [app, ...apps.filter((a) => a.id !== app.id)].slice(0, 20);
    await setLocal('ascentul_recent_apps', updated);
  },

  // ============================================
  // PENDING APPLICATIONS (Offline Queue)
  // ============================================

  async getPendingApplications(): Promise<PendingApplication[]> {
    const apps = await getLocal<PendingApplication[]>('ascentul_pending_apps');
    return apps || [];
  },

  async addPendingApplication(app: Omit<PendingApplication, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    const pending: PendingApplication = {
      ...app,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0,
    };

    const queue = await this.getPendingApplications();
    queue.push(pending);
    await setLocal('ascentul_pending_apps', queue);

    return pending.id;
  },

  async removePendingApplication(id: string): Promise<void> {
    const queue = await this.getPendingApplications();
    const updated = queue.filter((a) => a.id !== id);
    await setLocal('ascentul_pending_apps', updated);
  },

  async updatePendingApplication(id: string, updates: Partial<PendingApplication>): Promise<void> {
    const queue = await this.getPendingApplications();
    const index = queue.findIndex((a) => a.id === id);
    if (index !== -1) {
      queue[index] = { ...queue[index], ...updates };
      await setLocal('ascentul_pending_apps', queue);
    }
  },

  // ============================================
  // CLEAR ALL
  // ============================================

  async clearAll(): Promise<void> {
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
  },
};

/**
 * Pending application for offline queue
 */
export interface PendingApplication {
  id: string;
  company: string;
  jobTitle: string;
  url?: string;
  atsPlatform?: string;
  timestamp: number;
  retryCount: number;
}

export default storage;
